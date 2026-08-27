export type BrowserFile = Pick<File, "name" | "size" | "text" | "arrayBuffer"> & { webkitRelativePath?: string };

export interface BrowserReport {
  schema_version: 2;
  generated_by: "browser-spot-check";
  totals: { notebooks: number; notes: number; attachments: number; attachment_bytes: number };
  attachment_types: Record<string, number>;
  links: { external: number; internal: number; local_file: number };
  risks: Array<{ code: string; label: string; count: number }>;
  notes: Array<{ key: string; name: string; path: string; fingerprint: string }>;
  attachments: Array<{ key: string; name: string; path: string; bytes: number; fingerprint: string }>;
}

const noteExtensions = new Set(["md", "markdown", "html", "htm", "txt", "rtf", "json", "enex"]);
const ignoredNames = new Set([".ds_store", "thumbs.db"]);

export async function inspectFiles(files: BrowserFile[]): Promise<BrowserReport> {
  const notebooks = new Set<string>();
  const notes: BrowserReport["notes"] = [];
  const attachments: BrowserReport["attachments"] = [];
  const attachmentTypes: Record<string, number> = {};
  const riskCounts = new Map<string, { label: string; count: number }>();
  const links = { external: 0, internal: 0, local_file: 0 };

  for (const file of files) {
    const path = file.webkitRelativePath || file.name;
    const name = path.split("/").at(-1) || file.name;
    if (ignoredNames.has(name.toLowerCase()) || name.startsWith(".")) continue;
    const ext = extension(name);
    if (noteExtensions.has(ext)) {
      const segments = path.split("/");
      notebooks.add(segments.length > 2 ? segments[1] : "Unfiled");
      notes.push({
        key: normalizeKey(name.replace(/\.[^.]+$/, "")),
        name,
        path,
        fingerprint: await fingerprint(file)
      });
      if (file.size <= 5 * 1024 * 1024) {
        const text = await file.text();
        countMatches(text, /https?:\/\//gi, (count) => (links.external += count));
        countMatches(text, /(?:\[\[[^\]]+\]\]|href=["'](?!https?:|file:|#)|\[[^\]]*\]\((?!https?:|file:|#))/gi, (count) => (links.internal += count));
        countMatches(text, /file:/gi, (count) => (links.local_file += count));
        watch(text, /<table|^\s*\|.+\|/im, "table", "Tables may change layout", riskCounts);
        watch(text, /- \[[ x]\]|type=["']checkbox/i, "task", "Tasks may flatten", riskCounts);
        watch(text, /\[\[.+?\]\]/s, "wiki-link", "Wiki links need target resolution", riskCounts);
        watch(text, /<iframe|!\[\[/i, "embed", "Embeds may not survive", riskCounts);
        watch(text, /data:/i, "data-url", "Inline data may be dropped", riskCounts);
        watch(text, /```|<pre/i, "code", "Code formatting may change", riskCounts);
      } else {
        increment("large-note", "Notes over 5 MB need the CLI", riskCounts);
      }
    } else {
      const type = typeFor(ext);
      attachmentTypes[type] = (attachmentTypes[type] || 0) + 1;
      attachments.push({ key: normalizeKey(name), name, path, bytes: file.size, fingerprint: await fingerprint(file) });
      if (file.size > 25 * 1024 * 1024) increment("large-attachment", "Large attachments can exhaust importers", riskCounts);
      if (["m4a", "mp3", "wav", "aac"].includes(ext)) increment("audio", "Audio recordings are often unsupported", riskCounts);
      if (["mov", "mp4", "mkv", "avi"].includes(ext)) increment("video", "Video attachments may not be preserved", riskCounts);
    }
  }

  return {
    schema_version: 2,
    generated_by: "browser-spot-check",
    totals: {
      notebooks: notebooks.size,
      notes: notes.length,
      attachments: attachments.length,
      attachment_bytes: attachments.reduce((sum, file) => sum + file.bytes, 0)
    },
    attachment_types: attachmentTypes,
    links,
    risks: [...riskCounts.entries()].map(([code, value]) => ({ code, ...value })),
    notes,
    attachments
  };
}

export function compareBrowserReports(source: BrowserReport, destination: BrowserReport) {
  const unmatchedDestinationNotes = new Set(destination.notes.map((_, index) => index));
  const unmatchedSourceNotes: number[] = [];
  source.notes.forEach((note, sourceIndex) => {
    const destinationIndex = [...unmatchedDestinationNotes].find((index) => destination.notes[index].fingerprint === note.fingerprint);
    if (destinationIndex === undefined) unmatchedSourceNotes.push(sourceIndex);
    else unmatchedDestinationNotes.delete(destinationIndex);
  });
  const duplicateNotes = duplicateKeys(source.notes.map((note) => note.key));
  const missingNotes: string[] = [];
  const changedNotes: string[] = [];
  for (const sourceIndex of unmatchedSourceNotes) {
    const note = source.notes[sourceIndex];
    const destinationIndex = [...unmatchedDestinationNotes].find((index) => destination.notes[index].key === note.key);
    if (destinationIndex === undefined) missingNotes.push(entryLabel(note.name, note.path, duplicateNotes.has(note.key)));
    else {
      unmatchedDestinationNotes.delete(destinationIndex);
      changedNotes.push(entryLabel(note.name, note.path, duplicateNotes.has(note.key)));
    }
  }

  const remainingAttachmentFingerprints = countFingerprints(destination.attachments);
  const duplicateAttachments = duplicateKeys(source.attachments.map((file) => file.key));
  const missingAttachments: string[] = [];
  for (const file of source.attachments) {
    const count = remainingAttachmentFingerprints.get(file.fingerprint) || 0;
    if (count) remainingAttachmentFingerprints.set(file.fingerprint, count - 1);
    else missingAttachments.push(entryLabel(file.name, file.path, duplicateAttachments.has(file.key)));
  }
  return {
    missingNotes,
    changedNotes,
    missingAttachments
  };
}

async function fingerprint(file: BrowserFile) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function countFingerprints(files: BrowserReport["attachments"]) {
  const counts = new Map<string, number>();
  for (const file of files) counts.set(file.fingerprint, (counts.get(file.fingerprint) || 0) + 1);
  return counts;
}
function duplicateKeys(keys: string[]) {
  const counts = new Map<string, number>();
  for (const key of keys) counts.set(key, (counts.get(key) || 0) + 1);
  return new Set([...counts].filter(([, count]) => count > 1).map(([key]) => key));
}
function entryLabel(name: string, path: string, hasCollision: boolean) { return hasCollision ? `${name} [${path}]` : name; }

function extension(name: string) { return name.includes(".") ? name.split(".").at(-1)!.toLowerCase() : ""; }
function normalizeKey(value: string) { return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim(); }
function typeFor(ext: string) {
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "image";
  if (["m4a", "mp3", "wav", "aac"].includes(ext)) return "audio";
  if (["mov", "mp4", "mkv", "avi"].includes(ext)) return "video";
  if (ext === "pdf") return "pdf";
  return ext || "other";
}
function countMatches(text: string, pattern: RegExp, receive: (count: number) => void) { receive([...text.matchAll(pattern)].length); }
function watch(text: string, pattern: RegExp, code: string, label: string, map: Map<string, { label: string; count: number }>) { if (pattern.test(text)) increment(code, label, map); }
function increment(code: string, label: string, map: Map<string, { label: string; count: number }>) { const current = map.get(code); map.set(code, { label, count: (current?.count || 0) + 1 }); }

export type BrowserFile = Pick<File, "name" | "size" | "text"> & { webkitRelativePath?: string };

export interface BrowserReport {
  schema_version: 1;
  generated_by: "browser-spot-check";
  totals: { notebooks: number; notes: number; attachments: number; attachment_bytes: number };
  attachment_types: Record<string, number>;
  links: { external: number; internal: number; local_file: number };
  risks: Array<{ code: string; label: string; count: number }>;
  notes: Array<{ key: string; name: string }>;
  attachments: Array<{ key: string; name: string; bytes: number }>;
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
      notes.push({ key: normalizeKey(name.replace(/\.[^.]+$/, "")), name });
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
      attachments.push({ key: normalizeKey(name), name, bytes: file.size });
      if (file.size > 25 * 1024 * 1024) increment("large-attachment", "Large attachments can exhaust importers", riskCounts);
      if (["m4a", "mp3", "wav", "aac"].includes(ext)) increment("audio", "Audio recordings are often unsupported", riskCounts);
      if (["mov", "mp4", "mkv", "avi"].includes(ext)) increment("video", "Video attachments may not be preserved", riskCounts);
    }
  }

  return {
    schema_version: 1,
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
  const destinationNotes = new Set(destination.notes.map((note) => note.key));
  const destinationAttachments = new Set(destination.attachments.map((file) => `${file.key}:${file.bytes}`));
  return {
    missingNotes: source.notes.filter((note) => !destinationNotes.has(note.key)).map((note) => note.name),
    missingAttachments: source.attachments.filter((file) => !destinationAttachments.has(`${file.key}:${file.bytes}`)).map((file) => file.name)
  };
}

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


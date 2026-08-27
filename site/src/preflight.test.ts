import { describe, expect, it } from "vitest";
import { compareBrowserReports, inspectFiles, type BrowserFile } from "./preflight";

function fake(name: string, text: string, path = name): BrowserFile {
  return { name, size: new TextEncoder().encode(text).length, webkitRelativePath: path, text: async () => text };
}

describe("browser spot check", () => {
  it("inventories notes, attachments, links, and risks", async () => {
    const report = await inspectFiles([
      fake("move.md", "# Move\n- [ ] task\n[site](https://example.com)", "Export/Work/move.md"),
      fake("photo.jpg", "bytes", "Export/Work/photo.jpg")
    ]);
    expect(report.totals).toMatchObject({ notebooks: 1, notes: 1, attachments: 1 });
    expect(report.links.external).toBe(1);
    expect(report.risks.some((risk) => risk.code === "task")).toBe(true);
  });

  it("finds missing notes and attachments", async () => {
    const source = await inspectFiles([fake("one.md", "one"), fake("voice.m4a", "voice")]);
    const destination = await inspectFiles([]);
    const comparison = compareBrowserReports(source, destination);
    expect(comparison.missingNotes).toEqual(["one.md"]);
    expect(comparison.missingAttachments).toEqual(["voice.m4a"]);
  });
});


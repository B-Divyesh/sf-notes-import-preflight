import type { BrowserFile } from "./preflight";

const SAMPLE_FILES: Array<[string, string]> = [
  ["Sample/Work/Project Atlas.md", "---\ncreated: 2024-02-18\nupdated: 2026-08-12\ntags: migration, work\n---\n# Project Atlas handoff\n- [x] Confirm the contract owner\n- [ ] Move the signed notes\nSee [[Decision log]] and [the project site](https://example.com/atlas).\n"],
  ["Sample/Work/Decision log.md", "# Decision log\n| Date | Decision |\n| --- | --- |\n| 2026-08-02 | Keep the recordings |\n```text\nMigration window: Saturday\n```\n"],
  ["Sample/Personal/Travel plan.html", "<!doctype html><html><head><title>Lisbon train plan</title></head><body><a href=\"https://www.cp.pt/\">Check the timetable</a>.</body></html>"],
  ["Sample/Personal/Voice memo.txt", "Interview notes from 14 August. The original recording is attached."],
  ["Sample/Reference/Recipe.md", "# Cardamom buns\nBake at 220 C for eight minutes."],
  ["Sample/Work/receipt.jpg", "sample-receipt-image-bytes"],
  ["Sample/Work/interview.m4a", "sample-interview-audio-bytes"],
  ["Sample/Reference/menu.pdf", "sample-menu-pdf-bytes"]
];

export function sampleBrowserFiles(): BrowserFile[] {
  return SAMPLE_FILES.map(([path, contents]) => file(path, contents));
}

function file(path: string, contents: string): BrowserFile {
  const bytes = new TextEncoder().encode(contents);
  return {
    name: path.split("/").at(-1) || path,
    size: bytes.length,
    webkitRelativePath: path,
    text: async () => contents,
    arrayBuffer: async () => bytes.slice().buffer as ArrayBuffer
  };
}

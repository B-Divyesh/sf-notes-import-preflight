import { expect, test } from "@playwright/test";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";

const binary = resolve("target/debug/notes-preflight");
const sample = resolve("crates/preflight/examples/sample-export");
const sampleZip = resolve("tests/fixtures/archives/sample-export.zip");
const unsafeZip = resolve("tests/fixtures/archives/unsafe-path.zip");

function temporary(prefix: string) { return mkdtempSync(join(tmpdir(), prefix)); }
function run(args: string[], env: NodeJS.ProcessEnv = process.env) {
  return spawnSync(binary, args, { encoding: "utf8", env, maxBuffer: 10 * 1024 * 1024 });
}
function json(args: string[]) {
  const result = run(args);
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout);
}
function hash(path: string) { return createHash("sha256").update(readFileSync(path)).digest("hex"); }

test("the CLI demo uses bundled sample data in a new temporary directory @claim:demo-sandbox", () => {
  const result = run(["demo"]);
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toContain("5 notes / 3 attachments");
  expect(result.stdout).toContain("Missing attachments (1)");
  const output = result.stdout.match(/Sample files and JSON reports: (.+)/)?.[1].trim();
  expect(output).toMatch(/^\/tmp\/notes-preflight-demo-/);
  expect(existsSync(join(output!, "source-report.json"))).toBe(true);
  expect(existsSync(join(output!, "comparison-report.json"))).toBe(true);
  rmSync(output!, { recursive: true });
});

test("the public Git install command produces a working consumer binary @claim:install-git", () => {
  test.setTimeout(240_000);
  const root = temporary("preflight-install-");
  const cargoHome = temporary("preflight-cargo-home-");
  const result = spawnSync("cargo", ["install", "--git", "https://github.com/B-Divyesh/sf-notes-import-preflight.git", "--locked", "--root", root], {
    encoding: "utf8", env: { ...process.env, CARGO_HOME: cargoHome }, maxBuffer: 20 * 1024 * 1024
  });
  expect(result.status, result.stderr).toBe(0);
  const help = execFileSync(join(root, "bin/notes-preflight"), ["--help"], { encoding: "utf8" });
  expect(help).toContain("Usage: notes-preflight <COMMAND>");
  expect(help).toContain("scan");
  expect(help).toContain("compare");
  expect(readFileSync(resolve("LICENSE"), "utf8")).toContain("MIT License");
  rmSync(root, { recursive: true });
  rmSync(cargoHome, { recursive: true });
});

test("CLI scans do not modify selected source files @claim:cli-read-only", () => {
  const root = temporary("preflight-read-only-");
  cpSync(sample, root, { recursive: true });
  const note = join(root, "Work/Project Atlas.md");
  const before = { hash: hash(note), modified: statSync(note).mtimeMs };
  const result = run(["scan", root, "--json"]);
  expect(result.status, result.stderr).toBe(0);
  expect({ hash: hash(note), modified: statSync(note).mtimeMs }).toEqual(before);
  rmSync(root, { recursive: true });
});

test("browser demo sends no sample names, contents, or results off origin @claim:browser-private", async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto(`${baseURL}/demo/`);
  await expect(page.locator("#manifest-state")).toHaveText("Complete");
  await page.locator("#reset-demo").click();
  await expect(page.locator("#metric-notes")).toHaveText("5");
  expect(requests.every((url) => new URL(url).origin === new URL(baseURL!).origin)).toBe(true);
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });
  await context.close();
});

test("the site starts without tracking storage or third-party requests @claim:no-tracking", async ({ page, baseURL }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  expect(requests.every((url) => new URL(url).origin === new URL(baseURL!).origin)).toBe(true);
  expect(await page.context().cookies()).toEqual([]);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});

test("reports notebook, note, attachment, byte counts, and downloadable browser JSON @claim:inventory-counts", async ({ page }) => {
  const report = json(["scan", sample, "--json"]);
  expect(report.totals).toEqual({ notebooks: 3, notes: 5, attachments: 3, attachment_bytes: 78 });
  await page.goto("/demo/");
  await expect(page.locator("#metric-notebooks")).toHaveText("3");
  await expect(page.locator("#metric-notes")).toHaveText("5");
  await expect(page.locator("#metric-attachments")).toHaveText("3");
  const download = await Promise.all([page.waitForEvent("download"), page.locator("#download-report").click()]).then(([value]) => value);
  expect(download.suggestedFilename()).toBe("notes-preflight-browser-report.json");
});

test("reports link targets, metadata coverage, and conversion risks @claim:risk-link-metadata", () => {
  const report = json(["scan", sample, "--json"]);
  expect(report.links.external).toBe(2);
  expect(report.metadata).toMatchObject({ notes_with_created: 1, notes_with_updated: 1, notes_with_tags: 1 });
  expect(report.risks.map((risk: { code: string }) => risk.code)).toEqual(expect.arrayContaining(["audio", "code", "table", "task", "wiki-link"]));
});

test("scans the same sample from a directory and ZIP archive @claim:directory-zip", () => {
  const directory = json(["scan", sample, "--json"]);
  const archive = json(["scan", sampleZip, "--json"]);
  expect(archive.source_kind).toBe("zip");
  expect(archive.totals).toEqual(directory.totals);
});

test("recognizes Markdown, HTML, text, RTF, ENEX, and JSON note files @claim:supported-formats", () => {
  const root = temporary("preflight-formats-");
  writeFileSync(join(root, "one.md"), "# Markdown");
  writeFileSync(join(root, "two.html"), "<title>HTML</title>");
  writeFileSync(join(root, "three.txt"), "Text note");
  writeFileSync(join(root, "four.rtf"), "{\\rtf1 RTF note}");
  writeFileSync(join(root, "five.json"), '{"title":"JSON note","body":"hello"}');
  writeFileSync(join(root, "six.enex"), "<en-export><note><title>ENEX note</title><content><![CDATA[<en-note>Hello</en-note>]]></content></note></en-export>");
  const report = json(["scan", root, "--json"]);
  expect(report.totals.notes).toBe(6);
  expect(report.notes.map((note: { format: string }) => note.format)).toEqual(expect.arrayContaining(["md", "html", "txt", "rtf", "json", "enex"]));
  rmSync(root, { recursive: true });
});

test("rejects unsafe paths and configured archive boundaries without extraction @claim:archive-bounds", () => {
  const unsafe = run(["scan", unsafeZip]);
  expect(unsafe.status).toBe(1);
  expect(unsafe.stderr).toContain("unsafe ZIP path rejected");
  const bounded = run(["scan", sampleZip, "--max-entries", "1"]);
  expect(bounded.status).toBe(1);
  expect(bounded.stderr).toContain("entry limit");
});

test("writes schema 2 JSON and reads schema 1 reports @claim:schema-compat", () => {
  const root = temporary("preflight-schema-");
  const report = json(["scan", sample, "--json"]);
  expect(report.schema_version).toBe(2);
  report.schema_version = 1;
  for (const note of report.notes) delete note.path;
  for (const attachment of report.attachments) delete attachment.path;
  const oldReport = join(root, "schema-1.json");
  writeFileSync(oldReport, JSON.stringify(report));
  const loaded = json(["scan", oldReport, "--json"]);
  expect(loaded.schema_version).toBe(1);
  expect(loaded.totals.notes).toBe(5);
  rmSync(root, { recursive: true });
});

test("saved reports omit note bodies and attachment bytes @claim:report-redaction", () => {
  const root = temporary("preflight-redaction-");
  mkdirSync(root, { recursive: true });
  const secretBody = "private-body-7c881";
  const secretAttachment = "private-attachment-91ad";
  writeFileSync(join(root, "note.md"), `# Private title\n${secretBody}`);
  writeFileSync(join(root, "photo.jpg"), secretAttachment);
  const result = run(["scan", root, "--json"]);
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).not.toContain(secretBody);
  expect(result.stdout).not.toContain(secretAttachment);
  const report = JSON.parse(result.stdout);
  expect(report.notes[0].title).toBe("Private title");
  expect(report.attachments[0].name).toBe("photo.jpg");
  rmSync(root, { recursive: true });
});

test("comparison finds missing or changed notes and missing attachments @claim:loss-comparison", () => {
  const result = run(["demo", "--json"]);
  expect(result.status, result.stderr).toBe(0);
  const report = JSON.parse(result.stdout).comparison;
  expect(report.verdict).toBe("loss-detected");
  expect(report.changed_notes).toHaveLength(1);
  expect(report.missing_attachments).toEqual(["interview.m4a"]);
  rmSync(JSON.parse(result.stdout).output_directory, { recursive: true });
});

test("duplicate titles and equal-size different attachments cannot hide loss @claim:collision-safe", () => {
  const root = temporary("preflight-collision-");
  const source = join(root, "source");
  const destination = join(root, "destination");
  for (const folder of [join(source, "A"), join(source, "B"), join(destination, "C")]) mkdirSync(folder, { recursive: true });
  writeFileSync(join(source, "A/note.md"), "# Same\nAlpha"); writeFileSync(join(source, "A/receipt.jpg"), "aaa");
  writeFileSync(join(source, "B/note.md"), "# Same\nBravo"); writeFileSync(join(source, "B/receipt.jpg"), "bbb");
  writeFileSync(join(destination, "C/note.md"), "# Same\nBravo"); writeFileSync(join(destination, "C/receipt.jpg"), "aaa");
  const result = run(["compare", source, destination, "--json", "--fail-on-loss"]);
  expect(result.status).toBe(2);
  const report = JSON.parse(result.stdout);
  expect(report.missing_notes).toEqual(["Same [A/note.md]"]);
  expect(report.missing_attachments).toEqual(["receipt.jpg [B/receipt.jpg]"]);
  rmSync(root, { recursive: true });
});

test("uses exit 0 for success, 1 for invalid input, and 2 for detected loss @claim:exit-codes", () => {
  expect(run(["scan", sample]).status).toBe(0);
  expect(run(["scan", join(tmpdir(), "missing-preflight-input")]).status).toBe(1);
  const empty = temporary("preflight-empty-");
  expect(run(["compare", sample, empty, "--fail-on-loss"]).status).toBe(2);
  rmSync(empty, { recursive: true });
});

test("reports proprietary database exports without trying to decode them @claim:unsupported-database", () => {
  const root = temporary("preflight-database-");
  writeFileSync(join(root, "NoteStore.sqlite"), "encrypted database bytes");
  const report = json(["scan", root, "--json"]);
  expect(report.totals.notes).toBe(0);
  expect(report.risks.map((risk: { code: string }) => risk.code)).toContain("proprietary-database");
  expect(report.warnings.join(" ")).toContain("does not bypass encryption");
  rmSync(root, { recursive: true });
});

test("demo reload and folder inspection work offline after the first visit @claim:offline-reload", async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${baseURL}/demo/`);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; if (!navigator.serviceWorker.controller) await new Promise((resolve) => navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true })); });
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#manifest-state")).toHaveText("Complete");
  await expect(page.locator("#metric-notes")).toHaveText("5");
  await context.close();
});

test("Preflight Plus is offered for a single $19 payment @claim:plus-price", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#plus")).toContainText("$19 once");
  await expect(page.locator("#plus")).toContainText("not a subscription");
  await expect(page.locator("#buy-plus")).toHaveAttribute("href", "https://api.sociobot.in/api/v1/products/notes-import-preflight/checkout");
});

test("a valid license enables comparison, saved baselines, printing, and setup support @claim:plus-features", async ({ page }) => {
  let verifications = 0;
  await page.route("https://pilot-api.sociobot.in/api/v1/products/notes-import-preflight/verify?*", async (route) => {
    verifications += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ valid: true, reason: "ok" }) });
  });
  await page.goto("/");
  await page.locator("#license-input").fill("test-valid-license");
  await page.locator("#license-form button").click();
  await expect(page.locator("#plus-workspace")).toBeVisible();
  const sourceFolder = temporary("preflight-plus-source-");
  writeFileSync(join(sourceFolder, "source.md"), "# Source note");
  await page.setInputFiles("#folder-input", sourceFolder);
  await expect(page.locator("#manifest-state")).toHaveText("Complete");
  await page.locator("#save-baseline").click();
  await expect(page.locator("#baseline-message")).toContainText("Saved a baseline with 1 note");
  await page.reload();
  await expect(page.locator("#plus-workspace")).toBeVisible();
  await page.locator("#load-baseline").click();
  await expect(page.locator("#metric-notes")).toHaveText("1");
  await page.evaluate(() => { window.print = () => { document.body.dataset.printed = "true"; }; });
  await page.locator("#print-audit").click();
  await expect(page.locator("body")).toHaveAttribute("data-printed", "true");
  await expect(page.locator("#support-link")).toHaveAttribute("href", /^mailto:support@sociobot\.in/);
  expect(verifications).toBe(1);
  rmSync(sourceFolder, { recursive: true });
});

test("license checks send only the token, cache daily, and lock invalid licenses @claim:license-verification", async ({ page }) => {
  const calls: Array<{ url: string; method: string; body: string | null }> = [];
  await page.route("https://pilot-api.sociobot.in/api/v1/products/notes-import-preflight/verify?*", async (route) => {
    const request = route.request();
    calls.push({ url: request.url(), method: request.method(), body: request.postData() });
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ valid: false, reason: "invalid" }) });
  });
  await page.goto("/");
  await page.locator("#license-input").fill("invalid-token-value");
  await page.locator("#license-form button").click();
  await expect(page.locator("#license-message")).toContainText("invalid token");
  await expect(page.locator("#plus-workspace")).toBeHidden();
  await page.reload();
  expect(calls).toHaveLength(1);
  const url = new URL(calls[0].url);
  expect([...url.searchParams.entries()]).toEqual([["license", "invalid-token-value"]]);
  expect(calls[0]).toMatchObject({ method: "GET", body: null });
});

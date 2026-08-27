import "./style.css";
import { compareBrowserReports, inspectFiles, type BrowserReport } from "./preflight";

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
let currentReport: BrowserReport | null = null;

const folderInput = $("#folder-input") as HTMLInputElement;
const destinationInput = $("#destination-input") as HTMLInputElement;
const manifest = $(".manifest");
const emptyState = $("#empty-state");
const errorState = $("#error-state");
const results = $("#results");
const manifestState = $("#manifest-state");

folderInput.addEventListener("change", async () => {
  const files = [...(folderInput.files || [])];
  if (!files.length) return;
  setLoading(true);
  try {
    currentReport = await inspectFiles(files);
    if (!currentReport.totals.notes && !currentReport.totals.attachments) throw new Error("No supported notes or attachments were found. Choose the top-level export folder or run the CLI for a ZIP archive.");
    renderReport(currentReport);
  } catch (error) {
    showError(error instanceof Error ? error.message : "The browser could not read this export. Try the local CLI.");
  } finally {
    setLoading(false);
  }
});

destinationInput.addEventListener("change", async () => {
  const target = $("#compare-result");
  if (!currentReport) { target.innerHTML = "<p class=\"notice\">Scan the source folder above first.</p>"; return; }
  target.textContent = "Inspecting destination…";
  try {
    const destination = await inspectFiles([...(destinationInput.files || [])]);
    const comparison = compareBrowserReports(currentReport, destination);
    const total = comparison.missingNotes.length + comparison.changedNotes.length + comparison.missingAttachments.length;
    target.innerHTML = total === 0
      ? `<p class="pass"><b>Pass.</b> All ${currentReport.totals.notes} note and ${currentReport.totals.attachments} attachment fingerprints are present.</p>`
      : `<p class="loss"><b>Loss detected.</b> ${comparison.missingNotes.length} missing notes, ${comparison.changedNotes.length} changed notes, and ${comparison.missingAttachments.length} missing attachments need review.</p><ul>${[...comparison.missingNotes, ...comparison.changedNotes, ...comparison.missingAttachments].slice(0, 8).map(escapeItem).join("")}</ul>`;
  } catch { target.innerHTML = "<p class=\"loss\">The destination folder could not be inspected.</p>"; }
});

$("#download-report").addEventListener("click", () => {
  if (!currentReport) return;
  const blob = new Blob([JSON.stringify(currentReport, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = "notes-preflight-browser-report.json"; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
});

document.querySelectorAll<HTMLButtonElement>("[data-copy]").forEach((button) => button.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(button.dataset.copy || "");
    const label = button.querySelector("span")!; label.textContent = "Copied";
    setTimeout(() => { label.textContent = "Copy"; }, 1600);
  } catch { button.querySelector("span")!.textContent = "Select text"; }
}));

function setLoading(loading: boolean) {
  manifest.setAttribute("aria-busy", String(loading));
  manifestState.textContent = loading ? "Inspecting…" : currentReport ? "Complete" : "Waiting";
  folderInput.disabled = loading;
}

function renderReport(report: BrowserReport) {
  emptyState.hidden = true; errorState.hidden = true; results.hidden = false;
  $("#metric-notebooks").textContent = report.totals.notebooks.toLocaleString();
  $("#metric-notes").textContent = report.totals.notes.toLocaleString();
  $("#metric-attachments").textContent = report.totals.attachments.toLocaleString();
  $("#metric-bytes").textContent = humanBytes(report.totals.attachment_bytes);
  const list = $("#risk-list");
  list.innerHTML = report.risks.length
    ? report.risks.map((risk) => `<li><span>Review</span>${escapeHtml(risk.label)} <b>×${risk.count}</b></li>`).join("")
    : "<li><span>Clear</span>No sampled conversion risks found</li>";
}

function showError(message: string) {
  emptyState.hidden = true; results.hidden = true; errorState.hidden = false;
  $("#error-copy").textContent = message;
  manifestState.textContent = "Needs attention";
}

function humanBytes(value: number) {
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} GiB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MiB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${value} B`;
}
function escapeHtml(value: string) { const node = document.createElement("span"); node.textContent = value; return node.innerHTML; }
function escapeItem(value: string) { return `<li>${escapeHtml(value)}</li>`; }

const networkState = $("#network-state");
function updateNetwork() { networkState.textContent = navigator.onLine ? "Online — not required for inspection." : "Offline — folder inspection still works."; }
window.addEventListener("online", updateNetwork); window.addEventListener("offline", updateNetwork); updateNetwork();

const PRODUCT = "notes-import-preflight";
const TOKEN_KEY = `sb_license:${PRODUCT}`;
const VERDICT_KEY = `sb_license_verdict:${PRODUCT}`;
const DAY = 86_400_000;
type Verdict = { token: string; valid: boolean; checkedAt: number; reason: string };

const params = new URLSearchParams(location.search);
const returnedLicense = params.get("license");
if (returnedLicense) {
  localStorage.setItem(TOKEN_KEY, returnedLicense);
  params.delete("license");
  history.replaceState({}, "", `${location.pathname}${params.size ? `?${params}` : ""}${location.hash}`);
}

const licenseForm = $("#license-form") as HTMLFormElement;
const licenseInput = $("#license-input") as HTMLInputElement;
licenseForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const token = licenseInput.value.trim();
  if (!token) { setLicenseMessage("Paste the complete license token first.", false); return; }
  localStorage.setItem(TOKEN_KEY, token); localStorage.removeItem(VERDICT_KEY);
  await verifyLicense(token, true);
});

async function initializeLicense() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;
  const cached = readVerdict();
  if (cached?.token === token && cached.valid) unlockPlus();
  if (!cached || cached.token !== token || Date.now() - cached.checkedAt >= DAY || returnedLicense) await verifyLicense(token, Boolean(returnedLicense));
}

async function verifyLicense(token: string, announce: boolean) {
  if (!navigator.onLine) { if (announce) setLicenseMessage("Offline. Reconnect once to verify this license; the free tools remain available.", false); return; }
  if (announce) setLicenseMessage("Verifying license…", true);
  const api = location.hostname === "localhost" || location.hostname === "127.0.0.1" ? "https://pilot-api.sociobot.in" : "https://api.sociobot.in";
  try {
    const response = await fetch(`${api}/api/v1/products/${PRODUCT}/verify?license=${encodeURIComponent(token)}`);
    if (!response.ok) throw new Error("verification service unavailable");
    const result = await response.json() as { valid: boolean; reason: string };
    const verdict: Verdict = { token, valid: result.valid, reason: result.reason, checkedAt: Date.now() };
    localStorage.setItem(VERDICT_KEY, JSON.stringify(verdict));
    if (result.valid) { unlockPlus(); setLicenseMessage("License active. Plus is ready on this device.", true); }
    else { lockPlus(); setLicenseMessage(`License no longer active (${reasonLabel(result.reason)}).`, false); }
  } catch { if (announce) setLicenseMessage("Could not verify right now. The free tools remain available; try again later.", false); }
}

function readVerdict(): Verdict | null { try { return JSON.parse(localStorage.getItem(VERDICT_KEY) || "null") as Verdict | null; } catch { return null; } }
function unlockPlus() { $("#plus-workspace").hidden = false; $("#license-status").textContent = "Preflight Plus active"; document.body.dataset.licensed = "true"; }
function lockPlus() { $("#plus-workspace").hidden = true; $("#license-status").textContent = "Free CLI + browser scan active"; delete document.body.dataset.licensed; }
function setLicenseMessage(message: string, positive: boolean) { const target = $("#license-message"); target.textContent = message; target.className = positive ? "positive" : "negative"; }
function reasonLabel(reason: string) { return ({ invalid: "invalid token", expired: "expired", revoked: "revoked", wrong_product: "wrong product" } as Record<string, string>)[reason] || reason; }
void initializeLicense();

if ("serviceWorker" in navigator) window.addEventListener("load", () => { void navigator.serviceWorker.register("/sw.js").catch(() => undefined); });

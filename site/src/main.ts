import "./style.css";
import { compareBrowserReports, inspectFiles, type BrowserReport } from "./preflight";
import { sampleBrowserFiles } from "./sample";

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const isDemo = location.pathname.replace(/\/+$/, "") === "/demo";
let currentReport: BrowserReport | null = null;
let inspectionState: "waiting" | "loading" | "complete" | "error" = "waiting";

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
  currentReport = null;
  setInspectionState("loading");
  try {
    const report = await inspectFiles(files);
    if (!report.totals.notes && !report.totals.attachments) {
      throw new Error("No supported notes or attachments were found. Choose the top export folder or use the CLI for a ZIP file.");
    }
    currentReport = report;
    renderReport(report);
  } catch (error) {
    showError(error instanceof Error ? error.message : "The browser could not read this export. Try the local CLI.");
  }
});

destinationInput.addEventListener("change", async () => {
  const target = $("#compare-result");
  if (!currentReport) {
    target.innerHTML = "<p class=\"notice\">Inspect or load the source baseline first.</p>";
    return;
  }
  target.textContent = "Inspecting destination…";
  try {
    const files = [...(destinationInput.files || [])];
    if (!files.length) throw new Error("no files selected");
    const destination = await inspectFiles(files);
    const comparison = compareBrowserReports(currentReport, destination);
    const total = comparison.missingNotes.length + comparison.changedNotes.length + comparison.missingAttachments.length;
    target.innerHTML = total === 0
      ? `<p class="pass"><b>Pass.</b> All ${currentReport.totals.notes} note and ${currentReport.totals.attachments} attachment fingerprints are present.</p>`
      : `<p class="loss"><b>Loss found.</b> ${comparison.missingNotes.length} missing notes, ${comparison.changedNotes.length} changed notes, and ${comparison.missingAttachments.length} missing attachments need review.</p><ul>${[...comparison.missingNotes, ...comparison.changedNotes, ...comparison.missingAttachments].slice(0, 8).map(escapeItem).join("")}</ul>`;
  } catch {
    target.innerHTML = "<p class=\"loss\">The destination folder could not be inspected. Choose an unzipped export folder.</p>";
  }
});

$("#download-report").addEventListener("click", () => {
  if (!currentReport) return;
  const blob = new Blob([JSON.stringify(currentReport, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "notes-preflight-browser-report.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
});

document.querySelectorAll<HTMLButtonElement>("[data-copy]").forEach((button) => button.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(button.dataset.copy || "");
    const label = button.querySelector("span")!;
    label.textContent = "Install command copied";
    setTimeout(() => { label.textContent = "Copy install command"; }, 1600);
  } catch {
    button.querySelector("span")!.textContent = "Select the command above";
  }
}));

function setInspectionState(state: typeof inspectionState) {
  inspectionState = state;
  manifest.setAttribute("aria-busy", String(state === "loading"));
  manifestState.textContent = ({ waiting: "Waiting", loading: "Inspecting…", complete: "Complete", error: "Needs attention" })[state];
  folderInput.disabled = state === "loading" || isDemo;
}

function renderReport(report: BrowserReport) {
  emptyState.hidden = true;
  errorState.hidden = true;
  results.hidden = false;
  $("#metric-notebooks").textContent = report.totals.notebooks.toLocaleString();
  $("#metric-notes").textContent = report.totals.notes.toLocaleString();
  $("#metric-attachments").textContent = report.totals.attachments.toLocaleString();
  $("#metric-bytes").textContent = humanBytes(report.totals.attachment_bytes);
  const list = $("#risk-list");
  list.innerHTML = report.risks.length
    ? report.risks.map((risk) => `<li><span>Review</span>${escapeHtml(risk.label)} <b>×${risk.count}</b></li>`).join("")
    : "<li><span>Clear</span>No sampled conversion risks found</li>";
  setInspectionState("complete");
}

function showError(message: string) {
  emptyState.hidden = true;
  results.hidden = true;
  errorState.hidden = false;
  $("#error-copy").textContent = message;
  setInspectionState("error");
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
function updateNetwork() {
  networkState.textContent = navigator.onLine ? "Online. A connection is not needed for inspection." : "Offline. Folder inspection still works.";
}
window.addEventListener("online", updateNetwork);
window.addEventListener("offline", updateNetwork);
updateNetwork();

const PRODUCT = "notes-import-preflight";
const TOKEN_KEY = `sb_license:${PRODUCT}`;
const VERDICT_KEY = `sb_license_verdict:${PRODUCT}`;
const BASELINE_KEY = `sb_baseline:${PRODUCT}`;
const DAY = 86_400_000;
type Verdict = { token: string; valid: boolean; checkedAt: number; reason: string };

if (isDemo) {
  document.body.dataset.demo = "true";
  document.title = "Demo — Notes Import Preflight";
  document.querySelector<HTMLLinkElement>('link[rel="canonical"]')!.href = "https://notes-import-preflight.sociobot.in/demo/";
  document.querySelector<HTMLMetaElement>('meta[property="og:url"]')!.content = "https://notes-import-preflight.sociobot.in/demo/";
  $("#demo-banner").hidden = false;
  $("#demo-quick-result").hidden = false;
  $(".real-input").hidden = true;
  $(".demo-input").hidden = false;
  const sampleAction = document.querySelector<HTMLAnchorElement>('.hero-actions a[href="/demo/"]')!;
  sampleAction.textContent = "Sample data loaded";
  sampleAction.setAttribute("aria-current", "page");
  sampleAction.removeAttribute("href");
  $("#license-form").hidden = true;
  $("#license-status").textContent = "Demo mode does not read saved licenses";
  $("#buy-plus").setAttribute("aria-disabled", "true");
  $("#buy-plus").addEventListener("click", (event) => event.preventDefault());
  $("#reset-demo").addEventListener("click", () => { void loadDemo(true); });
  void loadDemo(false);
} else {
  initializePaidFeatures();
}

async function loadDemo(announce: boolean) {
  currentReport = null;
  setInspectionState("loading");
  currentReport = await inspectFiles(sampleBrowserFiles());
  renderReport(currentReport);
  $("#compare-result").innerHTML = "<p class=\"loss\"><b>Sample comparison:</b> one changed note and one missing audio file need review.</p>";
  if (announce) {
    $("#route-announcement").textContent = "Sample data reset. Five notes and three attachments loaded.";
    $("#demo-quick-result").focus({ preventScroll: true });
  }
}

function initializePaidFeatures() {
  const params = new URLSearchParams(location.search);
  const returnedLicense = params.get("license");
  if (returnedLicense) {
    localStorage.setItem(TOKEN_KEY, returnedLicense);
    params.delete("license");
    history.replaceState({}, "", `${location.pathname}${params.size ? `?${params}` : ""}${location.hash}`);
  }

  const licenseForm = $("#license-form") as HTMLFormElement;
  const licenseInput = $("#license-input") as HTMLInputElement;
  $("#buy-plus").addEventListener("click", async (event) => {
    event.preventDefault();
    const link = event.currentTarget as HTMLAnchorElement;
    const message = $("#checkout-message");
    message.textContent = "Opening the hosted checkout…";
    try {
      const response = await fetch(link.href, { redirect: "manual", credentials: "omit" });
      if (response.status === 404) {
        message.textContent = "Checkout registration is pending. Existing licenses can still be restored here.";
        return;
      }
      location.assign(link.href);
    } catch {
      message.textContent = "The checkout could not open. Try again later or restore an existing license.";
    }
  });
  licenseForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const token = licenseInput.value.trim();
    if (!token) { setLicenseMessage("Paste the complete license token first.", false); return; }
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.removeItem(VERDICT_KEY);
    await verifyLicense(token, true);
  });

  $("#save-baseline").addEventListener("click", () => {
    if (!currentReport) { setBaselineMessage("Inspect a source folder before saving a baseline."); return; }
    localStorage.setItem(BASELINE_KEY, JSON.stringify(currentReport));
    setBaselineMessage(`Saved a baseline with ${currentReport.totals.notes} notes on this device.`);
  });
  $("#load-baseline").addEventListener("click", () => {
    try {
      const saved = JSON.parse(localStorage.getItem(BASELINE_KEY) || "null") as BrowserReport | null;
      if (!saved || saved.schema_version !== 2) throw new Error("missing");
      currentReport = saved;
      renderReport(saved);
      setBaselineMessage(`Loaded a baseline with ${saved.totals.notes} notes.`);
    } catch { setBaselineMessage("No readable baseline is saved on this device."); }
  });
  $("#clear-baseline").addEventListener("click", () => {
    if (!localStorage.getItem(BASELINE_KEY)) { setBaselineMessage("No saved baseline needs deletion."); return; }
    if (!window.confirm("Delete the saved baseline from this device?")) return;
    localStorage.removeItem(BASELINE_KEY);
    setBaselineMessage("Saved baseline deleted.");
  });
  $("#print-audit").addEventListener("click", () => window.print());

  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;
  const cached = readVerdict();
  if (cached?.token === token && cached.valid) unlockPlus();
  if (cached?.token === token && !cached.valid) setLicenseMessage(`License no longer active (${reasonLabel(cached.reason)}).`, false);
  if (!cached || cached.token !== token || Date.now() - cached.checkedAt >= DAY || Boolean(returnedLicense)) {
    void verifyLicense(token, Boolean(returnedLicense));
  }
}

async function verifyLicense(token: string, announce: boolean) {
  if (!navigator.onLine) {
    if (announce) setLicenseMessage("Offline. Reconnect once to verify this license. The free tools remain available.", false);
    return;
  }
  if (announce) setLicenseMessage("Verifying license…", true);
  const api = location.hostname === "localhost" || location.hostname === "127.0.0.1" ? "https://pilot-api.sociobot.in" : "https://api.sociobot.in";
  try {
    const response = await fetch(`${api}/api/v1/products/${PRODUCT}/verify?license=${encodeURIComponent(token)}`);
    if (!response.ok) throw new Error("verification service unavailable");
    const result = await response.json() as { valid: boolean; reason: string };
    const verdict: Verdict = { token, valid: result.valid, reason: result.reason, checkedAt: Date.now() };
    localStorage.setItem(VERDICT_KEY, JSON.stringify(verdict));
    if (result.valid) {
      unlockPlus();
      setLicenseMessage("License active. Preflight Plus is ready on this device.", true);
    } else {
      lockPlus();
      setLicenseMessage(`License no longer active (${reasonLabel(result.reason)}).`, false);
    }
  } catch {
    if (announce) setLicenseMessage("The license service did not respond. The free tools remain available. Try again later.", false);
  }
}

function readVerdict(): Verdict | null {
  try { return JSON.parse(localStorage.getItem(VERDICT_KEY) || "null") as Verdict | null; }
  catch { return null; }
}
function unlockPlus() { $("#plus-workspace").hidden = false; $("#license-status").textContent = "Preflight Plus active"; document.body.dataset.licensed = "true"; }
function lockPlus() { $("#plus-workspace").hidden = true; $("#license-status").textContent = "Free CLI and browser scan active"; delete document.body.dataset.licensed; }
function setLicenseMessage(message: string, positive: boolean) { const target = $("#license-message"); target.textContent = message; target.className = positive ? "positive" : "negative"; }
function setBaselineMessage(message: string) { $("#baseline-message").textContent = message; }
function reasonLabel(reason: string) { return ({ invalid: "invalid token", expired: "expired", revoked: "revoked", wrong_product: "wrong product" } as Record<string, string>)[reason] || reason; }

if ("serviceWorker" in navigator) window.addEventListener("load", () => { void navigator.serviceWorker.register("/sw.js").catch(() => undefined); });

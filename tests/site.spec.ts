import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const route of ["/", "/demo/", "/privacy/", "/terms/"]) {
  test(`${route} has its own metadata and one clear page heading`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(route === "/" ? "/$" : `${route}$`));
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /og-image\.jpg$/);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", "/apple-touch-icon.png");
    expect(await page.title()).toMatch(route === "/demo/" ? /^Demo —/ : route === "/privacy/" ? /^Privacy —/ : route === "/terms/" ? /^Terms —/ : /^Notes Import Preflight —/);
  });
}

test("unknown paths return the designed 404 page and status", async ({ page }) => {
  const response = await page.goto("/does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.locator("h1")).toHaveText("This page does not exist");
  await expect(page.getByRole("link", { name: "Return to the export checker" })).toHaveAttribute("href", "/");
});

test("invalid browser input stays marked for attention and a valid selection recovers", async ({ page }) => {
  const { mkdtempSync, rmSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const invalid = mkdtempSync(join(tmpdir(), "preflight-invalid-"));
  const valid = mkdtempSync(join(tmpdir(), "preflight-valid-"));
  writeFileSync(join(invalid, ".DS_Store"), "ignored");
  writeFileSync(join(valid, "recovered.md"), "# Recovered\n- [ ] task");
  await page.goto("/");
  await page.setInputFiles("#folder-input", invalid);
  await expect(page.locator("#manifest-state")).toHaveText("Needs attention");
  await expect(page.locator("#error-state")).toBeVisible();
  await page.setInputFiles("#folder-input", valid);
  await expect(page.locator("#manifest-state")).toHaveText("Complete");
  await expect(page.locator("#metric-notes")).toHaveText("1");
  rmSync(invalid, { recursive: true });
  rmSync(valid, { recursive: true });
});

test("an unavailable checkout reports the registration dependency without leaving the product", async ({ page }) => {
  await page.route("https://api.sociobot.in/api/v1/products/notes-import-preflight/checkout", (route) => route.fulfill({ status: 404, contentType: "application/json", body: '{"error":"enabled factory product"}' }));
  await page.goto("/");
  await page.locator("#buy-plus").click();
  await expect(page.locator("#checkout-message")).toContainText("Checkout registration is pending");
  expect(page.url()).toBe("http://127.0.0.1:4173/");
});

test("keyboard focus starts at the skip link and visible controls meet the touch target", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => (document.activeElement as HTMLElement).textContent?.trim())).toBe("Skip to main content");
  const outline = await page.locator(".skip-link").evaluate((element) => getComputedStyle(element).outlineWidth);
  expect(parseFloat(outline)).toBeGreaterThanOrEqual(3);
  const undersized = await page.locator('a, button, input:not([type="file"]), summary').evaluateAll((elements) => elements.filter((element) => {
    const node = element as HTMLElement;
    const style = getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden" || node.closest("[hidden]")) return false;
    const box = node.getBoundingClientRect();
    return box.width < 44 || box.height < 44;
  }).map((element) => ({ text: (element.textContent || "").trim(), box: (element as HTMLElement).getBoundingClientRect().toJSON() })));
  expect(undersized).toEqual([]);
});

test("reduced motion and 200 percent text retain the complete page", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4173/");
  const duration = await page.locator(".hero-copy").evaluate((element) => getComputedStyle(element).animationDuration);
  expect(parseFloat(duration)).toBeLessThanOrEqual(0.001);
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await expect(page.locator("#buy-plus")).toBeVisible();
  await context.close();
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`axe has no serious issues at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/demo/");
    await expect(page.locator("#manifest-state")).toHaveText("Complete");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical")).toEqual([]);
  });
}

test("all internal links return an expected page", async ({ page, request, baseURL }) => {
  await page.goto("/");
  const links = await page.locator("a[href]").evaluateAll((nodes) => [...new Set(nodes.map((node) => (node as HTMLAnchorElement).href).filter((href) => href.startsWith(location.origin)))]);
  for (const link of links) {
    const response = await request.get(link);
    expect(response.status(), link).toBe(200);
  }
  expect(links).toContain(`${baseURL}/demo/`);
  expect(links).toContain(`${baseURL}/privacy/`);
  expect(links).toContain(`${baseURL}/terms/`);
});

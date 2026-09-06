import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const root = join(process.cwd(), "dist/site");
const types = {
  ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp",
  ".woff2": "font/woff2", ".xml": "application/xml; charset=utf-8", ".txt": "text/plain; charset=utf-8"
};
const headers = {
  "Content-Security-Policy": "default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://api.sociobot.in https://pilot-api.sociobot.in; worker-src 'self'; form-action 'self' https://api.sociobot.in; frame-ancestors 'none'",
  "Referrer-Policy": "strict-origin-when-cross-origin", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY"
};

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
  const routeFiles = { "/": "index.html", "/demo": "demo/index.html", "/demo/": "demo/index.html", "/privacy": "privacy/index.html", "/privacy/": "privacy/index.html", "/terms": "terms/index.html", "/terms/": "terms/index.html" };
  let relative = routeFiles[pathname];
  if (!relative) {
    const candidate = normalize(pathname).replace(/^\/+/, "");
    if (!candidate.startsWith("..") && existsSync(join(root, candidate)) && statSync(join(root, candidate)).isFile()) relative = candidate;
  }
  const status = relative ? (pathname === "/404.html" ? 404 : 200) : 404;
  relative ||= "404.html";
  const file = join(root, relative);
  response.writeHead(status, { ...headers, "Content-Type": types[extname(file)] || "application/octet-stream", "Cache-Control": /\.(?:js|css|woff2|webp)$/.test(file) ? "public, max-age=31536000, immutable" : "public, max-age=0, must-revalidate" });
  createReadStream(file).pipe(response);
}).listen(4173, "127.0.0.1");

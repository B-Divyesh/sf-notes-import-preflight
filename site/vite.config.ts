import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: resolve(import.meta.dirname),
  plugins: [{
    name: "build-demo-route",
    closeBundle() {
      const output = resolve(import.meta.dirname, "../dist/site");
      const index = readFileSync(resolve(output, "index.html"), "utf8");
      const demo = index
        .replace("<title>Notes Import Preflight — check notes before migration</title>", "<title>Demo — Notes Import Preflight</title>")
        .replace('href="https://notes-import-preflight.sociobot.in/"', 'href="https://notes-import-preflight.sociobot.in/demo/"')
        .replace('content="https://notes-import-preflight.sociobot.in/"', 'content="https://notes-import-preflight.sociobot.in/demo/"');
      mkdirSync(resolve(output, "demo"), { recursive: true });
      writeFileSync(resolve(output, "demo/index.html"), demo);
    }
  }],
  build: {
    outDir: resolve(import.meta.dirname, "../dist/site"),
    emptyOutDir: true,
    target: "es2022",
    assetsInlineLimit: 2048,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        notFound: resolve(import.meta.dirname, "404.html"),
        privacy: resolve(import.meta.dirname, "privacy/index.html"),
        terms: resolve(import.meta.dirname, "terms/index.html")
      }
    }
  }
});

import { copyFile, mkdir } from "node:fs/promises";
import { platform } from "node:process";

await mkdir("dist/bin", { recursive: true });
const suffix = platform === "win32" ? ".exe" : "";
await copyFile(`target/release/notes-preflight${suffix}`, `dist/bin/notes-preflight${suffix}`);

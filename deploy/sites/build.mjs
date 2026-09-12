import { mkdir, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL(".", import.meta.url));
await mkdir(join(root, "dist/server"), { recursive: true });
await copyFile(join(root, "worker.mjs"), join(root, "dist/server/index.js"));
console.log("Built the Sites gateway Worker. Site registration and runtime secrets are required before publishing.");

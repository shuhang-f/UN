import { cp, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const web = fileURLToPath(new URL("../apps/web/", import.meta.url));
await cp(join(web, ".next/static"), join(web, ".next/standalone/apps/web/.next/static"), { recursive: true });
try { await access(join(web, "public")); }
catch (error) { if (error.code === "ENOENT") process.exit(0); throw error; }
await cp(join(web, "public"), join(web, ".next/standalone/apps/web/public"), { recursive: true });

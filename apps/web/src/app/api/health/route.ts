import { access, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import { dataDirectory } from "@/lib/server/data-directory";
import { deployment } from "@/lib/server/deployment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (deployment().mode === "invalid") throw new Error("Missing deployment configuration");
    const directory = dataDirectory();
    // Reject an accidentally ephemeral Railway deployment before it receives traffic.
    if (process.env.RAILWAY_ENVIRONMENT_ID &&
      (!process.env.RAILWAY_VOLUME_MOUNT_PATH || resolve(process.env.RAILWAY_VOLUME_MOUNT_PATH) !== directory))
      throw new Error("Missing persistent volume");
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await access(directory, constants.R_OK | constants.W_OK);
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, mkdir, open, readdir, realpath, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { z } from "zod";
import type { UnHandoffRun } from "../un-handoff-types";
import { trustedAppOrigin } from "./deployment";
import { UnReviewService } from "./un-reviews";

const inputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("draft"), reviewId: z.uuid() }).strict(),
  z.object({ action: z.literal("approve"), runId: z.uuid(), approvalNote: z.string().trim().max(4000) }).strict(),
]);
const runSchema: z.ZodType<UnHandoffRun> = z.object({
  id: z.uuid(), reviewId: z.uuid(), unitId: z.string().min(1), unitNumber: z.string().min(1),
  mode: z.literal("simulated"), status: z.enum(["awaiting-approval", "approved"]),
  createdAt: z.iso.datetime(), reviewer: z.string().min(1), simulationDate: z.iso.date(),
  packet: z.object({
    role: z.literal("property-manager"), summary: z.string(),
    sources: z.array(z.object({
      id: z.string(), title: z.string(), kind: z.enum(["lease", "ledger", "email", "registration", "rule"]),
      date: z.iso.date(), body: z.string(),
    }).strict()),
    requestedRent: z.number().nonnegative(), effectiveDate: z.iso.date(),
  }).strict(),
  letter: z.object({ title: z.string().min(1), body: z.string().min(1) }).strict(),
  approvedAt: z.iso.datetime().nullable(), approvalNote: z.string().max(4000),
}).strict().refine(run => run.status === "approved" ? run.approvedAt !== null : run.approvedAt === null && run.approvalNote === "");

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const hasCode = (error: unknown, code: string) => error instanceof Error && "code" in error && error.code === code;
const bodyLimit = 16_000;
const cookieName = "un-review-session";

export class UnHandoffError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

async function assertDirectory(path: string) {
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Invalid handoff storage directory.");
}

async function readRun(path: string): Promise<UnHandoffRun | undefined> {
  let handle;
  try { handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW); }
  catch (error) { if (hasCode(error, "ENOENT")) return undefined; throw error; }
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > 1_000_000) throw new Error("Invalid handoff storage file.");
    const body = await handle.readFile("utf8");
    try { return runSchema.parse(JSON.parse(body)); }
    catch { throw new Error("Invalid saved handoff."); }
  } finally { await handle.close(); }
}

async function publishOnce(path: string, run: UnHandoffRun) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(run), { flag: "wx", mode: 0o600 });
  try { await link(temporary, path); }
  catch (error) { if (!hasCode(error, "EEXIST")) throw error; }
  finally { await unlink(temporary); }
}

/** Persists simulated handoffs separately from saved review packets. No provider is used. */
export class UnHandoffService {
  private directory: string;
  private reviews: UnReviewService;
  constructor(options: { directory: string; reviewsDirectory: string }) {
    this.directory = resolve(options.directory);
    this.reviews = new UnReviewService(options.reviewsDirectory);
  }

  private async sessionDirectory(session: string, create: boolean): Promise<string | undefined> {
    if (!/^[a-f0-9]{64}$/.test(session)) throw new UnHandoffError("Invalid browser session.", 403);
    if (create) await mkdir(this.directory, { recursive: true, mode: 0o700 });
    try { await assertDirectory(this.directory); }
    catch (error) { if (!create && hasCode(error, "ENOENT")) return undefined; throw error; }
    const root = await realpath(this.directory);
    const directory = join(root, digest(session));
    if (create) await mkdir(directory, { recursive: true, mode: 0o700 });
    try { await assertDirectory(directory); }
    catch (error) { if (!create && hasCode(error, "ENOENT")) return undefined; throw error; }
    if (await realpath(directory) !== directory) throw new Error("Invalid handoff storage path.");
    return directory;
  }

  private async withApproval(directory: string, draft: UnHandoffRun) {
    if (draft.status !== "awaiting-approval") throw new Error("Invalid handoff draft state.");
    const approved = await readRun(join(directory, `${draft.id}.approved.json`));
    if (!approved) return draft;
    // An approval records a decision over the original snapshot; it cannot rewrite it.
    if (approved.status !== "approved" || JSON.stringify({ ...approved, status: draft.status, approvedAt: null, approvalNote: "" }) !== JSON.stringify(draft))
      throw new Error("The handoff approval differs from its draft snapshot.");
    return approved;
  }

  async list(session: string): Promise<UnHandoffRun[]> {
    const directory = await this.sessionDirectory(session, false);
    if (!directory) return [];
    const files = await readdir(directory);
    const runs = await Promise.all(files.filter(file => /^[a-f0-9]{64}\.draft\.json$/.test(file)).map(async file => {
      const draft = await readRun(join(directory, file));
      return draft ? this.withApproval(directory, draft) : undefined;
    }));
    return runs.filter((run): run is UnHandoffRun => !!run)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  }

  async act(session: string, value: unknown): Promise<UnHandoffRun> {
    const input = inputSchema.parse(value);
    if (!/^[a-f0-9]{64}$/.test(session)) throw new UnHandoffError("Invalid browser session.", 403);
    if (input.action === "approve") {
      const current = (await this.list(session)).find(run => run.id === input.runId);
      if (!current) throw new UnHandoffError("This handoff was not found in the current browser session.", 404);
      if (current.status === "approved") {
        if (current.approvalNote !== input.approvalNote) throw new UnHandoffError("This draft is already approved with a different note. Its recorded approval has not changed.", 409);
        return current;
      }
      const directory = await this.sessionDirectory(session, false);
      if (!directory) throw new Error("Handoff storage is unavailable.");
      await publishOnce(join(directory, `${current.id}.approved.json`), {
        ...current, status: "approved", approvedAt: new Date().toISOString(), approvalNote: input.approvalNote,
      });
      const approved = await this.withApproval(directory, current);
      if (approved.status !== "approved") throw new Error("Handoff approval could not be read back.");
      if (approved.approvalNote !== input.approvalNote) throw new UnHandoffError("This draft was approved with a different note. Its recorded approval has not changed.", 409);
      return approved;
    }

    const review = (await this.reviews.list(session)).find(record => record.id === input.reviewId);
    if (!review) throw new UnHandoffError("Save and select a review in this browser session before preparing its handoff.", 404);
    if (review.packet.status !== "draft-ready" || !review.packet.draft)
      throw new UnHandoffError("This review has no prepared draft. Resolve its evidence or timing issues before drafting a handoff.");
    const directory = await this.sessionDirectory(session, true);
    if (!directory) throw new Error("Handoff storage is unavailable.");
    const path = join(directory, `${digest(review.id)}.draft.json`);
    let draft = await readRun(path);
    if (!draft) {
      const run: UnHandoffRun = {
        id: randomUUID(), reviewId: review.id, unitId: review.packet.unit.id, unitNumber: review.packet.unit.unitNumber,
        mode: "simulated", status: "awaiting-approval", createdAt: new Date().toISOString(),
        reviewer: review.preferences.reviewer, simulationDate: review.simulationDate,
        packet: {
          role: "property-manager", summary: review.packet.summary,
          sources: review.packet.evidence.map(({ id, title, kind, date, body }) => ({ id, title, kind, date, body })),
          requestedRent: review.packet.requestedRent, effectiveDate: review.packet.effectiveDate,
        },
        letter: { title: review.packet.draft.title, body: review.packet.draft.body },
        approvedAt: null, approvalNote: "",
      };
      await publishOnce(path, run);
      draft = await readRun(path);
    }
    if (!draft) throw new Error("The handoff could not be read back.");
    return this.withApproval(directory, draft);
  }
}

async function readBody(request: Request) {
  if (Number(request.headers.get("content-length")) > bodyLimit) throw new UnHandoffError("The handoff request is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) return "";
  let bytes = 0;
  let body = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > bodyLimit) { await reader.cancel(); throw new UnHandoffError("The handoff request is too large.", 413); }
      body += decoder.decode(value, { stream: true });
    }
    return body + decoder.decode();
  } finally { reader.releaseLock(); }
}

export function createUnHandoffsHandler(options: { directory: string; reviewsDirectory: string }) {
  const service = new UnHandoffService(options);
  return async (request: Request): Promise<Response> => {
    const expected = trustedAppOrigin(request);
    if (!expected) return Response.json({ error: "Untrusted app host." }, { status: 403 });
    const reply = (value: unknown, status = 200) => Response.json(value, {
      status, headers: { "Cache-Control": "no-store", ...(status === 405 ? { Allow: "GET, POST" } : {}) },
    });
    if (request.method !== "GET" && request.method !== "POST") return reply({ error: "Method not allowed." }, 405);
    const cookie = request.headers.get("cookie")?.split(";").map(part => part.trim())
      .find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    const session = cookie && /^[a-f0-9]{64}$/.test(cookie) ? cookie : undefined;
    if (request.method === "POST" && (!session || request.headers.get("origin") !== expected.origin ||
      request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json"))
      return reply({ error: "Reload UN and use the draft or approval button for this simulated handoff." }, 403);
    try {
      // The parent reviews endpoint owns cookie creation, avoiding two racing sessions.
      if (request.method === "GET") return reply({ runs: session ? await service.list(session) : [] });
      return reply({ run: await service.act(session!, JSON.parse(await readBody(request))) });
    } catch (error) {
      if (error instanceof UnHandoffError) return reply({ error: error.message }, error.status);
      if (error instanceof z.ZodError || error instanceof SyntaxError)
        return reply({ error: "Invalid handoff. Choose a saved review or run and check the approval note." }, 400);
      return reply({ error: "Unable to read or save this simulated handoff. Check local storage and retry the same action." }, 502);
    }
  };
}

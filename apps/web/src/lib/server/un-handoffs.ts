import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, mkdir, open, readdir, realpath, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { z } from "zod";
import type { UnHandoffRun } from "../un-handoff-types";
import { trustedAppOrigin } from "./deployment";
import { FollowupError } from "./followup-error";
import { UnReviewService } from "./un-reviews";
import type { Workplace, WorkplaceTask } from "./workplace";

const inputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("draft"), reviewId: z.uuid(), approved: z.literal(true) }).strict(),
  z.object({ action: z.literal("approve"), runId: z.uuid(), approvalNote: z.string().trim().max(4000) }).strict(),
]);
const snapshotSchema = z.object({
  id: z.uuid(), reviewId: z.uuid(), unitId: z.string().min(1), unitNumber: z.string().min(1),
  mode: z.literal("ambiguous"), status: z.enum(["awaiting-approval", "approved"]),
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
}).strict();
const runSchema: z.ZodType<UnHandoffRun> = snapshotSchema.extend({
  externalTask: z.object({
    id: z.uuid(), url: z.url().nullable(), workspaceId: z.string().min(1),
    identityName: z.string().min(1), verifiedAt: z.iso.datetime(),
  }).strict(),
}).strict().refine(run => run.status === "approved" ? run.approvedAt !== null : run.approvedAt === null && run.approvalNote === "");
const proposalSchema = z.object({
  run: snapshotSchema, title: z.string().min(1), description: z.string().min(1),
  identityId: z.string().min(1), workspaceId: z.string().min(1), identityName: z.string().min(1),
}).strict();
type StoredProposal = z.infer<typeof proposalSchema>;
const receiptSchema = z.object({ id: z.uuid() }).strict();

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

async function readStored<T>(path: string, schema: z.ZodType<T>): Promise<T | undefined> {
  let handle;
  try {
    // O_NOFOLLOW is unavailable on Windows; reject links explicitly on every platform.
    const entry = await lstat(path);
    if (!entry.isFile() || entry.isSymbolicLink()) throw new Error("Invalid handoff storage file.");
    handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  }
  catch (error) { if (hasCode(error, "ENOENT")) return undefined; throw error; }
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > 1_000_000) throw new Error("Invalid handoff storage file.");
    const body = await handle.readFile("utf8");
    try { return schema.parse(JSON.parse(body)); }
    catch { throw new Error("Invalid saved handoff."); }
  } finally { await handle.close(); }
}

async function publishOnce(path: string, value: unknown): Promise<boolean> {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value), { flag: "wx", mode: 0o600 });
  try { await link(temporary, path); return true; }
  catch (error) { if (!hasCode(error, "EEXIST")) throw error; return false; }
  finally { await unlink(temporary); }
}

const uncertain = () => new UnHandoffError(
  "The Ambiguous save is still in progress or its outcome is uncertain. Retry this same saved review to find the existing task; it will not be sent twice. If this remains unresolved, inspect the workspace. Only after confirming no task exists, save a new reviewed version with an updated review note.", 409,
);

/** Local metadata binds one external write to a saved review and browser session. */
export class UnHandoffService {
  private directory: string;
  private reviews: UnReviewService;
  private workplace?: Workplace;
  constructor(options: { directory: string; reviewsDirectory: string; workplace?: Workplace }) {
    this.directory = resolve(options.directory);
    this.reviews = new UnReviewService(options.reviewsDirectory);
    this.workplace = options.workplace;
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
    const approved = await readStored(join(directory, `${draft.id}.approved.json`), runSchema);
    if (!approved) return draft;
    // An approval records a decision over the original snapshot; it cannot rewrite it.
    if (approved.status !== "approved" || JSON.stringify({ ...approved, status: draft.status, approvedAt: null, approvalNote: "" }) !== JSON.stringify(draft))
      throw new Error("The handoff approval differs from its draft snapshot.");
    return approved;
  }

  private async savedRuns(session: string): Promise<UnHandoffRun[]> {
    const directory = await this.sessionDirectory(session, false);
    if (!directory) return [];
    const files = await readdir(directory);
    const runs = await Promise.all(files.filter(file => /^[a-f0-9]{64}\.saved\.json$/.test(file)).map(async file => {
      const draft = await readStored(join(directory, file), runSchema);
      return draft ? this.withApproval(directory, draft) : undefined;
    }));
    return runs.filter((run): run is UnHandoffRun => !!run)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  }

  private checkIdentity(proposal: StoredProposal, identity: Awaited<ReturnType<Workplace["identity"]>>) {
    if (proposal.identityId !== identity.id || proposal.workspaceId !== identity.workspaceId)
      throw new UnHandoffError("The connected Ambiguous identity or workspace changed. Restore the original connection before retrying this review.", 409);
  }

  private async verifiedTask(id: string, proposal: StoredProposal): Promise<UnHandoffRun["externalTask"]> {
    const task = await this.workplace!.get(id);
    if (task.id !== id || task.title !== proposal.title || task.description !== proposal.description)
      throw new UnHandoffError("The Ambiguous task differs from the reviewed packet and letter. Inspect the task before continuing; do not create it again.", 409);
    if (task.url) {
      const url = new URL(task.url);
      if (url.protocol !== "https:" || url.hostname !== "app.ambiguous.ai" || url.username || url.password)
        throw new UnHandoffError("Ambiguous returned an unsafe task link.", 502);
    }
    return {
      id: task.id, url: task.url, workspaceId: proposal.workspaceId,
      identityName: proposal.identityName, verifiedAt: new Date().toISOString(),
    };
  }

  async list(session: string): Promise<UnHandoffRun[]> {
    const runs = await this.savedRuns(session);
    if (!runs.length || !this.workplace) return runs;
    const failure = (error: unknown) => error instanceof UnHandoffError || error instanceof FollowupError
      ? error.message : "Unable to verify this task with Ambiguous. The saved packet and last verification time are shown; retry refreshing.";
    let identity: Awaited<ReturnType<Workplace["identity"]>>;
    try { identity = await this.workplace.identity(); }
    catch (error) { return runs.map(run => ({ ...run, verificationError: failure(error) })); }
    const directory = (await this.sessionDirectory(session, false))!;
    return Promise.all(runs.map(async run => {
      try {
        const proposal = await readStored(join(directory, `${digest(run.reviewId)}.proposal.json`), proposalSchema);
        if (!proposal) throw new Error("Handoff proposal is missing.");
        this.checkIdentity(proposal, identity);
        return { ...run, externalTask: await this.verifiedTask(run.externalTask.id, proposal) };
      } catch (error) { return { ...run, verificationError: failure(error) }; }
    }));
  }

  async act(session: string, value: unknown): Promise<UnHandoffRun> {
    if (value && typeof value === "object" && "action" in value && value.action === "draft" &&
      (!("approved" in value) || value.approved !== true))
      throw new UnHandoffError("Review the packet and letter, then explicitly approve saving them to Ambiguous.", 403);
    const input = inputSchema.parse(value);
    if (!/^[a-f0-9]{64}$/.test(session)) throw new UnHandoffError("Invalid browser session.", 403);
    if (input.action === "approve") {
      const current = (await this.savedRuns(session)).find(run => run.id === input.runId);
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

    if (!this.workplace)
      throw new UnHandoffError("Ambiguous is not connected. Set AMBIGUOUS_API_KEY in the server environment and restart the app before saving this packet.", 503);
    const workplace = this.workplace;
    const review = (await this.reviews.list(session)).find(record => record.id === input.reviewId);
    if (!review) throw new UnHandoffError("Save and select a review in this browser session before preparing its handoff.", 404);
    if (review.packet.status !== "draft-ready" || !review.packet.draft)
      throw new UnHandoffError("This review has no prepared draft. Resolve its evidence or timing issues before drafting a handoff.");
    const directory = await this.sessionDirectory(session, true);
    if (!directory) throw new Error("Handoff storage is unavailable.");
    const key = digest(review.id);
    const path = join(directory, `${key}.saved.json`);
    const proposalPath = join(directory, `${key}.proposal.json`);
    const identity = await workplace.identity();
    let proposal = await readStored(proposalPath, proposalSchema);
    if (!proposal) {
      const run: z.infer<typeof snapshotSchema> = {
        id: randomUUID(), reviewId: review.id, unitId: review.packet.unit.id, unitNumber: review.packet.unit.unitNumber,
        mode: "ambiguous", status: "awaiting-approval", createdAt: new Date().toISOString(),
        reviewer: review.preferences.reviewer, simulationDate: review.simulationDate,
        packet: {
          role: "property-manager", summary: review.packet.summary,
          sources: review.packet.evidence.map(({ id, title, kind, date, body }) => ({ id, title, kind, date, body })),
          requestedRent: review.packet.requestedRent, effectiveDate: review.packet.effectiveDate,
        },
        letter: { title: review.packet.draft.title, body: review.packet.draft.body },
        approvedAt: null, approvalNote: "",
      };
      const marker = `un-review:${digest(`${digest(session)}:${key}`)}`;
      await publishOnce(proposalPath, {
        run, identityId: identity.id, workspaceId: identity.workspaceId, identityName: identity.name,
        title: `UN review — Unit ${run.unitNumber}`,
        description: [
          "Reviewed UN packet and existing template letter. Ambiguous stores this task; it has not drafted or sent a notice.",
          `Review date: ${run.simulationDate}\nReviewer: ${run.reviewer}\nReview ID: ${run.reviewId}`,
          `Review note: ${review.reviewerNote || "None"}`,
          `Summary\n${run.packet.summary}`,
          `Requested rent: ${run.packet.requestedRent}\nEffective date: ${run.packet.effectiveDate}`,
          ...run.packet.sources.map(source => `Source: ${source.title}\nSource ID: ${source.id}\nType: ${source.kind}\nDate: ${source.date}\n${source.body}`),
          `UN template letter: ${run.letter.title}\n${run.letter.body}`,
          "The manager's approval is recorded separately in UN. This task does not send or serve a tenant notice.", marker,
        ].join("\n\n"),
      });
      proposal = await readStored(proposalPath, proposalSchema);
    }
    if (!proposal) throw new Error("The handoff proposal could not be read back.");
    this.checkIdentity(proposal, identity);
    const draft = proposal;
    const readBack = async (id: string) => {
      const externalTask = await this.verifiedTask(id, draft);
      await publishOnce(path, { ...draft.run, externalTask });
      const saved = await readStored(path, runSchema);
      if (!saved || saved.externalTask.id !== id) throw new UnHandoffError("The saved task ID differs from Ambiguous. Inspect the workspace before continuing.", 409);
      return { ...await this.withApproval(directory, saved), externalTask };
    };
    const marker = `un-review:${digest(`${digest(session)}:${key}`)}`;
    const reconcile = async () => {
      const matches = (await workplace.list(marker)).filter(task => task.description.split("\n").includes(marker));
      if (matches.length > 1) throw new UnHandoffError("Ambiguous contains multiple tasks for this review. Inspect the workspace before continuing.", 409);
      return matches[0] ? readBack(matches[0].id) : undefined;
    };
    const existing = await readStored(path, runSchema);
    if (existing) return readBack(existing.externalTask.id);
    const receiptPath = join(directory, `${key}.receipt.json`);
    const receipt = await readStored(receiptPath, receiptSchema);
    if (receipt) return readBack(receipt.id);
    const reconciled = await reconcile();
    if (reconciled) return reconciled;
    let attempted = false;
    let conflict = false;
    let created: WorkplaceTask;
    try {
      created = await workplace.create(draft.title, draft.description, async () => {
        this.checkIdentity(draft, await workplace.identity());
        if (!await publishOnce(join(directory, `${key}.attempt.json`), { runId: draft.run.id, attemptedAt: new Date().toISOString() })) {
          conflict = true;
          throw uncertain();
        }
        attempted = true;
      });
      await publishOnce(receiptPath, { id: created.id });
    } catch (error) {
      if (conflict) {
        const recovered = await reconcile();
        if (recovered) return recovered;
      }
      if (attempted || conflict) throw uncertain();
      throw error;
    }
    try { return await readBack(created.id); }
    catch (error) { if (error instanceof UnHandoffError) throw error; throw uncertain(); }
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

export function createUnHandoffsHandler(options: {
  directory: string; reviewsDirectory: string;
  isAmbiguousConfigured(): boolean;
  connect(): { workplace: Workplace; close(): Promise<void> } | undefined;
}) {
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
      return reply({ error: "Reload UN and use the Save to Ambiguous or approval button." }, 403);
    let connection: ReturnType<typeof options.connect>;
    try {
      // The parent reviews endpoint owns cookie creation, avoiding two racing sessions.
      if (request.method === "GET") {
        if (session && options.isAmbiguousConfigured()) connection = options.connect();
        return reply({
          runs: session ? await new UnHandoffService({ ...options, workplace: connection?.workplace }).list(session) : [],
          ambiguousConfigured: options.isAmbiguousConfigured(),
        });
      }
      const value: unknown = JSON.parse(await readBody(request));
      if (value && typeof value === "object" && "action" in value && value.action === "draft" &&
        (!("approved" in value) || value.approved !== true))
        return reply({ error: "Review the packet and letter, then explicitly approve saving them to Ambiguous." }, 403);
      const input = inputSchema.parse(value);
      if (input.action === "draft") connection = options.connect();
      return reply({ run: await new UnHandoffService({ ...options, workplace: connection?.workplace }).act(session!, input) });
    } catch (error) {
      if (error instanceof UnHandoffError) return reply({ error: error.message }, error.status);
      if (error instanceof z.ZodError || error instanceof SyntaxError)
        return reply({ error: "Invalid handoff. Choose a saved review or run and check the approval note." }, 400);
      if (error instanceof FollowupError) return reply({ error: error.message }, 502);
      return reply({ error: "Unable to read or save this handoff. Check server storage and Ambiguous access, then retry the same action." }, 502);
    } finally {
      try { await connection?.close(); } catch { /* Never expose credential-bearing transport errors. */ }
    }
  };
}

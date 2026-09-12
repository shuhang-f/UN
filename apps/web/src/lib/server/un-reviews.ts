import { createHash, randomBytes, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, mkdir, open, readdir, realpath, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { z } from "zod";
import { demoUnits } from "../un-demo";
import { reviewUnit } from "../un-review";
import type { UnSavedReview } from "../un-storage-types";
import type { UnReviewCase } from "../un-types";
import { trustedAppOrigin } from "./deployment";

const preferencesSchema = z.object({
  reviewLeadDays: z.number().int().min(1).max(180),
  requestedIncreasePercent: z.number().min(0).max(10),
  reviewer: z.string().trim().min(1).max(120),
}).strict();
const inputSchema = z.object({
  unitId: z.string().min(1).max(100),
  asOf: z.iso.date(),
  preferences: preferencesSchema,
  reviewerNote: z.string().trim().max(4000),
  approved: z.literal(true),
}).strict();
const evidenceSchema = z.object({
  id: z.string(),
  kind: z.enum(["lease", "ledger", "email", "registration", "rule"]),
  title: z.string(),
  date: z.iso.date(),
  body: z.string(),
  url: z.url().optional(),
}).strict();
const packetSchema: z.ZodType<UnReviewCase> = z.object({
  id: z.string(),
  unit: z.object({
    id: z.string(), unitNumber: z.string(), propertyName: z.string(), address: z.string(), residentName: z.string(),
    leaseEnd: z.iso.date(), baseRent: z.number(), lastIncreaseDate: z.iso.date().nullable(),
    correspondenceIncreaseDate: z.iso.date().nullable(), coverage: z.enum(["confirmed", "unknown"]),
    registrationVerified: z.boolean(), evidence: z.array(evidenceSchema),
  }).strict(),
  status: z.enum(["draft-ready", "needs-evidence", "blocked", "upcoming"]),
  summary: z.string(), daysUntilRenewal: z.number().int(), effectiveDate: z.iso.date(),
  nextEligibleDate: z.iso.date().nullable(), requestedIncreasePercent: z.number(), requestedRent: z.number(),
  capPercent: z.number().nullable(), maximumRent: z.number().nullable(), blockers: z.array(z.string()),
  evidence: z.array(evidenceSchema),
  tasks: z.array(z.object({ title: z.string(), owner: z.string(), details: z.string() }).strict()),
  draft: z.object({ title: z.string(), body: z.string(), templateVersion: z.string() }).strict().nullable(),
  rule: z.object({
    title: z.string(), url: z.url(), effectiveFrom: z.iso.date(), effectiveTo: z.iso.date(), verifiedAt: z.iso.date(),
  }).strict().nullable(),
}).strict();
const recordSchema = z.object({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  simulationDate: z.iso.date(),
  preferences: preferencesSchema,
  reviewerNote: z.string().max(4000),
  // Only reviewUnit writes this snapshot; retain all evidence and draft fields on read-back.
  packet: packetSchema,
  destination: z.literal("local"),
}).strict();
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const canonicalJson = (value: unknown) => JSON.stringify(value, (_key, item: unknown) => {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    return Object.fromEntries(Object.entries(item).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0));
  }
  return item;
});
const hasCode = (error: unknown, code: string) => error instanceof Error && "code" in error && error.code === code;
const cookieName = "un-review-session";
const bodyLimit = 16_000;

export class UnReviewStorageError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

async function assertDirectory(path: string) {
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Invalid review storage directory.");
}

async function readRecord(path: string): Promise<UnSavedReview | undefined> {
  let handle;
  try { handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW); }
  catch (error) { if (hasCode(error, "ENOENT")) return undefined; throw error; }
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > 1_000_000) throw new Error("Invalid saved review file.");
    const contents = await handle.readFile("utf8");
    try { return recordSchema.parse(JSON.parse(contents)); }
    catch { throw new Error("Invalid saved review file."); }
  } finally { await handle.close(); }
}

/** Atomic publication also handles simultaneous retries from multiple server processes. */
async function publishOnce(path: string, record: UnSavedReview) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(record), { flag: "wx", mode: 0o600 });
  try { await link(temporary, path); }
  catch (error) { if (!hasCode(error, "EEXIST")) throw error; }
  finally { await unlink(temporary); }
}

/** A local mock database; browser sessions have independent review histories. */
export class UnReviewService {
  private directory: string;
  constructor(directory: string) { this.directory = resolve(directory); }

  private async sessionDirectory(session: string, create: boolean): Promise<string | undefined> {
    if (!/^[a-f0-9]{64}$/.test(session)) throw new UnReviewStorageError("Invalid browser session.", 403);
    if (create) await mkdir(this.directory, { recursive: true, mode: 0o700 });
    try { await assertDirectory(this.directory); }
    catch (error) { if (!create && hasCode(error, "ENOENT")) return undefined; throw error; }
    const root = await realpath(this.directory);
    const directory = join(root, digest(session));
    if (create) await mkdir(directory, { recursive: true, mode: 0o700 });
    try { await assertDirectory(directory); }
    catch (error) { if (!create && hasCode(error, "ENOENT")) return undefined; throw error; }
    // A session can never select its path or follow a linked directory outside this database.
    if (await realpath(directory) !== directory) throw new Error("Invalid review storage path.");
    return directory;
  }

  async list(session: string): Promise<UnSavedReview[]> {
    const directory = await this.sessionDirectory(session, false);
    if (!directory) return [];
    const entries = await readdir(directory, { withFileTypes: true });
    const records = await Promise.all(entries
      .filter((entry) => /^[a-f0-9]{64}\.saved\.json$/.test(entry.name))
      .map((entry) => readRecord(join(directory, entry.name))));
    return records.filter((record): record is UnSavedReview => !!record)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  }

  async save(session: string, value: unknown): Promise<UnSavedReview> {
    if (!value || typeof value !== "object" || !("approved" in value) || value.approved !== true)
      throw new UnReviewStorageError("Review the packet and approve saving the internal record.", 403);
    const { approved: _approved, ...fields } = inputSchema.parse(value);
    const unit = demoUnits.find((candidate) => candidate.id === fields.unitId);
    if (!unit) throw new UnReviewStorageError("Choose a unit from the UN demo portfolio.");
    // No client-supplied calculation, source, status, or notice body is accepted.
    const packet = reviewUnit(unit, fields.asOf, fields.preferences);
    const directory = await this.sessionDirectory(session, true);
    if (!directory) throw new Error("Review storage is unavailable.");
    // Seed, source, rule, and template changes create a new immutable snapshot even
    // when the manager submits the same inputs. Identical packet versions dedupe.
    const savedPath = join(directory, `${digest(canonicalJson({ input: fields, packet }))}.saved.json`);
    const existing = await readRecord(savedPath);
    if (existing) return existing;
    const record: UnSavedReview = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      simulationDate: fields.asOf,
      preferences: fields.preferences,
      reviewerNote: fields.reviewerNote,
      packet,
      destination: "local",
    };
    // Blocked cases may be retained as follow-ups; saving never marks a notice sent.
    await publishOnce(savedPath, record);
    const saved = await readRecord(savedPath);
    if (!saved) throw new Error("The saved review could not be read back.");
    return saved;
  }
}

async function readBody(request: Request) {
  const advertisedLength = Number(request.headers.get("content-length"));
  if (advertisedLength > bodyLimit) throw new UnReviewStorageError("The review request is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let bytes = 0;
  let body = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > bodyLimit) {
        await reader.cancel();
        throw new UnReviewStorageError("The review request is too large.", 413);
      }
      body += decoder.decode(value, { stream: true });
    }
    return body + decoder.decode();
  } finally { reader.releaseLock(); }
}

export function createUnReviewsHandler(options: { directory: string }) {
  const service = new UnReviewService(options.directory);
  return async (request: Request): Promise<Response> => {
    const expected = trustedAppOrigin(request);
    if (!expected) return Response.json({ error: "Untrusted app host." }, { status: 403 });
    const cookie = request.headers.get("cookie")?.split(";").map((part) => part.trim())
      .find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    const hasSession = !!cookie && /^[a-f0-9]{64}$/.test(cookie);
    const session = hasSession ? cookie : randomBytes(32).toString("hex");
    const reply = (value: unknown, status = 200) => Response.json(value, {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...(!hasSession ? { "Set-Cookie": `${cookieName}=${session}; HttpOnly; SameSite=Strict; Path=/api/un/reviews; Max-Age=2592000${expected.protocol === "https:" ? "; Secure" : ""}` } : {}),
        ...(status === 405 ? { Allow: "GET, POST" } : {}),
      },
    });
    if (request.method !== "GET" && request.method !== "POST") return reply({ error: "Method not allowed." }, 405);
    if (request.method === "POST" && (!hasSession || request.headers.get("origin") !== expected.origin ||
      request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json"))
      return reply({ error: "Reload UN and use its review-and-save action to save this packet." }, 403);
    try {
      if (request.method === "GET") return reply({ records: await service.list(session) });
      return reply({ record: await service.save(session, JSON.parse(await readBody(request))) });
    } catch (error) {
      if (error instanceof UnReviewStorageError) return reply({ error: error.message }, error.status);
      if (error instanceof z.ZodError || error instanceof SyntaxError || error instanceof RangeError)
        return reply({ error: "Invalid review. Check the demo unit, simulation date, preferences, and reviewer note." }, 400);
      return reply({ error: "Unable to save or read this review. Check local storage and retry the same packet." }, 502);
    }
  };
}

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { link, mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { trustedAppOrigin } from "./deployment";
import { join } from "node:path";
import { z } from "zod";
import type { PropertyPlan } from "../property-plan-types";
import { FollowupError } from "./followup-error";
import type { Workplace, WorkplaceTask } from "./workplace";

const stepSchema = z.object({
  title: z.string().trim().min(1).max(200),
  owner: z.string().trim().min(1).max(150),
  details: z.string().trim().min(1).max(2000),
}).strict();
const fieldsSchema = z.object({
  title: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(100),
  steps: z.array(stepSchema).min(1).max(20),
  toolIds: z.array(z.string().trim().regex(/^[a-zA-Z0-9_-]{1,80}$/)).max(20)
    .transform((ids) => [...new Set(ids)].sort()),
  destination: z.enum(["local", "ambiguous"]),
});
const inputSchema = fieldsSchema.extend({ approved: z.literal(true) }).strict();
const planSchema = fieldsSchema.extend({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  externalTask: z.object({ id: z.string().min(1), url: z.string().nullable() }).optional(),
});
const draftSchema = z.object({
  plan: planSchema,
  identityId: z.string(),
  workspaceId: z.string(),
  description: z.string(),
});
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const hasCode = (error: unknown, code: string) =>
  error instanceof Error && "code" in error && error.code === code;
export class PropertyPlanError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
const uncertain = () => new PropertyPlanError(
  "The Ambiguous save is still in progress or its outcome is uncertain. Retry this same workflow to check for the existing record; it will not be sent twice.", 409,
);

// Publish complete files atomically, without replacing a concurrent request's record.
async function createOnce(path: string, value: unknown): Promise<boolean> {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value), { flag: "wx", mode: 0o600 });
  try {
    await link(temporary, path);
    return true;
  } catch (error) {
    if (hasCode(error, "EEXIST")) return false;
    throw error;
  } finally {
    await unlink(temporary);
  }
}
async function readOptional(path: string): Promise<unknown | undefined> {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch (error) { if (hasCode(error, "ENOENT")) return undefined; throw error; }
}

/** Stores only the reviewed plan and save metadata, never assessment/profile/email context. */
export class PropertyPlanService {
  constructor(private directory: string, private workplace?: Workplace) {}

  private sessionDirectory(session: string) {
    if (!/^[a-f0-9]{64}$/.test(session)) throw new PropertyPlanError("Invalid browser session.", 403);
    return join(this.directory, digest(session));
  }

  async list(session: string): Promise<PropertyPlan[]> {
    const directory = this.sessionDirectory(session);
    let files: string[];
    try { files = await readdir(directory); }
    catch (error) { if (hasCode(error, "ENOENT")) return []; throw error; }
    const plans = await Promise.all(files.filter((file) => /^[a-f0-9]{64}\.saved\.json$/.test(file))
      .map(async (file) => planSchema.parse(JSON.parse(await readFile(join(directory, file), "utf8")))));
    return plans.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async save(session: string, value: unknown): Promise<PropertyPlan> {
    if (!value || typeof value !== "object" || !("approved" in value) || value.approved !== true)
      throw new PropertyPlanError("Review the workflow and explicitly approve saving it.", 403);
    const { approved: _approved, ...fields } = inputSchema.parse(value);
    const directory = this.sessionDirectory(session);
    const key = digest(JSON.stringify(fields));
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const savedPath = join(directory, `${key}.saved.json`);
    const existing = await readOptional(savedPath);
    if (fields.destination === "local") {
      if (existing) return planSchema.parse(existing);
      const plan = { ...fields, id: randomUUID(), createdAt: new Date().toISOString() };
      await createOnce(savedPath, plan);
      return planSchema.parse(await readOptional(savedPath));
    }

    if (!this.workplace) throw new PropertyPlanError("Ambiguous is not configured. Choose Save locally, or configure AMBIGUOUS_API_KEY and restart the app.", 503);
    const workplace = this.workplace;
    const identity = await workplace.identity();
    const draftPath = join(directory, `${key}.draft.json`);
    const marker = `property-workflow:${digest(`${digest(session)}:${key}`)}`;
    const proposed = {
      plan: { ...fields, id: randomUUID(), createdAt: new Date().toISOString() },
      identityId: identity.id,
      workspaceId: identity.workspaceId,
      description: [
        `Property operations workflow: ${fields.category}`,
        ...fields.steps.map((step, i) => `${i + 1}. ${step.title}\nOwner: ${step.owner}\n${step.details}`),
        `Tools to evaluate: ${fields.toolIds.join(", ") || "None selected"}`,
        "Saved as a planning task; no resident messages, vendor dispatches, or property-system changes have been executed.",
        marker,
      ].join("\n\n"),
    };
    await createOnce(draftPath, proposed);
    const draft = draftSchema.parse(await readOptional(draftPath));
    if (draft.identityId !== identity.id || draft.workspaceId !== identity.workspaceId)
      throw new PropertyPlanError("The connected Ambiguous identity or workspace changed. Restore the original connection before retrying this workflow.", 409);

    const readBack = async (id: string) => {
      const task = await workplace.get(id);
      if (task.id !== id || task.title !== draft.plan.title || task.description !== draft.description)
        throw new PropertyPlanError("The Ambiguous record differs from the approved workflow. Inspect it before making another save.", 409);
      // A link is optional and must come from the provider; never construct one.
      if (task.url) {
        const url = new URL(task.url);
        if (url.protocol !== "https:" || url.hostname !== "app.ambiguous.ai" || url.username || url.password)
          throw new PropertyPlanError("Ambiguous returned an unsafe record link.", 502);
      }
      const plan = { ...draft.plan, externalTask: { id: task.id, url: task.url } };
      await createOnce(savedPath, plan);
      return plan;
    };
    const reconcile = async () => {
      const matches = (await workplace.list(marker)).filter((task) =>
        task.title === draft.plan.title && task.description === draft.description);
      if (matches.length > 1) throw new PropertyPlanError("Ambiguous contains multiple matching workflow records. Inspect the workspace before continuing.", 409);
      return matches[0] ? readBack(matches[0].id) : undefined;
    };
    if (existing) {
      const plan = planSchema.parse(existing);
      if (!plan.externalTask) throw new PropertyPlanError("The saved Ambiguous record is missing its provider ID.", 502);
      return readBack(plan.externalTask.id);
    }
    const reconciled = await reconcile();
    if (reconciled) return reconciled;
    let attempted = false;
    let conflict = false;
    let created: WorkplaceTask;
    try {
      created = await workplace.create(draft.plan.title, draft.description, async () => {
        // Existing adapter calls this only after live input-schema validation.
        const current = await workplace.identity();
        if (current.id !== draft.identityId || current.workspaceId !== draft.workspaceId)
          throw new PropertyPlanError("The Ambiguous identity changed before saving. Nothing was sent.", 409);
        if (!await createOnce(join(directory, `${key}.attempt.json`), { planId: draft.plan.id, attemptedAt: new Date().toISOString() })) {
          conflict = true;
          throw uncertain();
        }
        attempted = true;
      });
    } catch (error) {
      if (conflict) {
        const recovered = await reconcile();
        if (recovered) return recovered;
      }
      if (attempted || conflict) throw uncertain();
      throw error;
    }
    try { return await readBack(created.id); }
    catch (error) {
      if (error instanceof PropertyPlanError) throw error;
      throw uncertain();
    }
  }
}

const cookieName = "property-plan-session";
export function createPropertyPlansHandler(options: {
  directory: string;
  isAmbiguousConfigured(): boolean;
  connect(): { workplace: Workplace; close(): Promise<void> } | undefined;
}) {
  return async (request: Request): Promise<Response> => {
    const expected = trustedAppOrigin(request);
    if (!expected) return Response.json({ error: "Untrusted app host." }, { status: 403 });
    const cookie = request.headers.get("cookie")?.split(";").map((part) => part.trim())
      .find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    const hasSession = !!cookie && /^[a-f0-9]{64}$/.test(cookie);
    const session = hasSession ? cookie : randomBytes(32).toString("hex");
    const reply = (value: unknown, status = 200) => Response.json(value, {
      status,
      headers: { "Cache-Control": "no-store", ...(!hasSession ? {
        "Set-Cookie": `${cookieName}=${session}; HttpOnly; SameSite=Strict; Path=/api/plans; Max-Age=2592000${expected.protocol === "https:" ? "; Secure" : ""}`,
      } : {}) },
    });
    if (request.method !== "GET" && request.method !== "POST") return reply({ error: "Method not allowed." }, 405);
    if (request.method === "POST" && (!hasSession || request.headers.get("origin") !== expected.origin ||
      request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json"))
      return reply({ error: "Reload this app and use its Save workflow button to approve the action." }, 403);
    let connection: ReturnType<typeof options.connect> = undefined;
    try {
      if (request.method === "GET") return reply({
        plans: await new PropertyPlanService(options.directory).list(session),
        ambiguousConfigured: options.isAmbiguousConfigured(),
      });
      const body = await request.text();
      if (body.length > 32_000) return reply({ error: "The workflow is too large." }, 413);
      const input: unknown = JSON.parse(body);
      // Validate consent and all fields before touching any provider connection.
      if (!input || typeof input !== "object" || !("approved" in input) || input.approved !== true)
        return reply({ error: "Review the workflow and explicitly approve saving it." }, 403);
      const parsed = inputSchema.parse(input);
      if (parsed.destination === "ambiguous") connection = options.connect();
      const plan = await new PropertyPlanService(options.directory, connection?.workplace).save(session, parsed);
      return reply({ plan });
    } catch (error) {
      if (error instanceof PropertyPlanError) return reply({ error: error.message }, error.status);
      if (error instanceof z.ZodError || error instanceof SyntaxError)
        return reply({ error: "Invalid workflow. Check its title, category, steps, tools, and destination." }, 400);
      if (error instanceof FollowupError) return reply({ error: error.message }, 502);
      return reply({ error: "Unable to save or read this workflow. Check server storage and the selected provider, then retry the same workflow." }, 502);
    } finally {
      try { await connection?.close(); } catch { /* Never expose credential-bearing transport errors. */ }
    }
  };
}

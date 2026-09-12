import { randomUUID } from "node:crypto";
import { CopilotRuntime, createCopilotHonoHandler } from "@copilotkit/runtime/v2";
import { makeAgent } from "agent-core";
import { UN_WORKBENCH_PROMPT } from "@/lib/un-workbench-prompt";

const runtime = new CopilotRuntime({
  agents: () => ({ default: makeAgent(randomUUID(), { workplace: false, prompt: UN_WORKBENCH_PROMPT }) }),
});
const app = createCopilotHonoHandler({ runtime, basePath: "/api/un/workbench-agent" });
export const GET = app.fetch;
export const POST = app.fetch;
export const OPTIONS = app.fetch;

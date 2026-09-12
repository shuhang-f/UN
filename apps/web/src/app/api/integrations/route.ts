import { isSearchConfigured, isWorkplaceConfigured, resolveModel } from "agent-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Configuration presence only: no provider calls, token values, or mailbox access. */
export function GET() {
  let modelConfigured = false;
  try {
    resolveModel();
    modelConfigured = true;
  } catch {
    // resolveModel validates the selected provider, rather than any unrelated key.
  }

  return Response.json(
    {
      modelConfigured,
      exaConfigured: isSearchConfigured() && Boolean(process.env.EXA_API_KEY?.trim()),
      ambiguousConfigured:
        isWorkplaceConfigured() && Boolean(process.env.AMBIGUOUS_API_KEY?.trim()),
      emailConnected: false,
      emailMode: "selected-messages",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

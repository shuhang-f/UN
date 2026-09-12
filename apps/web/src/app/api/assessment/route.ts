import { z } from "zod";
import { analyzeProperty } from "@/lib/property-analysis";
import { trustedAppOrigin } from "@/lib/server/deployment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const text = (max: number) => z.string().max(max);
const inputSchema = z.object({
  profile: z.object({
    name: text(160), email: text(254), company: text(200), website: text(500),
    role: text(160), units: text(80), system: text(160),
    focus: z.enum(["vacancy", "maintenance", "both", "rent-control"]), jurisdiction: text(200).optional(), property: text(300).optional(), context: text(6000),
  }).strict(),
  messages: z.array(z.object({
    id: z.string().min(1).max(100), from: text(254), subject: text(500),
    body: text(8000), source: z.enum(["sample", "pasted"]),
  }).strict()).max(30).refine((messages) => new Set(messages.map((message) => message.id)).size === messages.length, "Message IDs must be unique."),
}).strict();

const maxBytes = 100_000;
const reply = (value: unknown, status = 200) => Response.json(value, {
  status, headers: { "Cache-Control": "no-store" },
});

export async function POST(request: Request) {
  const expected = trustedAppOrigin(request);
  if (
    !expected ||
    request.headers.get("origin") !== expected.origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  ) {
    return reply({ error: "Open this assessment from the app's own page." }, 403);
  }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return reply({ error: "Send assessment data as JSON." }, 400);
  }
  if (Number(request.headers.get("content-length")) > maxBytes) return reply({ error: "The assessment is too large. Use fewer or shorter messages." }, 413);
  try {
    // Limit streamed bytes too, so a missing or incorrect Content-Length cannot bypass the cap.
    const reader = request.body?.getReader();
    if (!reader) return reply({ error: "Assessment data is required." }, 400);
    let bytes = 0;
    let body = "";
    const decoder = new TextDecoder();
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        return reply({ error: "The assessment is too large. Use fewer or shorter messages." }, 413);
      }
      body += decoder.decode(chunk.value, { stream: true });
    }
    body += decoder.decode();
    const input = inputSchema.parse(JSON.parse(body));
    // Pure local rules: no mailbox connection, website request, persistence, or external message.
    return reply({ report: analyzeProperty(input) });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return reply({ error: "Check the profile and messages. Use unique message IDs and keep each message under 8,000 characters." }, 400);
    }
    return reply({ error: "Unable to read the assessment. Please try again." }, 400);
  }
}

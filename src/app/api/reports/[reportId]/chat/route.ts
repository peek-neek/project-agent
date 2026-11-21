import { auth } from "@clerk/nextjs/server";
import { chat } from "@trigger.dev/sdk/chat-server";
import { parseTravelMode } from "@/lib/travel";
import {
  chatInstructions,
  chatModel,
  chatProviderOptions,
  headStartTools,
} from "@/server/ai/property-chat";
import { chatRefusalMessage, getChatAllowance } from "@/server/entitlements";
import { createRateLimiter } from "@/server/rate-limit";
import { reportIdOfChat, reportStore } from "@/server/report-store";

/**
 * Head Start for a chat's first message: step 1's model call runs here, in
 * the warm Next.js server, while the Trigger.dev agent boots in parallel.
 * If step 1 calls a tool (Maps, routes) the agent takes over and runs it;
 * a pure-text first answer never wakes the model on the agent side. Later
 * messages go straight to the agent.
 *
 * Imports stay light: tool schemas only (lib/chat-tools), never the
 * Trigger task module or the tool executes.
 */

// Step 1 plus, when it calls tools, the agent's step 2 streamed through here.
export const maxDuration = 120;

/** New chats per agent: a ceiling on runaway cost. */
const limiter = createRateLimiter("report:chat-start", [
  { limit: 20, windowMs: 10 * 60_000 },
  { limit: 200, windowMs: 24 * 60 * 60_000 },
]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const { reportId } = await params;
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  // The wire payload: { chatId, messages, metadata } (metadata = clientData).
  const body = (await req
    .clone()
    .json()
    .catch(() => null)) as {
    chatId?: string;
    metadata?: { travelMode?: string };
  } | null;
  const chatId = body?.chatId;
  if (!chatId || reportIdOfChat(chatId) !== reportId) {
    return new Response("Bad request", { status: 400 });
  }
  const report = await reportStore.findWithDetails(reportId);
  if (!report || report.userId !== userId) {
    return new Response("Not found", { status: 404 });
  }
  // Only the report's current thread can be started.
  const thread = await reportStore.getChatThread(reportId);
  if (thread?.chatId !== chatId) {
    return new Response("This chat has ended", { status: 409 });
  }
  // Monthly AI chat allowance: refuse before the warm model call. The agent
  // checks again on every turn (onTurnStart) and records usage.
  const allowance = await getChatAllowance(userId);
  if (!allowance.allowed) {
    return new Response(chatRefusalMessage(allowance), { status: 402 });
  }
  const limit = limiter.check(userId);
  if (!limit.success) {
    return new Response(
      `Too many new chats. Try again in ${Math.ceil(limit.retryAfterMs / 60_000)} min.`,
      { status: 429 },
    );
  }
  const picked = chatModel();
  if (!picked) {
    return new Response("AI isn't configured. Add OPENAI_API_KEY.", {
      status: 503,
    });
  }

  const mode = parseTravelMode(body.metadata?.travelMode);
  const webSearch = picked.provider === "openai";
  // Same model and instructions as the agent, so step 2 reads seamlessly.
  const handler = chat.headStart({
    agentId: "property-chat",
    run: async ({ streamText }) =>
      streamText({
        model: picked.model,
        instructions: chatInstructions(report, mode, webSearch),
        tools: headStartTools(report.property?.city, webSearch, report.property?.province),
        providerOptions: chatProviderOptions(picked.provider, reportId),
      }),
  });
  return handler(req);
}

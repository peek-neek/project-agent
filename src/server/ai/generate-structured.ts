// Structured generation with provider fallback: OpenAI → Claude → Gemini.
// Shared by Next.js and Trigger.dev tasks (no "server-only" import).
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { generateText, type LanguageModel, Output } from "ai";
import type { z } from "zod";

export type AiProviderId = "openai" | "anthropic" | "google";

type Provider = {
  id: AiProviderId;
  label: string;
  apiKeyEnv: string;
  modelEnv: string;
  defaultModel: string;
  create: (modelId: string) => LanguageModel;
};

/** Tried in this order. Model IDs can be overridden with the *_MODEL env vars. */
const PROVIDERS: Provider[] = [
  {
    id: "openai",
    label: "OpenAI",
    apiKeyEnv: "OPENAI_API_KEY",
    modelEnv: "OPENAI_MODEL",
    defaultModel: "gpt-6-astra",
    create: (id) => openai(id),
  },
  {
    id: "anthropic",
    label: "Claude",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    modelEnv: "ANTHROPIC_MODEL",
    defaultModel: "claude-opus-5-5",
    create: (id) => anthropic(id),
  },
  {
    id: "google",
    label: "Gemini",
    apiKeyEnv: "GOOGLE_GENERATIVE_AI_API_KEY",
    modelEnv: "GEMINI_MODEL",
    defaultModel: "gemini-4-argon",
    create: (id) => google(id),
  },
];

export type GeneratedBy = { provider: AiProviderId; model: string };

export class AiUnavailableError extends Error {
  constructor(readonly attempts: string[]) {
    const configured = attempts.some((a) => !a.endsWith("not configured"));
    super(
      configured
        ? `All AI providers failed. ${attempts.join(" · ")}`.slice(0, 500)
        : "AI isn't configured. Add OPENAI_API_KEY, ANTHROPIC_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY.",
    );
  }
}

const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message.split("\n")[0].slice(0, 160)
    : String(error);

export async function generateStructured<S extends z.ZodType>({
  schema,
  instructions,
  prompt,
  timeoutMs = 90_000,
}: {
  schema: S;
  instructions: string;
  prompt: string;
  /** Per provider, so a hung provider fails over instead of stalling. */
  timeoutMs?: number;
}): Promise<{ output: z.infer<S>; generatedBy: GeneratedBy }> {
  const attempts: string[] = [];

  for (const provider of PROVIDERS) {
    if (!process.env[provider.apiKeyEnv]) {
      attempts.push(`${provider.label}: not configured`);
      continue;
    }
    const model = process.env[provider.modelEnv] || provider.defaultModel;
    try {
      const result = await generateText({
        model: provider.create(model),
        instructions,
        prompt,
        output: Output.object({ schema }),
        maxRetries: 1,
        abortSignal: AbortSignal.timeout(timeoutMs),
      });
      return {
        output: result.output as z.infer<S>,
        generatedBy: { provider: provider.id, model },
      };
    } catch (error) {
      const message = `${provider.label} (${model}): ${errorMessage(error)}`;
      attempts.push(message);
      const isLast = provider === PROVIDERS[PROVIDERS.length - 1];
      console.warn(`[ai] ${message}${isLast ? "" : " — trying next provider"}`);
    }
  }

  throw new AiUnavailableError(attempts);
}

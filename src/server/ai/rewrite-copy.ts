// One-click rewrite or translation of a piece of marketing copy.
// Shared by Next.js and Trigger.dev tasks (no "server-only" import).
import { z } from "zod";
import {
  type Language,
  REWRITE_ACTIONS,
  type RewriteAction,
} from "../../lib/copy-actions";
import { generateStructured } from "./generate-structured";

const INSTRUCTIONS = `You edit real estate marketing copy for agents in Ontario, Canada.

Rules:
- Keep every fact exactly as given: names, numbers, times, distances. Never add facts, amenities, features or claims that aren't in the text.
- Keep placeholders such as [date], [time] and [new price] exactly as written.
- Keep the format: line breaks, emoji and hashtags stay where they are (translate hashtag words only when translating, and keep the #).
- Follow the Ontario Human Rights Code and RECO advertising rules: never describe, target or exclude buyers by race, ancestry, place of origin, ethnicity, citizenship, creed or religion, sex, sexual orientation, gender identity, age, marital or family status, or disability. Never call an area "safe" or "low-crime", never call a school "best" or say the home is in a school's catchment, and never promise value growth.
- Return only the rewritten text, with no notes or quotation marks.`;

export async function rewriteCopy({
  text,
  action,
  language,
}: {
  text: string;
  action: RewriteAction;
  language?: Language;
}) {
  const task =
    action === "translate"
      ? `Translate the text into ${language ?? "French"}. Keep street, place, school and business names, and numbers, as they are. Use natural, fluent ${language ?? "French"} that a local real estate agent would write.`
      : REWRITE_ACTIONS[action].instruction;
  const { output, generatedBy } = await generateStructured({
    schema: z.object({ text: z.string() }),
    instructions: INSTRUCTIONS,
    prompt: `<task>${task}</task>\n\n<text>\n${text}\n</text>`,
    timeoutMs: 45_000,
  });
  return { text: output.text.trim(), generatedBy };
}

import { z } from "zod";

// Shared (server, client, PDF and the Remotion composition): whose branding a
// PDF or video carries. Pro agents get their own; everyone else Areaview's.

/**
 * The agent's details as they type them (all optional, trimmed). Kept
 * small on purpose: it's a footer line, so brokerage and contacts only.
 */
export const agentBrandingInputSchema = z.object({
  brokerage: z.string().trim().max(120),
  phone: z.string().trim().max(40),
  email: z.union([z.literal(""), z.string().trim().email().max(120)]),
  website: z.string().trim().max(120),
});
export type AgentBrandingInput = z.infer<typeof agentBrandingInputSchema>;

export const EMPTY_AGENT_BRANDING: AgentBrandingInput = {
  brokerage: "",
  phone: "",
  email: "",
  website: "",
};

/** Logo or headshot: PNG or JPEG (what the PDF renderer can embed). */
export const LOGO_TYPES = ["image/png", "image/jpeg"] as const;
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;

/** What a PDF or video actually shows. `logoSrc` is a URL, null for none. */
export type Branding =
  | { kind: "areaview" }
  | ({ kind: "agent"; logoSrc: string | null } & AgentBrandingInput);

export const AREAVIEW = {
  name: "Areaview",
  tagline: "AI property reports for real estate agents",
  /** The house mark (24×24 viewBox), same as the site's logo. */
  markPath:
    "M12 2 3 8v14h6v-7h6v7h6V8l-9-6Zm0 3.2 6 4V19h-1v-6.5H7V19H6V9.2l6-4Z",
} as const;

/** Enough to sign off with: the brokerage's name. */
export const hasAgentIdentity = (b: Pick<AgentBrandingInput, "brokerage">) =>
  Boolean(b.brokerage.trim());

/** Contact lines in display order, empty ones dropped. */
export const contactLines = (b: AgentBrandingInput) =>
  [b.phone, b.email, b.website].filter((x) => x.trim() !== "");

/**
 * Stable key for what the branding looks like: a video export is redone
 * when it changes (FNV-1a). Pass a stable `logoSrc` (the stored pathname),
 * not a signed URL that changes on every call.
 */
export function brandingKey(branding: Branding) {
  const text = JSON.stringify(
    branding.kind === "areaview"
      ? ["areaview"]
      : [
          branding.brokerage,
          branding.phone,
          branding.email,
          branding.website,
          branding.logoSrc,
        ],
  );
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

// One-click rewrites for any piece of generated copy. Shared by the UI
// (menu labels) and the server (instructions).

export const REWRITE_ACTIONS = {
  shorter: {
    label: "Shorter",
    instruction:
      "Make it about 40% shorter. Keep the strongest facts and the call to action.",
  },
  longer: {
    label: "Longer",
    instruction:
      "Make it about 40% longer by expanding on facts already in the text. Do not add new facts.",
  },
  luxury: {
    label: "More luxurious",
    instruction:
      "Rewrite in a refined, upscale tone: elegant and understated, never exaggerated.",
  },
  casual: {
    label: "More casual",
    instruction: "Rewrite in a friendly, conversational, plain-spoken tone.",
  },
  translate: {
    label: "Translate",
    instruction: "Translate it.",
  },
} as const;
export type RewriteAction = keyof typeof REWRITE_ACTIONS;

/** Common languages among GTA and Ontario buyers. */
export const LANGUAGES = [
  "French",
  "Simplified Chinese",
  "Traditional Chinese",
  "Punjabi",
  "Hindi",
  "Urdu",
  "Tagalog",
  "Spanish",
  "Arabic",
  "Tamil",
  "Persian",
  "Portuguese",
  "Italian",
  "Korean",
  "Russian",
  "Gujarati",
] as const;
export type Language = (typeof LANGUAGES)[number];

/** Longest text accepted for a rewrite. */
export const REWRITE_MAX_CHARS = 6000;

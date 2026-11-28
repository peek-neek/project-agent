import path from "node:path";
import { Font, StyleSheet } from "@react-pdf/renderer";

// Inter, as in the app. Files live next to this module and are traced into
// the PDF route's bundle (next.config.ts, outputFileTracingIncludes).
const FONT_DIR = path.join(process.cwd(), "src/server/pdf/fonts");
let registered = false;
export function registerFonts() {
  if (registered) return;
  registered = true;
  Font.register({
    family: "Inter",
    fonts: [400, 500, 600, 700].map((fontWeight) => ({
      src: path.join(FONT_DIR, `Inter-${fontWeight}.ttf`),
      fontWeight,
    })),
  });
  // Never break words with hyphens: addresses and names must stay whole.
  Font.registerHyphenationCallback((word) => [word]);
}

/** Warm neutrals and the app's red, used sparingly. */
export const C = {
  ink: "#1c1917",
  body: "#44403c",
  muted: "#78716c",
  faint: "#a8a29e",
  line: "#e7e5e4",
  wash: "#f6f5f4",
  accent: "#c4161c",
  good: "#16a34a",
  warn: "#d97706",
  white: "#ffffff",
} as const;

/** US Letter, the Ontario standard. */
export const PAGE = {
  size: "LETTER" as const,
  margin: 44,
  top: 58,
  bottom: 66,
  /** Width inside the margins: 612 − 2 × 44. */
  content: 524,
};

export const s = StyleSheet.create({
  page: {
    fontFamily: "Inter",
    fontSize: 9,
    lineHeight: 1.45,
    color: C.body,
    paddingTop: PAGE.top,
    paddingBottom: PAGE.bottom,
    paddingHorizontal: PAGE.margin,
  },
  runningHeader: {
    position: "absolute",
    top: 24,
    left: PAGE.margin,
    right: PAGE.margin,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: C.faint,
  },
  footer: {
    position: "absolute",
    bottom: 22,
    left: PAGE.margin,
    right: PAGE.margin,
    height: 28,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  /** Bottom left of every page: Areaview's brand, or the Pro agent's. */
  brandSlot: { width: 300, height: 28 },
  pageNumber: { fontSize: 7.5, color: C.faint },

  eyebrow: {
    fontSize: 7.5,
    fontWeight: 600,
    color: C.accent,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  h1: {
    fontSize: 22,
    fontWeight: 700,
    color: C.ink,
    lineHeight: 1.2,
    marginTop: 4,
  },
  lede: { fontSize: 10, color: C.muted, marginTop: 4, lineHeight: 1.5 },
  h2: {
    fontSize: 12,
    fontWeight: 600,
    color: C.ink,
    marginTop: 18,
    marginBottom: 6,
  },
  h3: { fontSize: 10, fontWeight: 600, color: C.ink, marginBottom: 3 },
  p: { fontSize: 9, lineHeight: 1.55, color: C.body },
  small: { fontSize: 7.5, color: C.muted, lineHeight: 1.45 },
  strong: { fontWeight: 600, color: C.ink },
  card: {
    borderWidth: 1,
    borderColor: C.line,
    padding: 10,
  },
  row: { flexDirection: "row" },
});

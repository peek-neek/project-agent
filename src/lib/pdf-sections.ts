/**
 * The PDF's optional sections, in PDF order: the download dialog's
 * checkboxes and the `?sections=` filter the PDF route accepts. The cover
 * and contents pages are always included. Ids match `sectionsFor` in
 * `src/server/pdf/render.tsx`.
 */
export const PDF_SECTIONS = [
  { id: "scores", label: "Scores" },
  { id: "overview", label: "Overview" },
  { id: "story", label: "Neighbourhood story" },
  { id: "amenities", label: "Amenities" },
  { id: "commute", label: "Commute & transit" },
  { id: "schools", label: "Schools" },
  { id: "safety", label: "Safety & environment" },
  { id: "neighbourhood", label: "Neighbourhood" },
  { id: "upside", label: "Future upside" },
  { id: "finance", label: "Financial scenarios" },
  { id: "marketing", label: "Marketing kit" },
  { id: "campaign", label: "Listing campaign" },
  { id: "playbook", label: "Showing playbook" },
  { id: "details", label: "Property details" },
] as const;

export type PdfSectionId = (typeof PDF_SECTIONS)[number]["id"];

const IDS = new Set<string>(PDF_SECTIONS.map((s) => s.id));

export const isPdfSectionId = (id: string): id is PdfSectionId => IDS.has(id);

/**
 * `?sections=a,b,c` → the chosen sections. `null` when the parameter is
 * absent (everything); an empty set when it names no known section.
 */
export function parsePdfSections(
  param: string | null,
): ReadonlySet<PdfSectionId> | null {
  if (param == null) return null;
  return new Set(param.split(",").map((s) => s.trim()).filter(isPdfSectionId));
}

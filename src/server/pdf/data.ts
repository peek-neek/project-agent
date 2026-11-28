import type { z } from "zod";
import type { PdfBrand } from "./primitives";
import { marketScore } from "@/lib/market-score";
import {
  amenitiesSchema,
  campaignSchema,
  commuteSchema,
  copySectionKey,
  demographicsSchema,
  insightsSchema,
  listingSchema,
  marketingSchema,
  SECTION_KEYS,
  safetySchema,
  schoolsSchema,
  showingSchema,
  upsideSchema,
} from "@/lib/report-sections";
import {
  amenitiesScore,
  commuteScore,
  neighbourhoodScore,
  safetyScore,
  schoolsScore,
  upsideScore,
} from "@/lib/section-scores";
import { savedCalculatorsSchema } from "@/lib/finance/scenario";
import type { TravelMode } from "@/lib/travel";
import type { reportStore } from "../report-store";

export type PdfReport = NonNullable<
  Awaited<ReturnType<typeof reportStore.findForUser>>
>;

export type PdfImage = { data: Buffer; format: "png" | "jpg" };

export type PdfImages = {
  /** Satellite photos of the property, by zoom level (server/satellite.ts). */
  aerial: Partial<Record<"home" | "street" | "block" | "area", PdfImage>>;
  maps: Partial<
    Record<"overview" | "transit" | "schools" | "upside", PdfImage>
  >;
  /** Google Places photo per amenity / transit stop id. */
  places: Record<string, PdfImage>;
  /** Street View photo per school id. */
  schools: Record<string, PdfImage>;
};

const MODES: TravelMode[] = ["walk", "drive"];

/** PDF fonts have no emoji: drop them (and their joiners) from AI copy. */
const EMOJI =
  /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}\u{20E3}]/gu;
function stripEmoji<T>(value: T): T {
  if (typeof value === "string") {
    return value
      .replace(EMOJI, "")
      .replace(/^[ \t]+/gm, "")
      .replace(/[ \t]{2,}/g, " ") as T;
  }
  if (Array.isArray(value)) return value.map(stripEmoji) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, stripEmoji(v)]),
    ) as T;
  }
  return value;
}

/** Everything the PDF shows, parsed once. */
export function pdfData(report: PdfReport, copyMode: TravelMode) {
  const get = <S extends z.ZodType>(
    key: string,
    schema: S,
  ): z.infer<S> | null => {
    const row = report.sections.find((x) => x.key === key);
    if (!row) return null;
    const parsed = schema.safeParse(row.data);
    return parsed.success ? parsed.data : null;
  };
  // AI copy: the chosen mode's own copy, else the report's single copy.
  const copy = <S extends z.ZodType>(key: string, schema: S) =>
    stripEmoji(get(copySectionKey(key, copyMode), schema) ?? get(key, schema));

  const amenities = get(SECTION_KEYS.amenities, amenitiesSchema);
  const commute = get(SECTION_KEYS.commute, commuteSchema);
  const schools = get(SECTION_KEYS.schools, schoolsSchema);
  const safety = get(SECTION_KEYS.safety, safetySchema);
  const demographics = get(SECTION_KEYS.demographics, demographicsSchema);
  const upside = get(SECTION_KEYS.upside, upsideSchema);
  const listing = get(SECTION_KEYS.listing, listingSchema);

  // Scores for every mode side by side (no section repeated per mode).
  const scores = Object.fromEntries(
    MODES.map((m) => [
      m,
      {
        amenities: amenitiesScore(amenities, m)?.score ?? null,
        commute: commuteScore(commute, m)?.score ?? null,
        schools: schoolsScore(schools, m)?.score ?? null,
      },
    ]),
  ) as Record<
    TravelMode,
    Record<"amenities" | "commute" | "schools", number | null>
  >;
  const fixedScores = {
    safety: safetyScore(safety)?.score ?? null,
    neighbourhood: neighbourhoodScore(demographics)?.score ?? null,
    upside: upsideScore(upside)?.score ?? null,
  };
  const market = Object.fromEntries(
    MODES.map((m) => [
      m,
      marketScore(
        {
          amenities,
          commute,
          schools,
          safety,
          upside,
          listPrice: listing?.listPrice ?? null,
          city: report.property?.city ?? null,
          province: report.property?.province ?? null,
        },
        m,
      ),
    ]),
  ) as Record<TravelMode, ReturnType<typeof marketScore>>;

  const p = report.property;
  const address = p?.formattedAddress ?? report.inputAddress;
  const [street, ...rest] = address.split(",").map((x) => x.trim());

  return {
    report,
    copyMode,
    address,
    street,
    place: rest.filter((x) => x !== "Canada").join(", "),
    property: p,
    listing,
    amenities,
    commute,
    schools,
    safety,
    demographics,
    upside,
    insights: copy(SECTION_KEYS.insights, insightsSchema),
    marketing: copy(SECTION_KEYS.marketing, marketingSchema),
    campaign: copy(SECTION_KEYS.campaign, campaignSchema),
    showing: copy(SECTION_KEYS.showing, showingSchema),
    /** The agent's saved calculator inputs (partial), if any. */
    calculators: get(SECTION_KEYS.calculators, savedCalculatorsSchema),
    scores,
    fixedScores,
    market,
    /** Set on the first layout pass to learn where sections start. */
    recordPage: undefined as ((id: string, page: number) => void) | undefined,
    /** Footer brand (bottom left of every page); set by renderReportPdf. */
    brand: { kind: "areaview" } as PdfBrand,
  };
}

export type PdfData = ReturnType<typeof pdfData>;

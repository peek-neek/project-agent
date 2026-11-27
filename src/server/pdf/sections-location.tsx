import { Image, Link, Text, View } from "@react-pdf/renderer";
import {
  AlertTriangleIcon,
  BusIcon,
  CheckIcon,
  GaugeIcon,
  GraduationCapIcon,
  HouseIcon,
  type LucideIcon,
  MapPinnedIcon,
  StoreIcon,
  TrophyIcon,
} from "lucide-react";
import { AMENITY_ICONS } from "@/components/globals/report/amenity-icons";
import { TRANSIT_ICONS } from "@/components/globals/report/transit-icons";
import { levelFor, MARKET_LEVELS, type MarketFactor } from "@/lib/market-score";
import {
  AMENITY_CATEGORIES,
  EQAO_FIELDS,
  type NearbyPlace,
  SCHOOL_SYSTEMS,
  type School,
  schoolMapLabels,
  TRANSIT_KINDS,
} from "@/lib/report-sections";
import { eqaoMean } from "@/lib/section-scores";
import { destinationTime, type TravelMode } from "@/lib/travel";
import type { PdfData, PdfImage, PdfImages } from "./data";
import {
  Card,
  Chip,
  date,
  Facts,
  fmtMin,
  Grid,
  H2,
  HeadedGrid,
  Icon,
  IconChip,
  km,
  MODE_ICONS,
  MODE_LABELS,
  MODES,
  money,
  Note,
  Para,
  PlaceCard,
  placeTimes,
  ReportPage,
  ScoreBlocks,
  scoreColor,
  SectionHead,
  Stat,
  Times,
  TimesLegend,
  TransitIcon,
  tint,
} from "./primitives";
import { C, s } from "./theme";

const MODE_GERUND: Record<TravelMode, string> = {
  walk: "walking",
  drive: "driving",
};

/** One entry on the contents page (and the section's number). */
export type TocEntry = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

function Picture({ image, height }: { image?: PdfImage; height: number }) {
  return image ? (
    // eslint-disable-next-line jsx-a11y/alt-text -- PDF image, no alt prop
    <Image src={image} style={{ width: "100%", height, objectFit: "cover" }} />
  ) : (
    <View
      style={{
        height,
        backgroundColor: C.wash,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={s.small}>No image available</Text>
    </View>
  );
}

export function MapImage({
  image,
  caption,
}: {
  image?: PdfImage;
  caption: string;
}) {
  if (!image) return null;
  return (
    <View
      style={{ marginBottom: 14, borderWidth: 0.75, borderColor: C.line }}
      wrap={false}
    >
      <Picture image={image} height={200} />
      <View
        style={[
          s.row,
          { alignItems: "center", gap: 4, padding: 5, backgroundColor: C.wash },
        ]}
      >
        <Icon icon={MapPinnedIcon} size={8} color={C.muted} />
        <Text style={s.small}>{caption}</Text>
      </View>
    </View>
  );
}

/** A row of KPI tiles under a section title. */
function Kpis({
  items,
}: {
  items: (Parameters<typeof Stat>[0] | null | false | undefined)[];
}) {
  const shown = items.filter(Boolean) as Parameters<typeof Stat>[0][];
  if (!shown.length) return null;
  return (
    <View style={{ marginBottom: 14 }}>
      <Grid columns={shown.length}>
        {shown.map((k, i) => (
          <Stat key={i} {...k} />
        ))}
      </Grid>
    </View>
  );
}

/**
 * Why a market-ease score is what it is: the two strongest factors (by
 * weight) and the weakest, each with its 1–5 rating and one-line detail.
 */
function marketReasons(factors: MarketFactor[]) {
  const byWeight = (a: MarketFactor, b: MarketFactor) => b.weight - a.weight;
  const helps = factors
    .filter((f) => f.score >= 0.6)
    .sort(byWeight)
    .slice(0, 2);
  const drag = factors
    .filter((f) => f.score < 0.45)
    .sort((a, b) => a.score - b.score || b.weight - a.weight)
    .slice(0, helps.length < 2 ? 2 : 1);
  return [...helps, ...drag].map((f) => ({
    rating: levelFor(f.score),
    text: `${f.label}: ${f.detail}`,
  }));
}

/**
 * A factor's 1–5 rating on the market ease scale: "4/5" plus five small
 * segments filled up to it, in that level's colour.
 */
function FactorRating({ score }: { score: number }) {
  const rating = levelFor(score);
  const color = MARKET_LEVELS[rating].color;
  return (
    <View style={[s.row, { gap: 3, alignItems: "center" }]}>
      <View style={[s.row, { gap: 1 }]}>
        {[1, 2, 3, 4, 5].map((l) => (
          <View
            key={l}
            style={{
              width: 4,
              height: 4,
              backgroundColor: l <= rating ? color : C.line,
            }}
          />
        ))}
      </View>
      <Text style={{ fontSize: 7, fontWeight: 700, color }}>{`${rating}/5`}</Text>
    </View>
  );
}

const nearestOf = <T extends { distanceMeters: number }>(places: T[]) =>
  [...places].sort((a, b) => a.distanceMeters - b.distanceMeters)[0];

// ---------------------------------------------------------------------------
// Cover: photos and the property's details, nothing else
// ---------------------------------------------------------------------------

export function CoverPage({ d, images }: { d: PdfData; images: PdfImages }) {
  const l = d.listing;
  const p = d.property;
  const details = [
    { label: "Address", value: d.street },
    {
      label: "Municipality",
      value: [p?.city, p?.province].filter(Boolean).join(", ") || d.place,
    },
    p?.postalCode && { label: "Postal code", value: p.postalCode },
    l?.propertyType && { label: "Property type", value: l.propertyType },
    p?.unitNumber && { label: "Unit", value: p.unitNumber },
    l?.bedrooms != null && { label: "Bedrooms", value: String(l.bedrooms) },
    l?.bathrooms != null && { label: "Bathrooms", value: String(l.bathrooms) },
    l?.listPrice != null && { label: "List price", value: money(l.listPrice) },
    p?.pin && { label: "Land Registry PIN", value: p.pin },
    p?.rollNumber && { label: "MPAC roll number", value: p.rollNumber },
  ].filter(Boolean) as { label: string; value: string }[];
  const angles = (["closeUp", "frontLeft", "frontRight"] as const).filter(
    (a) => images.street[a],
  );
  const hero = images.street.front ?? images.maps.overview;

  return (
    <ReportPage section="Property report" address={d.address}>
      <View id="cover" style={[s.row, { alignItems: "center", gap: 6 }]}>
        <View style={{ width: 18, height: 3, backgroundColor: C.accent }} />
        <Text style={s.eyebrow}>Property report</Text>
      </View>
      <Text style={[s.h1, { fontSize: 28, marginTop: 6 }]}>{d.street}</Text>
      <Text style={s.lede}>
        {d.place || "Canada"} · Prepared {date(d.report.createdAt)}
      </Text>

      <View style={{ marginTop: 14 }}>
        <Picture image={hero} height={angles.length ? 300 : 400} />
      </View>
      {angles.length > 0 && (
        <View style={[s.row, { gap: 6, marginTop: 6 }]}>
          {angles.map((a) => (
            <View key={a} style={{ flex: 1 }}>
              <Picture image={images.street[a]} height={112} />
            </View>
          ))}
        </View>
      )}
      {hero ? (
        <Text style={[s.small, { marginTop: 4 }]}>
          Photos: Google Street View, which may not show the home&apos;s current
          condition.
        </Text>
      ) : null}

      <Card style={{ marginTop: 12 }}>
        <View
          style={[s.row, { alignItems: "center", gap: 6, marginBottom: 9 }]}
        >
          <IconChip icon={HouseIcon} color={C.accent} size={18} />
          <Text style={[s.h3, { marginBottom: 0 }]}>Property details</Text>
        </View>
        <Facts items={details} columns={3} />
        {p?.legalDescription ? (
          <View style={{ marginTop: 9 }}>
            <Text style={s.small}>Legal description</Text>
            <Text style={[s.strong, { fontSize: 8.5, marginTop: 1 }]}>
              {p.legalDescription}
            </Text>
          </View>
        ) : null}
        {l?.features ? (
          <View style={{ marginTop: 9 }}>
            <Text style={s.small}>Standout features</Text>
            <Text style={[s.strong, { fontSize: 8.5, marginTop: 1 }]}>
              {l.features}
            </Text>
          </View>
        ) : null}
      </Card>
    </ReportPage>
  );
}

// ---------------------------------------------------------------------------
// Scores, explained
// ---------------------------------------------------------------------------

/** Plain-language band for a 1–5 section score. */
const scoreWord = (score: number) =>
  score >= 4.5
    ? "Excellent"
    : score >= 3.5
      ? "Strong"
      : score >= 2.5
        ? "Fair"
        : score >= 1.5
          ? "Weak"
          : "Poor";

/** What each section score measures (mirrors lib/section-scores.ts). */
const SCORE_ROWS = [
  {
    id: "amenities",
    label: "Amenities",
    icon: StoreIcon,
    measures:
      "How quickly you reach the nearest grocery store (counts double), pharmacy, café, restaurant, park and gym, plus other places like healthcare and banks.",
  },
  {
    id: "commute",
    label: "Commute",
    icon: BusIcon,
    measures:
      "How easily you get on transit near home (rapid transit counts more than a bus), plus trip times to downtowns and airports by the faster of transit or the mode shown.",
  },
  {
    id: "schools",
    label: "Schools",
    icon: GraduationCapIcon,
    measures:
      "The closest schools and how far away they are, with EQAO results against the Ontario average for Ontario schools. Attendance boundaries aren't scored; confirm with the board or district.",
  },
  {
    id: "safety",
    label: "Safety",
    icon: AlertTriangleIcon,
    measures:
      "Police-reported crime against the province (or Toronto's neighbourhood ranking), plus flood regulation, highway, rail and airport noise, and air quality where available.",
  },
  {
    id: "neighbourhood",
    label: "Neighbourhood",
    icon: MapPinnedIcon,
    measures:
      "Variety of home types and a mix of owners and renters, which widen the pool of buyers and tenants. Never based on who lives there.",
  },
  {
    id: "upside",
    label: "Future upside",
    icon: TrophyIcon,
    measures:
      "Transit under construction, major projects and development applications nearby. About 2.6 (neutral) when nothing is planned.",
  },
] as const;

export function ScoresPage({ d, n }: { d: PdfData; n: number }) {
  const travelIds = new Set(["amenities", "commute", "schools"]);
  // Factor weights, from the score itself so the text never drifts.
  const weights = (
    MODES.map((m) => d.market[m]).find(Boolean)?.factors ?? []
  ).filter((f, i, all) => all.findIndex((g) => g.id === f.id) === i);
  const totalWeight = weights.reduce((a, f) => a + f.weight, 0);

  const cell = (score: number | null) =>
    score == null ? (
      <Text style={{ fontSize: 8, color: C.faint }}>No data</Text>
    ) : (
      <View style={{ gap: 2 }}>
        <View style={[s.row, { alignItems: "flex-end", gap: 3 }]}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: scoreColor(score),
              lineHeight: 1,
            }}
          >
            {score.toFixed(1)}
          </Text>
          <Text style={{ fontSize: 7, color: C.muted, marginBottom: 1 }}>
            {scoreWord(score)}
          </Text>
        </View>
        <ScoreBlocks score={score} showValue={false} width={9} />
      </View>
    );

  return (
    <ReportPage section="Scores" address={d.address}>
      <SectionHead
        record={d.recordPage}
        id="scores"
        number={n}
        eyebrow="Scores"
        title="How this location scores"
        lede="Every score runs from 1 to 5, where 5 is best. Scores that depend on getting around are shown for walking and driving, each judged against what's normal for that mode."
      />

      {/* Sell / rent ease, per mode, with the reasons. */}
      <Card style={{ padding: 11 }}>
        <View
          style={[s.row, { alignItems: "center", gap: 6, marginBottom: 2 }]}
        >
          <IconChip icon={TrophyIcon} color={C.accent} size={18} />
          <Text style={[s.h3, { marginBottom: 0 }]}>
            How easy the location and price make it to sell or rent
          </Text>
        </View>
        <Text style={[s.small, { marginBottom: 8 }]}>
          1 = hard, 5 = very easy.{" "}
          {totalWeight
            ? `Weighted from ${weights
                .map(
                  (f) =>
                    `${f.label.toLowerCase()} ${Math.round((f.weight / totalWeight) * 100)}%`,
                )
                .join(", ")}. `
            : ""}
          Green points help the sale; red points hold it back. Price is judged
          by how many buyers can afford it, not against recent sales; condition
          and the market matter too.
        </Text>
        <Grid columns={3} width={500}>
          {MODES.map((m) => {
            const score = d.market[m];
            const level = score ? MARKET_LEVELS[score.level] : null;
            const color = level?.color ?? C.faint;
            return (
              <View
                key={m}
                style={{ backgroundColor: tint(color, 0.08), padding: 8 }}
              >
                <View style={[s.row, { alignItems: "center", gap: 4 }]}>
                  <Icon icon={MODE_ICONS[m]} size={9} color={C.muted} />
                  <Text style={[s.small, { fontWeight: 600 }]}>
                    {MODE_LABELS[m]}
                  </Text>
                </View>
                <View
                  style={[
                    s.row,
                    { alignItems: "flex-end", gap: 4, marginTop: 2 },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 22,
                      fontWeight: 700,
                      color,
                      lineHeight: 1,
                    }}
                  >
                    {score ? score.level : "—"}
                  </Text>
                  <Text style={[s.small, { marginBottom: 4 }]}>
                    / 5 · {level?.label ?? "Not enough data"}
                  </Text>
                </View>
                {score ? (
                  <View style={{ marginTop: 7, gap: 3 }}>
                    {marketReasons(score.factors).map((r, i) => (
                      <View key={i} style={[s.row, { gap: 4 }]}>
                        <Text
                          style={{
                            fontSize: 7,
                            fontWeight: 700,
                            color: MARKET_LEVELS[r.rating].color,
                          }}
                        >
                          {`${r.rating}/5`}
                        </Text>
                        <Text style={{ fontSize: 7, color: C.body, flex: 1 }}>
                          {r.text}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </Grid>
      </Card>

      {/* Section scores: what each measures, and this home's result. */}
      <H2 icon={GaugeIcon} color={C.accent}>
        Section scores
      </H2>
      <View style={{ borderWidth: 0.75, borderColor: C.line }}>
        <View
          style={[
            s.row,
            {
              backgroundColor: C.wash,
              paddingVertical: 4,
              paddingHorizontal: 8,
              gap: 8,
            },
          ]}
        >
          <Text style={[s.small, { width: 285, fontWeight: 600 }]}>
            WHAT IT MEASURES
          </Text>
          {MODES.map((m) => (
            <View
              key={m}
              style={[s.row, { flex: 1, gap: 3, alignItems: "center" }]}
            >
              <Icon icon={MODE_ICONS[m]} size={8} color={C.muted} />
              <Text style={[s.small, { fontWeight: 600 }]}>
                {MODE_LABELS[m].toUpperCase()}
              </Text>
            </View>
          ))}
        </View>
        {SCORE_ROWS.map((row, idx) => {
          const travel = travelIds.has(row.id);
          return (
            <View
              key={row.id}
              wrap={false}
              style={[
                s.row,
                {
                  paddingVertical: 5,
                  paddingHorizontal: 8,
                  gap: 8,
                  borderTopWidth: idx ? 0.5 : 0,
                  borderTopColor: C.line,
                },
              ]}
            >
              <View style={{ width: 285 }}>
                <View
                  style={[
                    s.row,
                    { alignItems: "center", gap: 5, marginBottom: 2 },
                  ]}
                >
                  <Icon icon={row.icon} size={9} color={C.accent} />
                  <Text style={[s.strong, { fontSize: 9 }]}>{row.label}</Text>
                </View>
                <Text
                  style={{ fontSize: 7.4, color: C.body, lineHeight: 1.35 }}
                >
                  {row.measures}
                </Text>
              </View>
              {travel ? (
                MODES.map((m) => (
                  <View key={m} style={{ flex: 1 }}>
                    {cell(
                      d.scores[m][
                        row.id as "amenities" | "commute" | "schools"
                      ],
                    )}
                  </View>
                ))
              ) : (
                <View style={{ flex: 1 }}>
                  {cell(
                    d.fixedScores[
                      row.id as "safety" | "neighbourhood" | "upside"
                    ],
                  )}
                  <Text style={[s.small, { marginTop: 2 }]}>
                    Same however you get around
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* How to read the numbers. */}
      <View style={[s.row, { gap: 10, marginTop: 8, flexWrap: "wrap" }]}>
        {[
          [4.6, "4.5–5 Excellent"],
          [3.8, "3.5–4.4 Strong"],
          [3, "2.5–3.4 Fair"],
          [2, "1.5–2.4 Weak"],
          [1.2, "1–1.4 Poor"],
        ].map(([v, label]) => (
          <View
            key={label as string}
            style={[s.row, { gap: 3, alignItems: "center" }]}
          >
            <View
              style={{
                width: 6,
                height: 6,
                backgroundColor: scoreColor(v as number),
              }}
            />
            <Text style={s.small}>{label}</Text>
          </View>
        ))}
      </View>
    </ReportPage>
  );
}

// ---------------------------------------------------------------------------
// Contents
// ---------------------------------------------------------------------------

export function ContentsPage({
  d,
  entries,
  pages,
}: {
  d: PdfData;
  entries: TocEntry[];
  /** Page per section id, from the first layout pass (empty on that pass). */
  pages: Record<string, number>;
}) {
  return (
    <ReportPage section="Contents" address={d.address}>
      <SectionHead
        record={d.recordPage}
        id="contents"
        eyebrow="Contents"
        title="What's in this report"
        lede="Tap any section to jump straight to it."
      />
      <View style={{ gap: 5 }}>
        {entries.map((e, i) => (
          <Link key={e.id} src={`#${e.id}`} style={{ textDecoration: "none" }}>
            <View
              style={[
                s.row,
                {
                  alignItems: "center",
                  gap: 10,
                  borderWidth: 0.75,
                  borderColor: C.line,
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                },
              ]}
            >
              <Text
                style={{
                  width: 20,
                  fontSize: 10,
                  fontWeight: 700,
                  color: C.accent,
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </Text>
              <IconChip icon={e.icon} color={C.ink} size={22} />
              <View style={{ flex: 1 }}>
                <Text style={[s.h3, { marginBottom: 0, fontSize: 10.5 }]}>
                  {e.title}
                </Text>
                <Text style={s.small}>{e.description}</Text>
              </View>
              <Text style={{ fontSize: 9, fontWeight: 600, color: C.ink }}>
                {pages[e.id] ? `p. ${pages[e.id]}` : "p. —"}
              </Text>
            </View>
          </Link>
        ))}
      </View>
    </ReportPage>
  );
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export function OverviewPage({ d, n }: { d: PdfData; n: number }) {
  const factorIds = Array.from(
    new Set(MODES.flatMap((m) => d.market[m]?.factors.map((f) => f.id) ?? [])),
  );
  const factor = (m: TravelMode, id: string) =>
    d.market[m]?.factors.find((f) => f.id === id) ?? null;

  const essentials: {
    label: string;
    icon: LucideIcon;
    color: string;
    place: NearbyPlace;
  }[] = [];
  for (const id of [
    "groceries",
    "pharmacies",
    "parks",
    "healthcare",
  ] as const) {
    const place = nearestOf(d.amenities?.categories[id] ?? []);
    const cat = AMENITY_CATEGORIES.find((c) => c.id === id)!;
    if (place) {
      essentials.push({
        label: cat.label,
        icon: AMENITY_ICONS[id],
        color: cat.color,
        place,
      });
    }
  }
  for (const kinds of [
    ["subway", "train", "light_rail"],
    ["bus", "go_bus"],
  ] as const) {
    const place = nearestOf(
      d.commute?.stations.filter((x) =>
        (kinds as readonly string[]).includes(x.kind),
      ) ?? [],
    );
    if (place) {
      const kind = TRANSIT_KINDS[place.kind];
      essentials.push({
        label: kinds[0] === "bus" ? "Bus stop" : `Rapid transit`,
        icon: TRANSIT_ICONS[place.kind],
        color: kind.color,
        place,
      });
    }
  }
  const allSchools =
    d.schools?.systems.flatMap((x) => [...x.elementary, ...x.secondary]) ?? [];
  for (const level of ["Elementary", "Secondary"] as const) {
    const school = nearestOf(allSchools.filter((x) => x.level === level));
    if (school) {
      essentials.push({
        label: `${level} school`,
        icon: GraduationCapIcon,
        color: "#7c3aed",
        place: school as unknown as NearbyPlace,
      });
    }
  }

  return (
    <ReportPage section="Overview" address={d.address}>
      <SectionHead
        record={d.recordPage}
        id="overview"
        number={n}
        eyebrow="Overview"
        title="The location at a glance"
        lede="Every factor behind the sell / rent ease score for walking and driving, and the closest everyday places. Page 2 explains the scores."
      />

      {d.insights?.headline ? (
        <Card accent={C.accent} style={{ marginBottom: 4 }}>
          <Text
            style={{
              fontSize: 11.5,
              fontWeight: 500,
              color: C.ink,
              lineHeight: 1.4,
            }}
          >
            {d.insights.headline}
          </Text>
        </Card>
      ) : null}

      {factorIds.length > 0 && (
        <>
          <H2 icon={TrophyIcon} color={C.accent}>
            Sell / rent ease, factor by factor
          </H2>
          <Card style={{ padding: 0 }}>
            <View
              style={[
                s.row,
                {
                  backgroundColor: C.wash,
                  paddingVertical: 4,
                  paddingHorizontal: 8,
                },
              ]}
            >
              <Text style={[s.small, { flex: 1, fontWeight: 600 }]}>
                FACTOR
              </Text>
              {MODES.map((m) => (
                <View
                  key={m}
                  style={[s.row, { flex: 1.3, gap: 3, alignItems: "center" }]}
                >
                  <Icon icon={MODE_ICONS[m]} size={8} color={C.muted} />
                  <Text style={[s.small, { fontWeight: 600 }]}>
                    {MODE_LABELS[m].toUpperCase()}
                  </Text>
                </View>
              ))}
            </View>
            {factorIds.map((id, idx) => {
              const per = MODES.map((m) => factor(m, id));
              const first = per.find(Boolean)!;
              const same = per.every((f) => f?.detail === first.detail);
              const cell = (f: typeof first | null) =>
                f ? (
                  <View style={{ gap: 2 }}>
                    <FactorRating score={f.score} />
                    <Text style={{ fontSize: 7.8 }}>{f.detail}</Text>
                  </View>
                ) : (
                  <Text style={{ fontSize: 7.8, color: C.faint }}>—</Text>
                );
              return (
                <View
                  key={id}
                  wrap={false}
                  style={[
                    s.row,
                    {
                      paddingVertical: 3,
                      paddingHorizontal: 8,
                      borderTopWidth: idx ? 0.5 : 0,
                      borderTopColor: C.line,
                    },
                  ]}
                >
                  <Text style={[s.strong, { flex: 1, fontSize: 8.2 }]}>
                    {first.label}
                  </Text>
                  {same ? (
                    <View style={{ flex: 3.9 }}>{cell(first)}</View>
                  ) : (
                    per.map((f, i) => (
                      <View key={i} style={{ flex: 1.3, paddingRight: 6 }}>
                        {cell(f)}
                      </View>
                    ))
                  )}
                </View>
              );
            })}
            <View
              style={[
                s.row,
                {
                  gap: 10,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  backgroundColor: C.wash,
                },
              ]}
            >
              <Text style={s.small}>
                Each factor rated on the market ease scale:
              </Text>
              {([1, 2, 3, 4, 5] as const).map((l) => (
                <View key={l} style={[s.row, { gap: 3, alignItems: "center" }]}>
                  <View
                    style={{
                      width: 5,
                      height: 5,
                      backgroundColor: MARKET_LEVELS[l].color,
                    }}
                  />
                  <Text style={s.small}>
                    {l === 1 ? "1 hard" : l === 5 ? "5 easy" : String(l)}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        </>
      )}

      {essentials.length > 0 && (
        <>
          <H2 icon={MapPinnedIcon} color={C.accent}>
            Closest essentials
          </H2>
          {/* Four across, compact: keeps the overview to one page. */}
          <Grid columns={4} gap={6}>
            {essentials.map((e) => (
              <View
                key={e.label}
                style={{
                  borderWidth: 0.75,
                  borderColor: C.line,
                  borderTopWidth: 2,
                  borderTopColor: e.color,
                  padding: 6,
                  gap: 2,
                }}
              >
                <View style={[s.row, { alignItems: "center", gap: 3 }]}>
                  <Icon icon={e.icon} size={8} color={e.color} />
                  <Text style={[s.small, { fontWeight: 600, flex: 1 }]}>
                    {e.label}
                  </Text>
                  <Text style={{ fontSize: 6.8, color: C.muted }}>
                    {km(e.place.distanceMeters)}
                  </Text>
                </View>
                <Text
                  style={[
                    s.strong,
                    { fontSize: 7.8, maxLines: 1, textOverflow: "ellipsis" },
                  ]}
                >
                  {e.place.name}
                </Text>
                <Times times={placeTimes(e.place)} size={6.8} />
              </View>
            ))}
          </Grid>
        </>
      )}
    </ReportPage>
  );
}

// ---------------------------------------------------------------------------
// Neighbourhood story (AI)
// ---------------------------------------------------------------------------

export function StoryPage({ d, n }: { d: PdfData; n: number }) {
  const i = d.insights;
  if (!i) return null;
  return (
    <ReportPage section="Neighbourhood story" address={d.address}>
      <SectionHead
        record={d.recordPage}
        id="story"
        number={n}
        eyebrow="Neighbourhood story"
        title={i.headline}
      />
      <Card accent={C.accent} style={{ marginBottom: 4 }}>
        <Text style={{ fontSize: 10, color: C.ink, lineHeight: 1.55 }}>
          {i.summary}
        </Text>
      </Card>

      <H2>A day in the neighbourhood</H2>
      <Para>{i.dayInTheLife}</Para>

      <H2 icon={CheckIcon} color={C.good}>
        Selling points
      </H2>
      <Grid columns={2}>
        {i.highlights.map((h, k) => (
          <Card key={k} style={{ minHeight: 70 }}>
            <View style={[s.row, { gap: 6, alignItems: "flex-start" }]}>
              <Text
                style={{
                  fontSize: 8,
                  fontWeight: 700,
                  color: C.white,
                  backgroundColor: C.good,
                  paddingHorizontal: 4,
                  paddingVertical: 1.5,
                }}
              >
                {k + 1}
              </Text>
              <Text style={[s.h3, { flex: 1 }]}>{h.title}</Text>
            </View>
            <Text style={[s.p, { fontSize: 8.2 }]}>{h.detail}</Text>
          </Card>
        ))}
      </Grid>

      <H2 icon={AlertTriangleIcon} color={C.warn}>
        What buyers may ask about
      </H2>
      <View style={{ gap: 7 }}>
        {i.watchOuts.map((w, k) => (
          <View key={k} wrap={false}>
            <Card accent={C.warn}>
              <Text style={s.h3}>{w.title}</Text>
              <Text style={s.p}>{w.detail}</Text>
              <View
                style={{
                  marginTop: 5,
                  backgroundColor: tint(C.good, 0.07),
                  padding: 6,
                }}
              >
                <Text style={[s.p, { fontSize: 8.2 }]}>
                  <Text style={[s.strong, { color: C.good }]}>
                    How to address it:{" "}
                  </Text>
                  {w.reframe}
                </Text>
              </View>
            </Card>
          </View>
        ))}
      </View>
      <Note>Travel times in this copy use {MODE_GERUND[d.copyMode]}.</Note>
    </ReportPage>
  );
}

// ---------------------------------------------------------------------------
// Amenities
// ---------------------------------------------------------------------------

export function AmenitiesPage({
  d,
  images,
  n,
}: {
  d: PdfData;
  images: PdfImages;
  n: number;
}) {
  const a = d.amenities;
  if (!a) return null;
  const found = AMENITY_CATEGORIES.filter(
    (c) => (a.categories[c.id] ?? []).length > 0,
  );
  const missing = AMENITY_CATEGORIES.filter(
    (c) => (a.categories[c.id] ?? []).length === 0,
  );
  const all = found.flatMap((c) => a.categories[c.id]);
  const rated = all.filter((p) => p.rating != null);
  const avgRating = rated.length
    ? rated.reduce((sum, p) => sum + p.rating!, 0) / rated.length
    : null;
  const within10 = all.filter((p) => p.walkMinutes <= 10).length;

  return (
    <ReportPage section="Amenities" address={d.address}>
      <SectionHead
        record={d.recordPage}
        id="amenities"
        number={n}
        eyebrow="Amenities"
        title="What's nearby"
        lede="Nearest first in every category, with the time to each on foot and by car."
      />
      <Kpis
        items={[
          { label: "Places found", value: String(all.length), icon: StoreIcon },
          {
            label: "Categories",
            value: `${found.length} / ${AMENITY_CATEGORIES.length}`,
          },
          {
            label: "Within a 10-min walk",
            value: String(within10),
            icon: MODE_ICONS.walk,
          },
          avgRating != null && {
            label: "Average rating",
            value: `${avgRating.toFixed(1)} ★`,
          },
        ]}
      />
      <MapImage
        image={images.maps.overview}
        caption="Everyday amenities around the home (H)."
      />
      <TimesLegend />
      {found.map((cat) => {
        const places = [...a.categories[cat.id]].sort(
          (x, y) => x.distanceMeters - y.distanceMeters,
        );
        return (
          <View key={cat.id} style={{ marginBottom: 12 }}>
            <HeadedGrid
              columns={2}
              heading={
                <H2
                  icon={AMENITY_ICONS[cat.id]}
                  color={cat.color}
                  first
                  aside={
                    <Chip color={cat.color}>{`${places.length} nearby`}</Chip>
                  }
                >
                  {cat.label}
                </H2>
              }
            >
              {places.map((p) => (
                <PlaceCard
                  key={p.id}
                  image={images.places[p.id]}
                  icon={AMENITY_ICONS[cat.id]}
                  color={cat.color}
                  name={p.name}
                  address={p.address}
                  rating={{ value: p.rating, count: p.ratingCount }}
                  distanceMeters={p.distanceMeters}
                  times={placeTimes(p)}
                />
              ))}
            </HeadedGrid>
          </View>
        );
      })}
      {missing.length > 0 && (
        <Note>
          Nothing found within range: {missing.map((c) => c.label).join(", ")}.
        </Note>
      )}
      <Note>
        Places, photos and ratings from Google Maps. Updated {date(a.fetchedAt)}
        .
      </Note>
    </ReportPage>
  );
}

// ---------------------------------------------------------------------------
// Commute
// ---------------------------------------------------------------------------

export function CommutePage({
  d,
  images,
  n,
}: {
  d: PdfData;
  images: PdfImages;
  n: number;
}) {
  const c = d.commute;
  if (!c) return null;
  const destinations = c.destinations.map((dest) => ({
    ...dest,
    kind: dest.kind ?? (/airport/i.test(dest.label) ? "airport" : "downtown"),
    modes: Object.fromEntries(
      MODES.map((m) => [m, destinationTime(dest, m)]),
    ) as Record<TravelMode, ReturnType<typeof destinationTime>>,
  }));
  const rapid = nearestOf(
    c.stations.filter((x) =>
      ["subway", "train", "light_rail"].includes(x.kind),
    ),
  );
  const bus = nearestOf(
    c.stations.filter((x) => ["bus", "go_bus"].includes(x.kind)),
  );
  const downtown = destinations.find((x) => x.kind === "downtown");

  return (
    <ReportPage section="Commute & transit" address={d.address}>
      <SectionHead
        record={d.recordPage}
        id="commute"
        number={n}
        eyebrow="Commute & transit"
        title="Getting around"
        lede={`Transit stops nearby and trips to downtowns and airports. Drive and transit times are for ${c.departureLabel}.`}
      />
      <Kpis
        items={[
          rapid && {
            label: "Nearest rapid transit",
            value: `${rapid.walkMinutes} min`,
            sub: `${rapid.name} · walk`,
            icon: TRANSIT_ICONS[rapid.kind],
            color: TRANSIT_KINDS[rapid.kind].color,
          },
          bus && {
            label: "Nearest bus stop",
            value: `${bus.walkMinutes} min`,
            sub: `${bus.name} · walk`,
            icon: TRANSIT_ICONS[bus.kind],
            color: TRANSIT_KINDS[bus.kind].color,
          },
          downtown?.transitMinutes != null && {
            label: "Downtown by transit",
            value: fmtMin(downtown.transitMinutes),
            sub: downtown.label,
            icon: TransitIcon,
          },
          downtown?.driveMinutes != null && {
            label: "Downtown by car",
            value: fmtMin(downtown.driveMinutes),
            sub: downtown.label,
            icon: MODE_ICONS.drive,
          },
        ]}
      />
      <MapImage
        image={images.maps.transit}
        caption="Numbers match the stops listed below."
      />

      {destinations.length > 0 && (
        <View>
          <H2 first>Trips to downtowns and airports</H2>
          <View style={{ gap: 6 }}>
            {destinations.map((x) => {
              const tiles: {
                label: string;
                icon: LucideIcon;
                minutes: number | null;
                km: number | null;
                estimated: boolean;
              }[] = [
                ...MODES.map((m) => ({
                  label: MODE_LABELS[m],
                  icon: MODE_ICONS[m],
                  minutes: x.modes[m].minutes,
                  km: x.modes[m].km,
                  estimated: x.modes[m].estimated,
                })),
                {
                  label: "Transit",
                  icon: TransitIcon,
                  minutes: x.transitMinutes,
                  km: null,
                  estimated: false,
                },
              ];
              return (
                <View key={x.id} wrap={false}>
                  <Card style={{ padding: 7 }}>
                    {/* Stretch: all four mode tiles share one height. */}
                    <View style={[s.row, { alignItems: "stretch", gap: 8 }]}>
                      <View style={{ width: 130, justifyContent: "center" }}>
                        <Text style={[s.strong, { fontSize: 9 }]}>
                          {x.label}
                        </Text>
                        <Chip>
                          {x.kind === "airport" ? "Airport" : "Downtown"}
                        </Chip>
                      </View>
                      {tiles.map((t) => (
                        <View
                          key={t.label}
                          style={{
                            flex: 1,
                            backgroundColor: C.wash,
                            padding: 5,
                          }}
                        >
                          <View
                            style={[s.row, { gap: 3, alignItems: "center" }]}
                          >
                            <Icon icon={t.icon} size={7.5} color={C.muted} />
                            <Text style={s.small}>{t.label}</Text>
                          </View>
                          <Text style={[s.strong, { fontSize: 9.5 }]}>
                            {t.minutes == null
                              ? "—"
                              : `${t.estimated ? "~" : ""}${fmtMin(t.minutes)}`}
                          </Text>
                          {t.km != null ? (
                            <Text style={{ fontSize: 6.8, color: C.muted }}>
                              {t.km.toFixed(1)} km
                            </Text>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  </Card>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {c.stations.length > 0 && (
        <>
          <HeadedGrid
            columns={2}
            heading={
              <>
                <H2>Transit stops nearby</H2>
                <TimesLegend />
              </>
            }
          >
            {c.stations.map((st, i) => {
              const kind = TRANSIT_KINDS[st.kind];
              return (
                <PlaceCard
                  key={st.id}
                  image={images.places[st.id]}
                  icon={TRANSIT_ICONS[st.kind]}
                  color={kind.color}
                  badge={String(i + 1)}
                  name={st.name}
                  address={st.address}
                  chips={
                    <Chip color={kind.color} icon={TRANSIT_ICONS[st.kind]}>
                      {kind.label}
                    </Chip>
                  }
                  distanceMeters={st.distanceMeters}
                  times={placeTimes(st)}
                />
              );
            })}
          </HeadedGrid>
        </>
      )}
      {!c.routesAvailable && (
        <Note>
          Live routing was unavailable when this report was made, so times are
          estimated from distance.
        </Note>
      )}
      <Note>
        Stops and routes from Google Maps. Updated {date(c.fetchedAt)}.
      </Note>
    </ReportPage>
  );
}

// ---------------------------------------------------------------------------
// Schools
// ---------------------------------------------------------------------------

const pct = (v: number | null | undefined) =>
  v == null ? "—" : `${Math.round(v)}%`;

export function SchoolsPage({
  d,
  images,
  n,
}: {
  d: PdfData;
  images: PdfImages;
  n: number;
}) {
  const sc = d.schools;
  if (!sc) return null;
  const labels = schoolMapLabels(sc);
  const provincial = eqaoMean(sc.provincialAverage);
  const all = sc.systems.flatMap((x) => [...x.elementary, ...x.secondary]);
  const nearestElem = nearestOf(all.filter((x) => x.level === "Elementary"));
  const nearestSec = nearestOf(all.filter((x) => x.level === "Secondary"));
  const best = all
    .map((x) => ({ x, avg: eqaoMean(x.results) }))
    .filter((r) => r.avg != null && r.x.distanceMeters <= 5000)
    .sort((a, b) => b.avg! - a.avg!)[0];

  const card = (x: School, color: string) => {
    const avg = eqaoMean(x.results);
    const diff =
      avg != null && provincial != null ? Math.round(avg - provincial) : null;
    const results = EQAO_FIELDS.filter((f) => x.results[f.id] != null);
    return (
      <PlaceCard
        key={x.id}
        image={images.schools[x.id]}
        icon={GraduationCapIcon}
        color={color}
        badge={labels.get(x.id)}
        name={x.name}
        address={x.address}
        chips={
          <View style={[s.row, { gap: 3, flexWrap: "wrap" }]}>
            {x.gradeRange ? <Chip>{`Grades ${x.gradeRange}`}</Chip> : null}
            {x.enrolment != null ? (
              <Chip>{`${x.enrolment.toLocaleString("en-CA")} students`}</Chip>
            ) : null}
            {avg != null ? (
              <Chip color={diff != null && diff < 0 ? C.warn : C.good}>
                {`EQAO ${pct(avg)}${diff != null ? ` (${diff >= 0 ? "+" : ""}${diff} vs ON)` : ""}`}
              </Chip>
            ) : null}
          </View>
        }
        distanceMeters={x.distanceMeters}
        times={placeTimes(x)}
        extra={
          <>
            <Text
              style={[
                { fontSize: 6.8, color: C.muted },
                { maxLines: 1, textOverflow: "ellipsis" },
              ]}
            >
              {x.board}
            </Text>
            {results.length > 0 ? (
              <Text style={{ fontSize: 6.5, color: C.body }}>
                {results
                  .map(
                    (f) =>
                      `${f.label.replace("Grade ", "G").replace(" (OSSLT)", "")} ${pct(x.results[f.id])}`,
                  )
                  .join(" · ")}
              </Text>
            ) : null}
          </>
        }
      />
    );
  };

  return (
    <ReportPage section="Schools" address={d.address}>
      <SectionHead
        record={d.recordPage}
        id="schools"
        number={n}
        eyebrow="Schools"
        title="Schools nearby"
        lede="Nearby schools in each of Ontario's four school systems, with EQAO results (share of students meeting the provincial standard)."
      />
      <Kpis
        items={[
          {
            label: "Schools listed",
            value: String(all.length),
            icon: GraduationCapIcon,
          },
          nearestElem && {
            label: "Nearest elementary",
            value: `${nearestElem.walkMinutes} min`,
            sub: `${nearestElem.name} · walk`,
          },
          nearestSec && {
            label: "Nearest secondary",
            value: `${nearestSec.walkMinutes} min`,
            sub: `${nearestSec.name} · walk`,
          },
          best && {
            label: "Top EQAO within 5 km",
            value: pct(best.avg),
            sub: best.x.name,
            valueColor: C.good,
          },
        ]}
      />
      <MapImage
        image={images.maps.schools}
        caption="Map labels match the badge on each school."
      />
      <TimesLegend />
      {sc.systems.map((system) => {
        const meta = SCHOOL_SYSTEMS.find((x) => x.id === system.id)!;
        if (system.elementary.length + system.secondary.length === 0)
          return null;
        const byDistance = (list: School[]) =>
          [...list].sort((a, b) => a.distanceMeters - b.distanceMeters);
        return (
          <View key={system.id} style={{ marginBottom: 6 }}>
            {(
              [
                ["Elementary", system.elementary],
                ["Secondary", system.secondary],
              ] as const
            ).map(([level, list], li) =>
              list.length ? (
                <View key={level} style={{ marginBottom: 8 }}>
                  <HeadedGrid
                    columns={2}
                    heading={
                      <H2
                        icon={GraduationCapIcon}
                        color={meta.color}
                        first={li > 0 && system.elementary.length > 0}
                        aside={<Chip color={meta.color}>{level}</Chip>}
                      >
                        {meta.label}
                      </H2>
                    }
                  >
                    {byDistance([...list]).map((x) => card(x, meta.color))}
                  </HeadedGrid>
                </View>
              ) : null,
            )}
          </View>
        );
      })}
      <View wrap={false}>
        <H2>Ontario average, for comparison</H2>
        <Grid columns={4} gap={6}>
          {EQAO_FIELDS.map((f) => (
            <Stat
              key={f.id}
              label={f.label}
              value={pct(sc.provincialAverage[f.id])}
            />
          ))}
        </Grid>
      </View>
      <Note>
        EQAO results for {sc.dataYear}. School locations from the Ontario
        Ministry of Education; photos from Google Street View. Updated{" "}
        {date(sc.fetchedAt)}.
      </Note>
    </ReportPage>
  );
}

"use client";

import {
  BedDoubleIcon,
  BathIcon,
  DollarSignIcon,
  GraduationCapIcon,
  HomeIcon,
  MapIcon,
  RulerIcon,
  ScaleIcon,
  ShieldCheckIcon,
  ShoppingBasketIcon,
  TrainFrontIcon,
  TrafficConeIcon,
  WavesIcon,
  BuildingIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { useTravelMode } from "@/components/globals/travel-mode";
import { eqaoMean } from "@/lib/section-scores";
import { TRANSIT_KINDS } from "@/lib/report-sections";
import { sectionTiles } from "@/components/globals/report/overview-tab";
import {
  formatDistance,
  formatPrice,
} from "@/components/globals/report/report-format";
import { getJob, isJobActive } from "@/components/globals/report/report-hooks";
import {
  allSchools,
  downtownCommute,
  nearestPlace,
  nearestTransit,
} from "@/components/globals/report/report-insights";
import { crimeTile } from "@/components/globals/report/safety-tab";
import { FLOOD_BADGES } from "@/components/globals/report/safety-section";
import type { TabId } from "@/components/globals/report/report-tabs";
import { DashCard } from "@/components/globals/report/dash-card";
import { CompareMap } from "./compare-map";
import {
  type CompareProperty,
  metresBetween,
  minutesTo,
  placeCell,
  propertyMarketScore,
  type Side,
  type Travel,
  winner,
} from "./compare-shared";
import { type CompareRow, CompareTable } from "./compare-table";
import { DuelTile } from "./compare-tiles";

/** Section scores this close count as a tie. */
const TIE = 0.2;

/** Flood status, best first, for picking the safer side. */
const FLOOD_RANK = { clear: 0, nearby: 1, inside: 2, unknown: null } as const;

/**
 * The overall leader: the side ahead on more of the overview's duel tiles
 * (market ease plus the six sections, same tie rules). Null when level.
 */
export function compareLeader(
  a: CompareProperty,
  b: CompareProperty,
  mode: Parameters<typeof sectionTiles>[1],
): Side | null {
  const tilesB = sectionTiles(b.data, mode);
  const winners = [
    winner(
      propertyMarketScore(a, mode)?.level,
      propertyMarketScore(b, mode)?.level,
    ),
    ...sectionTiles(a.data, mode).map((t, i) =>
      winner(t.score?.score, tilesB[i].score?.score, { tolerance: TIE }),
    ),
  ];
  const winsA = winners.filter((w) => w === "a").length;
  const winsB = winners.filter((w) => w === "b").length;
  return winsA === winsB ? null : winsA > winsB ? "a" : "b";
}

export function CompareOverview({
  a,
  b,
  onNavigate,
}: {
  a: CompareProperty;
  b: CompareProperty;
  onNavigate: (tab: TabId) => void;
}) {
  const travel = useTravelMode();
  const props = { a, b };
  const busy = (p: CompareProperty, kind: Parameters<typeof getJob>[1]) =>
    isJobActive(getJob(p.report, kind));

  // Duel tiles: the six sections. Market ease is in the header's market
  // badges, so it isn't repeated here (it still counts for the crown).
  const tiles = {
    a: sectionTiles(a.data, travel.mode),
    b: sectionTiles(b.data, travel.mode),
  };
  const duels = [
    ...tiles.a.map((t, i) => {
      const tb = tiles.b[i];
      return {
        id: t.id,
        label: t.label,
        icon: t.icon,
        accent: t.accent,
        tab: t.tab,
        winner: winner(t.score?.score, tb.score?.score, { tolerance: TIE }),
        side: (side: Side) => {
          const tile = side === "a" ? t : tb;
          return {
            score: tile.score?.score ?? null,
            caption: tile.score ? tile.caption : tile.empty,
            loading: !tile.score && busy(props[side], tile.job),
          };
        },
      };
    }),
  ];

  const apart = a.home && b.home ? metresBetween(a.home, b.home) : null;

  return (
    <div className="space-y-4">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
        className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
      >
        {duels.map((d) => (
          <DuelTile
            key={d.id}
            icon={d.icon}
            label={d.label}
            accent={d.accent}
            a={d.side("a")}
            b={d.side("b")}
            winner={d.winner}
            onClick={d.tab ? () => onNavigate(d.tab) : undefined}
          />
        ))}
      </motion.div>

      <div className="grid gap-4 lg:grid-cols-12">
        <DashCard
          title="Where they are"
          icon={MapIcon}
          className="lg:col-span-7"
          bodyClassName="px-0 pb-0"
          action={
            apart != null && (
              <span className="text-xs text-foreground/55 tabular-nums">
                {formatDistance(apart)} apart
              </span>
            )
          }
        >
          <CompareMap a={a} b={b} className="h-80 lg:h-[26rem]" />
        </DashCard>

        <CompareTable
          title="The homes"
          icon={HomeIcon}
          a={a}
          b={b}
          className="lg:col-span-5"
          rows={homeRows(a, b)}
          footer="From the property details. Edit them on each property's own view."
        />
      </div>

      <CompareTable
        title="Key numbers"
        icon={RulerIcon}
        a={a}
        b={b}
        rows={keyRows(a, b, travel)}
        footer={`Times are by ${travel.verb === "walk" ? "walking" : travel.verb === "bike" ? "bike" : "car"}; change it at the top of the page.`}
      />
    </div>
  );
}

function homeRows(a: CompareProperty, b: CompareProperty): CompareRow[] {
  const la = a.data.listing;
  const lb = b.data.listing;
  const price = (p: CompareProperty) => p.data.listing?.listPrice ?? null;
  const perBed = (p: CompareProperty) => {
    const l = p.data.listing;
    return l?.listPrice && l.bedrooms ? l.listPrice / l.bedrooms : null;
  };
  return [
    {
      id: "price",
      label: "List price",
      icon: DollarSignIcon,
      a: la?.listPrice ? { value: formatPrice(la.listPrice) } : null,
      b: lb?.listPrice ? { value: formatPrice(lb.listPrice) } : null,
      winner: winner(price(a), price(b), { higher: false }),
    },
    {
      id: "type",
      label: "Property type",
      icon: BuildingIcon,
      a: la?.propertyType ? { value: la.propertyType } : null,
      b: lb?.propertyType ? { value: lb.propertyType } : null,
    },
    {
      id: "beds",
      label: "Bedrooms",
      icon: BedDoubleIcon,
      a: la?.bedrooms != null ? { value: la.bedrooms } : null,
      b: lb?.bedrooms != null ? { value: lb.bedrooms } : null,
      winner: winner(la?.bedrooms, lb?.bedrooms),
    },
    {
      id: "baths",
      label: "Bathrooms",
      icon: BathIcon,
      a: la?.bathrooms != null ? { value: la.bathrooms } : null,
      b: lb?.bathrooms != null ? { value: lb.bathrooms } : null,
      winner: winner(la?.bathrooms, lb?.bathrooms),
    },
    {
      id: "perBed",
      label: "Price per bedroom",
      icon: ScaleIcon,
      a: perBed(a) ? { value: formatPrice(perBed(a)!) } : null,
      b: perBed(b) ? { value: formatPrice(perBed(b)!) } : null,
      winner: winner(perBed(a), perBed(b), { higher: false }),
    },
  ];
}

function keyRows(
  a: CompareProperty,
  b: CompareProperty,
  travel: Travel,
): CompareRow[] {
  const sides = { a, b };
  const pick = <T,>(fn: (p: CompareProperty) => T) => ({ a: fn(a), b: fn(b) });

  const grocery = pick((p) => nearestPlace(p.data.amenities, "groceries"));
  const transit = pick((p) => nearestTransit(p.data.commute));
  const downtown = pick((p) => downtownCommute(p.data.commute));
  const school = pick(
    (p) =>
      allSchools(p.data.schools).find((s) => s.level === "Elementary") ?? null,
  );
  const results = pick((p) => {
    const eqaos = allSchools(p.data.schools)
      .slice(0, 4)
      .map((s) => eqaoMean(s.results))
      .filter((v): v is number => v != null);
    return eqaos.length
      ? Math.round(eqaos.reduce((x, y) => x + y, 0) / eqaos.length)
      : null;
  });
  const crime = pick((p) => (p.data.safety ? crimeTile(p.data.safety) : null));
  // Toronto's neighbourhood ranking when both have it, else severity.
  const crimeWinner =
    a.data.safety?.crime?.lowerRateThanShare != null &&
    b.data.safety?.crime?.lowerRateThanShare != null
      ? winner(
          a.data.safety.crime.lowerRateThanShare,
          b.data.safety.crime.lowerRateThanShare,
          { tolerance: 0.05 },
        )
      : winner(a.data.safety?.areaCrime?.csi, b.data.safety?.areaCrime?.csi, {
          higher: false,
          tolerance: 3,
        });
  const flood = pick((p) => p.data.safety?.flood.status ?? null);
  // No highway within range counts as far (quiet), where roads are covered.
  const highway = pick((p) => {
    const n = p.data.safety?.noise;
    if (!n) return null;
    return n.highway?.meters ?? (n.roadsCovered ? 10_000 : null);
  });
  const highwayCell = (p: CompareProperty) => {
    const n = p.data.safety?.noise;
    if (!n) return null;
    if (n.highway) return { value: formatDistance(n.highway.meters) };
    return n.roadsCovered ? { value: "None nearby" } : null;
  };

  return [
    {
      id: "grocery",
      label: "Nearest grocery",
      icon: ShoppingBasketIcon,
      a: placeCell(grocery.a, travel),
      b: placeCell(grocery.b, travel),
      winner: winner(
        minutesTo(grocery.a, travel),
        minutesTo(grocery.b, travel),
        {
          higher: false,
        },
      ),
    },
    {
      id: "transit",
      label: "Nearest transit",
      icon: TrainFrontIcon,
      a: placeCell(
        transit.a,
        travel,
        transit.a &&
          `${transit.a.name} · ${TRANSIT_KINDS[transit.a.kind].label}`,
      ),
      b: placeCell(
        transit.b,
        travel,
        transit.b &&
          `${transit.b.name} · ${TRANSIT_KINDS[transit.b.kind].label}`,
      ),
      winner: winner(
        minutesTo(transit.a, travel),
        minutesTo(transit.b, travel),
        {
          higher: false,
        },
      ),
    },
    {
      id: "downtown",
      label: "Downtown",
      hint: "Transit, else driving",
      icon: TrafficConeIcon,
      a: downtown.a && {
        value: `${downtown.a.minutes} min`,
        sub: `${downtown.a.label} by ${downtown.a.mode === "transit" ? "transit" : "car"}`,
      },
      b: downtown.b && {
        value: `${downtown.b.minutes} min`,
        sub: `${downtown.b.label} by ${downtown.b.mode === "transit" ? "transit" : "car"}`,
      },
      winner:
        downtown.a?.mode === downtown.b?.mode
          ? winner(downtown.a?.minutes, downtown.b?.minutes, {
              higher: false,
              tolerance: 2,
            })
          : null,
    },
    {
      id: "school",
      label: "Nearest elementary school",
      icon: GraduationCapIcon,
      a: placeCell(school.a, travel),
      b: placeCell(school.b, travel),
      winner: winner(minutesTo(school.a, travel), minutesTo(school.b, travel), {
        higher: false,
      }),
    },
    {
      id: "eqao",
      label: "School results",
      hint: "EQAO average, 4 nearest schools",
      icon: GraduationCapIcon,
      a: results.a != null ? { value: `${results.a}%` } : null,
      b: results.b != null ? { value: `${results.b}%` } : null,
      winner: winner(results.a, results.b, { tolerance: 1 }),
    },
    {
      id: "crime",
      label: "Crime",
      icon: ShieldCheckIcon,
      a:
        crime.a && crime.a.value !== "—"
          ? { value: `${crime.a.label} ${crime.a.value}`, sub: crime.a.caption }
          : null,
      b:
        crime.b && crime.b.value !== "—"
          ? { value: `${crime.b.label} ${crime.b.value}`, sub: crime.b.caption }
          : null,
      winner: crimeWinner,
    },
    {
      id: "flood",
      label: "Flood regulation",
      icon: WavesIcon,
      a:
        flood.a && flood.a !== "unknown"
          ? { value: FLOOD_BADGES[flood.a].label }
          : null,
      b:
        flood.b && flood.b !== "unknown"
          ? { value: FLOOD_BADGES[flood.b].label }
          : null,
      winner: winner(
        flood.a ? FLOOD_RANK[flood.a] : null,
        flood.b ? FLOOD_RANK[flood.b] : null,
        { higher: false },
      ),
    },
    {
      id: "highway",
      label: "Nearest highway",
      hint: "Further is quieter",
      icon: TrafficConeIcon,
      a: highwayCell(sides.a),
      b: highwayCell(sides.b),
      winner: winner(highway.a, highway.b, { tolerance: 50 }),
    },
  ];
}

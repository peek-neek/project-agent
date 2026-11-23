"use client";

import {
  AlertTriangleIcon,
  GaugeIcon,
  PlaneIcon,
  ShieldCheckIcon,
  TrafficConeIcon,
  TrainTrackIcon,
  WavesIcon,
  WindIcon,
} from "lucide-react";
import { CRIME_TYPES, JOB_KINDS, type SafetyData } from "@/lib/report-sections";
import { formatDistance } from "@/components/globals/report/report-format";
import { FLOOD_BADGES } from "@/components/globals/report/safety-section";
import { type CompareProperty, sideState, winner } from "./compare-shared";
import { type CompareRow, CompareTable } from "./compare-table";

const FLOOD_RANK = { clear: 0, nearby: 1, inside: 2, unknown: null } as const;
/** "None nearby" counts as this far, so it beats any distance. */
const FAR = 100_000;

export function CompareSafety({
  a,
  b,
}: {
  a: CompareProperty;
  b: CompareProperty;
}) {
  const states = {
    a: sideState(a.report, JOB_KINDS.safety, a.data.safety != null),
    b: sideState(b.report, JOB_KINDS.safety, b.data.safety != null),
  };
  const sa = a.data.safety;
  const sb = b.data.safety;

  const crimeRows: CompareRow[] = [];
  if (
    sa?.crime?.lowerRateThanShare != null ||
    sb?.crime?.lowerRateThanShare != null
  ) {
    const share = (s: SafetyData | null) =>
      s?.crime?.lowerRateThanShare ?? null;
    const cell = (s: SafetyData | null) =>
      share(s) != null
        ? {
            value: `Lower than ${Math.round(share(s)! * 100)}%`,
            sub: `of Toronto areas · ${s!.crime!.neighbourhood}`,
          }
        : null;
    crimeRows.push({
      id: "ranking",
      label: "Crime ranking",
      hint: "Toronto neighbourhoods, total rate",
      icon: ShieldCheckIcon,
      a: cell(sa),
      b: cell(sb),
      winner: winner(share(sa), share(sb), { tolerance: 0.05 }),
    });
  }
  const csi = (
    s: SafetyData | null,
    key: "csi" | "violentCsi" | "nonViolentCsi",
  ) => s?.areaCrime?.[key] ?? null;
  for (const [key, label] of [
    ["csi", "Crime severity index"],
    ["violentCsi", "Violent crime severity"],
    ["nonViolentCsi", "Non-violent crime severity"],
  ] as const) {
    if (csi(sa, key) == null && csi(sb, key) == null) continue;
    const cell = (s: SafetyData | null) =>
      csi(s, key) != null
        ? {
            value: Math.round(csi(s, key)!),
            sub:
              key === "csi"
                ? `${s!.areaCrime!.service} · ${s!.areaCrime!.year}`
                : undefined,
          }
        : null;
    crimeRows.push({
      id: key,
      label,
      hint: key === "csi" ? "100 = Canada in 2006; lower is safer" : undefined,
      icon: GaugeIcon,
      a: cell(sa),
      b: cell(sb),
      winner: winner(csi(sa, key), csi(sb, key), {
        higher: false,
        tolerance: 3,
      }),
    });
  }
  // Toronto offence rates, where both homes have them.
  if (sa?.crime && sb?.crime) {
    for (const type of CRIME_TYPES) {
      const rate = (s: SafetyData) =>
        s.crime!.types.find((t) => t.id === type.id)?.rate ?? null;
      const ra = rate(sa);
      const rb = rate(sb);
      if (ra == null && rb == null) continue;
      crimeRows.push({
        id: type.id,
        label: type.label,
        hint: "Per 100,000 residents",
        icon: AlertTriangleIcon,
        a:
          ra != null ? { value: Math.round(ra).toLocaleString("en-CA") } : null,
        b:
          rb != null ? { value: Math.round(rb).toLocaleString("en-CA") } : null,
        winner: winner(ra, rb, { higher: false, tolerance: 5 }),
      });
    }
  }

  const flood = (s: SafetyData | null) => s?.flood.status ?? null;
  const distance = (
    s: SafetyData | null,
    key: "highway" | "railway",
  ): number | null => {
    if (!s) return null;
    const hit = s.noise[key];
    if (hit) return hit.meters;
    return s.noise.roadsCovered ? FAR : null;
  };
  const distanceCell = (s: SafetyData | null, key: "highway" | "railway") => {
    const d = distance(s, key);
    if (d == null) return null;
    return { value: d === FAR ? "None nearby" : formatDistance(d) };
  };
  const airport = (s: SafetyData | null) =>
    s ? (s.noise.airport?.km ?? FAR / 1000) : null;
  const aqi = (s: SafetyData | null) => s?.airQuality?.aqi ?? null;

  const environmentRows: CompareRow[] = [
    {
      id: "flood",
      label: "Flood regulation",
      icon: WavesIcon,
      a:
        flood(sa) && flood(sa) !== "unknown"
          ? {
              value: FLOOD_BADGES[flood(sa)!].label,
              sub: sa!.flood.authority ?? undefined,
            }
          : null,
      b:
        flood(sb) && flood(sb) !== "unknown"
          ? {
              value: FLOOD_BADGES[flood(sb)!].label,
              sub: sb!.flood.authority ?? undefined,
            }
          : null,
      winner: winner(
        flood(sa) ? FLOOD_RANK[flood(sa)!] : null,
        flood(sb) ? FLOOD_RANK[flood(sb)!] : null,
        { higher: false },
      ),
    },
    {
      id: "highway",
      label: "Nearest highway",
      hint: "Further is quieter",
      icon: TrafficConeIcon,
      a: distanceCell(sa, "highway"),
      b: distanceCell(sb, "highway"),
      winner: winner(distance(sa, "highway"), distance(sb, "highway"), {
        tolerance: 50,
      }),
    },
    {
      id: "railway",
      label: "Nearest rail line",
      hint: "Further is quieter",
      icon: TrainTrackIcon,
      a: distanceCell(sa, "railway"),
      b: distanceCell(sb, "railway"),
      winner: winner(distance(sa, "railway"), distance(sb, "railway"), {
        tolerance: 50,
      }),
    },
    {
      id: "airport",
      label: "Airport noise",
      icon: PlaneIcon,
      a: sa
        ? sa.noise.airport
          ? {
              value: `${sa.noise.airport.km.toFixed(1)} km`,
              sub: sa.noise.airport.name,
            }
          : { value: "None nearby" }
        : null,
      b: sb
        ? sb.noise.airport
          ? {
              value: `${sb.noise.airport.km.toFixed(1)} km`,
              sub: sb.noise.airport.name,
            }
          : { value: "None nearby" }
        : null,
      winner: winner(airport(sa), airport(sb), { tolerance: 0.5 }),
    },
    {
      id: "air",
      label: "Air quality",
      hint: "Index, higher is cleaner",
      icon: WindIcon,
      a: sa?.airQuality
        ? { value: sa.airQuality.aqi, sub: sa.airQuality.category }
        : null,
      b: sb?.airQuality
        ? { value: sb.airQuality.aqi, sub: sb.airQuality.category }
        : null,
      winner: winner(aqi(sa), aqi(sb), { tolerance: 3 }),
    },
  ];

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <CompareTable
        title="Crime"
        icon={ShieldCheckIcon}
        a={a}
        b={b}
        rows={crimeRows}
        states={states}
        footer={
          crimeRows.length === 0
            ? (sa?.crimeNote ??
              sb?.crimeNote ??
              "No crime figures for these areas.")
            : "Statistics Canada crime severity, and Toronto Police neighbourhood rates where available."
        }
      />
      <CompareTable
        title="Environment"
        icon={WavesIcon}
        a={a}
        b={b}
        rows={environmentRows}
        states={states}
      />
    </div>
  );
}

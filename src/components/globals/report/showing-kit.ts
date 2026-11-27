// Showing-day facts straight from the report data (no AI): exact answers to
// the questions buyers ask, and a short neighbourhood tour. Times are in the
// selected travel mode.
import {
  type AmenitiesData,
  type CommuteData,
  type DemographicsData,
  type NearbyPlace,
  type SafetyData,
  type SchoolsData,
  TRANSIT_KINDS,
  type UpsideData,
} from "@/lib/report-sections";
import {
  destinationTime,
  TRAVEL_MODES,
  type TravelMode,
  type TravelTimes,
  travelTime,
} from "@/lib/travel";
import { distanceMeters } from "@/server/geo";
import { formatDistance, formatMinutes } from "./report-format";

export type FastFact = { id: string; question: string; answer: string };

type Data = {
  amenities: AmenitiesData | null;
  commute: CommuteData | null;
  schools: SchoolsData | null;
  safety: SafetyData | null;
  demographics: DemographicsData | null;
  upside: UpsideData | null;
};

const RAPID = new Set(["subway", "light_rail", "train"]);

/** "6 min walk (450 m)" in the mode, "~" when estimated. */
function trip(place: TravelTimes, mode: TravelMode) {
  const t = travelTime(place, mode);
  return `${t.estimated ? "~" : ""}${t.minutes} min ${TRAVEL_MODES[mode].verb} (${formatDistance(place.distanceMeters)})`;
}

function quickest<T extends TravelTimes>(places: T[], mode: TravelMode) {
  return places.reduce<T | undefined>(
    (best, p) =>
      !best || travelTime(p, mode).minutes < travelTime(best, mode).minutes
        ? p
        : best,
    undefined,
  );
}

const nearest = (
  amenities: AmenitiesData | null,
  id: string,
  mode: TravelMode,
): NearbyPlace | undefined => quickest(amenities?.categories[id] ?? [], mode);

/** Exact answers to the questions buyers usually ask, from the report. */
export function fastFacts(data: Data, mode: TravelMode): FastFact[] {
  const facts: FastFact[] = [];
  const { amenities, commute, schools, safety, demographics, upside } = data;

  const grocery = nearest(amenities, "groceries", mode);
  if (amenities) {
    facts.push({
      id: "groceries",
      question: "Where's the nearest grocery store?",
      answer: grocery
        ? `${grocery.name}, ${trip(grocery, mode)}.`
        : "None within 1.5 km.",
    });
  }

  if (commute) {
    const stations = commute.stations;
    const rapid = quickest(
      stations.filter((s) => RAPID.has(s.kind)),
      mode,
    );
    const bus = quickest(
      stations.filter((s) => s.kind === "bus" || s.kind === "go_bus"),
      mode,
    );
    const transitParts = [
      rapid &&
        `${rapid.name} (${TRANSIT_KINDS[rapid.kind].label}), ${trip(rapid, mode)}`,
      bus &&
        `${bus.name} (${TRANSIT_KINDS[bus.kind].label}), ${trip(bus, mode)}`,
    ].filter(Boolean);
    facts.push({
      id: "transit",
      question: "How close is transit?",
      answer: transitParts.length
        ? `${transitParts.join("; ")}.`
        : "No stops found nearby.",
    });

    const downtown = commute.destinations.find(
      (d) => (d.kind ?? "downtown") === "downtown",
    );
    if (downtown) {
      const own = destinationTime(downtown, mode);
      facts.push({
        id: "downtown",
        question: `How long to ${downtown.label}?`,
        answer: [
          downtown.transitMinutes != null &&
            `${formatMinutes(downtown.transitMinutes)} by transit`,
          own.minutes != null &&
            `${own.estimated ? "~" : ""}${formatMinutes(own.minutes)} ${mode === "walk" ? "on foot" : "by car"}`,
        ]
          .filter(Boolean)
          .join(", ")
          .concat(`, ${commute.departureLabel.toLowerCase()}.`),
      });
    }
    const airport = commute.destinations.find(
      (d) => d.kind === "airport" || /airport/i.test(d.label),
    );
    if (airport) {
      const own = destinationTime(airport, mode);
      facts.push({
        id: "airport",
        question: "How far is the airport?",
        answer: `${airport.label}: ${[
          airport.driveMinutes != null &&
            `${formatMinutes(airport.driveMinutes)} by car`,
          airport.transitMinutes != null &&
            `${formatMinutes(airport.transitMinutes)} by transit`,
          mode !== "drive" &&
            own.minutes != null &&
            `${own.estimated ? "~" : ""}${formatMinutes(own.minutes)} on foot`,
        ]
          .filter(Boolean)
          .join(", ")}.`,
      });
    }
  }

  if (schools) {
    const all = schools.systems.flatMap((s) => [
      ...s.elementary,
      ...s.secondary,
    ]);
    const pick = (level: "Elementary" | "Secondary") =>
      quickest(
        all.filter((s) => s.level === level),
        mode,
      );
    const el = pick("Elementary");
    const sec = pick("Secondary");
    if (el || sec) {
      facts.push({
        id: "schools",
        question: "Which schools are nearby?",
        answer: `${[
          el && `${el.name} (elementary), ${trip(el, mode)}`,
          sec && `${sec.name} (secondary), ${trip(sec, mode)}`,
        ]
          .filter(Boolean)
          .join("; ")}. Catchments change: confirm with the board.`,
      });
    }
  }

  if (amenities) {
    const daily = [
      ["parks", "Park"],
      ["pharmacies", "Pharmacy"],
      ["cafes", "Café"],
      ["gyms", "Gym"],
      ["healthcare", "Hospital"],
    ] as const;
    const parts = daily.flatMap(([id, label]) => {
      const p = nearest(amenities, id, mode);
      return p ? [`${label}: ${p.name}, ${trip(p, mode)}`] : [];
    });
    if (parts.length) {
      facts.push({
        id: "daily",
        question: "What's nearby day to day?",
        answer: `${parts.join("; ")}.`,
      });
    }
  }

  if (safety) {
    const crime = safety.crime;
    const area = safety.areaCrime;
    facts.push({
      id: "crime",
      question: "What does the crime data say?",
      answer:
        crime?.lowerRateThanShare != null
          ? `${crime.source}: lower total crime rate than ${Math.round(crime.lowerRateThanShare * 100)}% of Toronto neighbourhoods (${crime.year}). Rates vary by street; buyers can check the source.`
          : area?.csi != null
            ? `Statistics Canada Crime Severity Index ${Math.round(area.csi)} for ${area.level === "service" ? `the ${area.service} police service area` : `${area.province.name} overall`}, vs ${area.province.name} ${area.province.csi != null ? Math.round(area.province.csi) : "n/a"} (${area.year}). It covers the whole service area, not this street.`
            : (safety.crimeNote ??
              "Crime data isn't available for this address."),
    });
    facts.push({
      id: "flood",
      question: "Is it in a flood zone?",
      answer: safety.flood.note,
    });
    const { highway, railway, airport } = safety.noise;
    facts.push({
      id: "noise",
      question: "Any traffic, rail or aircraft noise?",
      answer: safety.noise.roadsCovered
        ? [
            highway
              ? `Nearest highway ${formatDistance(highway.meters)} away`
              : "No highway within 500 m",
            railway
              ? `rail line ${formatDistance(railway.meters)} away`
              : "no main rail line within 500 m",
            airport ? `${airport.name} airport ${airport.km} km away` : null,
          ]
            .filter(Boolean)
            .join("; ") + "."
        : safety.noise.outsideCoverage
          ? `Highway and rail distances are available for Ontario only so far.${airport ? ` ${airport.name} airport is ${airport.km} km away.` : ""}`
          : "Highway and rail distances couldn't be checked.",
    });
  }

  if (upside) {
    const transit = upside.projects.find((p) => p.category === "Transit");
    const apps = upside.development?.applications.length;
    facts.push({
      id: "building",
      question: "Is anything being built nearby?",
      answer:
        [
          upside.projects.length
            ? `${upside.projects.length} public projects planned or underway nearby${transit ? `, including ${transit.name} (${transit.status.toLowerCase()}, ${formatDistance(transit.distanceMeters)})` : ""}`
            : "No major public projects nearby",
          apps != null &&
            `${apps} open development application${apps === 1 ? "" : "s"} within 500 m`,
        ]
          .filter(Boolean)
          .join("; ") + ".",
    });
  }

  const v = demographics?.area.values;
  if (v && (v.owners != null || v.renters != null)) {
    facts.push({
      id: "tenure",
      question: "Is it mostly owners or renters?",
      answer: `${v.owners != null ? `${Math.round(v.owners)}% of homes are owned` : ""}${v.owners != null && v.renters != null ? ", " : ""}${v.renters != null ? `${Math.round(v.renters)}% rented` : ""} (${demographics!.censusYear} Census).`,
    });
  }

  return facts;
}

export type TourStop = {
  id: string;
  /** e.g. "Groceries". */
  kind: string;
  name: string;
  lat: number;
  lng: number;
  /** From the home, in the selected mode. */
  minutes: number;
  estimated: boolean;
  distanceMeters: number;
  address: string | null;
  color: string;
};

const TOUR = [
  { id: "groceries", kind: "Groceries", color: "#2563eb" },
  { id: "cafes", kind: "Café", color: "#a16207" },
  { id: "parks", kind: "Park", color: "#16a34a" },
  { id: "restaurants", kind: "Restaurant", color: "#ea580c" },
] as const;

/**
 * A short tour: the quickest grocery, café, park, restaurant, transit stop
 * and elementary school, ordered as a loop from the home (nearest next stop
 * each time, by straight-line distance).
 */
export function neighbourhoodTour(
  data: Data,
  home: { lat: number; lng: number },
  mode: TravelMode,
): TourStop[] {
  const stops: TourStop[] = [];
  const add = (
    place: TravelTimes & {
      id: string;
      name: string;
      lat: number;
      lng: number;
      address?: string | null;
    },
    kind: string,
    color: string,
  ) => {
    const t = travelTime(place, mode);
    stops.push({
      id: place.id,
      kind,
      name: place.name,
      lat: place.lat,
      lng: place.lng,
      minutes: t.minutes,
      estimated: t.estimated,
      distanceMeters: place.distanceMeters,
      address: place.address ?? null,
      color,
    });
  };
  for (const s of TOUR) {
    const p = nearest(data.amenities, s.id, mode);
    if (p) add(p, s.kind, s.color);
  }
  const station =
    quickest(
      (data.commute?.stations ?? []).filter((s) => RAPID.has(s.kind)),
      mode,
    ) ?? quickest(data.commute?.stations ?? [], mode);
  if (station) {
    add(
      station,
      TRANSIT_KINDS[station.kind].label,
      TRANSIT_KINDS[station.kind].color,
    );
  }
  const school = quickest(
    (data.schools?.systems ?? []).flatMap((s) => s.elementary),
    mode,
  );
  if (school) add(school, "Elementary school", "#7c3aed");

  // Order as a loop: always visit the closest remaining stop next.
  const ordered: TourStop[] = [];
  let at = home;
  const left = stops.filter(
    (s, i) => stops.findIndex((o) => o.id === s.id) === i,
  );
  while (left.length) {
    let best = 0;
    for (let i = 1; i < left.length; i++) {
      if (distanceMeters(at, left[i]) < distanceMeters(at, left[best]))
        best = i;
    }
    const [next] = left.splice(best, 1);
    ordered.push(next);
    at = next;
  }
  return ordered;
}

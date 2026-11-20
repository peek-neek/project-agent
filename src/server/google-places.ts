// Shared by Next.js and Trigger.dev tasks, so no "server-only" import here.

import { distanceMeters } from "./geo";

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";

const FIELD_MASK = [
  "suggestions.placePrediction.placeId",
  "suggestions.placePrediction.text.text",
  "suggestions.placePrediction.structuredFormat.mainText.text",
  "suggestions.placePrediction.structuredFormat.secondaryText.text",
  "suggestions.placePrediction.distanceMeters",
].join(",");

// Used when we don't have the user's location: prefer results in Ontario.
const ONTARIO_BOUNDS = {
  rectangle: {
    low: { latitude: 41.68, longitude: -95.16 },
    high: { latitude: 56.86, longitude: -74.32 },
  },
};

const NEARBY_RADIUS_METERS = 50_000; // API maximum for a circle bias

export type LatLng = { lat: number; lng: number };

export type AddressPrediction = {
  placeId: string;
  primary: string;
  secondary: string;
  distanceMeters: number | null;
};

type AutocompleteResponse = {
  suggestions?: {
    placePrediction?: {
      placeId: string;
      text?: { text: string };
      structuredFormat?: {
        mainText?: { text: string };
        secondaryText?: { text: string };
      };
      distanceMeters?: number;
    };
  }[];
};

export class PlacesConfigError extends Error {}

export async function autocompleteAddresses({
  input,
  near,
  sessionToken,
}: {
  input: string;
  near?: LatLng | null;
  sessionToken?: string;
}): Promise<AddressPrediction[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new PlacesConfigError("GOOGLE_MAPS_API_KEY is not set");

  const center = near && {
    latitude: Number(near.lat.toFixed(3)),
    longitude: Number(near.lng.toFixed(3)),
  };

  const response = await fetch(AUTOCOMPLETE_URL, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      input,
      includedRegionCodes: ["ca"],
      includedPrimaryTypes: ["street_address", "premise", "subpremise"],
      languageCode: "en-CA",
      sessionToken,
      ...(center
        ? {
            locationBias: {
              circle: { center, radius: NEARBY_RADIUS_METERS },
            },
            origin: center,
          }
        : { locationBias: ONTARIO_BOUNDS }),
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Places autocomplete failed (${response.status}): ${detail.slice(0, 300)}`,
    );
  }

  const data = (await response.json()) as AutocompleteResponse;
  return (data.suggestions ?? []).flatMap(({ placePrediction: p }) => {
    if (!p) return [];
    const primary = p.structuredFormat?.mainText?.text ?? p.text?.text ?? "";
    if (!primary) return [];
    return [
      {
        placeId: p.placeId,
        primary,
        secondary: p.structuredFormat?.secondaryText?.text ?? "",
        distanceMeters: p.distanceMeters ?? null,
      },
    ];
  });
}

// ---------------------------------------------------------------------------
// Place lookup: resolve an address (by place ID or free text) to its parts.
// ---------------------------------------------------------------------------

const PLACE_FIELDS = [
  "id",
  "formattedAddress",
  "addressComponents",
  "location",
];

type AddressComponent = {
  longText: string;
  shortText: string;
  types: string[];
};

type PlaceResult = {
  id: string;
  formattedAddress?: string;
  addressComponents?: AddressComponent[];
  location?: { latitude: number; longitude: number };
};

export type ResolvedAddress = {
  placeId: string;
  formattedAddress: string | null;
  streetNumber: string | null;
  streetName: string | null;
  unitNumber: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
};

function requireKey() {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new PlacesConfigError("GOOGLE_MAPS_API_KEY is not set");
  return apiKey;
}

async function placesFetch<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Places request failed (${response.status}): ${detail.slice(0, 300)}`,
    );
  }
  return (await response.json()) as T;
}

function toResolvedAddress(place: PlaceResult): ResolvedAddress {
  const components = place.addressComponents ?? [];
  const find = (type: string, short = false) => {
    const c = components.find((component) => component.types.includes(type));
    return c ? (short ? c.shortText : c.longText) : null;
  };

  return {
    placeId: place.id,
    formattedAddress: place.formattedAddress ?? null,
    streetNumber: find("street_number"),
    streetName: find("route"),
    unitNumber: find("subpremise"),
    city: find("locality") ?? find("postal_town") ?? find("sublocality"),
    province: find("administrative_area_level_1", true),
    postalCode: find("postal_code"),
    country: find("country", true),
    latitude: place.location?.latitude ?? null,
    longitude: place.location?.longitude ?? null,
  };
}

/** Place Details (New). Passing the autocomplete session token ends that session. */
export async function getPlaceAddress(
  placeId: string,
  sessionToken?: string,
): Promise<ResolvedAddress> {
  const url = new URL(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
  );
  url.searchParams.set("languageCode", "en-CA");
  if (sessionToken) url.searchParams.set("sessionToken", sessionToken);

  const place = await placesFetch<PlaceResult>(url.toString(), {
    headers: {
      "X-Goog-Api-Key": requireKey(),
      "X-Goog-FieldMask": PLACE_FIELDS.join(","),
    },
  });
  return toResolvedAddress(place);
}

/** Text Search (New), for addresses typed without picking a suggestion. */
export async function searchPlaceAddress(
  text: string,
): Promise<ResolvedAddress | null> {
  const data = await placesFetch<{ places?: PlaceResult[] }>(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": requireKey(),
        "X-Goog-FieldMask": PLACE_FIELDS.map((f) => `places.${f}`).join(","),
      },
      body: JSON.stringify({
        textQuery: text,
        regionCode: "CA",
        languageCode: "en-CA",
        locationBias: ONTARIO_BOUNDS,
        pageSize: 1,
      }),
    },
  );
  const place = data.places?.[0];
  return place ? toResolvedAddress(place) : null;
}

// ---------------------------------------------------------------------------
// Address check for typed addresses (no suggestion picked): a few Text Search
// candidates, each marked precise (a street number) and in Ontario or not.
// ---------------------------------------------------------------------------

export type AddressCandidate = {
  placeId: string;
  formattedAddress: string;
  /** "123 Main St" */
  primary: string;
  /** "Toronto, ON M5V 1A1" */
  secondary: string;
  /** Has a street number (a building or lot, not a street or city). */
  precise: boolean;
  inOntario: boolean;
  lat: number | null;
  lng: number | null;
};

export type AddressResolution =
  /** One precise Ontario address matching the typed street number. */
  | { outcome: "exact"; candidates: AddressCandidate[] }
  /** Several precise Ontario addresses: the agent picks. */
  | { outcome: "choose"; candidates: AddressCandidate[] }
  /** Only streets, neighbourhoods or towns: needs a street number. */
  | { outcome: "imprecise"; candidates: AddressCandidate[] }
  | { outcome: "outside"; candidates: AddressCandidate[] }
  | { outcome: "none"; candidates: AddressCandidate[] };

const PRECISE_TYPES = ["street_address", "premise", "subpremise"];

/** Leading street number the agent typed ("Unit 4, 120 Main" → "120"). */
function typedStreetNumber(text: string) {
  const cleaned = text.replace(
    /^\s*(?:unit|suite|apt\.?|apartment|ph|#)\s*[a-z0-9-]+\s*[,-]?\s+/i,
    "",
  );
  const match = cleaned.match(/^\s*(?:[a-z]?\d+[a-z]?\s*-\s*)?(\d+[a-z]?)\b/i);
  return match ? match[1].toLowerCase() : null;
}

export async function resolveAddress(text: string): Promise<AddressResolution> {
  const fields = [...PLACE_FIELDS, "types"];
  const data = await placesFetch<{
    places?: (PlaceResult & { types?: string[] })[];
  }>("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": requireKey(),
      "X-Goog-FieldMask": fields.map((f) => `places.${f}`).join(","),
    },
    body: JSON.stringify({
      textQuery: text,
      regionCode: "CA",
      languageCode: "en-CA",
      locationBias: ONTARIO_BOUNDS,
      pageSize: 5,
    }),
  });

  const candidates = (data.places ?? []).map((place): AddressCandidate => {
    const r = toResolvedAddress(place);
    const formatted = (r.formattedAddress ?? "").replace(/, Canada$/, "");
    const [primary, ...rest] = formatted.split(",").map((s) => s.trim());
    return {
      placeId: r.placeId,
      formattedAddress: formatted,
      primary: primary ?? formatted,
      secondary: rest.join(", "),
      precise:
        Boolean(r.streetNumber) ||
        (place.types ?? []).some((t) => PRECISE_TYPES.includes(t)),
      inOntario: r.province === "ON" && r.country === "CA",
      lat: r.latitude,
      lng: r.longitude,
    };
  });

  const usable = candidates.filter((c) => c.precise && c.inOntario);
  if (usable.length > 0) {
    const typed = typedStreetNumber(text);
    const [first] = usable;
    const sameNumber =
      typed != null &&
      new RegExp(`^${typed}\\b`).test(
        first.primary.toLowerCase().replace(/^[a-z0-9]+\s*-\s*(?=\d)/, ""),
      );
    return {
      outcome: usable.length === 1 && sameNumber ? "exact" : "choose",
      candidates: usable,
    };
  }
  const ontario = candidates.filter((c) => c.inOntario);
  if (ontario.length > 0) return { outcome: "imprecise", candidates: ontario };
  if (candidates.length > 0) return { outcome: "outside", candidates };
  return { outcome: "none", candidates: [] };
}

// ---------------------------------------------------------------------------
// Nearby Search (New): places of given types around a point, nearest first.
// ---------------------------------------------------------------------------

export type NearbyResult = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  rating: number | null;
  ratingCount: number | null;
  primaryType: string | null;
  photo?: PlacePhoto | null;
  /** Up to PHOTOS_PER_PLACE photos (the first is `photo`). */
  photos?: PlacePhoto[];
};

export type PlacePhoto = {
  name: string;
  author: string | null;
  authorUri: string | null;
};

/** Photos kept per place: enough to browse, few enough to stay light. */
const PHOTOS_PER_PLACE = 4;

type NearbyPlace = {
  id: string;
  displayName?: { text: string };
  location?: { latitude: number; longitude: number };
  shortFormattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  primaryType?: string;
  photos?: {
    name: string;
    authorAttributions?: { displayName?: string; uri?: string }[];
  }[];
};

const NEARBY_FIELDS = [
  "id",
  "displayName",
  "location",
  "shortFormattedAddress",
  "rating",
  "userRatingCount",
  "primaryType",
  // Same SKU tier as rating/userRatingCount, so no extra cost per search.
  "photos",
];

function toNearbyResult(p: NearbyPlace): NearbyResult[] {
  if (!p.location || !p.displayName?.text) return [];
  const photos: PlacePhoto[] = (p.photos ?? [])
    .slice(0, PHOTOS_PER_PLACE)
    .map((ph) => ({
      name: ph.name,
      author: ph.authorAttributions?.[0]?.displayName ?? null,
      authorUri: ph.authorAttributions?.[0]?.uri ?? null,
    }));
  return [
    {
      id: p.id,
      name: p.displayName.text,
      lat: p.location.latitude,
      lng: p.location.longitude,
      address: p.shortFormattedAddress ?? null,
      rating: p.rating ?? null,
      ratingCount: p.userRatingCount ?? null,
      primaryType: p.primaryType ?? null,
      photo: photos[0] ?? null,
      photos,
    },
  ];
}

export async function searchNearby({
  lat,
  lng,
  types,
  radius,
  match = "any",
  maxResults = 10,
}: {
  lat: number;
  lng: number;
  types: readonly string[];
  radius: number;
  /** "primary": only places whose primary type is listed. */
  match?: "primary" | "any";
  maxResults?: number;
}): Promise<NearbyResult[]> {
  const data = await placesFetch<{ places?: NearbyPlace[] }>(
    "https://places.googleapis.com/v1/places:searchNearby",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": requireKey(),
        "X-Goog-FieldMask": NEARBY_FIELDS.map((f) => `places.${f}`).join(","),
      },
      body: JSON.stringify({
        [match === "primary" ? "includedPrimaryTypes" : "includedTypes"]: types,
        maxResultCount: maxResults,
        rankPreference: "DISTANCE",
        languageCode: "en-CA",
        locationRestriction: {
          circle: { center: { latitude: lat, longitude: lng }, radius },
        },
      }),
    },
  );
  // Google can return related subtypes (e.g. medical_center for hospital) even
  // with includedPrimaryTypes, so enforce the primary type ourselves.
  const places = (data.places ?? []).filter(
    (p) =>
      match !== "primary" || !p.primaryType || types.includes(p.primaryType),
  );
  return places.flatMap(toNearbyResult);
}

/**
 * Text Search (New) around a point, for places a type alone can't pick out
 * (e.g. "GO bus" stops among all bus stops). Nearest first, within `radius`.
 */
export async function searchTextNearby({
  lat,
  lng,
  query,
  type,
  radius,
  maxResults = 20,
}: {
  lat: number;
  lng: number;
  query: string;
  /** Restrict to one place type; omit for any place matching the query. */
  type?: string;
  radius: number;
  maxResults?: number;
}): Promise<NearbyResult[]> {
  const data = await placesFetch<{ places?: NearbyPlace[] }>(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": requireKey(),
        "X-Goog-FieldMask": NEARBY_FIELDS.map((f) => `places.${f}`).join(","),
      },
      body: JSON.stringify({
        textQuery: query,
        ...(type ? { includedType: type, strictTypeFiltering: true } : {}),
        rankPreference: "DISTANCE",
        pageSize: maxResults,
        regionCode: "CA",
        languageCode: "en-CA",
        // Text Search only biases to a circle, so enforce the radius below.
        locationBias: {
          circle: { center: { latitude: lat, longitude: lng }, radius },
        },
      }),
    },
  );
  return (data.places ?? [])
    .flatMap(toNearbyResult)
    .filter((p) => distanceMeters({ lat, lng }, p) <= radius);
}

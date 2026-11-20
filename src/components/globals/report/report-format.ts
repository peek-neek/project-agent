import type { inferRouterOutputs } from "@trpc/server";
import type {
  FieldProvenance,
  FieldSource,
  IdentitySources,
} from "@/server/report-store";
import type { AppRouter } from "@/trpc/routers/_app";

export type { FieldProvenance, IdentitySources };

/** Report as the client receives it (dates serialized to strings). */
export type ReportData = NonNullable<
  inferRouterOutputs<AppRouter>["report"]["byId"]
>;
export type ReportJob = ReportData["jobs"][number];

// Dates arrive as Date (server render) or ISO strings (client refetch).
type DateLike = Date | string;

export const formatDate = (value: DateLike) =>
  new Intl.DateTimeFormat("en-CA", { dateStyle: "long" }).format(
    new Date(value),
  );

export const formatShortDate = (value: DateLike) =>
  new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(
    new Date(value),
  );

export const sourceLabels: Record<FieldSource, string> = {
  google: "Google Maps",
  search: "Address as searched",
  agent: "Entered by agent",
  pin: "Pin dropped by agent",
};

export function formatCoordinates(lat: number, lng: number) {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(5)}° ${ns}, ${Math.abs(lng).toFixed(5)}° ${ew}`;
}

export const shortId = (id: string) => id.slice(0, 8).toUpperCase();

export const formatDistance = (meters: number) =>
  meters < 1000
    ? `${Math.round(meters / 10) * 10} m`
    : `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`;

export const formatMinutes = (minutes: number) =>
  minutes < 60
    ? `${minutes} min`
    : `${Math.floor(minutes / 60)} h ${minutes % 60 ? `${minutes % 60} min` : ""}`.trim();

export const formatPrice = (value: number) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);

/** Google Maps link for a place: by place ID when we have one. */
export function googleMapsUrl({
  name,
  address,
  placeId,
  lat,
  lng,
}: {
  name?: string | null;
  address?: string | null;
  placeId?: string;
  lat: number;
  lng: number;
}) {
  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1");
  url.searchParams.set(
    "query",
    [name, address].filter(Boolean).join(", ") || `${lat},${lng}`,
  );
  if (placeId) url.searchParams.set("query_place_id", placeId);
  return url.toString();
}

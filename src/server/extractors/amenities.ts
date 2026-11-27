// Runs inside the Trigger.dev "amenities" task.
import {
  AMENITY_CATEGORIES,
  type AmenitiesData,
  type NearbyPlace,
  SECTION_KEYS,
} from "../../lib/report-sections";
import { estimateMinutes } from "../../lib/travel";
import { distanceMeters, type LatLng } from "../geo";
import { type NearbyResult, searchNearby } from "../google-places";
import { RoutesUnavailableError, routeMatrix } from "../google-routes";
import { reportStore } from "../report-store";

const PER_CATEGORY = 5;

type Matrix = Awaited<ReturnType<typeof routeMatrix>>;

/**
 * Walk and drive times to places (one matrix call per mode), falling back to
 * distance estimates. Walk drives distanceMeters (and is required unless the
 * Routes API is off); drive failures only cost accuracy.
 */
export async function withTravelTimes(
  origin: LatLng,
  places: NearbyResult[],
): Promise<NearbyPlace[]> {
  const matrix = async (mode: "WALK" | "DRIVE", strict: boolean) => {
    try {
      return await routeMatrix(origin, places, mode);
    } catch (error) {
      if (strict && !(error instanceof RoutesUnavailableError)) throw error;
      return null;
    }
  };
  const [walk, drive]: (Matrix | null)[] = await Promise.all([
    matrix("WALK", true),
    matrix("DRIVE", false),
  ]);

  const minutes = (m: Matrix | null, i: number) => {
    const cell = m?.[i];
    return cell ? Math.max(1, Math.round(cell.seconds / 60)) : null;
  };

  return places.map((place, i) => {
    const straight = Math.round(distanceMeters(origin, place));
    const w = walk?.[i];
    const driveMinutes = minutes(drive, i);
    return {
      id: place.id,
      name: place.name,
      lat: place.lat,
      lng: place.lng,
      address: place.address,
      rating: place.rating,
      ratingCount: place.ratingCount,
      distanceMeters: w ? w.meters : straight,
      walkMinutes: minutes(walk, i) ?? estimateMinutes(straight, "walk"),
      walkEstimated: !w,
      driveMinutes: driveMinutes ?? estimateMinutes(straight, "drive"),
      driveEstimated: driveMinutes == null,
      photo: place.photo ?? null,
      photos: place.photos ?? (place.photo ? [place.photo] : []),
    };
  });
}

export async function extractAmenities(reportId: string) {
  const report = await reportStore.findWithDetails(reportId);
  const { latitude: lat, longitude: lng } = report?.property ?? {};
  if (lat == null || lng == null) {
    throw new Error("The property's location isn't available yet.");
  }
  const origin = { lat, lng };

  const found = await Promise.all(
    AMENITY_CATEGORIES.map((category) =>
      searchNearby({
        ...origin,
        types: category.types,
        radius: category.radius,
        match: category.match,
        // Fetch extra: strict primary-type filtering can drop some results.
        maxResults: category.match === "primary" ? 20 : PER_CATEGORY,
      }).then((places) => places.slice(0, PER_CATEGORY)),
    ),
  );

  // One matrix call per travel mode for every place across all categories.
  const all = found.flat();
  const timed = await withTravelTimes(origin, all);
  const byId = new Map(timed.map((p) => [p.id, p]));

  const categories: AmenitiesData["categories"] = {};
  AMENITY_CATEGORIES.forEach((category, i) => {
    categories[category.id] = found[i]
      .map((p) => byId.get(p.id)!)
      .sort((a, b) => a.distanceMeters - b.distanceMeters);
  });

  const data: AmenitiesData = {
    categories,
    fetchedAt: new Date().toISOString(),
  };
  await reportStore.setSection(reportId, SECTION_KEYS.amenities, data);
  return {
    places: all.length,
    walkTimesEstimated: timed.some((p) => p.walkEstimated),
  };
}

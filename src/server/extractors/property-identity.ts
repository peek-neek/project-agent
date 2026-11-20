// Runs inside the Trigger.dev "property-identity" task.
import { AbortTaskRunError } from "@trigger.dev/sdk";
import { municipalityAt } from "../crime-severity";
import {
  getPlaceAddress,
  type ResolvedAddress,
  searchPlaceAddress,
} from "../google-places";
import {
  type IdentitySources,
  PROPERTY_IDENTITY_JOB,
  reportStore,
} from "../report-store";

const UNIT_PATTERNS = [
  // "Unit 1203, 100 Queen St W", "Suite 4 - 77 King St", "#12 100 Main St"
  /^\s*(?:unit|suite|apt\.?|apartment|ph|#)\s*([a-z0-9-]+)\s*[,-]?\s+\d/i,
  // "1203-100 Queen St W" (unit, dash, street number)
  /^\s*([a-z]?\d+[a-z]?)\s*-\s*\d+[a-z]?\s+\S/i,
];

/** Unit number written in the address the agent typed, if any. */
export function parseUnitFromInput(input: string) {
  for (const pattern of UNIT_PATTERNS) {
    const match = input.match(pattern);
    if (match) return match[1].toUpperCase();
  }
  return null;
}

/** Shown on the report when the address can't be placed on the map. */
export const ADDRESS_NOT_FOUND =
  "We couldn't find this address on the map. Check the street number and town, pick it from the suggestions, or drop a pin for new builds and rural lots.";
export const ADDRESS_OUTSIDE_ONTARIO =
  "This address is outside Ontario. Reports cover Ontario properties only.";

/** "WHITCHURCH-STOUFFVILLE" → "Whitchurch-Stouffville". */
const titleCase = (s: string) =>
  s
    .toLowerCase()
    .replace(/(^|[\s\-/.(])([a-z])/g, (_, p, c) => p + c.toUpperCase());

/**
 * Resolves the report's address with Google and stores the identification
 * fields. Legal description, PIN and roll number have no free public source,
 * so they stay empty for the agent to fill in.
 */
export async function extractPropertyIdentity({
  reportId,
  sessionToken,
}: {
  reportId: string;
  sessionToken?: string;
}) {
  const report = await reportStore.findById(reportId);
  // Deleted by the agent: stop without retrying.
  if (!report) throw new AbortTaskRunError(`Report ${reportId} was deleted`);

  await reportStore.updateJob(reportId, PROPERTY_IDENTITY_JOB, {
    status: "running",
    startedAt: new Date(),
    error: null,
  });

  // A pin the agent dropped: keep its coordinates, add the town (free, from
  // Ontario's municipal boundaries) and skip Google.
  const existing = await reportStore.getIdentity(reportId);
  const pinned =
    (existing?.sources as IdentitySources | null)?.location?.source === "pin" &&
    existing?.latitude != null &&
    existing.longitude != null;
  if (pinned) {
    const muni = await municipalityAt({
      lat: existing.latitude!,
      lng: existing.longitude!,
    }).catch(() => null);
    const asOf = new Date().toISOString();
    const typedUnit = parseUnitFromInput(report.inputAddress);
    await reportStore.saveIdentity(
      reportId,
      {
        city: existing.city ?? (muni ? titleCase(muni.name) : null),
        unitNumber: existing.unitNumber ?? typedUnit,
      },
      typedUnit ? { unitNumber: { source: "search", asOf } } : {},
    );
    await reportStore.updateJob(reportId, PROPERTY_IDENTITY_JOB, {
      status: "completed",
      finishedAt: new Date(),
    });
    return { resolved: true, pinned: true, unitNumber: typedUnit };
  }

  const resolved: ResolvedAddress | null = report.placeId
    ? await getPlaceAddress(report.placeId, sessionToken)
    : await searchPlaceAddress(report.inputAddress);

  // Safety net (the search box checks first): no point building a report on
  // a guess. Fail once, without retries, with a message the agent can act on.
  const notFound =
    !resolved || resolved.latitude == null || resolved.longitude == null;
  const outside =
    resolved != null &&
    (resolved.province !== "ON" || resolved.country !== "CA");
  const vague = !report.placeId && resolved != null && !resolved.streetNumber;
  if (notFound || outside || vague) {
    const message = outside ? ADDRESS_OUTSIDE_ONTARIO : ADDRESS_NOT_FOUND;
    await reportStore.updateJob(reportId, PROPERTY_IDENTITY_JOB, {
      status: "failed",
      finishedAt: new Date(),
      error: message,
    });
    throw new AbortTaskRunError(message);
  }

  const asOf = new Date().toISOString();
  const typedUnit = parseUnitFromInput(report.inputAddress);
  const unitNumber = resolved.unitNumber ?? typedUnit;

  const sources: IdentitySources = {
    formattedAddress: { source: "google", asOf },
  };
  if (unitNumber) {
    sources.unitNumber = {
      source: resolved.unitNumber ? "google" : "search",
      asOf,
    };
  }

  await reportStore.saveIdentity(
    reportId,
    {
      formattedAddress: resolved.formattedAddress ?? report.inputAddress,
      streetNumber: resolved.streetNumber,
      streetName: resolved.streetName,
      unitNumber,
      city: resolved.city,
      province: resolved.province,
      postalCode: resolved.postalCode,
      country: resolved.country,
      latitude: resolved.latitude,
      longitude: resolved.longitude,
    },
    sources,
  );

  await reportStore.updateJob(reportId, PROPERTY_IDENTITY_JOB, {
    status: "completed",
    finishedAt: new Date(),
  });

  return { resolved: true, pinned: false, unitNumber };
}

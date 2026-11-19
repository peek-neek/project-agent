// Runs inside the Trigger.dev "property-identity" task.
import { AbortTaskRunError } from "@trigger.dev/sdk";
import { getPlaceAddress, searchPlaceAddress } from "../google-places";
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

  const resolved = report.placeId
    ? await getPlaceAddress(report.placeId, sessionToken)
    : await searchPlaceAddress(report.inputAddress);

  const asOf = new Date().toISOString();
  const typedUnit = parseUnitFromInput(report.inputAddress);
  const unitNumber = resolved?.unitNumber ?? typedUnit;

  const sources: IdentitySources = {
    formattedAddress: { source: resolved ? "google" : "search", asOf },
  };
  if (unitNumber) {
    sources.unitNumber = {
      source: resolved?.unitNumber ? "google" : "search",
      asOf,
    };
  }

  await reportStore.saveIdentity(
    reportId,
    {
      formattedAddress: resolved?.formattedAddress ?? report.inputAddress,
      streetNumber: resolved?.streetNumber,
      streetName: resolved?.streetName,
      unitNumber,
      city: resolved?.city,
      province: resolved?.province,
      postalCode: resolved?.postalCode,
      country: resolved?.country,
      latitude: resolved?.latitude,
      longitude: resolved?.longitude,
    },
    sources,
  );

  await reportStore.updateJob(reportId, PROPERTY_IDENTITY_JOB, {
    status: "completed",
    finishedAt: new Date(),
  });

  return { resolved: Boolean(resolved), unitNumber };
}

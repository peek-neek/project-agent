// Public and Catholic K–12 schools outside Ontario into CanadaSchool.
//
// Source: Statistics Canada, Open Database of Educational Facilities v2.1
// (2022; Open Government Licence – Canada). It's archived, so this is a
// snapshot: schools opened since aren't in it. Ontario uses the ministry's
// file instead (datasets/ontario-schools.ts, with EQAO).
//
// About 2,400 public schools (mostly AB, BC, MB, SK, NL) come without
// coordinates. When the Google Geocoding API is enabled they're placed from
// their address; otherwise they're skipped. Google allows caching geocodes
// for 30 days, so the import is scheduled monthly and re-geocodes each run.
//
// Shared by `npm run data:canada-schools` and the Trigger.dev task (no
// "server-only" import).
import { unzipSync } from "fflate";
import type { Prisma } from "../../generated/prisma/client";
import { parseCsvRecords } from "../csv";
import { db } from "../db";

export const SOURCE_URL =
  "https://www150.statcan.gc.ca/n1/en/pub/37-26-0001/2022001/ODEF_v2.1.zip";
export const DATA_YEAR = "ODEF 2.1 (2022)";
const CSV_NAME = /ODEF_v2_1\.csv$/;

type Row = Record<string, string>;

/** ".." is the source's "not available". */
const value = (v: string | undefined) => {
  const s = (v ?? "").trim();
  return s === "" || s === ".." ? null : s;
};
const coordinate = (v: string | undefined) => {
  const n = Number(value(v));
  return value(v) != null && Number.isFinite(n) && n !== 0 ? n : null;
};

// --- which records are public K–12 schools ----------------------------------

/**
 * Not a public or Catholic school: private and independent schools (as for
 * Ontario), post-secondary, pre-school programs, Québec building records
 * ("Installation"), government and alternative centres, and federally run
 * First Nations schools (which serve their communities, not a catchment).
 */
const EXCLUDED_TYPE =
  /private|independent|ECS Private|installation|gouvernementale|Alternative Learning|First Nations|StrongStart|University|College|Collège|Cégep|Technical|Nursing|Miscellaneous/i;
const EXCLUDED_AUTHORITY = /INDEPENDENT SCHOOLS|NON-FUNDED|FIRST NATIONS|Private|Native/i;
/**
 * Programs listed as public schools that don't serve a catchment: online and
 * distance learning, outreach, hospital and treatment programs, adult and
 * continuing education (e.g. Vancouver's "Peak House", a youth program).
 * Not a bare "House": towns like 100 Mile House name real schools.
 */
const EXCLUDED_NAME =
  /\b(Online|Virtual|Distance|e-?Learning|Home ?School|Homeschool|Outreach|Alternate|Alternative|Hospital|Treatment|Custody|Peak House|Grimmon House|Adult|Continuing Education|Learning Centre|Learning Center|Correspondence)\b|à distance|éducation des adultes|formation professionnelle/i;

/** Levels from the name, for provinces that publish none (PEI, Nunavut). */
const SECONDARY_NAME = /\b(High|Secondary|Senior|Collegiate|Intermediate|Middle|Regional)\b|\bpolyvalente\b|\bsecondaire\b/i;
const ELEMENTARY_NAME = /\b(Elementary|Primary|Consolidated|Kindergarten)\b|\bprimaire\b|\bélémentaire\b/i;

function levels(r: Row) {
  const flags = ["ISCED1", "ISCED2", "ISCED3"].map((k) => value(r[k]));
  if (flags.some((f) => f != null)) {
    const elementary = r.ISCED1 === "1";
    // Junior highs (lower secondary only) count as secondary.
    const secondary = r.ISCED3 === "1" || (r.ISCED2 === "1" && !elementary);
    return { elementary, secondary };
  }
  // No levels published: infer from the name; a plain "School" is often a
  // small community's only (K–12) school, so it counts as both.
  const name = r.Facility_Name ?? "";
  const secondary = SECONDARY_NAME.test(name);
  const elementary = ELEMENTARY_NAME.test(name);
  if (!secondary && !elementary) return { elementary: true, secondary: true };
  return { elementary, secondary };
}

// --- language and type -------------------------------------------------------

const FRENCH_AUTHORITY =
  /francophone|Conseil scolaire|Commission scolaire|scolaire acadien|^DSF\b|District scolaire|\bCSF\b|Centre de services scolaire/i;
const CATHOLIC = /Catholic|Separate|RCSSD|catholique|\bYCS\b/i;
const ENGLISH_NAME =
  /\b(School|Elementary|High|Intermediate|Academy|Collegiate|Primary|Secondary|Community|Junior|Senior)\b/i;

/**
 * OLMS_Status flags official-language-minority schools: French outside
 * Québec, English inside it. Board names fill gaps (BC rarely has them).
 */
function language(r: Row): "English" | "French" {
  const authority = r.Authority_Name ?? "";
  const minority = r.OLMS_Status === "1";
  if (r.Prov_Terr === "QC") {
    const english =
      minority ||
      /School Board/i.test(authority) ||
      (value(authority) == null &&
        ENGLISH_NAME.test(r.Facility_Name ?? "") &&
        !/^[ÉE]cole/i.test(r.Facility_Name ?? ""));
    return english ? "English" : "French";
  }
  return minority ||
    r.Facility_Type === "Francophone" ||
    FRENCH_AUTHORITY.test(authority)
    ? "French"
    : "English";
}

const schoolType = (r: Row): "Public" | "Catholic" =>
  CATHOLIC.test(r.Authority_Name ?? "") ||
  r.Facility_Type === "Separate" ||
  r.Facility_Type === "Catholic"
    ? "Catholic"
    : "Public";

// --- geocoding ------------------------------------------------------------------

type Located = { lat: number; lng: number; approximate: boolean };

/** Null when the Geocoding API isn't enabled or finds nothing in Canada. */
async function geocode(address: string, key: string): Promise<Located | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("region", "ca");
  url.searchParams.set("components", "country:CA");
  url.searchParams.set("key", key);
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const json = (await res.json()) as {
    status: string;
    results?: {
      geometry: { location: { lat: number; lng: number }; location_type: string };
    }[];
  };
  if (json.status === "REQUEST_DENIED") throw new GeocodingUnavailable();
  const hit = json.results?.[0];
  if (!hit) return null;
  return {
    ...hit.geometry.location,
    // A town or postal area, not the building (rural box addresses).
    approximate: hit.geometry.location_type === "APPROXIMATE",
  };
}
class GeocodingUnavailable extends Error {}

/** Runs `fn` over `items`, `limit` at a time. */
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

// --- import ----------------------------------------------------------------------

async function downloadCsv() {
  const res = await fetch(SOURCE_URL, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`School data download failed: HTTP ${res.status}`);
  const files = unzipSync(new Uint8Array(await res.arrayBuffer()));
  const name = Object.keys(files).find((f) => CSV_NAME.test(f));
  if (!name) throw new Error("School data: CSV not found in the ZIP");
  // The CSV is Windows-1252 (accented names).
  return new TextDecoder("windows-1252").decode(files[name]);
}

/**
 * Replaces CanadaSchool with the source's public K–12 schools outside
 * Ontario (given CSV text, or downloaded). All or nothing.
 */
export async function importCanadaSchools(csvText?: string) {
  const rows = parseCsvRecords(csvText ?? (await downloadCsv()));
  const key = process.env.GOOGLE_MAPS_API_KEY;
  let geocoding = Boolean(key);

  const seen = new Set<string>();
  const skipped = { notSchool: 0, notLocated: 0, duplicate: 0 };
  const candidates: { row: Row; lat: number | null; lng: number | null }[] = [];
  for (const row of rows) {
    if (row.Prov_Terr === "ON" || !value(row.Prov_Terr)) continue;
    const { elementary, secondary } = levels(row);
    if (
      (!elementary && !secondary) ||
      EXCLUDED_TYPE.test(row.Facility_Type ?? "") ||
      EXCLUDED_AUTHORITY.test(row.Authority_Name ?? "") ||
      EXCLUDED_NAME.test(row.Facility_Name ?? "")
    ) {
      skipped.notSchool++;
      continue;
    }
    candidates.push({ row, lat: coordinate(row.Latitude), lng: coordinate(row.Longitude) });
  }

  // Place the ones without coordinates from their address.
  const missing = candidates.filter((c) => c.lat == null || c.lng == null);
  const located = new Map<Row, Located | null>();
  if (geocoding && missing.length) {
    await pool(missing, 8, async ({ row }) => {
      if (!geocoding) return;
      const address = value(row.Full_Addr);
      if (!address) return;
      try {
        located.set(row, await geocode(address, key!));
      } catch (error) {
        if (error instanceof GeocodingUnavailable) geocoding = false;
        else located.set(row, null);
      }
    });
  }

  const schools: Prisma.CanadaSchoolCreateManyInput[] = [];
  for (const { row, lat, lng } of candidates) {
    const place = lat != null && lng != null ? null : located.get(row);
    const latitude = lat ?? place?.lat;
    const longitude = lng ?? place?.lng;
    if (latitude == null || longitude == null) {
      skipped.notLocated++;
      continue;
    }
    const name = value(row.Facility_Name);
    const dedupe = `${name?.toLowerCase()}|${latitude.toFixed(3)}|${longitude.toFixed(3)}`;
    if (!name || seen.has(dedupe)) {
      skipped.duplicate++;
      continue;
    }
    seen.add(dedupe);
    const street = [value(row.Unit), value(row.Street_No), value(row.Street_Name)]
      .filter(Boolean)
      .join(" ");
    schools.push({
      id: row.Index,
      name,
      boardName: value(row.Authority_Name),
      type: schoolType(row),
      language: language(row),
      ...levels(row),
      street: street || null,
      city: value(row.City),
      province: row.Prov_Terr,
      postalCode: value(row.Postal_Code),
      latitude,
      longitude,
      geocoded: place != null,
      approximate: place?.approximate ?? false,
      dataYear: DATA_YEAR,
    });
  }
  if (schools.length === 0) {
    throw new Error("The school file had no usable rows; kept the existing data.");
  }

  await db.$transaction([
    db.canadaSchool.deleteMany(),
    db.canadaSchool.createMany({ data: schools }),
  ]);
  return {
    imported: schools.length,
    geocoded: schools.filter((s) => s.geocoded).length,
    geocodingAvailable: geocoding,
    skipped,
    dataYear: DATA_YEAR,
  };
}

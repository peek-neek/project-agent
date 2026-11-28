// Development applications outside Toronto, queried live from municipal open
// data: ArcGIS layers, Socrata datasets (Calgary, Edmonton, Winnipeg) and
// Opendatasoft (Vancouver). Each city publishes its own fields and statuses,
// so every source maps its records to one shape. Toronto's applications come
// from the imported table instead (datasets/toronto-development.ts).
//
// Outside Ontario some cities publish permits rather than planning
// applications; those sources keep only significant files (rezonings and new
// multi-unit, mixed-use or commercial buildings), like Ontario's planning
// applications.
//
// Only planning fields are read: never owner, agent or contact details.
// Shared by Next.js and Trigger.dev tasks (no "server-only" import).
import type { ApplicationStage } from "../lib/report-sections";
import { type ArcgisFeature, atPoint, queryLayer } from "./arcgis";
import { parseStoreys, parseUnits } from "./datasets/parse-development";
import { distanceMeters, type LatLng } from "./geo";

type Attrs = Record<string, unknown>;

export type LiveApplication = {
  id: string;
  type: string;
  status: string;
  stage: ApplicationStage;
  submittedAt: string | null;
  address: string;
  description: string | null;
  url: string | null;
  units: number | null;
  storeys: number | null;
  lat: number;
  lng: number;
  distanceMeters: number;
};

/** What a source maps one record to (position and distance added later). */
type Mapped = Omit<
  LiveApplication,
  "lat" | "lng" | "distanceMeters" | "units" | "storeys" | "stage"
> & {
  stage?: ApplicationStage | null;
  units?: number | null;
  storeys?: number | null;
};

type BaseSource = {
  /** Shown as the data source, e.g. "City of Mississauga". */
  label: string;
  /** Two-letter province code: a same-named place elsewhere never matches. */
  province: string;
  /** Lower/single-tier municipalities served (normalized names). */
  municipalities: string[];
  /** Null drops the record (closed, withdrawn, minor variance…). */
  map: (a: Attrs) => Mapped | null;
};

/** ArcGIS feature layer(s), queried by distance. */
type ArcgisSource = BaseSource & {
  kind?: "arcgis";
  /** One layer, or several queried together (e.g. by application type). */
  url: string | string[];
  where?: string;
  outFields: string[];
};

/** Socrata dataset (data.calgary.ca…), queried by distance. */
type SocrataSource = BaseSource & {
  kind: "socrata";
  domain: string;
  dataset: string;
  /** SoQL filter, ANDed with the distance filter. */
  where?: string;
  /**
   * A point column (within_circle), or latitude/longitude text columns
   * (bounding box, then exact distance).
   */
  geo: { point: string } | { lat: string; lng: string };
};

/** Opendatasoft dataset (opendata.vancouver.ca…), queried by distance. */
type OdsSource = BaseSource & {
  kind: "ods";
  base: string;
  dataset: string;
  /** geo_point_2d field. */
  geoField: string;
  /** ODSQL filter, ANDed with the distance filter. */
  where?: string;
};

type Source = ArcgisSource | SocrataSource | OdsSource;

// --- value helpers ----------------------------------------------------------

const text = (v: unknown) => {
  if (v == null) return null;
  const s = String(v)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return s && s !== "None" && s !== "Null" ? s : null;
};
const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(text(v));
  return Number.isFinite(n) && n > 0 ? n : null;
};
/** Epoch ms or a date string → ISO, else null. */
const date = (v: unknown) => {
  if (v == null || v === "") return null;
  const d = typeof v === "number" ? new Date(v) : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const titleCase = (s: string) =>
  s
    .toLowerCase()
    .replace(/(^|[\s\-/(])([a-z])/g, (_, p, c) => p + c.toUpperCase());
/** "321  COURTLAND AVE E" → "321 Courtland Ave E" (leave mixed case alone). */
const address = (v: unknown) => {
  const full = text(v);
  if (!full) return null;
  // "281 Princess St, Kingston, ON K7L 1B4" → "281 Princess St"; long
  // legal descriptions ("Southwest corner of …, Parts 5, 8 …") → first part.
  const first = full.split(",")[0].trim();
  const s = /^\d/.test(first) || full.length > 70 ? first : full;
  return s === s.toUpperCase() ? titleCase(s) : s;
};

/** Ended files: not shown. */
const CLOSED =
  /\b(closed|withdrawn|refused|cancell?ed|void|inactive|done|lapsed|assumed|registered|no regional interests|denied|deferred indefinitely|transferred|invalid|revoked|expired)\b/i;
/**
 * A status's stage. Decided-with-appeal-window ("In Appeal Period") counts
 * as approved; a filed appeal as under appeal.
 */
function stageOf(status: string): ApplicationStage | null {
  if (/closed\s*-\s*approved/i.test(status)) return "approved";
  if (CLOSED.test(status)) return null;
  if (/appeal period/i.test(status)) return "approved";
  if (/appeal|\bolt\b|\bomb\b|\blpat\b(?! approved)/i.test(status))
    return "appeal";
  if (/approv|endorsed|adopted|passed|issued|signed off|final/i.test(status))
    return "approved";
  return "review";
}

/** Common application types to the codes the UI labels (else the text). */
function typeOf(raw: string | null) {
  const t = raw ?? "";
  if (/official plan|zoning|rezoning|\bopa\b|\bzba\b|\boz\b/i.test(t))
    return "OZ";
  if (/site plan|\bspa?\b/i.test(t)) return "SA";
  if (/subdivision/i.test(t)) return "SB";
  if (/condo/i.test(t)) return "CD";
  if (/part.lot/i.test(t)) return "PL";
  return raw ?? "Development application";
}
/** Committee of Adjustment files are minor; Toronto's data leaves them out too. */
const MINOR =
  /minor variance|consent|committee of adjustment|sign by-?law|sign variance/i;

/**
 * Calgary development permit statuses: "Released" (and "Pending Release")
 * mean approved; advertising and circulation are review steps.
 */
function calgaryStage(status: string): ApplicationStage | null {
  if (/released|approved/i.test(status)) return "approved";
  if (/appeal/i.test(status)) return "appeal";
  if (CLOSED.test(status) || /hold/i.test(status)) return null;
  return "review";
}

/**
 * A permit description for a building that changes a block: three or more
 * homes, or multi-unit, mixed-use, commercial or institutional. Not house
 * scale (detached and semi-detached houses, suites, garages, decks).
 */
const BLOCK_SCALE =
  /\b(apartment|row hous|townhous|stacked|multi[- ]unit|multi[- ]family|mixed[- ]use|commercial|retail|office|hotel|institutional|school|care facility|assisted living)/i;
const HOUSE_SCALE =
  /\b(single detached|semi[- ]detached|secondary suite|garden suite|backyard house|garage|deck|basement|accessory)/i;
/** Whole words: "building" alone (an existing building) doesn't count. */
const NEW_BUILDING = /\b(construct(ion|ing)?|erect|new)\b/i;
/** Changes to a building that's already there. */
const EXISTING =
  /\bto an existing\b|^to (add|convert|change|operate|install|legali[sz]e|renovate)\b|\balterations?\b/i;
function significant(description: string) {
  // Conversions and additions to existing buildings aren't new development.
  if (!NEW_BUILDING.test(description) || EXISTING.test(description)) return false;
  const units = parseUnits(description) ?? 0;
  if (units >= 3) return true;
  return BLOCK_SCALE.test(description) && !HOUSE_SCALE.test(description);
}

/** Small works filed as site plans (Brampton): not development. */
const MINOR_WORK =
  /interior alteration|exhaust|window|signage|\bsign\b|patio|canopy|fa[cç]ade|roof top unit|rooftop unit|\bhvac\b|generator|accessible ramp|parking lot (re)?surfac|change of (occupancy|use)/i;

/** "NEW: MULTI-RESIDENTIAL DEVELOPMENT" → "New: multi-residential development". */
const sentence = (v: string | null) =>
  v && v === v.toUpperCase() ? v.charAt(0) + v.slice(1).toLowerCase() : v;

// --- sources ------------------------------------------------------------------

const SOURCES: Source[] = [
  {
    label: "City of Mississauga",
    province: "ON",
    municipalities: ["mississauga"],
    url: "https://services6.arcgis.com/hM5ymMLbxIyWTjn2/arcgis/rest/services/Growth_Management_–_Active_Development_Applications/FeatureServer/0",
    outFields: [
      "ApplicationNumber",
      "SubmissionDate",
      "ApplicationStatus",
      "ApplicationDescription",
      "SiteAddress",
      "ResidentialUnits",
      "MaxStoreys",
    ],
    map: (a) => {
      const id = text(a.ApplicationNumber);
      const raw = text(a.ApplicationStatus) ?? "In process";
      // "Withheld": an active file whose step isn't published.
      const status = raw === "Withheld" ? "In process" : raw;
      const prefix = id?.split(/\s/)[0] ?? "";
      return id
        ? {
            id,
            type:
              { OZ: "OZ", SP: "SA", SPM: "SA", T: "SB", CD: "CD" }[
                prefix.replace(/\d.*/, "")
              ] ?? typeOf(prefix),
            status,
            stage: stageOf(status),
            submittedAt: date(a.SubmissionDate),
            address: address(a.SiteAddress) ?? id,
            description: text(a.ApplicationDescription),
            url: null,
            units: num(a.ResidentialUnits),
            storeys: num(a.MaxStoreys),
          }
        : null;
    },
  },
  {
    label: "Town of Oakville",
    province: "ON",
    municipalities: ["oakville"],
    url: "https://services5.arcgis.com/QJebCdoMf4PF8fJP/arcgis/rest/services/Planning_and_Development_Applications/FeatureServer/0",
    outFields: [
      "FolderRSN",
      "FolderNumber",
      "FolderType",
      "FolderName",
      "Description",
      "IntakeDate",
      "Status",
      "Proposed_Total___of_Units",
    ],
    map: (a) => {
      const status = text(a.Status) ?? "Open";
      return {
        id: text(a.FolderNumber) ?? `Oakville ${text(a.FolderRSN)}`,
        type: typeOf(text(a.FolderType)),
        status,
        stage: stageOf(status),
        submittedAt: date(a.IntakeDate),
        address: address(a.FolderName) ?? "Oakville",
        description: text(a.Description),
        url: null,
        units: num(a.Proposed_Total___of_Units),
      };
    },
  },
  {
    label: "City of Hamilton",
    province: "ON",
    municipalities: ["hamilton"],
    url: "https://services.arcgis.com/rYz782eMbySr2srL/arcgis/rest/services/Development_Applications/FeatureServer/2",
    // No status field: keep recent files only.
    where: `FILE_YEAR >= ${new Date().getFullYear() - 3}`,
    outFields: ["FILE_NUM", "FILE_TYPE", "ADDRESS", "FILE_YEAR", "DESCRIP"],
    map: (a) => {
      const id = text(a.FILE_NUM);
      const year = num(a.FILE_YEAR);
      return id
        ? {
            id,
            type: typeOf(text(a.FILE_TYPE)),
            status: year ? `Filed ${year}` : "Filed",
            stage: "review",
            submittedAt: year ? `${year}-01-01T00:00:00.000Z` : null,
            address: address(a.ADDRESS) ?? id,
            description: text(a.DESCRIP),
            url: null,
          }
        : null;
    },
  },
  {
    label: "City of Kitchener",
    province: "ON",
    municipalities: ["kitchener"],
    url: "https://services1.arcgis.com/qAo1OsXi67t7XgmS/arcgis/rest/services/Planning_Applications_Active/FeatureServer/0",
    outFields: [
      "APPLICATION_NO",
      "FOLDERTYPE",
      "STATUS",
      "INDATE",
      "ADDRESS",
      "DESCRIPTION",
      "PROP_MAX_RES_UNITS_DA",
    ],
    map: (a) => {
      const id = text(a.APPLICATION_NO);
      const status = text(a.STATUS) ?? "In circulation";
      return id
        ? {
            id,
            type: typeOf(text(a.FOLDERTYPE)),
            status,
            stage: stageOf(status),
            submittedAt: date(a.INDATE),
            address: address(a.ADDRESS) ?? id,
            description: text(a.DESCRIPTION),
            url: null,
            units: num(a.PROP_MAX_RES_UNITS_DA),
          }
        : null;
    },
  },
  {
    label: "City of Guelph",
    province: "ON",
    municipalities: ["guelph"],
    url: "https://gismaps.guelph.ca/hosting/rest/services/OpenData/OpenData1/FeatureServer/27",
    // "Undetermined" marks digitized historic files.
    where: "STATUSDESC <> 'Undetermined'",
    outFields: [
      "FOLDERRSN",
      "REFERENCEFILE",
      "FOLDERDESC",
      "STATUSDESC",
      "INDATE",
      "ADDRESS",
      "FOLDERDESCRIPTION",
      "URL",
    ],
    map: (a) => {
      const status = text(a.STATUSDESC) ?? "In review";
      return {
        id: text(a.REFERENCEFILE) ?? `Guelph ${text(a.FOLDERRSN)}`,
        type: typeOf(text(a.FOLDERDESC)),
        status,
        stage: stageOf(status),
        submittedAt: date(a.INDATE),
        address: address(a.ADDRESS) ?? "Guelph",
        description: text(a.FOLDERDESCRIPTION),
        url: text(a.URL),
      };
    },
  },
  {
    label: "City of Kingston",
    province: "ON",
    municipalities: ["kingston"],
    url: "https://api.cityofkingston.ca/gis_unfed/rest/services/Planning/PlanningApplications_FGDB/MapServer/0",
    outFields: [
      "RECORD_ID",
      "RECORD_TYPE",
      "RECORD_STATUS",
      "ADDR_FULL",
      "DESCRIPTION",
      "DASH_URL",
    ],
    map: (a) => {
      const id = text(a.RECORD_ID);
      const type = text(a.RECORD_TYPE);
      const status = text(a.RECORD_STATUS) ?? "In review";
      return id && !MINOR.test(type ?? "")
        ? {
            id,
            type: typeOf(type),
            status,
            stage: stageOf(status),
            submittedAt: null,
            address: address(a.ADDR_FULL) ?? id,
            description: text(a.DESCRIPTION),
            url: text(a.DASH_URL),
          }
        : null;
    },
  },
  {
    label: "City of Niagara Falls",
    province: "ON",
    municipalities: ["niagara falls"],
    url: "https://services9.arcgis.com/oMFQlUUrLd1Uh1bd/arcgis/rest/services/Niagara_Falls_Current_Development_Applications_WGS_1984/FeatureServer/0",
    outFields: ["FileNumber", "TypeDesc", "ApplDesc", "Address", "weblink"],
    map: (a) => {
      const id = text(a.FileNumber);
      const type = text(a.TypeDesc);
      // SBA- files are sign by-law amendments, often with no type.
      return id && !/^SBA-/i.test(id) && !MINOR.test(type ?? "")
        ? {
            id,
            type: typeOf(type),
            status: "Current",
            stage: "review",
            submittedAt: null,
            address: address(a.Address) ?? id,
            description: text(a.ApplDesc),
            url: text(a.weblink),
          }
        : null;
    },
  },
  {
    label: "City of Vaughan",
    province: "ON",
    municipalities: ["vaughan"],
    url: "https://services2.arcgis.com/9LnN9037wYhPG904/arcgis/rest/services/Active_Development_Applications_view/FeatureServer/0",
    outFields: [
      "FileNum",
      "AppDesc",
      "ParentStatus",
      "RcvdDte",
      "MunAddress",
      "Description",
    ],
    map: (a) => {
      const id = text(a.FileNum);
      const type = text(a.AppDesc);
      return id && !MINOR.test(type ?? "")
        ? {
            id,
            type: typeOf(type),
            status: "In progress",
            stage: "review",
            submittedAt: date(a.RcvdDte),
            address:
              address(a.MunAddress)?.replace(/\s+L\d\w\s?\d\w\d$/i, "") ?? id,
            description: text(a.Description),
            url: null,
          }
        : null;
    },
  },
  {
    label: "City of Richmond Hill",
    province: "ON",
    municipalities: ["richmond hill"],
    url: "https://services5.arcgis.com/cu2HFDk7AqvG7e31/arcgis/rest/services/Development_Applications_view_-_Active_Applications/FeatureServer/0",
    outFields: [
      "FILENUMBER",
      "APPLICATIONTYPE",
      "STATUS",
      "ADDRESS",
      "DESCRIPTIONOFAPPLICATION",
      "APPLICATIONRECEIVEDDATE",
    ],
    map: (a) => {
      const id = text(a.FILENUMBER);
      const type = text(a.APPLICATIONTYPE);
      const status = text(a.STATUS) ?? "In process";
      return id && !MINOR.test(type ?? "")
        ? {
            id,
            type: typeOf(type),
            status,
            stage: stageOf(status),
            submittedAt: date(a.APPLICATIONRECEIVEDDATE),
            address: address(a.ADDRESS) ?? id,
            description: text(a.DESCRIPTIONOFAPPLICATION),
            url: null,
          }
        : null;
    },
  },
  {
    label: "Town of Newmarket",
    province: "ON",
    municipalities: ["newmarket"],
    url: "https://services3.arcgis.com/tSwsWwbYRimLwcCZ/arcgis/rest/services/OPENNewmarket_Active_Developments/FeatureServer/23",
    where: "STATUS = 'ACTIVE'",
    outFields: [
      "FILE_NUM",
      "APP_TYPE",
      "APP_STATUS",
      "LOCATION",
      "DESCRIPTION",
      "WEBLINK",
      "HEIGHT_NUMBER_OF_STOREYS",
      "TOTAL_RESIDENTIAL_UNITS",
    ],
    map: (a) => {
      const id = text(a.FILE_NUM);
      const status = text(a.APP_STATUS) ?? "In progress";
      return id
        ? {
            id,
            type: typeOf(text(a.APP_TYPE)),
            status,
            stage: stageOf(status),
            submittedAt: null,
            address: address(a.LOCATION) ?? id,
            description: text(a.DESCRIPTION),
            url: text(a.WEBLINK),
            units: num(a.TOTAL_RESIDENTIAL_UNITS),
            storeys: num(a.HEIGHT_NUMBER_OF_STOREYS),
          }
        : null;
    },
  },
  {
    // Files the Region reviews, for York municipalities without their own
    // open data layer here.
    label: "York Region",
    province: "ON",
    municipalities: [
      "markham",
      "aurora",
      "king",
      "georgina",
      "east gwillimbury",
      "whitchurch stouffville",
    ],
    url: "https://ww8.yorkmaps.ca/arcgis/rest/services/OpenData/DevelopmentApplicationStatusAndTeams/MapServer/0",
    outFields: [
      "REG_FILE_NUM",
      "EXT_REF_NUM",
      "APPL_TYPE",
      "APPL_STATUS",
      "DATE_RECVD",
      "ADDRESS",
      "APPL_DESC",
      "LOCATION",
    ],
    map: (a) => {
      const id = text(a.EXT_REF_NUM) ?? text(a.REG_FILE_NUM);
      const type = text(a.APPL_TYPE);
      const status = text(a.APPL_STATUS) ?? "In progress";
      return id && !MINOR.test(type ?? "")
        ? {
            id,
            type: typeOf(type),
            status,
            stage: stageOf(status),
            submittedAt: date(a.DATE_RECVD),
            address: address(a.ADDRESS) ?? address(a.LOCATION) ?? id,
            description: text(a.APPL_DESC),
            url: null,
          }
        : null;
    },
  },
  // --- outside the GTA / outside Ontario -------------------------------------
  {
    label: "City of Brampton",
    province: "ON",
    municipalities: ["brampton"],
    // Official plan / zoning / subdivision, site plan and draft condo files.
    url: [9, 11, 7].map(
      (layer) =>
        `https://services3.arcgis.com/rl7ACuZkiFsmDA2g/ArcGIS/rest/services/Planning_Land_Use_Development/FeatureServer/${layer}`,
    ),
    outFields: [
      "FILE_NUMBER",
      "LOCATION",
      "DATE_RECEIVED",
      "APPLICATION_TYPE",
      "APPLICATION_TITLE",
      "DESCRIPTION",
      "STATUS",
      "PROPOSAL_DESCRIPTION",
    ],
    map: (a) => {
      const id = text(a.FILE_NUMBER);
      const status = text(a.STATUS) ?? "In review";
      const description = text(a.PROPOSAL_DESCRIPTION) ?? text(a.DESCRIPTION);
      // Undated files are decades-old records (e.g. "SP90-…").
      return id && a.DATE_RECEIVED != null && !MINOR_WORK.test(description ?? "")
        ? {
            id,
            type: typeOf(text(a.APPLICATION_TYPE)),
            status,
            stage: stageOf(status),
            submittedAt: date(a.DATE_RECEIVED),
            address: address(a.LOCATION) ?? text(a.APPLICATION_TITLE) ?? id,
            description,
            url: null,
          }
        : null;
    },
  },
  {
    // Rezonings ("Land Use Redesignation"): every file is significant.
    label: "City of Calgary",
    province: "AB",
    municipalities: ["calgary"],
    kind: "socrata",
    domain: "data.calgary.ca",
    dataset: "33vi-ew4s",
    geo: { lat: "latitude", lng: "longitude" },
    map: (a) => {
      const id = text(a.permitnum);
      const status = text(a.statuscurrent) ?? "Submitted";
      if (!id || /miscellaneous/i.test(status)) return null;
      const from = text(a.fromlud);
      const to = text(a.proposedlud);
      return {
        id,
        type: "OZ",
        status,
        stage: stageOf(status),
        submittedAt: date(a.applieddate),
        address: address(a.address) ?? id,
        description:
          [text(a.description), from && to ? `(${from} to ${to})` : null]
            .filter(Boolean)
            .join(" ") || null,
        url: null,
      };
    },
  },
  {
    // Development permits for buildings that change a block: multi-family,
    // mixed use, commercial, industrial and institutional. Not suites,
    // home businesses, signs or relaxations.
    label: "City of Calgary",
    province: "AB",
    municipalities: ["calgary"],
    kind: "socrata",
    domain: "data.calgary.ca",
    dataset: "6933-unw5",
    geo: { point: "point" },
    where:
      "category like 'Residential - Multi-Family%' OR category like 'Mixed Use%' OR category like 'Commercial%' OR category like 'Industrial%' OR category like 'Institutional%'",
    map: (a) => {
      const id = text(a.permitnum);
      const status = text(a.statuscurrent) ?? "Under review";
      const description = text(a.description);
      // Revisions amend a permit already listed.
      return id && !/^revision/i.test(description ?? "")
        ? {
            id,
            type: "Development permit",
            status,
            stage: calgaryStage(status),
            submittedAt: date(a.applieddate),
            address: address(a.address) ?? id,
            description: sentence(description),
            url: null,
          }
        : null;
    },
  },
  {
    // Major development permits for multi-unit, mixed-use or commercial
    // buildings (minor permits are houses, suites, garages and decks).
    label: "City of Edmonton",
    province: "AB",
    municipalities: ["edmonton"],
    kind: "socrata",
    domain: "data.edmonton.ca",
    dataset: "2ccn-pwtu",
    geo: { point: "geometry_point" },
    where: "permit_type = 'Major Development Permit'",
    map: (a) => {
      const id = text(a.city_file_number);
      const description = text(a.description_of_development);
      const status = text(a.status) ?? "In progress";
      if (!id || !description || !significant(description) || /^other$/i.test(status)) {
        return null;
      }
      // Some records carry only a unit or house number ("4a"): use the
      // neighbourhood instead.
      const street = address(a.address);
      const neighbourhood = text(a.neighbourhood);
      return {
        id,
        type: "Development permit",
        status,
        stage: stageOf(status),
        submittedAt: date(a.permit_date),
        address:
          street && street.length >= 8
            ? street
            : neighbourhood
              ? titleCase(neighbourhood)
              : (street ?? id),
        description,
        url: null,
      };
    },
  },
  {
    // Issued development permits for new multi-family and non-residential
    // buildings (not houses, duplexes or signs).
    label: "City of Winnipeg",
    province: "MB",
    municipalities: ["winnipeg"],
    kind: "socrata",
    domain: "data.winnipeg.ca",
    dataset: "w842-cdeb",
    geo: { point: "point" },
    where:
      "work_type = 'Construct New' AND sub_type NOT IN ('Residential Single Family/Two family', 'Residential 1-2 family', 'Home Occupation Application') AND sub_type NOT LIKE '%Sign%'",
    map: (a) => {
      const id = text(a.permit_number);
      if (!id) return null;
      const street = [a.street_number, a.street_name, a.street_type, a.street_direction]
        .map(text)
        .filter(Boolean)
        .join(" ");
      return {
        id,
        type: "Development permit",
        status: "Issued",
        stage: "approved",
        submittedAt: date(a.application_received_date),
        address: address(street) ?? id,
        description:
          [text(a.sub_type), text(a.building_use_description)].filter(Boolean).join(": ") ||
          null,
        url: null,
        units: num(a.dwelling_units_created),
      };
    },
  },
  {
    // Vancouver publishes issued building permits, not rezonings: new
    // multi-unit, mixed-use and commercial buildings only.
    label: "City of Vancouver",
    province: "BC",
    municipalities: ["vancouver"],
    kind: "ods",
    base: "https://opendata.vancouver.ca",
    dataset: "issued-building-permits",
    geoField: "geo_point_2d",
    where: [
      "typeofwork = 'New Building'",
      ...[
        "Laneway House",
        "Duplex",
        "Duplex w/Secondary Suite",
        "Single Detached House",
        "Single Detached House w/Sec Suite",
        "Secondary Suite",
        "Dwelling Unit",
        "Parking Garage",
      ].map((use) => `specificusecategory != '${use}'`),
    ].join(" and "),
    map: (a) => {
      const id = text(a.permitnumber);
      return id
        ? {
            id,
            type: "Building permit",
            status: "Permit issued",
            stage: "approved",
            submittedAt: date(a.permitnumbercreateddate) ?? date(a.issuedate),
            address: address(a.address) ?? id,
            description: text(a.projectdescription),
            url: null,
          }
        : null;
    },
  },
  {
    label: "Halifax Regional Municipality",
    province: "NS",
    municipalities: ["halifax"],
    url: "https://services2.arcgis.com/11XBiaBYA9Ep0yNJ/arcgis/rest/services/PPLC_Planning_Applications_Geolocated/FeatureServer/0",
    // Registrations, covenants and demolitions aren't development proposals.
    where: "APP_TYPE IS NULL OR APP_TYPE NOT IN ('Registration', 'Private Covenant', 'Demolition')",
    outFields: [
      "APP_NUM",
      "APP_NAME",
      "APP_TYPE",
      "APPSCOPE",
      "APPSTATUS",
      "SUBMITDATE",
      "LOCATION",
      "DESCRIPACT",
      "PROPLANDUSE",
      "WEBURL",
    ],
    map: (a) => {
      const id = text(a.APP_NUM);
      const status = text(a.APPSTATUS) ?? "In review";
      const description = text(a.DESCRIPACT) ?? text(a.PROPLANDUSE);
      if (
        !id ||
        /non-substantive|heritage property|registration|variance/i.test(
          `${text(a.APPSCOPE) ?? ""} ${text(a.APP_NAME) ?? ""}`,
        ) ||
        /timeline extension|time extension/i.test(description ?? "")
      ) {
        return null;
      }
      const location = text(a.LOCATION);
      return {
        id,
        type: typeOf(text(a.APP_NAME)),
        status,
        // Recordation: approved, being registered.
        stage: /recordation/i.test(status) ? "approved" : stageOf(status),
        submittedAt: date(a.SUBMITDATE),
        address:
          (location && !/no primary address/i.test(location) ? address(location) : null) ?? id,
        description,
        url: text(a.WEBURL),
      };
    },
  },
  {
    // Rezonings and development permits (not heritage, tax incentive or
    // variance-only files). Staff contact fields aren't read.
    label: "City of Victoria",
    province: "BC",
    municipalities: ["victoria"],
    url: "https://maps.victoria.ca/server/rest/services/OpenData/OpenData_PlanningAndDevelopment/MapServer/3",
    where:
      "AppType IN ('Rezoning', 'Development Permit', 'Dev Permit with Variance', 'Delegated Development Permit', 'Temporary Use Permit')",
    outFields: ["FOLDER_NUMBER", "AppType", "STATUS", "HOUSE", "STREET", "SUBJECT", "PURPOSE", "CREATED_DATE"],
    map: (a) => {
      const id = text(a.FOLDER_NUMBER);
      const appType = text(a.AppType);
      const status = text(a.STATUS) ?? "Active";
      if (!id) return null;
      return {
        id,
        type: appType === "Rezoning" ? "OZ" : (appType ?? "Development permit"),
        status: titleCase(status),
        stage: "review",
        submittedAt: date(a.CREATED_DATE),
        address:
          text(a.SUBJECT) ??
          (address([a.HOUSE, a.STREET].map(text).filter(Boolean).join(" ")) || id),
        description: text(a.PURPOSE),
        url: null,
      };
    },
  },
];

/** "WHITCHURCH-STOUFFVILLE" → "whitchurch stouffville". */
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * The open data source for a municipality, if one is connected. Matched by
 * province too, so a same-named place elsewhere (Kingston, NS; Richmond,
 * BC) never matches.
 */
export function developmentSourceFor(
  municipality: string,
  province: string | null,
): { label: string; sources: Source[] } | null {
  if (!province) return null;
  const name = norm(municipality);
  // A city can have several datasets (Calgary: rezonings and permits).
  const sources = SOURCES.filter(
    (s) => s.province === province && s.municipalities.includes(name),
  );
  if (sources.length === 0) return null;
  return { label: [...new Set(sources.map((s) => s.label))].join(", "), sources };
}

/** A feature's position: the point, or a polygon's vertex average. */
function positionOf(f: ArcgisFeature): LatLng | null {
  const g = f.geometry;
  if (g?.x != null && g.y != null) return { lat: g.y, lng: g.x };
  const ring = g?.rings?.[0];
  if (!ring?.length) return null;
  const [sx, sy] = ring.reduce(([x, y], [px, py]) => [x + px, y + py], [0, 0]);
  return { lat: sy / ring.length, lng: sx / ring.length };
}

type Located = { attrs: Attrs; position: LatLng | null };

async function arcgisRecords(source: ArcgisSource, point: LatLng, radius: number) {
  const urls = Array.isArray(source.url) ? source.url : [source.url];
  const layers = await Promise.all(
    urls.map((url) =>
      queryLayer<Attrs>(url, {
        ...atPoint(point, radius),
        where: source.where ?? "1=1",
        outFields: source.outFields.join(","),
        returnGeometry: true,
      }),
    ),
  );
  return layers.flat().map((f): Located => ({ attrs: f.attributes, position: positionOf(f) }));
}

async function socrataRecords(source: SocrataSource, point: LatLng, radius: number) {
  let near: string;
  if ("point" in source.geo) {
    near = `within_circle(${source.geo.point}, ${point.lat}, ${point.lng}, ${radius})`;
  } else {
    // Text columns: a box around the radius, then the exact distance below.
    const dLat = radius / 111_320;
    const dLng = radius / (111_320 * Math.cos((point.lat * Math.PI) / 180));
    const { lat, lng } = source.geo;
    near = `${lat}::number between ${point.lat - dLat} and ${point.lat + dLat} AND ${lng}::number between ${point.lng - dLng} and ${point.lng + dLng}`;
  }
  const url = new URL(`https://${source.domain}/resource/${source.dataset}.json`);
  url.searchParams.set("$where", source.where ? `(${near}) AND (${source.where})` : near);
  url.searchParams.set("$limit", "500");
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`${source.label}: HTTP ${res.status}`);
  const rows = (await res.json()) as Attrs[];
  return rows.map((attrs): Located => {
    if ("point" in source.geo) {
      const coords = (attrs[source.geo.point] as { coordinates?: number[] } | undefined)?.coordinates;
      return {
        attrs,
        position: coords && coords.length >= 2 ? { lat: coords[1], lng: coords[0] } : null,
      };
    }
    const lat = Number(attrs[source.geo.lat]);
    const lng = Number(attrs[source.geo.lng]);
    return {
      attrs,
      position: Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null,
    };
  });
}

async function odsRecords(source: OdsSource, point: LatLng, radius: number) {
  const near = `within_distance(${source.geoField}, geom'POINT(${point.lng} ${point.lat})', ${radius}m)`;
  const url = new URL(`${source.base}/api/explore/v2.1/catalog/datasets/${source.dataset}/records`);
  url.searchParams.set("where", source.where ? `(${near}) and (${source.where})` : near);
  url.searchParams.set("limit", "100");
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`${source.label}: HTTP ${res.status}`);
  const json = (await res.json()) as { results?: Attrs[] };
  return (json.results ?? []).map((attrs): Located => {
    const geo = attrs[source.geoField] as { lat?: number; lon?: number } | undefined;
    return {
      attrs,
      position: geo?.lat != null && geo.lon != null ? { lat: geo.lat, lng: geo.lon } : null,
    };
  });
}

/** Open applications within `radius` of a point, nearest first. */
export async function liveApplicationsNear(
  group: NonNullable<ReturnType<typeof developmentSourceFor>>,
  point: LatLng,
  radius: number,
): Promise<LiveApplication[]> {
  const perSource = await Promise.all(
    group.sources.map(async (source) => {
      const records =
        source.kind === "socrata"
          ? await socrataRecords(source, point, radius)
          : source.kind === "ods"
            ? await odsRecords(source, point, radius)
            : await arcgisRecords(source, point, radius);
      return records.map((r) => ({ ...r, source }));
    }),
  );
  const seen = new Set<string>();
  return perSource
    .flat()
    .flatMap(({ attrs, position, source }) => {
      const mapped = source.map(attrs);
      if (!mapped || !mapped.stage || !position || seen.has(mapped.id)) {
        return [];
      }
      seen.add(mapped.id);
      const description = mapped.description;
      return [
        {
          ...mapped,
          stage: mapped.stage,
          units: mapped.units ?? (description ? parseUnits(description) : null),
          storeys:
            mapped.storeys ?? (description ? parseStoreys(description) : null),
          lat: position.lat,
          lng: position.lng,
          distanceMeters: Math.round(distanceMeters(point, position)),
        },
      ];
    })
    // Bounding-box queries can return a little more than the radius.
    .filter((a) => a.distanceMeters <= radius)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}

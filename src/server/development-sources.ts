// Development applications outside Toronto, queried live from municipal open
// data (ArcGIS layers). Each city publishes its own fields and statuses, so
// every source maps its records to one shape. Toronto's applications come
// from the imported table instead (datasets/toronto-development.ts).
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

type Source = {
  /** Shown as the data source, e.g. "City of Mississauga". */
  label: string;
  /** Lower/single-tier municipalities served (normalized names). */
  municipalities: string[];
  url: string;
  where?: string;
  outFields: string[];
  /** Null drops the record (closed, withdrawn, minor variance…). */
  map: (a: Attrs) => Mapped | null;
};

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
  /\b(closed|withdrawn|refused|cancell?ed|void|inactive|done|lapsed|assumed|registered|no regional interests|denied|deferred indefinitely)\b/i;
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

// --- sources ------------------------------------------------------------------

const SOURCES: Source[] = [
  {
    label: "City of Mississauga",
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
];

/** "WHITCHURCH-STOUFFVILLE" → "whitchurch stouffville". */
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * The open data source for a municipality, if one is connected. All
 * connected sources are Ontario municipalities, so a same-named place in
 * another province (Kingston, NS; Richmond, BC) never matches one.
 */
export function developmentSourceFor(municipality: string, province: string | null) {
  if (province !== "ON") return null;
  const name = norm(municipality);
  return SOURCES.find((s) => s.municipalities.includes(name)) ?? null;
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

/** Open applications within `radius` of a point, nearest first. */
export async function liveApplicationsNear(
  source: NonNullable<ReturnType<typeof developmentSourceFor>>,
  point: LatLng,
  radius: number,
): Promise<LiveApplication[]> {
  const features = await queryLayer<Attrs>(source.url, {
    ...atPoint(point, radius),
    where: source.where ?? "1=1",
    outFields: source.outFields.join(","),
    returnGeometry: true,
  });
  const seen = new Set<string>();
  return features
    .flatMap((f) => {
      const mapped = source.map(f.attributes);
      const position = positionOf(f);
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
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}

import { Document, renderToBuffer } from "@react-pdf/renderer";
import {
  BookOpenIcon,
  CalculatorIcon,
  BusIcon,
  ClipboardListIcon,
  FileTextIcon,
  GaugeIcon,
  GraduationCapIcon,
  MegaphoneIcon,
  ShieldIcon,
  SparklesIcon,
  StoreIcon,
  TrendingUpIcon,
  TrophyIcon,
  UsersIcon,
} from "lucide-react";
import { cloneElement, type ReactElement } from "react";
import type { TravelMode } from "@/lib/travel";
import { staticMapUrl } from "../static-maps";
import { streetViewImage } from "../street-view";
import {
  type PdfData,
  type PdfImage,
  type PdfImages,
  type PdfReport,
  pdfData,
} from "./data";
import {
  CampaignPage,
  DetailsPage,
  MarketingPage,
  NeighbourhoodPage,
  PlaybookPage,
  SafetyPage,
  UpsidePage,
} from "./sections-area";
import {
  AmenitiesPage,
  CommutePage,
  ContentsPage,
  CoverPage,
  OverviewPage,
  ScoresPage,
  SchoolsPage,
  StoryPage,
  type TocEntry,
} from "./sections-location";
import { FinancePage } from "./sections-finance";
import { registerFonts } from "./theme";

async function toImage(res: Response | null): Promise<PdfImage | undefined> {
  if (!res?.ok) return undefined;
  const type = res.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) return undefined;
  return {
    data: Buffer.from(await res.arrayBuffer()),
    format: type.includes("png") ? "png" : "jpg",
  };
}

/** Runs `fn` over `items`, at most `limit` at a time. */
async function pool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
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

/** Card photos are shown at ~52 pt: 240 px is sharp in print. */
const PHOTO_PX = 240;
/** Place cards with a Google photo (each one is a billed request). */
const PDF_PHOTOS_PER_CATEGORY = 1;
const PDF_STATION_PHOTOS = 3;

function placePhoto(name: string) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return Promise.resolve(undefined);
  const url = new URL(`https://places.googleapis.com/v1/${name}/media`);
  url.searchParams.set("maxWidthPx", String(PHOTO_PX));
  url.searchParams.set("maxHeightPx", String(PHOTO_PX));
  url.searchParams.set("key", key);
  return fetch(url, { cache: "no-store" })
    .then(toImage)
    .catch(() => undefined);
}

/**
 * Street View angles, section maps, a photo for the nearest amenity in each
 * category and the nearest transit stops (Google Places), and a Street View
 * photo per school. Fetched in parallel with a cap; anything missing falls
 * back to an icon tile.
 */
async function loadImages(d: PdfData): Promise<PdfImages> {
  const { report } = d;
  const lat = report.property?.latitude;
  const lng = report.property?.longitude;
  const empty: PdfImages = { street: {}, maps: {}, places: {}, schools: {} };
  if (lat == null || lng == null) return empty;

  const angles = ["front", "closeUp", "frontLeft", "frontRight"] as const;
  const maps = ["overview", "transit", "schools", "upside"] as const;
  // Google bills every place photo, so only the nearest place in each
  // amenity category and the nearest few transit stops get one; the other
  // cards show their category icon.
  const nearest = <T extends { distanceMeters: number; photo?: unknown }>(
    list: T[],
    count: number,
  ) =>
    list
      .filter((p) => p.photo)
      .sort((x, y) => x.distanceMeters - y.distanceMeters)
      .slice(0, count);
  const places = [
    ...Object.values(d.amenities?.categories ?? {}).flatMap((list) =>
      nearest(list, PDF_PHOTOS_PER_CATEGORY),
    ),
    ...nearest(d.commute?.stations ?? [], PDF_STATION_PHOTOS),
  ].filter((p, i, all) => all.findIndex((x) => x.id === p.id) === i);
  console.log("[pdf] place photos", { reportId: report.id, count: places.length });
  const schools = Array.from(
    new Map(
      (d.schools?.systems ?? [])
        .flatMap((x) => [...x.elementary, ...x.secondary])
        .map((x) => [x.id, x]),
    ).values(),
  );

  const [street, mapImages, placeImages, schoolImages] = await Promise.all([
    Promise.all(
      angles.map((a) =>
        streetViewImage({ lat, lng }, a)
          .then(toImage)
          .catch(() => undefined),
      ),
    ),
    Promise.all(
      maps.map((m) => {
        // Same shape as the PDF frame (524 × 200 pt), padded so no pin is cut.
        const url = staticMapUrl(report, m, { size: "640x244", pad: true });
        return url
          ? fetch(url, { cache: "no-store" })
              .then(toImage)
              .catch(() => undefined)
          : undefined;
      }),
    ),
    pool(places, 16, (p) => placePhoto(p.photo!.name)),
    pool(schools, 8, (x) =>
      streetViewImage({ lat: x.lat, lng: x.lng }, "front", "240x240")
        .then(toImage)
        .catch(() => undefined),
    ),
  ]);

  const byId = <T extends { id: string }>(
    list: T[],
    imgs: (PdfImage | undefined)[],
  ) =>
    Object.fromEntries(
      list.flatMap((x, i) => (imgs[i] ? [[x.id, imgs[i]]] : [])),
    ) as Record<string, PdfImage>;

  return {
    street: Object.fromEntries(angles.map((a, i) => [a, street[i]])),
    maps: Object.fromEntries(maps.map((m, i) => [m, mapImages[i]])),
    places: byId(places, placeImages),
    schools: byId(schools, schoolImages),
  };
}

type Section = TocEntry & {
  show: boolean;
  page: (n: number, imgs: PdfImages) => ReactElement;
};

function sectionsFor(d: PdfData): Section[] {
  const all: Section[] = [
    {
      id: "scores",
      title: "Scores explained",
      description:
        "Sell / rent ease and every section score, with what each measures",
      icon: TrophyIcon,
      show: true,
      page: (n) => <ScoresPage d={d} n={n} />,
    },
    {
      id: "overview",
      title: "Overview",
      description:
        "Every factor behind the sell / rent ease, closest essentials",
      icon: GaugeIcon,
      show: true,
      page: (n) => <OverviewPage d={d} n={n} />,
    },
    {
      id: "story",
      title: "Neighbourhood story",
      description: "The pitch, selling points and what buyers may ask about",
      icon: SparklesIcon,
      show: Boolean(d.insights),
      page: (n) => <StoryPage d={d} n={n} />,
    },
    {
      id: "amenities",
      title: "Amenities",
      description:
        "Every nearby place by category, with photos, ratings and times",
      icon: StoreIcon,
      show: Boolean(d.amenities),
      page: (n, imgs) => <AmenitiesPage d={d} images={imgs} n={n} />,
    },
    {
      id: "commute",
      title: "Commute & transit",
      description: "Stops nearby and trips to downtowns and airports",
      icon: BusIcon,
      show: Boolean(d.commute),
      page: (n, imgs) => <CommutePage d={d} images={imgs} n={n} />,
    },
    {
      id: "schools",
      title: "Schools",
      description: "All four school systems with EQAO results",
      icon: GraduationCapIcon,
      show: Boolean(d.schools),
      page: (n, imgs) => <SchoolsPage d={d} images={imgs} n={n} />,
    },
    {
      id: "safety",
      title: "Safety & environment",
      description: "Crime severity, flood regulation, noise and air quality",
      icon: ShieldIcon,
      show: Boolean(d.safety),
      page: (n) => <SafetyPage d={d} n={n} />,
    },
    {
      id: "neighbourhood",
      title: "Neighbourhood",
      description: "Census figures for the area and the city",
      icon: UsersIcon,
      show: Boolean(d.demographics),
      page: (n) => <NeighbourhoodPage d={d} n={n} />,
    },
    {
      id: "upside",
      title: "Future upside",
      description: "Development applications and public projects nearby",
      icon: TrendingUpIcon,
      show: Boolean(d.upside),
      page: (n, imgs) => <UpsidePage d={d} images={imgs} n={n} />,
    },
    {
      id: "finance",
      title: "Financial scenarios",
      description: "Every calculator worked out three ways, in easy tables",
      icon: CalculatorIcon,
      show: true,
      page: (n) => <FinancePage d={d} n={n} />,
    },
    {
      id: "marketing",
      title: "Marketing kit",
      description: "MLS descriptions, social posts and an email",
      icon: MegaphoneIcon,
      show: Boolean(d.marketing),
      page: (n) => <MarketingPage d={d} n={n} />,
    },
    {
      id: "campaign",
      title: "Listing campaign",
      description:
        "Headlines, stage posts, Reel script, carousel, ads and emails",
      icon: BookOpenIcon,
      show: Boolean(d.campaign),
      page: (n) => <CampaignPage d={d} n={n} />,
    },
    {
      id: "playbook",
      title: "Showing playbook",
      description:
        "Personas, proven answers, talking points and the open house plan",
      icon: ClipboardListIcon,
      show: Boolean(d.marketing?.playbook || d.showing),
      page: (n) => <PlaybookPage d={d} n={n} />,
    },
    {
      id: "details",
      title: "Property details",
      description: "The property record and where every number comes from",
      icon: FileTextIcon,
      show: true,
      page: (n) => <DetailsPage d={d} n={n} />,
    },
  ];
  return all.filter((x) => x.show);
}

/**
 * The downloadable report. Order follows what agents and buyers weigh first:
 * the headline and scores, the selling story, then convenience (amenities,
 * commute, schools), safety and the area, and finally the marketing toolkit.
 * Every section starts on a new page; the contents page links to each.
 */
export async function renderReportPdf(report: PdfReport, copyMode: TravelMode) {
  registerFonts();
  const d = pdfData(report, copyMode);
  const images = await loadImages(d);

  const document = (
    dd: PdfData,
    pages: Record<string, number>,
    imgs: PdfImages,
  ) => {
    const sections = sectionsFor(dd);
    return (
      <Document
        title={`Property report: ${dd.address}`}
        subject="Property and neighbourhood report"
        language="en-CA"
      >
        {/* Page 1 photos and details, page 2 the scores, then contents. */}
        <CoverPage d={dd} images={imgs} />
        {sections[0]!.page(1, imgs)}
        <ContentsPage d={dd} entries={sections} pages={pages} />
        {sections
          .slice(1)
          .map((x, i) => cloneElement(x.page(i + 2, imgs), { key: x.id }))}
      </Document>
    );
  };

  // Pass 1 records where each section starts; pass 2 prints those numbers on
  // the contents page. Pass 1 skips the small card photos (their boxes are a
  // fixed size, so the layout is identical) to save time.
  const pages: Record<string, number> = {};
  const recordPage = (id: string, page: number) => {
    pages[id] ??= page;
  };
  await renderToBuffer(
    document({ ...d, recordPage }, {}, { ...images, places: {}, schools: {} }),
  );
  return renderToBuffer(document(d, pages, images));
}

/** "123-main-st-w-property-report.pdf" */
export function pdfFileName(street: string) {
  const slug = street
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${slug || "property"}-report.pdf`;
}

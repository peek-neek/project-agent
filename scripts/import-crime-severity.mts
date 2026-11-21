// Refreshes the bundled Crime Severity Index data (Statistics Canada, Open
// Government Licence – Canada). StatCan publishes it once a year, in July.
//
//   npm run data:crime
//
// Writes src/server/datasets/canada-crime-severity.json: CSI, violent and
// non-violent CSI for every police service in Canada, plus each province and
// territory and Canada, for the latest six years. Needs the `unzip` command
// (macOS/Linux).
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseCsvRecords } from "../src/server/csv";

const OUT = new URL(
  "../src/server/datasets/canada-crime-severity.json",
  import.meta.url,
);
const YEARS = 6;

/** "Crime severity index … police services in …" tables, one per region. */
const SERVICE_TABLES = {
  "35100186": "the Atlantic provinces",
  "35100187": "Quebec",
  "35100188": "Ontario",
  "35100189": "Manitoba",
  "35100061": "Saskatchewan",
  "35100190": "Alberta",
  "35100063": "British Columbia",
  "35100064": "the Territories",
} as const;
/** Canada, provinces, territories and CMAs. */
const CANADA_TABLE = "35100026";

const PROVINCES = {
  NL: "Newfoundland and Labrador",
  PE: "Prince Edward Island",
  NS: "Nova Scotia",
  NB: "New Brunswick",
  QC: "Quebec",
  ON: "Ontario",
  MB: "Manitoba",
  SK: "Saskatchewan",
  AB: "Alberta",
  BC: "British Columbia",
  YT: "Yukon",
  NT: "Northwest Territories",
  NU: "Nunavut",
} as const;
type ProvinceCode = keyof typeof PROVINCES;

const STATS = {
  "Crime severity index": "csi",
  "Violent crime severity index": "violent",
  "Non-violent crime severity index": "nonViolent",
} as const;
type Stat = (typeof STATS)[keyof typeof STATS];
type Series = Record<Stat, (number | null)[]>;

async function readTable(pid: string) {
  const dir = mkdtempSync(join(tmpdir(), "statcan-"));
  try {
    const res = await fetch(
      `https://www150.statcan.gc.ca/n1/tbl/csv/${pid}-eng.zip`,
    );
    if (!res.ok) throw new Error(`StatCan ${pid}: HTTP ${res.status}`);
    const zip = join(dir, `${pid}.zip`);
    writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
    const csv = execFileSync("unzip", ["-p", zip, `${pid}.csv`], {
      maxBuffer: 512 * 1024 * 1024,
    }).toString("utf8");
    return parseCsvRecords(csv);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** "York Region, Ontario, municipal [35335]" → "York Region, Ontario, municipal" */
const geoName = (geo: string) => geo.replace(/\s*\[[^\]]*\]\s*$/, "");

/** The province a service is in: the first ", <Province>" in its name. */
function provinceOf(geo: string): ProvinceCode | null {
  let best: { code: ProvinceCode; at: number } | null = null;
  for (const [code, name] of Object.entries(PROVINCES) as [ProvinceCode, string][]) {
    const at = geo.indexOf(`, ${name}`);
    if (at !== -1 && (!best || at < best.at)) best = { code, at };
  }
  return best?.code ?? null;
}

type ByYear = Map<number, Partial<Record<Stat, number>>>;

function collect(rows: Record<string, string>[], keep: (geo: string) => boolean) {
  const byGeo = new Map<string, ByYear>();
  for (const r of rows) {
    const stat = STATS[r.Statistics as keyof typeof STATS];
    const geo = geoName(r.GEO);
    if (!stat || !keep(geo) || r.VALUE === "") continue;
    const year = Number(r.REF_DATE);
    const years = byGeo.get(geo) ?? new Map();
    byGeo.set(geo, years);
    years.set(year, { ...years.get(year), [stat]: Number(r.VALUE) });
  }
  return byGeo;
}

const provinceNames = new Set<string>(Object.values(PROVINCES));
const services = new Map<string, ByYear>();
for (const pid of Object.keys(SERVICE_TABLES)) {
  const rows = await readTable(pid);
  // Provincial totals come from the Canada table; keep only services here.
  for (const [geo, byYear] of collect(rows, (g) => !provinceNames.has(g))) {
    services.set(geo, byYear);
  }
}
const totals = collect(
  await readTable(CANADA_TABLE),
  (geo) => geo === "Canada" || provinceNames.has(geo),
);

const latest = Math.max(
  ...[...services.values()].flatMap((years) =>
    [...years].filter(([, v]) => v.csi != null).map(([y]) => y),
  ),
);
const years = Array.from({ length: YEARS }, (_, i) => latest - YEARS + 1 + i);

const series = (byYear?: ByYear): Series => ({
  csi: years.map((y) => byYear?.get(y)?.csi ?? null),
  violent: years.map((y) => byYear?.get(y)?.violent ?? null),
  nonViolent: years.map((y) => byYear?.get(y)?.nonViolent ?? null),
});

const out = {
  source: `Statistics Canada, Tables 35-10-0026-01, ${Object.keys(SERVICE_TABLES)
    .map((pid) => `${pid.slice(0, 2)}-${pid.slice(2, 4)}-${pid.slice(4)}-01`)
    .join(", ")} (Crime Severity Index)`,
  years,
  canada: series(totals.get("Canada")),
  provinces: Object.fromEntries(
    (Object.entries(PROVINCES) as [ProvinceCode, string][]).map(([code, name]) => [
      code,
      series(totals.get(name)),
    ]),
  ) as Record<ProvinceCode, Series>,
  // Only services with a figure in the latest year (others have merged or
  // closed), each tagged with its province.
  services: [...services]
    .filter(([, byYear]) => byYear.get(latest)?.csi != null)
    .flatMap(([geo, byYear]) => {
      const province = provinceOf(geo);
      return province ? [{ geo, province, ...series(byYear) }] : [];
    })
    .sort((a, b) => a.geo.localeCompare(b.geo)),
};

writeFileSync(OUT, `${JSON.stringify(out)}\n`);
const perProvince = Object.fromEntries(
  Object.keys(PROVINCES).map((c) => [c, out.services.filter((s) => s.province === c).length]),
);
console.log(`Wrote ${out.services.length} services, ${years[0]}–${latest}`, perProvince);

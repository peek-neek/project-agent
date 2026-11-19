// Refreshes the bundled Crime Severity Index data (Statistics Canada, Open
// Government Licence – Canada). StatCan publishes it once a year, in July.
//
//   npm run data:crime
//
// Writes src/server/datasets/ontario-crime-severity.json: CSI, violent and
// non-violent CSI for every Ontario police service, plus Ontario and Canada,
// for the latest six years. Needs the `unzip` command (macOS/Linux).
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseCsvRecords } from "../src/server/csv";

const OUT = new URL(
  "../src/server/datasets/ontario-crime-severity.json",
  import.meta.url,
);
const YEARS = 6;

/** Table 35-10-0188: police services in Ontario. 35-10-0026: Canada. */
const TABLES = { ontario: "35100188", canada: "35100026" } as const;

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

function collect(
  rows: Record<string, string>[],
  keep: (geo: string) => boolean,
) {
  const byGeo = new Map<string, Map<number, Partial<Record<Stat, number>>>>();
  for (const r of rows) {
    const stat = STATS[r.Statistics as keyof typeof STATS];
    if (!stat || !keep(r.GEO) || r.VALUE === "") continue;
    const geo = geoName(r.GEO);
    const year = Number(r.REF_DATE);
    const years = byGeo.get(geo) ?? new Map();
    byGeo.set(geo, years);
    years.set(year, { ...years.get(year), [stat]: Number(r.VALUE) });
  }
  return byGeo;
}

const ontarioRows = await readTable(TABLES.ontario);
const canadaRows = await readTable(TABLES.canada);

const services = collect(ontarioRows, () => true);
const canada = collect(canadaRows, (geo) => geoName(geo) === "Canada");

const latest = Math.max(
  ...[...services.values()].flatMap((years) =>
    [...years].filter(([, v]) => v.csi != null).map(([y]) => y),
  ),
);
const years = Array.from({ length: YEARS }, (_, i) => latest - YEARS + 1 + i);

const series = (
  byYear?: Map<number, Partial<Record<Stat, number>>>,
): Series => ({
  csi: years.map((y) => byYear?.get(y)?.csi ?? null),
  violent: years.map((y) => byYear?.get(y)?.violent ?? null),
  nonViolent: years.map((y) => byYear?.get(y)?.nonViolent ?? null),
});

const out = {
  source:
    "Statistics Canada, Tables 35-10-0188-01 and 35-10-0026-01 (Crime Severity Index)",
  years,
  ontario: series(services.get("Ontario")),
  canada: series(canada.get("Canada")),
  // Only services with a figure in the latest year (others have merged or
  // closed).
  services: Object.fromEntries(
    [...services]
      .filter(
        ([geo, byYear]) => geo !== "Ontario" && byYear.get(latest)?.csi != null,
      )
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([geo, byYear]) => [geo, series(byYear)]),
  ),
};

writeFileSync(OUT, `${JSON.stringify(out, null, 1)}\n`);
console.log(
  `Wrote ${Object.keys(out.services).length} services, ${years[0]}–${latest}`,
);

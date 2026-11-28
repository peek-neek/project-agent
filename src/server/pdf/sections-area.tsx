import { Text, View } from "@react-pdf/renderer";
import {
  BuildingIcon,
  ClapperboardIcon,
  ConstructionIcon,
  DropletsIcon,
  GaugeIcon,
  HomeIcon,
  LayersIcon,
  MailIcon,
  MegaphoneIcon,
  MessageSquareIcon,
  ShieldIcon,
  UsersIcon,
  Volume2Icon,
  WindIcon,
} from "lucide-react";
import {
  APPLICATION_STAGES,
  APPLICATION_TYPES,
  CAMPAIGN_STAGES,
  CENSUS_FIELDS,
  type CensusFieldId,
  CRIME_TYPES,
  PROJECT_CATEGORIES,
  type ProjectCategory,
  projectSources,
  upsideMapLabels,
} from "@/lib/report-sections";
import type { PdfData, PdfImages } from "./data";
import {
  Block,
  BRAND_ICONS,
  Bullets,
  Card,
  Checklist,
  Chip,
  date,
  Facts,
  Grid,
  H2,
  IconChip,
  km,
  money,
  Note,
  Numbered,
  Para,
  ReportPage,
  SectionHead,
  shortDate,
  Sparkbars,
  Stat,
  Table,
  Thumb,
  tint,
} from "./primitives";
import { MapImage } from "./sections-location";
import { C, PAGE, s } from "./theme";

/** A row of KPI tiles under a section title. */
function Kpis({
  items,
}: {
  items: (Parameters<typeof Stat>[0] | null | false | undefined)[];
}) {
  const shown = items.filter(Boolean) as Parameters<typeof Stat>[0][];
  if (!shown.length) return null;
  return (
    <View style={{ marginBottom: 14 }}>
      <Grid columns={shown.length}>
        {shown.map((k, i) => (
          <Stat key={i} {...k} />
        ))}
      </Grid>
    </View>
  );
}

const n0 = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("en-CA", { maximumFractionDigits: 0 });

const compare = (local: number | null, reference: number | null, region: string) =>
  local == null || reference == null
    ? null
    : local <= reference
      ? {
          text: `${Math.round((1 - local / reference) * 100)}% below ${region}`,
          good: true,
        }
      : {
          text: `${Math.round((local / reference - 1) * 100)}% above ${region}`,
          good: false,
        };

// ---------------------------------------------------------------------------
// Safety & environment
// ---------------------------------------------------------------------------

const FLOOD = {
  inside: { label: "Inside a regulated area", color: C.warn },
  nearby: { label: "Near a regulated area", color: C.warn },
  clear: { label: "Not in a regulated area", color: C.good },
  unknown: { label: "Not checked", color: C.muted },
} as const;

export function SafetyPage({ d, n }: { d: PdfData; n: number }) {
  const sf = d.safety;
  if (!sf) return null;
  const area = sf.areaCrime;
  const crime = sf.crime;
  const province = area?.level === "province";
  const overall =
    area && !province ? compare(area.csi, area.province.csi, area.province.name) : null;
  const flood = FLOOD[sf.flood.status];

  return (
    <ReportPage section="Safety & environment" address={d.address} brand={d.brand}>
      <SectionHead
        record={d.recordPage}
        id="safety"
        number={n}
        eyebrow="Safety & environment"
        title="Safety, noise and environment"
        lede="Police-reported crime, flood regulation, distance to major noise sources, and air quality."
      />
      <Kpis
        items={[
          area && {
            label: "Crime Severity Index",
            value: n0(area.csi),
            sub: overall?.text ?? (province ? "Ontario overall" : undefined),
            icon: ShieldIcon,
            valueColor: overall ? (overall.good ? C.good : C.warn) : C.ink,
          },
          {
            label: "Flood regulation",
            value:
              sf.flood.status === "clear"
                ? "Clear"
                : sf.flood.status === "unknown"
                  ? "—"
                  : "Check",
            sub: flood.label,
            icon: DropletsIcon,
            valueColor: flood.color,
          },
          {
            label: "Nearest rail line",
            value: sf.noise.railway ? km(sf.noise.railway.meters) : "None near",
            icon: Volume2Icon,
          },
          sf.airQuality && {
            label: "Air quality",
            value: String(sf.airQuality.aqi),
            sub: sf.airQuality.category,
            icon: WindIcon,
            valueColor: C.good,
          },
        ]}
      />

      {area && (
        <View wrap={false}>
          <H2 icon={ShieldIcon} color={C.accent} first>
            {`Crime Severity Index, ${area.year}`}
          </H2>
          <Card>
            <Text style={[s.small, { marginBottom: 8 }]}>
              {province
                ? `${area.province.name} overall (no separate police figures for ${area.municipality ?? "this municipality"}).`
                : `${area.service}${area.policing === "opp" ? " (OPP)" : area.policing === "sq" ? " (SQ)" : area.policing === "rcmp" ? " (RCMP)" : ""}: covers the whole police service area.`}
            </Text>
            <Grid columns={3} gap={6} width={PAGE.content - 20}>
              {(
                [
                  ["Overall", area.csi, area.province.csi],
                  ["Violent", area.violentCsi, area.province.violentCsi],
                  [
                    "Non-violent",
                    area.nonViolentCsi,
                    area.province.nonViolentCsi,
                  ],
                ] as const
              ).map(([label, local, reference]) => {
                const cmp = province ? null : compare(local, reference, area.province.name);
                const max = Math.max(local ?? 0, reference ?? 0, 1);
                return (
                  <View
                    key={label}
                    style={{ backgroundColor: C.wash, padding: 8 }}
                  >
                    <Text style={[s.small, { fontWeight: 600 }]}>{label}</Text>
                    <Text
                      style={{ fontSize: 15, fontWeight: 700, color: C.ink }}
                    >
                      {n0(local)}
                    </Text>
                    {/* This area vs the province (short code fits the bar label). */}
                    {[
                      ["Here", local, C.ink],
                      [area.province.code ?? "CA", reference, C.faint],
                    ].map(([l, v, color]) => (
                      <View
                        key={l as string}
                        style={[
                          s.row,
                          { alignItems: "center", gap: 4, marginTop: 3 },
                        ]}
                      >
                        <Text
                          style={{ fontSize: 6.5, color: C.muted, width: 26 }}
                        >
                          {l as string}
                        </Text>
                        <View
                          style={{
                            flex: 1,
                            height: 4,
                            backgroundColor: C.white,
                          }}
                        >
                          <View
                            style={{
                              width: `${(((v as number | null) ?? 0) / max) * 100}%`,
                              height: 4,
                              backgroundColor: color as string,
                            }}
                          />
                        </View>
                      </View>
                    ))}
                    {cmp ? (
                      <Text
                        style={{
                          fontSize: 7,
                          marginTop: 4,
                          color: cmp.good ? C.good : C.warn,
                        }}
                      >
                        {cmp.text}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </Grid>
            <View
              style={[
                s.row,
                { alignItems: "flex-end", gap: 10, marginTop: 10 },
              ]}
            >
              <Sparkbars
                values={area.trend}
                width={150}
                height={26}
                highlight={C.accent}
              />
              <Text style={[s.small, { flex: 1 }]}>
                Overall index per year, {area.firstYear}–{area.year}:{" "}
                {area.trend.map((v) => v?.toFixed(0) ?? "n/a").join(", ")}
              </Text>
            </View>
          </Card>
          <Note>
            The index weighs police-reported crime by seriousness (100 = Canada
            in 2006). Canada: {n0(area.canadaCsi)}. {area.source}.
          </Note>
        </View>
      )}

      {crime ? (
        <View>
          <H2 icon={ShieldIcon} color={C.accent}>
            {`Neighbourhood crime: ${crime.neighbourhood}`}
          </H2>
          <Text style={[s.small, { marginBottom: 6 }]}>
            {crime.year} counts and rates per 100,000 residents
            {crime.population != null
              ? ` · ${crime.population.toLocaleString("en-CA")} residents`
              : ""}
            {crime.lowerRateThanShare != null
              ? ` · Lower overall rate than ${Math.round(crime.lowerRateThanShare * 100)}% of the city's neighbourhoods`
              : ""}
          </Text>
          <Card style={{ padding: 0 }}>
            <Table
              dense
              rows={crime.types}
              columns={[
                {
                  label: "Type",
                  flex: 1.6,
                  render: (t) =>
                    CRIME_TYPES.find((c) => c.id === t.id)?.label ?? t.id,
                },
                {
                  label: "Count",
                  width: 40,
                  align: "right",
                  render: (t) => n0(t.count),
                },
                {
                  label: "Rate",
                  width: 50,
                  align: "right",
                  render: (t) => n0(t.rate),
                },
                {
                  label: "City rate",
                  width: 54,
                  align: "right",
                  render: (t) => n0(t.cityRate),
                },
                {
                  label: `Trend ${crime.firstYear}–${crime.year}`,
                  width: 90,
                  align: "right",
                  render: (t) => (
                    <Sparkbars values={t.trend} width={70} height={12} />
                  ),
                },
              ]}
            />
          </Card>
          <Note>{crime.source}.</Note>
        </View>
      ) : sf.crimeNote ? (
        <Note>{sf.crimeNote}</Note>
      ) : null}

      <View wrap={false}>
        <H2 icon={DropletsIcon} color="#0891b2">
          Flood regulation
        </H2>
        <Card accent={flood.color}>
          <Facts
            columns={2}
            items={[
              { label: "Status", value: flood.label },
              {
                label: "Conservation authority",
                value: sf.flood.authority ?? "—",
              },
              ...(sf.flood.criteria.length
                ? [
                    {
                      label: "Regulated for",
                      value: sf.flood.criteria.join(", "),
                    },
                  ]
                : []),
            ]}
          />
          <Text style={[s.small, { marginTop: 6 }]}>{sf.flood.note}</Text>
        </Card>
      </View>

      {/* Noise and air in one grid: six tiles, no orphaned row. */}
      <View wrap={false}>
        <H2 icon={Volume2Icon} color="#7c3aed">
          Noise and air quality
        </H2>
        <Grid columns={3} gap={6}>
          {[
            {
              label: "Nearest highway",
              value: sf.noise.highway
                ? km(sf.noise.highway.meters)
                : sf.noise.roadsCovered
                  ? "None nearby"
                  : "Not available",
              icon: Volume2Icon,
              color: "#7c3aed",
            },
            {
              label: "Nearest rail line",
              value: sf.noise.railway
                ? km(sf.noise.railway.meters)
                : sf.noise.roadsCovered
                  ? "None nearby"
                  : "Not available",
              icon: Volume2Icon,
              color: "#7c3aed",
            },
            {
              label: "Nearest airport",
              value: sf.noise.airport
                ? `${sf.noise.airport.km.toFixed(1)} km`
                : "None nearby",
              sub: sf.noise.airport?.name,
              icon: Volume2Icon,
              color: "#7c3aed",
            },
            ...(sf.airQuality
              ? [
                  {
                    label: "Air Quality Index",
                    value: String(sf.airQuality.aqi),
                    sub: sf.airQuality.category,
                    icon: WindIcon,
                    color: C.good,
                    valueColor: C.good,
                  },
                  {
                    label: "Main pollutant",
                    value:
                      sf.airQuality.dominantPollutant?.toUpperCase() ?? "—",
                    icon: WindIcon,
                    color: C.good,
                  },
                  {
                    label: "Observed",
                    value: shortDate(sf.airQuality.observedAt),
                    sub: "A snapshot, not a long-term average",
                    icon: WindIcon,
                    color: C.good,
                  },
                ]
              : []),
          ].map((x) => (
            <Stat key={x.label} {...x} />
          ))}
        </Grid>
        {!sf.airQuality && sf.airQualityNote ? (
          <Note>{sf.airQualityNote}</Note>
        ) : null}
      </View>
      <Note>Air quality from Google; updated {date(sf.fetchedAt)}.</Note>
    </ReportPage>
  );
}

// ---------------------------------------------------------------------------
// Neighbourhood (census)
// ---------------------------------------------------------------------------

const CENSUS_GROUPS: { title: string; ids: CensusFieldId[] }[] = [
  {
    title: "People",
    ids: [
      "population",
      "density",
      "medianAge",
      "age0to14",
      "age15to64",
      "age65plus",
    ],
  },
  {
    title: "Households",
    ids: [
      "householdSize",
      "coupleWithChildren",
      "coupleNoChildren",
      "oneParent",
      "onePerson",
    ],
  },
  {
    title: "Income, tenure and education",
    ids: ["medianIncome", "owners", "renters", "bachelorPlus"],
  },
  {
    title: "Housing types",
    ids: [
      "singleDetached",
      "semiDetached",
      "rowHouse",
      "duplex",
      "lowRise",
      "highRise",
    ],
  },
];

function census(id: CensusFieldId, v: number | null | undefined) {
  if (v == null) return "—";
  const f = CENSUS_FIELDS.find((x) => x.id === id)!;
  switch (f.format) {
    case "percent":
      return `${v.toFixed(1)}%`;
    case "currency":
      return money(v);
    case "decimal":
      return v.toFixed(1);
    default:
      return Math.round(v).toLocaleString("en-CA");
  }
}

export function NeighbourhoodPage({ d, n }: { d: PdfData; n: number }) {
  const dm = d.demographics;
  if (!dm) return null;
  const v = dm.area.values;
  const city = dm.city?.values;
  const vs = (id: CensusFieldId) =>
    city?.[id] != null
      ? `${dm.city!.label}: ${census(id, city[id])}`
      : undefined;
  const colWidth = (PAGE.content - 14) / 2;

  return (
    <ReportPage section="Neighbourhood" address={d.address} brand={d.brand}>
      <SectionHead
        record={d.recordPage}
        id="neighbourhood"
        number={n}
        eyebrow="Neighbourhood"
        title="The neighbourhood in numbers"
        lede={`Statistics Canada ${dm.censusYear} Census for ${dm.area.label}${dm.city ? `, compared with ${dm.city.label}` : ""}.`}
      />
      <Kpis
        items={[
          {
            label: "Population",
            value: census("population", v.population),
            sub: vs("population"),
            icon: UsersIcon,
          },
          {
            label: "Median age",
            value: census("medianAge", v.medianAge),
            sub: vs("medianAge"),
          },
          {
            label: "Owners",
            value: census("owners", v.owners),
            sub: vs("owners"),
            icon: HomeIcon,
          },
          {
            label: "People per km²",
            value: census("density", v.density),
            sub: vs("density"),
            icon: LayersIcon,
          },
        ]}
      />
      {/* Two columns, so the whole census fits on one page. */}
      <View style={[s.row, { gap: 14 }]}>
        {[CENSUS_GROUPS.slice(0, 2), CENSUS_GROUPS.slice(2)].map(
          (groups, col) => (
            <View key={col} style={{ width: colWidth }}>
              {groups.map((g) => (
                <View key={g.title} wrap={false} style={{ marginBottom: 12 }}>
                  <Text style={[s.h3, { marginBottom: 5 }]}>{g.title}</Text>
                  <Card style={{ padding: 0 }}>
                    <Table
                      dense
                      rows={g.ids.map((id) => ({
                        id,
                        label: CENSUS_FIELDS.find((f) => f.id === id)!.label,
                      }))}
                      columns={[
                        { label: "Measure", flex: 2, render: (r) => r.label },
                        {
                          label:
                            dm.area.level === "tract" ? "This area" : "Area",
                          flex: 1,
                          align: "right",
                          render: (r) => census(r.id, v[r.id]),
                        },
                        ...(dm.city
                          ? [
                              {
                                label: dm.city.label,
                                flex: 1,
                                align: "right" as const,
                                render: (r: { id: CensusFieldId }) =>
                                  census(r.id, dm.city!.values[r.id]),
                              },
                            ]
                          : []),
                      ]}
                    />
                  </Card>
                </View>
              ))}
            </View>
          ),
        )}
      </View>
      <Note>
        Factual census figures for context only. Under the Ontario Human Rights
        Code, don&apos;t use them to describe or steer buyers by age, family
        status or income. Updated {date(dm.fetchedAt)}.
      </Note>
    </ReportPage>
  );
}

// ---------------------------------------------------------------------------
// Future upside
// ---------------------------------------------------------------------------

export function UpsidePage({
  d,
  images,
  n,
}: {
  d: PdfData;
  images: PdfImages;
  n: number;
}) {
  const u = d.upside;
  if (!u) return null;
  const labels = upsideMapLabels(u);
  const dev = u.development;

  return (
    <ReportPage section="Future upside" address={d.address} brand={d.brand}>
      <SectionHead
        record={d.recordPage}
        id="upside"
        number={n}
        eyebrow="Future upside"
        title="What's being built nearby"
        lede="Public infrastructure projects in the area and development applications close to the home."
      />
      <Kpis
        items={[
          dev && {
            label: "Applications within 500 m",
            value: String(dev.applications.length),
            icon: ConstructionIcon,
          },
          dev &&
            dev.totalUnits > 0 && {
              label: "Proposed units",
              value: dev.totalUnits.toLocaleString("en-CA"),
            },
          dev?.tallestStoreys
            ? {
                label: "Tallest proposal",
                value: `${dev.tallestStoreys} storeys`,
              }
            : null,
          {
            label: "Public projects",
            value: String(u.projects.length),
            icon: BuildingIcon,
          },
        ]}
      />
      <MapImage
        image={images.maps.upside}
        caption="Numbers are development applications; letters are public projects."
      />

      <H2 icon={ConstructionIcon} color="#d97706" first>
        Development applications
      </H2>
      {dev ? (
        dev.applications.length > 0 ? (
          <View style={{ gap: 6 }}>
            {dev.applications.map((a) => {
              const stage = APPLICATION_STAGES[a.stage];
              return (
                <View key={a.id} wrap={false}>
                  <Card style={{ padding: 7 }}>
                    <View style={[s.row, { gap: 8 }]}>
                      <Thumb
                        icon={ConstructionIcon}
                        color={stage.color}
                        badge={labels.get(a.id)}
                        size={34}
                      />
                      <View style={{ flex: 1, gap: 2 }}>
                        <View
                          style={[
                            s.row,
                            { justifyContent: "space-between", gap: 6 },
                          ]}
                        >
                          <Text style={[s.strong, { fontSize: 9, flex: 1 }]}>
                            {a.address}
                          </Text>
                          <Chip color={stage.color}>{stage.label}</Chip>
                        </View>
                        <Text style={{ fontSize: 7.2, color: C.muted }}>
                          {APPLICATION_TYPES[
                            a.type as keyof typeof APPLICATION_TYPES
                          ] ?? a.type}{" "}
                          · {a.status}
                        </Text>
                        {a.description ? (
                          <Text style={{ fontSize: 7.8, color: C.body }}>
                            {a.description}
                          </Text>
                        ) : null}
                        <View
                          style={[
                            s.row,
                            { gap: 4, flexWrap: "wrap", marginTop: 2 },
                          ]}
                        >
                          <Chip>{`${km(a.distanceMeters)} away`}</Chip>
                          {a.units != null ? (
                            <Chip>{`${a.units} units`}</Chip>
                          ) : null}
                          {a.storeys != null ? (
                            <Chip>{`${a.storeys} storeys`}</Chip>
                          ) : null}
                          {a.submittedAt ? (
                            <Chip>{`Submitted ${shortDate(a.submittedAt)}`}</Chip>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  </Card>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={s.p}>No active applications within 500 m.</Text>
        )
      ) : (
        <Text style={s.p}>
          {u.developmentNote ??
            "Development applications aren't available for this municipality yet."}
        </Text>
      )}

      <H2 icon={BuildingIcon} color="#2563eb">
        Public projects
      </H2>
      {u.projects.length > 0 ? (
        <View style={{ gap: 6 }}>
          {u.projects.map((p) => {
            const cat = PROJECT_CATEGORIES[p.category as ProjectCategory];
            const color = cat?.color ?? C.muted;
            return (
              <View key={p.id} wrap={false}>
                <Card style={{ padding: 7 }}>
                  <View style={[s.row, { gap: 8 }]}>
                    <Thumb
                      icon={BuildingIcon}
                      color={color}
                      badge={labels.get(p.id)}
                      size={34}
                    />
                    <View style={{ flex: 1, gap: 2 }}>
                      <View
                        style={[
                          s.row,
                          { justifyContent: "space-between", gap: 6 },
                        ]}
                      >
                        <Text style={[s.strong, { fontSize: 9, flex: 1 }]}>
                          {p.name}
                        </Text>
                        <Chip color={color}>{cat?.label ?? p.category}</Chip>
                      </View>
                      {p.description ? (
                        <Text style={{ fontSize: 7.8, color: C.body }}>
                          {p.description}
                        </Text>
                      ) : null}
                      <View
                        style={[
                          s.row,
                          { gap: 4, flexWrap: "wrap", marginTop: 2 },
                        ]}
                      >
                        <Chip>{p.status}</Chip>
                        <Chip>{`${km(p.distanceMeters)} away`}</Chip>
                        {p.transitLine ? <Chip>{p.transitLine}</Chip> : null}
                        {p.targetCompletion ? (
                          <Chip>{`Target ${p.targetCompletion}`}</Chip>
                        ) : null}
                        {p.budget != null ? (
                          <Chip>{money(p.budget)}</Chip>
                        ) : null}
                      </View>
                    </View>
                  </View>
                </Card>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={s.p}>{u.projectsNote ?? "No public projects listed nearby."}</Text>
      )}
      {u.federal && u.federal.projects.length > 0 ? (
        <View style={{ marginTop: 10, gap: 6 }}>
          <Text style={[s.strong, { fontSize: 10 }]}>
            {`Federally funded in ${u.federal.municipality}`}
          </Text>
          {u.federal.projects.map((p) => {
            const cat = PROJECT_CATEGORIES[p.category as ProjectCategory];
            return (
              <View key={p.id} wrap={false}>
                <Card style={{ padding: 7 }}>
                  <View style={[s.row, { justifyContent: "space-between", gap: 6 }]}>
                    <Text style={[s.strong, { fontSize: 9, flex: 1 }]}>{p.title}</Text>
                    <Chip color={cat?.color}>{cat?.label ?? p.category}</Chip>
                  </View>
                  <View style={[s.row, { gap: 4, flexWrap: "wrap", marginTop: 4 }]}>
                    <Chip>{p.status}</Chip>
                    {p.targetCompletion ? <Chip>{`Target ${p.targetCompletion}`}</Chip> : null}
                    {p.totalCost != null ? <Chip>{`${money(p.totalCost)} total`}</Chip> : null}
                  </View>
                </Card>
              </View>
            );
          })}
          <Text style={{ fontSize: 7.5, color: C.muted }}>
            {`Somewhere in ${u.federal.municipality}: Infrastructure Canada lists each project's municipality, not its exact site.`}
          </Text>
        </View>
      ) : null}
      <Note>
        {`Projects from ${[
          ...projectSources(u),
          ...(u.federal?.projects.length ? ["Infrastructure Canada"] : []),
        ].join(", ") || "public infrastructure data"}; applications from municipal open data. Updated ${date(u.fetchedAt)}.`}
      </Note>
    </ReportPage>
  );
}

// ---------------------------------------------------------------------------
// Marketing kit, listing campaign, showing playbook (AI)
// ---------------------------------------------------------------------------

const PLATFORM = {
  instagram: {
    label: "Instagram",
    icon: BRAND_ICONS.instagram,
    color: "#E4405F",
  },
  facebook: { label: "Facebook", icon: BRAND_ICONS.facebook, color: "#0866FF" },
  linkedin: { label: "LinkedIn", icon: BRAND_ICONS.linkedin, color: "#0A66C2" },
} as const;
const TONE = {
  professional: "Professional",
  warm: "Warm",
  luxury: "Luxury",
} as const;
const GERUND = { walk: "walking", drive: "driving" } as const;

const tags = (list: string[]) =>
  list.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ");

function Email({
  title,
  email,
}: {
  title: string;
  email: { subject: string; body: string };
}) {
  return (
    <Block title={title} icon={MailIcon}>
      <View
        style={{
          backgroundColor: C.wash,
          paddingHorizontal: 6,
          paddingVertical: 4,
          marginBottom: 6,
        }}
      >
        <Text style={[s.strong, { fontSize: 8.5 }]}>
          Subject: {email.subject}
        </Text>
      </View>
      <Text style={s.p}>{email.body}</Text>
    </Block>
  );
}

export function MarketingPage({ d, n }: { d: PdfData; n: number }) {
  const m = d.marketing;
  if (!m) return null;
  return (
    <ReportPage section="Marketing kit" address={d.address} brand={d.brand}>
      <SectionHead
        record={d.recordPage}
        id="marketing"
        number={n}
        eyebrow="Marketing kit"
        title="Listing copy, ready to use"
        lede={`MLS descriptions in three tones, social posts and an email. Travel times use ${GERUND[d.copyMode]}.`}
      />
      <H2 icon={MegaphoneIcon} color={C.accent} first>
        Listing descriptions
      </H2>
      {m.listingDescriptions.map((x) => (
        <Block
          key={x.tone}
          title={TONE[x.tone]}
          meta={`${x.text.split(/\s+/).length} words`}
        >
          <Text style={s.p}>{x.text}</Text>
        </Block>
      ))}
      <H2 icon={MessageSquareIcon} color={C.accent}>
        Social posts
      </H2>
      {m.socialPosts.map((x) => (
        <Block
          key={x.platform}
          title={PLATFORM[x.platform].label}
          icon={PLATFORM[x.platform].icon}
          color={PLATFORM[x.platform].color}
        >
          <Text style={s.p}>{x.caption}</Text>
          {x.hashtags.length ? (
            <Text
              style={{
                fontSize: 7.5,
                marginTop: 4,
                color: PLATFORM[x.platform].color,
              }}
            >
              {tags(x.hashtags)}
            </Text>
          ) : null}
        </Block>
      ))}
      {/* Heading and its (unbreakable) box move to a new page together. */}
      <View wrap={false}>
        <H2 icon={MailIcon} color={C.accent}>
          Email to your buyer list
        </H2>
        <Email title="Email" email={m.email} />
      </View>
    </ReportPage>
  );
}

export function CampaignPage({ d, n }: { d: PdfData; n: number }) {
  const c = d.campaign;
  if (!c) return null;
  return (
    <ReportPage section="Listing campaign" address={d.address} brand={d.brand}>
      <SectionHead
        record={d.recordPage}
        id="campaign"
        number={n}
        eyebrow="Listing campaign"
        title="The full campaign, stage by stage"
        lede="Headlines, short MLS remarks, a post for every stage, a Reel script, carousel slides, ads and emails."
      />
      <H2 icon={MegaphoneIcon} color={C.accent} first>
        Headlines
      </H2>
      <Card>
        <Numbered
          items={c.headlines.map((h) => (
            <Text key={h}>
              {h}{" "}
              <Text style={{ color: C.faint, fontSize: 7.5 }}>
                ({h.length} chars)
              </Text>
            </Text>
          ))}
        />
      </Card>

      <View wrap={false}>
        <H2>Short MLS remarks</H2>
        <Block
          title="MLS public remarks"
          meta={`${c.mlsShort.length} / 450 characters`}
        >
          <Text style={s.p}>{c.mlsShort}</Text>
        </Block>
      </View>

      <H2 icon={MessageSquareIcon} color={C.accent}>
        Posts for each stage
      </H2>
      {c.stagePosts.map((p, i) => (
        <Block key={p.stage} title={`${i + 1}. ${CAMPAIGN_STAGES[p.stage]}`}>
          <Text style={s.p}>{p.caption}</Text>
          {p.hashtags.length ? (
            <Text style={{ fontSize: 7.5, marginTop: 4, color: C.accent }}>
              {tags(p.hashtags)}
            </Text>
          ) : null}
        </Block>
      ))}

      <View>
        <H2 icon={ClapperboardIcon} color={C.accent}>
          30-second Reel / TikTok
        </H2>
        <Card accent={C.accent} style={{ marginBottom: 6 }}>
          <Text style={s.p}>
            <Text style={s.strong}>Hook: </Text>
            {c.reel.hook}
          </Text>
        </Card>
        <Card style={{ padding: 0 }}>
          <Table
            dense
            rows={c.reel.scenes}
            columns={[
              { label: "#", width: 16, render: (_x, i) => String(i + 1) },
              { label: "Shot", flex: 1.2, render: (x) => x.shot },
              { label: "Voiceover", flex: 1.6, render: (x) => x.voiceover },
              { label: "On screen", flex: 1, render: (x) => x.onScreenText },
            ]}
          />
        </Card>
        <Para style={{ marginTop: 6 }}>
          <Text style={s.strong}>Caption: </Text>
          {c.reel.caption}
        </Para>
        <Para>
          <Text style={s.strong}>Call to action: </Text>
          {c.reel.callToAction}
        </Para>
      </View>

      <H2 icon={BRAND_ICONS.instagram} color="#E4405F">
        Instagram carousel
      </H2>
      <Grid columns={3} gap={6}>
        {c.carousel.map((slide, i) => (
          <View
            key={i}
            style={{
              borderWidth: 0.75,
              borderColor: C.line,
              minHeight: 96,
            }}
          >
            <View
              style={{
                backgroundColor: tint("#E4405F", 0.08),
                paddingHorizontal: 7,
                paddingVertical: 4,
              }}
            >
              <Text
                style={{ fontSize: 6.8, fontWeight: 600, color: "#E4405F" }}
              >
                SLIDE {i + 1} / {c.carousel.length}
              </Text>
            </View>
            <View style={{ padding: 7 }}>
              <Text style={s.h3}>{slide.title}</Text>
              <Text style={[s.p, { fontSize: 7.8 }]}>{slide.body}</Text>
            </View>
          </View>
        ))}
      </Grid>

      <View wrap={false}>
        <H2 icon={GaugeIcon} color={C.accent}>
          Ads (Google / Meta)
        </H2>
        <Grid columns={2}>
          {[
            <Card key="h">
              <Text style={[s.small, { fontWeight: 600, marginBottom: 4 }]}>
                HEADLINES · 30 CHARACTERS MAX
              </Text>
              <Bullets
                items={c.ads.headlines.map((h) => `${h}  (${h.length})`)}
              />
            </Card>,
            <Card key="d">
              <Text style={[s.small, { fontWeight: 600, marginBottom: 4 }]}>
                DESCRIPTIONS · 90 CHARACTERS MAX
              </Text>
              <Bullets
                items={c.ads.descriptions.map((h) => `${h}  (${h.length})`)}
              />
            </Card>,
          ]}
        </Grid>
      </View>

      <H2 icon={MailIcon} color={C.accent}>
        Emails
      </H2>
      <Email title="Open house invitation" email={c.openHouseEmail} />
      <Email title="Letter to neighbours" email={c.neighbourLetter} />
    </ReportPage>
  );
}

export function PlaybookPage({ d, n }: { d: PdfData; n: number }) {
  const pb = d.marketing?.playbook;
  const sh = d.showing;
  if (!pb && !sh) return null;
  return (
    <ReportPage section="Showing playbook" address={d.address} brand={d.brand}>
      <SectionHead
        record={d.recordPage}
        id="playbook"
        number={n}
        eyebrow="Showing playbook"
        title="Showing day, prepared"
        lede="Who to pitch to, answers to tough questions with proof, talking points and the open house plan."
      />
      {sh && (
        <>
          <H2 icon={UsersIcon} color={C.accent} first>
            Buyer personas
          </H2>
          <Grid columns={3} gap={6}>
            {sh.personas.map((p, i) => (
              <Card key={i} style={{ minHeight: 160 }}>
                <IconChip icon={UsersIcon} color={C.accent} size={18} />
                <Text style={[s.h3, { marginTop: 5 }]}>{p.title}</Text>
                <Text style={[s.p, { fontSize: 7.8 }]}>{p.needs}</Text>
                <Text
                  style={[
                    s.small,
                    { fontWeight: 600, marginTop: 5, marginBottom: 2 },
                  ]}
                >
                  LEAD WITH
                </Text>
                <Bullets items={p.emphasize} />
                <View
                  style={{ backgroundColor: C.wash, padding: 5, marginTop: 5 }}
                >
                  <Text style={{ fontSize: 7.5 }}>
                    <Text style={s.strong}>Show first: </Text>
                    {p.tourFocus}
                  </Text>
                </View>
              </Card>
            ))}
          </Grid>
          <H2 icon={MessageSquareIcon} color={C.accent}>
            Tough questions, answered with proof
          </H2>
          {sh.provenAnswers.map((q, i) => (
            <Block key={i} title={q.question}>
              <Text style={s.p}>{q.answer}</Text>
              <View
                style={[
                  s.row,
                  {
                    gap: 4,
                    marginTop: 4,
                    backgroundColor: tint(C.good, 0.07),
                    padding: 5,
                  },
                ]}
              >
                <Text style={{ fontSize: 7.5, fontWeight: 600, color: C.good }}>
                  Proof:
                </Text>
                <Text style={{ fontSize: 7.5, flex: 1 }}>{q.proof}</Text>
              </View>
            </Block>
          ))}
        </>
      )}

      {pb && (
        <>
          <View wrap={false}>
            <H2 first={!sh}>Talking points</H2>
            <Card>
              <Bullets items={pb.talkingPoints} />
            </Card>
          </View>
          <H2>Objections and responses</H2>
          <Card style={{ padding: 0 }}>
            <Table
              rows={pb.objections}
              columns={[
                { label: "Objection", flex: 1, render: (o) => o.objection },
                { label: "Response", flex: 2, render: (o) => o.response },
              ]}
            />
          </Card>
          <View wrap={false}>
            <H2 icon={UsersIcon} color={C.accent}>
              Likely buyer
            </H2>
            <Card accent={C.accent}>
              <Text style={s.h3}>{pb.buyerProfile.title}</Text>
              <Para>{pb.buyerProfile.summary}</Para>
              <Bullets items={pb.buyerProfile.motivations} />
            </Card>
          </View>
          <View wrap={false}>
            <H2>Showing checklist</H2>
            <Card>
              <Checklist name="showing-checklist" items={pb.showingChecklist} />
            </Card>
          </View>
        </>
      )}

      {sh && (
        <>
          <View wrap={false}>
            <H2>Open house plan</H2>
            <Grid columns={3} gap={6}>
              {(
                [
                  ["Before", sh.openHousePlan.before],
                  ["On the day", sh.openHousePlan.dayOf],
                  ["After", sh.openHousePlan.after],
                ] as const
              ).map(([title, steps]) => (
                <View
                  key={title}
                  style={{ borderWidth: 0.75, borderColor: C.line }}
                >
                  <View
                    style={{
                      backgroundColor: C.wash,
                      paddingHorizontal: 8,
                      paddingVertical: 5,
                    }}
                  >
                    <Text style={[s.h3, { marginBottom: 0 }]}>{title}</Text>
                  </View>
                  <View style={{ padding: 8 }}>
                    <Checklist
                      name={`open-house-${title.toLowerCase().replace(/\W+/g, "-")}`}
                      items={[...steps]}
                    />
                  </View>
                </View>
              ))}
            </Grid>
          </View>
          <View wrap={false}>
            <H2>Follow-ups</H2>
            <Block
              title="Same-evening text"
              icon={MessageSquareIcon}
              meta={`${sh.followUpText.length} characters`}
            >
              <Text style={s.p}>{sh.followUpText}</Text>
            </Block>
          </View>
          <Email title="Next-day email" email={sh.followUpEmail} />
        </>
      )}
    </ReportPage>
  );
}

// ---------------------------------------------------------------------------
// Property details and sources
// ---------------------------------------------------------------------------

const SOURCE_LABELS: Record<string, string> = {
  google: "Google Maps",
  search: "Address as searched",
  agent: "Entered by agent",
  pin: "Pin dropped by agent",
};

export function DetailsPage({ d, n }: { d: PdfData; n: number }) {
  const p = d.property;
  const sources = (p?.sources ?? {}) as Record<
    string,
    { source?: string; asOf?: string } | undefined
  >;
  const src = (key: string) =>
    sources[key]?.source
      ? (SOURCE_LABELS[sources[key]!.source!] ?? sources[key]!.source!)
      : "";
  const rows = [
    {
      label: "Address",
      value: p?.formattedAddress ?? d.report.inputAddress,
      source: src("formattedAddress"),
    },
    { label: "Unit", value: p?.unitNumber, source: src("unitNumber") },
    {
      label: "Street",
      value: [p?.streetNumber, p?.streetName].filter(Boolean).join(" ") || null,
      source: "",
    },
    { label: "City", value: p?.city, source: "" },
    { label: "Province", value: p?.province, source: "" },
    { label: "Postal code", value: p?.postalCode, source: "" },
    {
      label: "Coordinates",
      value:
        p?.latitude != null && p?.longitude != null
          ? `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`
          : null,
      source: src("location"),
    },
    {
      label: "Legal description",
      value: p?.legalDescription,
      source: src("legalDescription"),
    },
    { label: "PIN", value: p?.pin, source: src("pin") },
    {
      label: "Assessment roll number",
      value: p?.rollNumber,
      source: src("rollNumber"),
    },
  ];
  const l = d.listing;
  const data = [
    d.amenities && {
      label: "Amenities",
      source: "Google Maps (Places, Routes)",
      at: d.amenities.fetchedAt,
    },
    d.commute && {
      label: "Commute & transit",
      source: "Google Maps (Places, Routes)",
      at: d.commute.fetchedAt,
    },
    d.schools && {
      label: "Schools",
      source:
        d.schools.coverage === "canada"
          ? `Statistics Canada, Open Database of Educational Facilities (${d.schools.dataYear}); Google Street View`
          : d.schools.coverage === "nearby"
            ? "Google Maps (Places); Google Street View"
            : `Ontario Ministry of Education, EQAO ${d.schools.dataYear}; Google Street View`,
      at: d.schools.fetchedAt,
    },
    d.safety && {
      label: "Safety & environment",
      source: [
        d.safety.areaCrime?.source,
        d.safety.crime?.source,
        d.safety.flood.authority,
        "Ontario Road / Rail Networks",
        "Google Air Quality",
      ]
        .filter(Boolean)
        .join("; "),
      at: d.safety.fetchedAt,
    },
    d.demographics && {
      label: "Neighbourhood",
      source: `Statistics Canada, ${d.demographics.censusYear} Census`,
      at: d.demographics.fetchedAt,
    },
    d.upside && {
      label: "Future upside",
      source: [...projectSources(d.upside), d.upside.development?.source]
        .filter(Boolean)
        .join("; "),
      at: d.upside.fetchedAt,
    },
  ].filter(Boolean) as { label: string; source: string; at: string }[];

  return (
    <ReportPage section="Property details" address={d.address} brand={d.brand}>
      <SectionHead
        record={d.recordPage}
        id="details"
        number={n}
        eyebrow="Property details"
        title="Property record and sources"
      />
      {l && (
        <View wrap={false} style={{ marginBottom: 4 }}>
          <Grid columns={4}>
            {[
              <Stat
                key="t"
                label="Type"
                value={l.propertyType ?? "—"}
                icon={HomeIcon}
              />,
              <Stat
                key="b"
                label="Bedrooms"
                value={l.bedrooms != null ? String(l.bedrooms) : "—"}
              />,
              <Stat
                key="ba"
                label="Bathrooms"
                value={l.bathrooms != null ? String(l.bathrooms) : "—"}
              />,
              <Stat
                key="p"
                label="List price"
                value={l.listPrice != null ? money(l.listPrice) : "—"}
              />,
            ]}
          </Grid>
          {l.features ? (
            <Card style={{ marginTop: 6 }}>
              <Text style={[s.small, { fontWeight: 600 }]}>FEATURES</Text>
              <Text style={s.p}>{l.features}</Text>
            </Card>
          ) : null}
        </View>
      )}
      <H2 icon={HomeIcon} color={C.accent} first={!l}>
        Identification
      </H2>
      <Card style={{ padding: 0 }}>
        <Table
          dense
          rows={rows}
          columns={[
            { label: "Field", flex: 1, render: (r) => r.label },
            { label: "Value", flex: 2, render: (r) => r.value || "—" },
            {
              label: "Source",
              flex: 1,
              render: (r) => (r.value ? r.source || "—" : "—"),
            },
          ]}
        />
      </Card>

      <H2 icon={LayersIcon} color={C.accent}>
        Where the data comes from
      </H2>
      <Card style={{ padding: 0 }}>
        <Table
          dense
          rows={data}
          columns={[
            { label: "Section", flex: 1, render: (r) => r.label },
            { label: "Source", flex: 2.4, render: (r) => r.source },
            { label: "Updated", width: 76, render: (r) => shortDate(r.at) },
          ]}
        />
      </Card>
      <Note>
        Report {d.report.id.slice(0, 8).toUpperCase()} · created{" "}
        {date(d.report.createdAt)}. Information is from public and third-party
        sources and may change; verify important details independently.
      </Note>
    </ReportPage>
  );
}

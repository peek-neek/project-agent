import { Text, View } from "@react-pdf/renderer";
import {
  ArrowLeftRightIcon,
  BadgeDollarSignIcon,
  BuildingIcon,
  CalculatorIcon,
  HandCoinsIcon,
  HouseIcon,
  LandmarkIcon,
  type LucideIcon,
  ReceiptTextIcon,
  RefreshCcwIcon,
  ScaleIcon,
  TrendingDownIcon,
  WalletCardsIcon,
} from "lucide-react";
import { maxAffordable, qualifyingRate } from "@/lib/finance/affordability";
import { buyerClosingCosts, sellerNet } from "@/lib/finance/closing";
import { commission } from "@/lib/finance/commission";
import { roundTo } from "@/lib/finance/defaults";
import {
  bridgeFinancing,
  prepayment,
  rentalAnalysis,
  rentVsBuy,
} from "@/lib/finance/investing";
import { landTransferTax } from "@/lib/finance/land-transfer-tax";
import {
  amortize,
  minDownPayment,
  mortgageInsurance,
  payment,
} from "@/lib/finance/mortgage";
import { ownershipCost } from "@/lib/finance/ownership";
import {
  ONTARIO_MEDIAN_TAX_RATE,
  PROPERTY_TAX_RATES,
  PROPERTY_TAX_RATES_YEAR,
} from "@/lib/finance/property-tax-rates";
import {
  CUSTOM_MUNICIPALITY,
  defaultInputs,
  hasSavedInputs,
  mergeInputs,
} from "@/lib/finance/scenario";
import { cloneElement } from "react";
import type { PdfData } from "./data";
import {
  H2,
  IconChip,
  Note,
  ReportPage,
  SectionHead,
  tint,
} from "./primitives";
import { C, s } from "./theme";

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const $ = (v: number) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(v) ? v : 0);
const $2 = (v: number) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
const pct = (v: number, d = 2) =>
  `${(v * 100)
    .toFixed(d)
    .replace(/(\.\d*?)0+$/, "$1")
    .replace(/\.$/, "")}%`;
const yrs = (months: number) => {
  const y = Math.floor(months / 12);
  const m = Math.round(months % 12);
  return m ? `${y} yr ${m} mo` : `${y} yr`;
};
const signed = (v: number) => `${v >= 0 ? "+" : "−"}${$(Math.abs(v))}`;

// ---------------------------------------------------------------------------
// Scenario table
// ---------------------------------------------------------------------------

type Row = {
  label: string;
  values: string[];
  /** A total: bold with a rule above. */
  strong?: boolean;
  muted?: boolean;
};

type Column = { label: string; value?: string };

/**
 * One calculator, three scenarios side by side: results down the rows,
 * options across. The highlighted column is the agent's figure (or the
 * base case).
 */
function ScenarioTable({
  title,
  icon,
  assumptions,
  columns,
  rows,
  highlight,
  nested,
}: {
  title: string;
  icon: LucideIcon;
  assumptions: string;
  columns: Column[];
  rows: Row[];
  highlight?: number;
  /** Already inside an unbreakable block (a group's first table). */
  nested?: boolean;
}) {
  const cellBg = (i: number) =>
    i === highlight ? { backgroundColor: tint(C.accent, 0.05) } : {};
  return (
    <View
      wrap={nested ? undefined : false}
      style={{ borderWidth: 0.75, borderColor: C.line, marginBottom: 10 }}
    >
      <View
        style={[
          s.row,
          {
            alignItems: "center",
            gap: 7,
            paddingHorizontal: 9,
            paddingTop: 8,
            paddingBottom: 6,
          },
        ]}
      >
        <IconChip icon={icon} color={C.accent} size={18} />
        <View style={{ flex: 1 }}>
          <Text style={[s.h3, { marginBottom: 0 }]}>{title}</Text>
          <Text style={{ fontSize: 7, color: C.muted }}>{assumptions}</Text>
        </View>
      </View>
      {/* Column headings */}
      <View style={[s.row, { borderBottomWidth: 1, borderBottomColor: C.ink }]}>
        <View style={{ flex: 1.5, paddingHorizontal: 9, paddingVertical: 5 }} />
        {columns.map((c, i) => (
          <View
            key={i}
            style={[
              {
                flex: 1,
                paddingHorizontal: 9,
                paddingVertical: 5,
                alignItems: "flex-end",
              },
              cellBg(i),
            ]}
          >
            <Text
              style={{
                fontSize: 6.8,
                fontWeight: 600,
                color: i === highlight ? C.accent : C.muted,
                textTransform: "uppercase",
                letterSpacing: 0.4,
              }}
            >
              {c.label}
            </Text>
            {c.value ? (
              <Text style={{ fontSize: 9, fontWeight: 700, color: C.ink }}>
                {c.value}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
      {rows.map((r, ri) => (
        <View
          key={ri}
          style={[
            s.row,
            r.strong
              ? { borderTopWidth: 0.75, borderTopColor: C.ink }
              : ri
                ? { borderTopWidth: 0.5, borderTopColor: C.line }
                : {},
          ]}
        >
          <Text
            style={{
              flex: 1.5,
              paddingHorizontal: 9,
              paddingVertical: 4,
              fontSize: 8,
              fontWeight: r.strong ? 700 : 400,
              color: r.muted ? C.muted : C.ink,
            }}
          >
            {r.label}
          </Text>
          {r.values.map((v, i) => (
            <Text
              key={i}
              style={[
                {
                  flex: 1,
                  paddingHorizontal: 9,
                  paddingVertical: 4,
                  fontSize: 8,
                  textAlign: "right",
                  fontWeight: r.strong ? 700 : 400,
                  color: r.muted ? C.muted : C.ink,
                },
                cellBg(i),
              ]}
            >
              {v}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

/**
 * A group heading kept on the same page as its first table (the table is
 * marked nested so unbreakable blocks never sit inside each other).
 */
function Group({
  title,
  icon,
  first,
  children,
}: {
  title: string;
  icon: LucideIcon;
  first?: boolean;
  children:
    | React.ReactElement<{ nested?: boolean }>
    | React.ReactElement<{ nested?: boolean }>[];
}) {
  const [lead, ...rest] = Array.isArray(children) ? children : [children];
  return (
    <>
      <View wrap={false}>
        <H2 icon={icon} color={C.accent} first={first}>
          {title}
        </H2>
        {cloneElement(lead, { nested: true })}
      </View>
      {rest}
    </>
  );
}

// ---------------------------------------------------------------------------
// The section
// ---------------------------------------------------------------------------

/**
 * Three options for a figure with the agent's own (or the base case) among
 * them: the nearest option is swapped for it, so it's always a column.
 */
function around(base: number, options: number[]) {
  const same = (a: number, b: number) => Math.abs(a - b) < 1e-6;
  const values = options.filter(
    (v, i) => options.findIndex((w) => same(v, w)) === i,
  );
  if (!values.some((v) => same(v, base))) {
    let nearest = 0;
    values.forEach((v, i) => {
      if (Math.abs(v - base) < Math.abs(values[nearest] - base)) nearest = i;
    });
    values[nearest] = base;
  }
  values.sort((a, b) => a - b);
  return { values, hi: values.findIndex((v) => same(v, base)) };
}

/**
 * Every calculator worked out at one price (the agent's saved price, else
 * the list price, else an example), with the figure that matters most for
 * it changed across the columns: down payment, interest rate,
 * amortization, term, income, commission, rent growth… The highlighted
 * column is the agent's own figure (saved in the Calculators tab) or the
 * base case.
 */
export function FinancePage({ d, n }: { d: PdfData; n: number }) {
  const listPrice = d.listing?.listPrice ?? null;
  const city = d.property?.city ?? null;
  const saved = d.calculators;
  const inp = mergeInputs(
    defaultInputs({
      listPrice,
      city,
      propertyType: d.listing?.propertyType ?? null,
    }),
    saved,
  );
  const usingSaved = hasSavedInputs(saved);
  const savedOn = saved?.savedAt
    ? new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(
        new Date(saved.savedAt),
      )
    : null;

  const {
    purchase,
    afford,
    closing: cl,
    own,
    seller: sl,
    comm,
    rental: rt,
    rvb: rv,
    prepay: pp,
    refi: rf,
    bridge: br,
    tax: tx,
  } = inp;
  const { toronto, singleFamily, rateType } = purchase;
  const condo = cl.condo;
  const price = purchase.price;
  const baseDown = purchase.downPayment;
  const rate = purchase.rate;
  const amortization = purchase.amortization;
  const termYears = purchase.termYears;
  const taxRate = afford.taxRate;
  const condoFees = afford.condoFees;

  const priceSource =
    saved?.purchase?.price != null
      ? "your purchase price"
      : listPrice
        ? "the list price"
        : "an example price (no list price yet)";
  /** Column headings: the highlighted one names whose figure it is. */
  const cols = (
    v: { values: number[]; hi: number },
    name: string,
    fmt: (x: number) => string,
    isSaved: boolean,
  ): Column[] =>
    v.values.map((x, i) => ({
      label: i === v.hi ? (isSaved ? "Your figure" : "Base case") : name,
      value: fmt(x),
    }));
  const downLabel = (p: number) => (v: number) =>
    `${$(v)} (${pct(p > 0 ? v / p : 0, 1)})`;
  const ratePlus = (r: number) =>
    [r - 0.005, r, r + 0.005].map((x) => Math.max(0.0025, x));

  // --- Buying -------------------------------------------------------------
  // Down payment: the minimum, 10% and 20% (20%, 25%, 35% at $1.5M+ where
  // insurance isn't available).
  const minDown = Math.ceil(minDownPayment(price) / 100) * 100;
  const downs = around(
    baseDown,
    price >= 1_500_000
      ? [0.2, 0.25, 0.35].map((s) => roundTo(price * s, 1_000))
      : [minDown, roundTo(price * 0.1, 1_000), roundTo(price * 0.2, 1_000)],
  );
  const downSaved = saved?.purchase?.downPayment != null;
  const loanFor = (down: number, years = amortization) => {
    const ins = mortgageInsurance({
      price,
      downPayment: down,
      amortizationYears: years,
    });
    return {
      ins,
      loan: Math.max(0, price - down) + (ins.available ? ins.premium : 0),
    };
  };
  const mortgage = (opts: {
    down?: number;
    rate?: number;
    years?: number;
    term?: number;
  }) => {
    const down = opts.down ?? baseDown;
    const years = opts.years ?? amortization;
    const { ins, loan } = loanFor(down, years);
    return {
      ins,
      loan,
      run: amortize({
        principal: loan,
        annualRate: opts.rate ?? rate,
        years,
        frequency: "monthly",
        termYears: opts.term ?? termYears,
        rateType,
      }),
    };
  };
  const byDown = downs.values.map((down) => mortgage({ down }));
  const rates = around(rate, ratePlus(rate));
  const rateSaved = saved?.purchase?.rate != null;
  const byRate = rates.values.map((r) => mortgage({ rate: r }));
  const amorts = around(amortization, [20, 25, 30]);
  const amortSaved = saved?.purchase?.amortization != null;
  const byAmort = amorts.values.map((years) => mortgage({ years }));
  const terms = around(termYears, [3, 5, 10]);
  const termSaved = saved?.purchase?.termYears != null;
  const byTerm = terms.values.map((term) => mortgage({ term }));
  const insuredAt30Blocked =
    byAmort.some((m, i) => m.ins.required && amorts.values[i] > 25) &&
    !purchase.firstTimeBuyer &&
    !purchase.newBuild;

  const closingFor = (down: number) =>
    buyerClosingCosts({
      price,
      downPayment: down,
      amortizationYears: amortization,
      toronto,
      firstTimeBuyer: purchase.firstTimeBuyer,
      singleFamily,
      nonResident: purchase.nonResident,
      condo,
      legalFees: cl.legalFees,
      titleInsurance: cl.titleInsurance,
      homeInspection: cl.homeInspection,
      appraisal: cl.appraisal,
      adjustments: cl.adjustments,
      moving: cl.moving,
      other: cl.other,
    });
  const closing = downs.values.map(closingFor);
  const buyers = [
    { label: "Standard buyer", firstTimeBuyer: false, nonResident: false },
    { label: "First-time buyer", firstTimeBuyer: true, nonResident: false },
    { label: "Non-resident", firstTimeBuyer: false, nonResident: true },
  ].map((b) => ({
    ...b,
    t: landTransferTax({ price, toronto, singleFamily, ...b }),
  }));
  const buyerHi = purchase.nonResident ? 2 : purchase.firstTimeBuyer ? 1 : 0;

  // Affordability: by income (the agent's figure ±$50K when saved).
  const incomeSaved = saved?.afford?.income != null;
  const incomes = incomeSaved
    ? around(afford.income, [
        Math.max(50_000, afford.income - 50_000),
        afford.income,
        afford.income + 50_000,
      ])
    : around(afford.income, [100_000, 150_000, 200_000]);
  const afford3 = incomes.values.map((income) =>
    maxAffordable({
      annualIncome: income,
      monthlyDebts: afford.debts,
      downPayment: baseDown,
      annualRate: rate,
      amortizationYears: amortization,
      propertyTaxRate: taxRate,
      heatingMonthly: afford.heating,
      condoFeesMonthly: condoFees,
    }),
  );
  const LIMIT = {
    "down-payment": "Down payment",
    gds: "Housing costs",
    tds: "Total debt",
    insurance: "Insurance cap",
  } as const;

  // --- Owning -------------------------------------------------------------
  const owning = rates.values.map((r) =>
    ownershipCost({
      price,
      downPayment: baseDown,
      rate: r,
      rateType,
      amortizationYears: amortization,
      propertyTaxRate: taxRate,
      insuranceMonthly: own.insurance,
      utilitiesMonthly: own.utilities,
      condoFeesMonthly: condoFees,
      maintenanceRate: own.maintenanceRate,
      otherMonthly: own.other,
    }),
  );
  const item = (o: (typeof owning)[number], id: string) =>
    o.items.find((i) => i.id === id)?.amount ?? 0;

  // Property tax: on the MPAC assessed value, usually well below today's
  // price (still 2016-based), so show it lower too.
  const taxRateFor =
    tx.municipality === CUSTOM_MUNICIPALITY
      ? tx.customRate
      : (PROPERTY_TAX_RATES[tx.municipality] ?? ONTARIO_MEDIAN_TAX_RATE);
  const taxName =
    tx.municipality === CUSTOM_MUNICIPALITY
      ? "your entered"
      : `${tx.municipality}'s`;
  const assessedSaved = saved?.tax?.assessedValue != null;
  const assessed = around(tx.assessedValue, [
    roundTo(tx.assessedValue * 0.6, 1_000),
    roundTo(tx.assessedValue * 0.8, 1_000),
    tx.assessedValue,
  ]);

  // Prepayment: the agent's own plan first when saved.
  const savedPrepay = saved?.prepay != null;
  const baseLoan = loanFor(baseDown).loan;
  const prepayBalance = savedPrepay ? pp.balance : baseLoan;
  const prepayRate = savedPrepay ? pp.rate : rate;
  const prepayYears = savedPrepay ? pp.remainingYears : amortization;
  const planLabel = [
    pp.extraMonthly ? `+${$(pp.extraMonthly)}/mo` : "",
    pp.annualLump ? `${$(pp.annualLump)}/yr` : "",
    pp.lumpNow ? `${$(pp.lumpNow)} now` : "",
  ]
    .filter(Boolean)
    .join(", ");
  const prepayPlans = [
    savedPrepay && planLabel
      ? {
          label: "Your plan",
          value: planLabel,
          extraMonthly: pp.extraMonthly,
          annualLump: pp.annualLump,
          lumpNow: pp.lumpNow,
        }
      : {
          label: "Prepay",
          value: "+$200 a month",
          extraMonthly: 200,
          annualLump: 0,
          lumpNow: 0,
        },
    {
      label: "Prepay",
      value: "+$500 a month",
      extraMonthly: 500,
      annualLump: 0,
      lumpNow: 0,
    },
    {
      label: "Prepay",
      value: "$10,000 a year",
      extraMonthly: 0,
      annualLump: 10_000,
      lumpNow: 0,
    },
  ].map((p) => ({
    ...p,
    r: prepayment({
      balance: prepayBalance,
      rate: prepayRate,
      remainingYears: prepayYears,
      extraMonthly: p.extraMonthly,
      annualLump: p.annualLump,
      lumpNow: p.lumpNow,
    }),
  }));

  // Renewal: new rate ±0.5% around the agent's (or today's typical) rate.
  const savedRefi = saved?.refi != null;
  const currentPayment = payment({
    principal: rf.balance,
    annualRate: rf.currentRate,
    years: rf.remainingYears,
    frequency: "monthly",
  });
  const renewRates = around(rf.newRate, ratePlus(rf.newRate));
  const renewPayments = renewRates.values.map((r) =>
    payment({
      principal: rf.balance,
      annualRate: r,
      years: rf.remainingYears,
      frequency: "monthly",
    }),
  );

  // --- Selling ------------------------------------------------------------
  // Total commission ±1% around the agent's, split between the brokerages
  // in the same proportion.
  const commTotal = sl.listingCommission + sl.buyerCommission;
  const listingPart = commTotal > 0 ? sl.listingCommission / commTotal : 0.5;
  const commSaved =
    saved?.seller?.listingCommission != null ||
    saved?.seller?.buyerCommission != null;
  const commTotals = around(
    commTotal,
    [commTotal - 0.01, commTotal, commTotal + 0.01].map((x) => Math.max(0, x)),
  );
  const selling = commTotals.values.map((total) =>
    sellerNet({
      ...sl,
      listingCommission: total * listingPart,
      buyerCommission: total * (1 - listingPart),
    }),
  );
  const line = (r: (typeof selling)[number], id: string) =>
    r.lines.find((l) => l.id === id)?.amount ?? 0;

  const savedBridge = saved?.bridge != null;
  const days = around(br.days, [30, 60, 90]);
  const bridges = days.values.map((d) => bridgeFinancing({ ...br, days: d }));

  // --- Investing ----------------------------------------------------------
  // Rental: by down payment (investment properties need 20%+).
  const rentalDowns = around(
    rt.downPayment,
    [0.2, 0.25, 0.35].map((s) => roundTo(rt.price * s, 1_000)),
  );
  const rentalDownSaved = saved?.rental?.downPayment != null;
  const rentals = rentalDowns.values.map((down) =>
    rentalAnalysis({ ...rt, downPayment: down }),
  );
  const rentIsExample = saved?.rental?.rent == null;

  // Rent vs buy: by yearly value growth, the figure that swings it most.
  const growth = around(rv.appreciation, [
    rv.appreciation - 0.01,
    rv.appreciation,
    rv.appreciation + 0.01,
  ]);
  const growthSaved = saved?.rvb?.appreciation != null;
  const rvb = growth.values.map((g) =>
    rentVsBuy({
      ...rv,
      price,
      downPayment: baseDown,
      rate,
      amortizationYears: amortization,
      toronto,
      firstTimeBuyer: purchase.firstTimeBuyer,
      propertyTaxRate: taxRate,
      appreciation: g,
    }),
  );

  // Commission: by the rate on your side (flat), or by your split (tiered).
  const flat = comm.structure === "flat";
  const commVar = flat
    ? around(comm.rate, [comm.rate - 0.005, comm.rate, comm.rate + 0.005])
    : around(
        comm.agentSplit,
        [comm.agentSplit - 0.1, comm.agentSplit, comm.agentSplit + 0.1].map(
          (x) => Math.min(1, Math.max(0, x)),
        ),
      );
  const commVarSaved = flat
    ? saved?.comm?.rate != null
    : saved?.comm?.agentSplit != null;
  const commissions = commVar.values.map((v) =>
    commission({ ...comm, ...(flat ? { rate: v } : { agentSplit: v }) }),
  );
  const commLine = flat
    ? `${pct(comm.agentSplit, 0)} split to you`
    : `${pct(comm.tierRate)} on the first ${$(comm.tierAmount)}, ${pct(comm.restRate)} on the rest`;

  const rateLine = `${pct(rate)} ${rateType}, ${amortization}-yr amortization, ${termYears}-yr term`;
  const downText = downLabel(price)(baseDown);

  return (
    <ReportPage section="Financial scenarios" address={d.address}>
      <SectionHead
        record={d.recordPage}
        id="finance"
        number={n}
        eyebrow="Financial scenarios"
        title="The numbers, three ways"
        lede={`Every calculator at ${$(price)}, ${priceSource}. Each table changes the figure that matters most (down payment, interest rate, amortization, term, income, commission) so you can compare options. The highlighted column is ${usingSaved ? "your figure from the Calculators tab" : "the base case"}.`}
      />
      <View
        style={{
          backgroundColor: usingSaved ? tint(C.good, 0.07) : C.wash,
          padding: 9,
          marginBottom: 12,
        }}
      >
        <Text
          style={[s.small, { fontWeight: 600, color: C.ink, marginBottom: 2 }]}
        >
          {usingSaved
            ? `Using your calculator figures${savedOn ? ` (saved ${savedOn})` : ""}`
            : "Base case used throughout"}
        </Text>
        <Text style={s.small}>
          {$(price)} · {downText} down · {rateLine} · property tax{" "}
          {pct(taxRate, 3)} a year
          {purchase.firstTimeBuyer ? " · first-time buyer" : ""}
          {toronto ? " · Toronto land transfer tax included" : ""}
          {condoFees ? ` · condo fees ${$(condoFees)}/month` : ""} · commission{" "}
          {pct(commTotal)} total.{" "}
          {usingSaved
            ? "Change them in the app's Calculators tab; the PDF follows."
            : "Change any of these in the app's Calculators tab: they save to the report and appear here."}
        </Text>
      </View>

      <Group title="Buying" icon={HandCoinsIcon} first>
        <ScenarioTable
          title="Mortgage by down payment"
          icon={CalculatorIcon}
          assumptions={`${$(price)} at ${rateLine}, monthly payments. Under 20% down needs mortgage insurance, added to the mortgage.`}
          columns={cols(downs, "Down payment", downLabel(price), downSaved)}
          highlight={downs.hi}
          rows={[
            {
              label: "Mortgage insurance",
              values: byDown.map((m) =>
                !m.ins.required
                  ? "Not needed"
                  : m.ins.available
                    ? `${$(m.ins.premium)} (${pct(m.ins.rate)})`
                    : "Not available",
              ),
            },
            {
              label: "PST on insurance (cash at closing)",
              values: byDown.map((m) => $(m.ins.pst)),
              muted: true,
            },
            { label: "Mortgage", values: byDown.map((m) => $(m.loan)) },
            {
              label: "Monthly payment",
              values: byDown.map((m) => $2(m.run.payment)),
              strong: true,
            },
            {
              label: `Interest in the first ${termYears} years`,
              values: byDown.map((m) => $(m.run.term?.interest ?? 0)),
            },
            {
              label: `Total interest over ${amortization} years`,
              values: byDown.map((m) => $(m.run.totalInterest)),
              muted: true,
            },
          ]}
        />
        <ScenarioTable
          title="Mortgage by interest rate"
          icon={CalculatorIcon}
          assumptions={`${$(price)} with ${downText} down, ${amortization}-yr amortization, ${termYears}-yr ${rateType} term.`}
          columns={cols(rates, "Rate", (r) => pct(r), rateSaved)}
          highlight={rates.hi}
          rows={[
            {
              label: "Monthly payment",
              values: byRate.map((m) => $2(m.run.payment)),
              strong: true,
            },
            {
              label: "Difference per month",
              values: byRate.map((m, i) =>
                i === rates.hi
                  ? "—"
                  : signed(m.run.payment - byRate[rates.hi].run.payment),
              ),
              muted: true,
            },
            {
              label: `Interest in the first ${termYears} years`,
              values: byRate.map((m) => $(m.run.term?.interest ?? 0)),
            },
            {
              label: `Balance after ${termYears} years`,
              values: byRate.map((m) => $(m.run.term?.balance ?? 0)),
            },
            {
              label: `Total interest over ${amortization} years`,
              values: byRate.map((m) => $(m.run.totalInterest)),
              muted: true,
            },
          ]}
        />
        <ScenarioTable
          title="Mortgage by amortization"
          icon={CalculatorIcon}
          assumptions={`${$(price)} with ${downText} down at ${pct(rate)}. A longer amortization lowers the payment but costs more interest.`}
          columns={cols(
            amorts,
            "Amortization",
            (y) => `${y} years`,
            amortSaved,
          )}
          highlight={amorts.hi}
          rows={[
            {
              label: "Monthly payment",
              values: byAmort.map((m) => $2(m.run.payment)),
              strong: true,
            },
            {
              label: `Interest in the first ${termYears} years`,
              values: byAmort.map((m) => $(m.run.term?.interest ?? 0)),
            },
            {
              label: `Balance after ${termYears} years`,
              values: byAmort.map((m) => $(m.run.term?.balance ?? 0)),
            },
            {
              label: "Total interest",
              values: byAmort.map((m) => $(m.run.totalInterest)),
            },
            ...(insuredAt30Blocked
              ? [
                  {
                    label: "Insured 30-year (under 20% down)",
                    values: byAmort.map((m, i) =>
                      m.ins.required && amorts.values[i] > 25
                        ? "First-time/new build only"
                        : "Allowed",
                    ),
                    muted: true,
                  },
                ]
              : []),
          ]}
        />
        <ScenarioTable
          title="Mortgage by term"
          icon={CalculatorIcon}
          assumptions={`Same payment (${$2(byTerm[0].run.payment)}/month at ${pct(rate)}); the term sets when the rate is renegotiated and what's left to renew.`}
          columns={cols(terms, "Term", (t) => `${t} years`, termSaved)}
          highlight={terms.hi}
          rows={[
            {
              label: "Interest paid during the term",
              values: byTerm.map((m) => $(m.run.term?.interest ?? 0)),
            },
            {
              label: "Principal paid during the term",
              values: byTerm.map((m) => $(m.loan - (m.run.term?.balance ?? 0))),
            },
            {
              label: "Balance to renew",
              values: byTerm.map((m) => $(m.run.term?.balance ?? 0)),
              strong: true,
            },
          ]}
        />
        <ScenarioTable
          title="Closing costs by down payment"
          icon={ReceiptTextIcon}
          assumptions={`${$(price)}; legal ${$(cl.legalFees)} + HST, title ${$(cl.titleInsurance)}, inspection ${$(cl.homeInspection)}${purchase.firstTimeBuyer ? "; first-time buyer rebates" : ""}.`}
          columns={cols(downs, "Down payment", downLabel(price), downSaved)}
          highlight={downs.hi}
          rows={[
            {
              label: toronto
                ? "Land transfer tax (Ontario + Toronto)"
                : "Land transfer tax",
              values: closing.map((c) => $(c.ltt.total)),
            },
            {
              label: "Legal fees with HST",
              values: closing.map((c) =>
                $(
                  c.lines
                    .filter((l) => l.id === "legal" || l.id === "legalHst")
                    .reduce((a, l) => a + l.amount, 0),
                ),
              ),
            },
            {
              label: "Title, inspection and appraisal",
              values: closing.map((c) =>
                $(
                  c.lines
                    .filter(
                      (l) =>
                        l.id === "title" ||
                        l.id === "inspection" ||
                        l.id === "appraisal",
                    )
                    .reduce((a, l) => a + l.amount, 0),
                ),
              ),
            },
            ...(condo
              ? [
                  {
                    label: "Status certificate",
                    values: closing.map((c) =>
                      $(c.lines.find((l) => l.id === "status")?.amount ?? 0),
                    ),
                  },
                ]
              : []),
            ...(closing.some((c) => c.lines.some((l) => l.id === "pst"))
              ? [
                  {
                    label: "PST on mortgage insurance",
                    values: closing.map((c) =>
                      $(c.lines.find((l) => l.id === "pst")?.amount ?? 0),
                    ),
                  },
                ]
              : []),
            {
              label: "Moving, adjustments and other",
              values: closing.map(() =>
                $(cl.moving + cl.adjustments + cl.other),
              ),
            },
            {
              label: "Closing costs",
              values: closing.map((c) => $(c.closingCosts)),
              strong: true,
            },
            {
              label: "Down payment",
              values: closing.map((c) => $(c.downPayment)),
            },
            {
              label: "Cash needed on closing",
              values: closing.map((c) => $(c.cashToClose)),
              strong: true,
            },
          ]}
        />
        <ScenarioTable
          title="Land transfer tax by buyer"
          icon={LandmarkIcon}
          assumptions={`At ${$(price)}. ${toronto ? "Ontario plus Toronto's municipal tax." : "Ontario land transfer tax (no municipal tax outside Toronto)."} Non-residents pay the 25% speculation tax${toronto ? " plus Toronto's 10%" : ""}.`}
          columns={buyers.map((b) => ({ label: b.label }))}
          highlight={buyerHi}
          rows={[
            {
              label: "Ontario",
              values: buyers.map((b) => $(b.t.provincial)),
            },
            {
              label: "Ontario first-time rebate",
              values: buyers.map((b) =>
                b.t.provincialRebate ? `−${$(b.t.provincialRebate)}` : "—",
              ),
              muted: true,
            },
            ...(toronto
              ? [
                  {
                    label: "Toronto",
                    values: buyers.map((b) => $(b.t.municipal)),
                  },
                  {
                    label: "Toronto first-time rebate",
                    values: buyers.map((b) =>
                      b.t.municipalRebate ? `−${$(b.t.municipalRebate)}` : "—",
                    ),
                    muted: true,
                  },
                ]
              : []),
            {
              label: "Non-resident speculation tax",
              values: buyers.map((b) =>
                b.t.nonResident ? $(b.t.nonResident) : "—",
              ),
            },
            {
              label: "Total",
              values: buyers.map((b) => $(b.t.total)),
              strong: true,
            },
          ]}
        />
        <ScenarioTable
          title="Affordability by income"
          icon={HandCoinsIcon}
          assumptions={`With ${$(baseDown)} down, ${$(afford.debts)}/month other debts, stress-tested at ${pct(qualifyingRate(rate))}.`}
          columns={cols(incomes, "Income", (i) => $(i), incomeSaved)}
          highlight={incomes.hi}
          rows={[
            {
              label: "Maximum price",
              values: afford3.map((a) => $(a.price)),
              strong: true,
            },
            { label: "Mortgage", values: afford3.map((a) => $(a.loan)) },
            {
              label: "Monthly payment",
              values: afford3.map((a) => $(a.contractPayment)),
            },
            {
              label: "Limited by",
              values: afford3.map((a) =>
                a.bindingLimit ? LIMIT[a.bindingLimit] : "—",
              ),
              muted: true,
            },
            {
              label: `This home (${$(price)})`,
              values: afford3.map((a) =>
                a.price >= price
                  ? "Within budget"
                  : `Over by ${$(price - a.price)}`,
              ),
            },
          ]}
        />
      </Group>

      <Group title="Owning" icon={WalletCardsIcon}>
        <ScenarioTable
          title="Monthly cost of owning by interest rate"
          icon={WalletCardsIcon}
          assumptions={`${$(price)} with ${downText} down, ${amortization}-yr amortization; insurance ${$(own.insurance)}, utilities ${$(own.utilities)}/month, ${pct(own.maintenanceRate)} maintenance.`}
          columns={cols(rates, "Rate", (r) => pct(r), rateSaved)}
          highlight={rates.hi}
          rows={[
            { label: "Mortgage", values: owning.map((o) => $(o.mortgage)) },
            {
              label: "Property tax",
              values: owning.map((o) => $(item(o, "tax"))),
            },
            {
              label: "Home insurance",
              values: owning.map((o) => $(item(o, "insurance"))),
            },
            {
              label: "Utilities",
              values: owning.map((o) => $(item(o, "utilities"))),
            },
            ...(condoFees
              ? [
                  {
                    label: "Condo fees",
                    values: owning.map((o) => $(item(o, "condo"))),
                  },
                ]
              : []),
            {
              label: "Maintenance reserve",
              values: owning.map((o) => $(item(o, "maintenance"))),
            },
            ...(own.other
              ? [
                  {
                    label: "Other",
                    values: owning.map((o) => $(item(o, "other"))),
                  },
                ]
              : []),
            {
              label: "Total per month",
              values: owning.map((o) => $(o.monthly)),
              strong: true,
            },
            {
              label: "Of which builds equity",
              values: owning.map((o) => $(o.equityMonthly)),
              muted: true,
            },
          ]}
        />
        <ScenarioTable
          title="Property tax by assessed value"
          icon={BuildingIcon}
          assumptions={`${taxName} ${tx.municipality === CUSTOM_MUNICIPALITY ? "" : `${PROPERTY_TAX_RATES_YEAR} `}rate of ${pct(taxRateFor, 4)}. Tax is on the MPAC assessed value, still based on 2016 values and often well below today's price: check the owner's assessment notice.`}
          columns={cols(assessed, "Assessed at", (v) => $(v), assessedSaved)}
          highlight={assessed.hi}
          rows={[
            {
              label: "Annual property tax",
              values: assessed.values.map((v) => $(v * taxRateFor)),
              strong: true,
            },
            {
              label: "Monthly",
              values: assessed.values.map((v) => $((v * taxRateFor) / 12)),
            },
          ]}
        />
        <ScenarioTable
          title="Prepaying the mortgage"
          icon={TrendingDownIcon}
          assumptions={`A ${$(prepayBalance)} mortgage at ${pct(prepayRate)}, ${prepayYears} years left.`}
          columns={prepayPlans.map((p) => ({ label: p.label, value: p.value }))}
          highlight={savedPrepay && planLabel ? 0 : undefined}
          rows={[
            {
              label: "Interest saved",
              values: prepayPlans.map((p) => $(p.r.interestSaved)),
              strong: true,
            },
            {
              label: "Time saved",
              values: prepayPlans.map((p) => yrs(p.r.monthsSaved)),
            },
            {
              label: "Mortgage-free in",
              values: prepayPlans.map((p) => yrs(p.r.newMonths)),
            },
          ]}
        />
        <ScenarioTable
          title="Renewal by new rate"
          icon={RefreshCcwIcon}
          assumptions={`Renewing ${$(rf.balance)} from ${pct(rf.currentRate)}, ${rf.remainingYears} years left (no penalty at maturity).`}
          columns={cols(renewRates, "New rate", (r) => pct(r), savedRefi)}
          highlight={renewRates.hi}
          rows={[
            {
              label: "Current payment",
              values: renewRates.values.map(() => $(currentPayment)),
              muted: true,
            },
            { label: "New payment", values: renewPayments.map((p) => $(p)) },
            {
              label: "Monthly savings",
              values: renewPayments.map((p) => signed(currentPayment - p)),
              strong: true,
            },
            {
              label: "Savings over a 5-year term",
              values: renewPayments.map((p) =>
                signed((currentPayment - p) * 60),
              ),
            },
          ]}
        />
      </Group>

      <Group title="Selling" icon={HouseIcon}>
        <ScenarioTable
          title="Seller net by commission"
          icon={HouseIcon}
          assumptions={`Selling at ${$(sl.salePrice)}, commission + HST, a ${$(sl.mortgageBalance)} mortgage${sl.monthsLeftInTerm && !sl.portingMortgage ? `, broken with ${sl.monthsLeftInTerm} months left` : " paid off at term end"}.`}
          columns={cols(
            commTotals,
            "Total commission",
            (c) => pct(c),
            commSaved,
          )}
          highlight={commTotals.hi}
          rows={[
            {
              label: "Commission with HST",
              values: selling.map((r) => $(r.commission)),
            },
            {
              label: "Mortgage payout",
              values: selling.map((r) => $(line(r, "mortgage"))),
              muted: true,
            },
            ...(selling[0].penalty.penalty
              ? [
                  {
                    label: "Prepayment penalty",
                    values: selling.map((r) => $(r.penalty.penalty)),
                  },
                ]
              : []),
            {
              label: "Legal fees with HST",
              values: selling.map((r) =>
                $(line(r, "legal") + line(r, "legalHst")),
              ),
            },
            {
              label: "Discharge, staging, moving, other",
              values: selling.map((r) =>
                $(
                  line(r, "discharge") +
                    line(r, "staging") +
                    line(r, "moving") +
                    line(r, "other"),
                ),
              ),
            },
            {
              label: "Selling costs",
              values: selling.map(
                (r) => `${$(r.sellingCosts)} (${pct(r.sellingCostShare, 1)})`,
              ),
            },
            {
              label: "Net proceeds",
              values: selling.map((r) => $(r.net)),
              strong: true,
            },
          ]}
        />
        <ScenarioTable
          title="Bridge financing by overlap"
          icon={ArrowLeftRightIcon}
          assumptions={`A ${$(br.bridgeAmount)} bridge at ${pct(br.bridgeRate)}, ${$(br.adminFee)} admin fee; carrying the current home at ${$(br.currentHomeMonthly)}/month.`}
          columns={cols(days, "Overlap", (x) => `${x} days`, savedBridge)}
          highlight={days.hi}
          rows={[
            {
              label: "Bridge interest",
              values: bridges.map((b) => $(b.interest)),
            },
            {
              label: "Admin and legal fees",
              values: bridges.map((b) => $(br.adminFee + b.legal)),
            },
            {
              label: "Carrying the current home",
              values: bridges.map((b) => $(b.extraCarrying)),
            },
            {
              label: "Total extra cost",
              values: bridges.map((b) => $(b.totalExtra)),
              strong: true,
            },
          ]}
        />
      </Group>

      <Group title="Investing" icon={ScaleIcon}>
        <ScenarioTable
          title="As a rental, by down payment"
          icon={BuildingIcon}
          assumptions={`${$(rt.price)} rented at ${$(rt.rent)}/month${rentIsExample ? " (example)" : " (your figure)"}, ${pct(rt.rate)} rate, ${pct(rt.vacancy, 0)} vacancy, ${pct(rt.maintenance, 0)} maintenance${rt.management ? `, ${pct(rt.management, 0)} management` : ", self-managed"}. Rentals usually need 20% down.`}
          columns={cols(
            rentalDowns,
            "Down payment",
            downLabel(rt.price),
            rentalDownSaved,
          )}
          highlight={rentalDowns.hi}
          rows={[
            {
              label: "Mortgage per month",
              values: rentals.map((r) => $(r.mortgageMonthly)),
            },
            {
              label: "Monthly cash flow",
              values: rentals.map((r) => signed(r.cashFlowMonthly)),
              strong: true,
            },
            { label: "Cap rate", values: rentals.map((r) => pct(r.capRate)) },
            {
              label: "Cash-on-cash return",
              values: rentals.map((r) => pct(r.cashOnCash)),
            },
            {
              label: "Debt coverage (lenders want 1.2×)",
              values: rentals.map((r) =>
                r.dscr != null ? `${r.dscr.toFixed(2)}×` : "—",
              ),
            },
            {
              label: "Break-even rent",
              values: rentals.map((r) =>
                r.breakEvenRent != null ? $(r.breakEvenRent) : "—",
              ),
              muted: true,
            },
            {
              label: "Cash invested",
              values: rentals.map((r) => $(r.cashInvested)),
              muted: true,
            },
          ]}
        />
        <ScenarioTable
          title="Rent vs buy by value growth"
          icon={ScaleIcon}
          assumptions={`Over ${rv.years} years at ${$(price)}: rent ${$(rv.rentMonthly)}/month (+${pct(rv.rentIncrease, 1)}/yr), ${pct(rv.investmentReturn, 1)} investment return. Not a forecast: growth is shown three ways because no one can promise it.`}
          columns={cols(
            growth,
            "Value growth",
            (g) => `${pct(g, 1)}/yr`,
            growthSaved,
          )}
          highlight={growth.hi}
          rows={[
            {
              label: "Owning, first month",
              values: rvb.map((r) => $(r.firstOwnerMonthly)),
              muted: true,
            },
            {
              label: "Net worth if buying",
              values: rvb.map((r) => $(r.buyNetWorth)),
            },
            {
              label: "Net worth if renting",
              values: rvb.map((r) => $(r.rentNetWorth)),
            },
            {
              label: "Comes out ahead",
              values: rvb.map(
                (r) =>
                  `${r.advantage >= 0 ? "Buy" : "Rent"} ${$(Math.abs(r.advantage))}`,
              ),
              strong: true,
            },
            {
              label: "Buying pulls ahead in",
              values: rvb.map((r) =>
                r.breakEvenYear
                  ? `Year ${r.breakEvenYear}`
                  : `Not within ${rv.years} yrs`,
              ),
              muted: true,
            },
          ]}
        />
      </Group>

      <Group title="Agent" icon={BadgeDollarSignIcon}>
        <ScenarioTable
          title={flat ? "Commission by rate" : "Commission by split"}
          icon={BadgeDollarSignIcon}
          assumptions={`Selling at ${$(comm.salePrice)}, ${commLine}${comm.referralFee ? `, ${pct(comm.referralFee, 0)} referral` : ""}${comm.transactionFee ? `, ${$(comm.transactionFee)} transaction fee` : ""}.`}
          columns={cols(
            commVar,
            flat ? "Rate" : "Split",
            (v) => pct(v, flat ? 2 : 0),
            commVarSaved,
          )}
          highlight={commVar.hi}
          rows={[
            {
              label: "Gross commission",
              values: commissions.map((c) => $(c.gross)),
            },
            {
              label: "HST collected (not income)",
              values: commissions.map((c) => $(c.hst)),
              muted: true,
            },
            ...(comm.referralFee
              ? [
                  {
                    label: "Referral fee",
                    values: commissions.map((c) => $(c.referral)),
                  },
                ]
              : []),
            {
              label: "Brokerage share",
              values: commissions.map((c) => $(c.brokerage)),
            },
            ...(comm.transactionFee
              ? [
                  {
                    label: "Transaction fee",
                    values: commissions.map((c) => $(c.transactionFee)),
                  },
                ]
              : []),
            {
              label: "Your take-home",
              values: commissions.map((c) => $(c.net)),
              strong: true,
            },
          ]}
        />
      </Group>
      <Note>
        Estimates for discussion, not financial or legal advice. Lenders,
        insurers and lawyers confirm final figures.
      </Note>
    </ReportPage>
  );
}

"use client";

import { CalculatorIcon, ArrowRightIcon, WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { incomeToQualify } from "@/lib/finance/affordability";
import { buyerClosingCosts } from "@/lib/finance/closing";
import { ownershipCost } from "@/lib/finance/ownership";
import {
  defaultInputs,
  hasSavedInputs,
  mergeInputs,
  savedCalculatorsSchema,
} from "@/lib/finance/scenario";
import { SECTION_KEYS } from "@/lib/report-sections";
import { formatPrice } from "@/components/globals/report/report-format";
import { getSection } from "@/components/globals/report/report-hooks";
import {
  type CompareProperty,
  SideChip,
  type Side,
  SIDES,
  winner,
} from "./compare-shared";
import { type CompareRow, CompareTable } from "./compare-table";

/**
 * The numbers the Calculators tab starts from for one property: its list
 * price (else an example), town and province, with the agent's saved
 * changes laid over them.
 */
function scenario(p: CompareProperty) {
  const saved = getSection(
    p.report,
    SECTION_KEYS.calculators,
    savedCalculatorsSchema,
  );
  const inp = mergeInputs(
    defaultInputs({
      listPrice: p.data.listing?.listPrice ?? null,
      city: p.report.property?.city ?? null,
      province: p.report.property?.province ?? null,
      propertyType: p.data.listing?.propertyType ?? null,
    }),
    saved,
  );
  const { purchase, afford, closing: cl, own } = inp;
  const owning = ownershipCost({
    price: purchase.price,
    downPayment: purchase.downPayment,
    rate: purchase.rate,
    rateType: purchase.rateType,
    amortizationYears: purchase.amortization,
    propertyTaxRate: afford.taxRate,
    insuranceMonthly: own.insurance,
    utilitiesMonthly: own.utilities,
    condoFeesMonthly: afford.condoFees,
    maintenanceRate: own.maintenanceRate,
    otherMonthly: own.other,
  });
  const closing = buyerClosingCosts({
    price: purchase.price,
    downPayment: purchase.downPayment,
    amortizationYears: purchase.amortization,
    province: purchase.province,
    toronto: purchase.toronto,
    montreal: purchase.montreal,
    firstTimeBuyer: purchase.firstTimeBuyer,
    singleFamily: purchase.singleFamily,
    nonResident: purchase.nonResident,
    condo: cl.condo,
    legalFees: cl.legalFees,
    titleInsurance: cl.titleInsurance,
    homeInspection: cl.homeInspection,
    appraisal: cl.appraisal,
    adjustments: cl.adjustments,
    moving: cl.moving,
    other: cl.other,
  });
  const income = incomeToQualify({
    price: purchase.price,
    annualRate: purchase.rate,
    amortizationYears: purchase.amortization,
    propertyTaxRate: afford.taxRate,
    heatingMonthly: afford.heating,
  });
  return {
    purchase,
    owning,
    closing,
    income,
    source:
      saved?.purchase?.price != null
        ? "Your figure"
        : p.data.listing?.listPrice
          ? "List price"
          : "Example price (no list price yet)",
    saved: hasSavedInputs(saved),
  };
}

const money = (v: number) => formatPrice(Math.round(v));

export function CompareCalculators({
  a,
  b,
  onOpen,
}: {
  a: CompareProperty;
  b: CompareProperty;
  /** Opens one property's own Calculators tab. */
  onOpen: (side: Side) => void;
}) {
  const s = { a: scenario(a), b: scenario(b) };
  const row = (
    id: string,
    label: string,
    get: (x: ReturnType<typeof scenario>) => number | null,
    opts: {
      hint?: string;
      sub?: (x: ReturnType<typeof scenario>) => string;
      lowerWins?: boolean;
    } = {},
  ): CompareRow => {
    const va = get(s.a);
    const vb = get(s.b);
    return {
      id,
      label,
      hint: opts.hint,
      a: va != null ? { value: money(va), sub: opts.sub?.(s.a) } : null,
      b: vb != null ? { value: money(vb), sub: opts.sub?.(s.b) } : null,
      winner: opts.lowerWins
        ? winner(va, vb, { higher: false, tolerance: 1 })
        : null,
    };
  };
  const item = (x: ReturnType<typeof scenario>, id: string) =>
    x.owning.items.find((i) => i.id === id)?.amount ?? null;

  const buying: CompareRow[] = [
    row("price", "Purchase price", (x) => x.purchase.price, {
      sub: (x) => x.source,
      lowerWins: true,
    }),
    row("down", "Down payment", (x) => x.purchase.downPayment, {
      sub: (x) =>
        `${Math.round((x.purchase.downPayment / Math.max(1, x.purchase.price)) * 100)}% down`,
    }),
    row("loan", "Mortgage", (x) => x.owning.loan, {
      sub: (x) =>
        `${(x.purchase.rate * 100).toFixed(2)}% · ${x.purchase.amortization} years`,
      lowerWins: true,
    }),
    row("ltt", "Land transfer tax", (x) => x.closing.ltt.total, {
      sub: (x) => x.closing.ltt.label,
      lowerWins: true,
    }),
    row("closing", "Closing costs", (x) => x.closing.closingCosts, {
      hint: "Tax, legal, inspection, moving…",
      lowerWins: true,
    }),
    row("cash", "Cash to close", (x) => x.closing.cashToClose, {
      hint: "Down payment plus closing costs",
      lowerWins: true,
    }),
    row("income", "Income to qualify", (x) => x.income, {
      hint: "20% down, stress-tested rate",
      lowerWins: true,
    }),
  ];
  const monthly: CompareRow[] = [
    row("mortgage", "Mortgage payment", (x) => item(x, "mortgage"), {
      lowerWins: true,
    }),
    row("tax", "Property tax", (x) => item(x, "tax"), { lowerWins: true }),
    row("insurance", "Home insurance", (x) => item(x, "insurance")),
    row("utilities", "Utilities", (x) => item(x, "utilities")),
    row("condo", "Condo fees", (x) => item(x, "condo")),
    row("maintenance", "Maintenance reserve", (x) => item(x, "maintenance")),
    row("total", "Total per month", (x) => x.owning.monthly, {
      sub: (x) =>
        `${money(x.owning.trueCostMonthly)} without the equity you build`,
      lowerWins: true,
    }),
  ];

  return (
    <div className="space-y-4">
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <CompareTable
          title="Buying"
          icon={WalletIcon}
          a={a}
          b={b}
          rows={buying}
        />
        <CompareTable
          title="Owning, per month"
          icon={CalculatorIcon}
          a={a}
          b={b}
          rows={monthly}
          footer="Each property uses its own Calculators inputs: list price, rate and down payment, or the figures you saved there."
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-foreground/60">Change the numbers:</span>
        {SIDES.map((side) => (
          <Button
            key={side}
            variant="outline"
            size="sm"
            onClick={() => onOpen(side)}
            className="bg-card"
          >
            <SideChip side={side} className="size-4 text-[10px]" />
            {(side === "a" ? a : b).street} calculators
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        ))}
      </div>
    </div>
  );
}

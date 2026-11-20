"use client";

import { GaugeIcon } from "lucide-react";
import { maxAffordable } from "@/lib/finance/affordability";
import { minDownPayment } from "@/lib/finance/mortgage";
import { QUALIFYING } from "@/lib/finance/ontario-rules";
import {
  BigResult,
  CalcLayout,
  MoneyField,
  Notice,
  Panel,
  PercentField,
  pct,
  RatioBar,
  SelectField,
  StatGrid,
  money,
} from "./calc-ui";
import type { AffordState, PurchaseState } from "./calculators-tab";

const LIMIT_TEXT = {
  "down-payment":
    "your down payment (the minimum is 5% of the first $500K and 10% above that, or 20% at $1.5M and up)",
  gds: "housing costs (GDS): the payment, property tax, heating and half of condo fees can't pass 39% of income",
  tds: "total debts (TDS): housing costs plus other debt payments can't pass 44% of income",
  insurance:
    "mortgage insurance: under 20% down, insured mortgages stop at $1.5M",
} as const;

export function AffordabilityCalculator({
  purchase,
  setPurchase,
  state,
  set,
  listPrice,
}: {
  purchase: PurchaseState;
  setPurchase: (patch: Partial<PurchaseState>) => void;
  state: AffordState;
  set: (patch: Partial<AffordState>) => void;
  listPrice: number | null;
}) {
  const r = maxAffordable({
    annualIncome: state.income,
    monthlyDebts: state.debts,
    downPayment: purchase.downPayment,
    annualRate: purchase.rate,
    amortizationYears: purchase.amortization,
    propertyTaxRate: state.taxRate,
    heatingMonthly: state.heating,
    condoFeesMonthly: state.condoFees,
  });
  const fits = listPrice != null ? r.price >= listPrice : null;
  const neededDown = listPrice != null ? minDownPayment(listPrice) : null;

  return (
    <CalcLayout
      inputs={
        <>
          <MoneyField
            label="Household income (before tax, per year)"
            value={state.income}
            onChange={(v) => set({ income: v })}
          />
          <MoneyField
            label="Other debt payments (per month)"
            value={state.debts}
            onChange={(v) => set({ debts: v })}
            hint="Car loans, minimum card and line-of-credit payments."
          />
          <MoneyField
            label="Down payment saved"
            value={purchase.downPayment}
            onChange={(v) => setPurchase({ downPayment: v })}
          />
          <div className="grid grid-cols-2 gap-4">
            <PercentField
              label="Interest rate"
              value={purchase.rate}
              onChange={(v) => setPurchase({ rate: v })}
            />
            <SelectField
              label="Amortization"
              value={purchase.amortization}
              onChange={(v) => setPurchase({ amortization: v })}
              options={[25, 30].map((a) => ({ value: a, label: `${a} years` }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <PercentField
              label="Property tax (of price, per year)"
              value={state.taxRate}
              onChange={(v) => set({ taxRate: v })}
              max={5}
            />
            <MoneyField
              label="Heating (per month)"
              value={state.heating}
              onChange={(v) => set({ heating: v })}
            />
          </div>
          <MoneyField
            label="Condo fees (per month)"
            value={state.condoFees}
            onChange={(v) => set({ condoFees: v })}
            hint="Lenders count half."
          />
        </>
      }
      results={
        <>
          <BigResult
            label="Maximum purchase price"
            value={money(r.price)}
            caption={
              <>
                With {money(purchase.downPayment)} down. Qualified at{" "}
                {pct(r.qualifyingRate)}, the stress-test rate (the higher of{" "}
                {pct(QUALIFYING.floorRate)} or your rate + 2%).
              </>
            }
          />
          {listPrice != null ? (
            <Notice tone={fits ? "info" : "warn"}>
              {fits
                ? `This home's list price (${money(listPrice)}) is within budget, with ${money(r.price - listPrice)} to spare.`
                : `This home's list price (${money(listPrice)}) is ${money(listPrice - r.price)} over budget.${
                    neededDown != null && purchase.downPayment < neededDown
                      ? ` It needs at least ${money(neededDown)} down.`
                      : ""
                  }`}
            </Notice>
          ) : null}
          <StatGrid
            items={[
              {
                label: "Mortgage",
                value: money(r.loan),
                hint: r.insured ? "Includes insurance" : undefined,
              },
              {
                label: "Monthly payment",
                value: money(r.contractPayment),
                hint: `At ${pct(purchase.rate)}`,
              },
              {
                label: "Qualifying payment",
                value: money(r.qualifyingPayment),
                hint: `At ${pct(r.qualifyingRate)}`,
              },
              {
                label: "Monthly housing costs",
                value: money(r.housingCosts),
                hint: "Tax, heat, ½ condo fees",
              },
              { label: "Monthly income", value: money(state.income / 12) },
              {
                label: "Down payment",
                value:
                  r.price > 0 ? pct(purchase.downPayment / r.price, 1) : "—",
                hint: "Of the maximum price",
              },
            ]}
          />
          <Panel title="How lenders check it" icon={GaugeIcon}>
            <div className="space-y-5">
              <RatioBar
                label="Housing costs (GDS)"
                value={r.gds}
                limit={QUALIFYING.maxGds}
                description="Qualifying payment, property tax, heating and half of condo fees, over gross income."
              />
              <RatioBar
                label="Total debt (TDS)"
                value={r.tds}
                limit={QUALIFYING.maxTds}
                description="Housing costs plus other debt payments, over gross income."
              />
            </div>
            {r.bindingLimit ? (
              <p className="mt-4 text-sm">
                <span className="font-semibold">What limits the price: </span>
                {LIMIT_TEXT[r.bindingLimit]}.
              </p>
            ) : null}
          </Panel>
        </>
      }
    />
  );
}

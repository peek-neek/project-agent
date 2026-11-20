"use client";

import { ScaleIcon } from "lucide-react";
import { FREQUENCIES } from "@/lib/finance/mortgage";
import { refinance } from "@/lib/finance/refinance";
import {
  BigResult,
  Breakdown,
  CalcLayout,
  ListPriceHint,
  MoneyField,
  Notice,
  Panel,
  PercentField,
  Segmented,
  SelectField,
  StatGrid,
  money,
} from "./calc-ui";
import type { RefiState } from "./calculators-tab";

export function RefinanceCalculator({
  state,
  set,
  listPrice,
  onUseListPrice,
}: {
  state: RefiState;
  set: (patch: Partial<RefiState>) => void;
  listPrice: number | null;
  onUseListPrice: () => void;
}) {
  const r = refinance({ ...state, frequency: "monthly" });
  const saving = r.monthlySaving;
  const renewing = state.monthsLeftInTerm === 0;

  return (
    <CalcLayout
      inputs={
        <>
          <MoneyField
            label="Home value today"
            value={state.homeValue}
            onChange={(v) => set({ homeValue: v })}
            hint={
              <ListPriceHint
                value={state.homeValue}
                listPrice={listPrice}
                onUse={onUseListPrice}
              />
            }
          />
          <MoneyField
            label="Mortgage balance"
            value={state.balance}
            onChange={(v) => set({ balance: v })}
          />
          <div className="grid grid-cols-2 gap-4">
            <PercentField
              label="Current rate"
              value={state.currentRate}
              onChange={(v) => set({ currentRate: v })}
            />
            <SelectField
              label="Amortization left"
              value={state.remainingYears}
              onChange={(v) => set({ remainingYears: v })}
              options={Array.from({ length: 30 }, (_, i) => i + 1).map((y) => ({
                value: y,
                label: `${y} year${y === 1 ? "" : "s"}`,
              }))}
            />
          </div>
          <Segmented
            label="Current rate type"
            value={state.currentRateType}
            onChange={(v) => set({ currentRateType: v })}
            options={[
              { value: "fixed", label: "Fixed" },
              { value: "variable", label: "Variable" },
            ]}
          />
          <SelectField
            label="Time left in the current term"
            value={state.monthsLeftInTerm}
            onChange={(v) => set({ monthsLeftInTerm: v })}
            options={[0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60].map((m) => ({
              value: m,
              label: m === 0 ? "Renewing now (no penalty)" : `${m} months`,
            }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <PercentField
              label="New rate"
              value={state.newRate}
              onChange={(v) => set({ newRate: v })}
            />
            <SelectField
              label="New amortization"
              value={state.newAmortizationYears}
              onChange={(v) => set({ newAmortizationYears: v })}
              options={[10, 15, 20, 25, 30].map((y) => ({
                value: y,
                label: `${y} years`,
              }))}
            />
          </div>
          {!renewing && state.currentRateType === "fixed" ? (
            <PercentField
              label="Lender's rate for the time left (for the penalty)"
              value={state.comparisonRate}
              onChange={(v) => set({ comparisonRate: v })}
              hint="Your lender's posted or discounted rate for a term like the one remaining."
            />
          ) : null}
          <div className="grid grid-cols-2 gap-4">
            <MoneyField
              label="Cash to take out"
              value={state.cashOut}
              onChange={(v) => set({ cashOut: v })}
            />
            <MoneyField
              label="Fees"
              value={state.fees}
              onChange={(v) => set({ fees: v })}
              hint="Legal, appraisal, discharge."
            />
          </div>
        </>
      }
      results={
        <>
          <BigResult
            label="Monthly savings at the new rate"
            value={money(Math.abs(saving))}
            tone={saving >= 0 ? "good" : "bad"}
            caption={
              saving >= 0
                ? `Same balance and amortization: ${money(r.currentPayment)} → ${money(r.currentPayment - r.savingPerPayment)} a month.`
                : "The new rate costs more each month than the current one."
            }
          />
          {r.cashOutCapped ? (
            <Notice tone="warn">
              A refinance can borrow up to 80% of the home&apos;s value (
              {money(r.maxLoan)}), so the cash out is capped.
            </Notice>
          ) : null}
          <StatGrid
            items={[
              {
                label: "Penalty to break",
                value: money(r.penalty),
                hint:
                  r.penaltyMethod === "none"
                    ? "None at renewal"
                    : r.penaltyMethod === "ird"
                      ? "Interest rate differential"
                      : "3 months' interest",
              },
              {
                label: "Break-even",
                value:
                  r.breakEvenMonths == null
                    ? "Never"
                    : r.costToSwitch === 0
                      ? "Right away"
                      : `${Math.ceil(r.breakEvenMonths)} months`,
                hint: "Savings to cover penalty and fees",
              },
              {
                label: "Equity available",
                value: money(r.availableEquity),
                hint: "Up to 80% of value",
              },
              { label: "New mortgage", value: money(r.newLoan) },
              {
                label: "New payment",
                value: money(r.newPayment, true),
                hint: `${FREQUENCIES.monthly.label}, ${state.newAmortizationYears} yrs`,
              },
              {
                label: "Current payment",
                value: money(r.currentPayment, true),
              },
            ]}
          />
          <Panel title="Cost to switch" icon={ScaleIcon}>
            <Breakdown
              rows={[
                {
                  label: "3 months' interest",
                  value: money(r.threeMonths),
                  muted: r.penaltyMethod !== "threeMonths",
                },
                ...(state.currentRateType === "fixed" && !renewing
                  ? [
                      {
                        label: "Interest rate differential (estimate)",
                        value: money(r.ird),
                        muted: r.penaltyMethod !== "ird",
                      },
                    ]
                  : []),
                { label: "Fees", value: money(state.fees) },
              ]}
              total={{
                label: "Total cost to switch",
                value: money(r.costToSwitch),
              }}
            />
            <p className="mt-3 text-xs text-foreground/55">
              Fixed-rate penalties are the greater of 3 months&apos; interest
              and the interest rate differential; variable rates pay 3
              months&apos; interest. Lenders calculate the differential
              differently, so confirm the exact figure with them.
            </p>
          </Panel>
        </>
      }
    />
  );
}

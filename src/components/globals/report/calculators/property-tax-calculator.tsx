"use client";

import { LandmarkIcon } from "lucide-react";
import {
  ONTARIO_MEDIAN_TAX_RATE,
  PROPERTY_TAX_RATES,
  PROPERTY_TAX_RATES_YEAR,
} from "@/lib/finance/property-tax-rates";
import {
  BigResult,
  CalcLayout,
  MoneyField,
  Notice,
  Panel,
  PercentField,
  pct,
  SelectField,
  StatGrid,
  money,
} from "./calc-ui";
import type { TaxState } from "./calculators-tab";

const CUSTOM = "__custom";
const MUNICIPALITIES = Object.keys(PROPERTY_TAX_RATES).sort();

export function PropertyTaxCalculator({
  state,
  set,
  price,
}: {
  state: TaxState;
  set: (patch: Partial<TaxState>) => void;
  /** Today's price, to show the tax as a share of it. */
  price: number;
}) {
  const rate =
    state.municipality === CUSTOM
      ? state.customRate
      : (PROPERTY_TAX_RATES[state.municipality] ?? state.customRate);
  const annual = state.assessedValue * rate;
  const vsMedian = rate / ONTARIO_MEDIAN_TAX_RATE - 1;

  return (
    <CalcLayout
      inputs={
        <>
          <SelectField
            label="Municipality"
            value={state.municipality}
            onChange={(v) => set({ municipality: v })}
            options={[
              ...MUNICIPALITIES.map((m) => ({
                value: m,
                label: `${m} (${pct(PROPERTY_TAX_RATES[m], 3)})`,
              })),
              { value: CUSTOM, label: "Other (enter the rate)" },
            ]}
            hint={`${PROPERTY_TAX_RATES_YEAR} residential rate, municipal and education combined.`}
          />
          {state.municipality === CUSTOM ? (
            <PercentField
              label="Tax rate"
              value={state.customRate}
              onChange={(v) => set({ customRate: v })}
              max={5}
              hint="From the municipality's tax rates page."
            />
          ) : null}
          <MoneyField
            label="MPAC assessed value"
            value={state.assessedValue}
            onChange={(v) => set({ assessedValue: v })}
            hint="On the tax bill or MPAC's AboutMyProperty. Still based on 2016 values, so usually below today's price."
          />
        </>
      }
      results={
        <>
          <BigResult
            label="Annual property tax"
            value={money(annual)}
            caption={`${money(annual / 12)} a month, at ${pct(rate, 4)} of the assessed value.`}
          />
          <StatGrid
            items={[
              { label: "Monthly", value: money(annual / 12) },
              {
                label: "Of today's price",
                value: price > 0 ? pct(annual / price, 2) : "—",
                hint: `Price ${money(price)}`,
              },
              {
                label: "Vs Ontario median",
                value: `${vsMedian >= 0 ? "+" : "−"}${pct(Math.abs(vsMedian), 0)}`,
                hint: `Median rate ${pct(ONTARIO_MEDIAN_TAX_RATE, 2)}`,
              },
            ]}
          />
          <Panel title="How it's calculated" icon={LandmarkIcon}>
            <p className="text-sm text-foreground/70">
              Ontario property tax is the MPAC assessed value times the
              municipality&apos;s total rate (its own levy, the region&apos;s
              where there is one, and the provincial education rate).
              Assessments still use January 1, 2016 values until the province
              reassesses, which is why the tax is often well below the rate
              times today&apos;s price.
            </p>
          </Panel>
          <Notice>
            Rates: BMA {PROPERTY_TAX_RATES_YEAR} Municipal Study (Toronto
            matches toronto.ca). New rates are set each spring; the tax bill is
            final.
          </Notice>
        </>
      }
    />
  );
}

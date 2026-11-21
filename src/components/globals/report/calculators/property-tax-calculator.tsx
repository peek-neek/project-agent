"use client";

import { LandmarkIcon } from "lucide-react";
import {
  ONTARIO_MEDIAN_TAX_RATE,
  PROPERTY_TAX_RATES,
  PROPERTY_TAX_RATES_YEAR,
} from "@/lib/finance/property-tax-rates";
import {
  PROVINCE_NAMES,
  type Province,
  TYPICAL_PROPERTY_TAX,
} from "@/lib/finance/provinces";
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
  province,
}: {
  state: TaxState;
  set: (patch: Partial<TaxState>) => void;
  /** Today's price, to show the tax as a share of it. */
  price: number;
  province: Province;
}) {
  // Municipal rates are on file for Ontario; elsewhere the agent enters the
  // rate, starting from a typical one for the province.
  const ontario = province === "ON";
  const rate =
    !ontario || state.municipality === CUSTOM
      ? state.customRate
      : (PROPERTY_TAX_RATES[state.municipality] ?? state.customRate);
  const annual = state.assessedValue * rate;
  const reference = ontario
    ? ONTARIO_MEDIAN_TAX_RATE
    : TYPICAL_PROPERTY_TAX[province];
  const vsMedian = rate / reference - 1;
  const region = PROVINCE_NAMES[province];

  return (
    <CalcLayout
      inputs={
        <>
          {ontario && (
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
          )}
          {!ontario || state.municipality === CUSTOM ? (
            <PercentField
              label="Tax rate"
              value={state.customRate}
              onChange={(v) => set({ customRate: v })}
              max={5}
              hint={
                ontario
                  ? "From the municipality's tax rates page."
                  : `Starts at a typical ${region} rate (${pct(TYPICAL_PROPERTY_TAX[province], 2)}). Enter the municipality's total residential rate.`
              }
            />
          ) : null}
          <MoneyField
            label={ontario ? "MPAC assessed value" : "Assessed value"}
            value={state.assessedValue}
            onChange={(v) => set({ assessedValue: v })}
            hint={
              ontario
                ? "On the tax bill or MPAC's AboutMyProperty. Still based on 2016 values, so usually below today's price."
                : "On the tax bill or the provincial assessment authority's site."
            }
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
                label: ontario ? "Vs Ontario median" : `Vs typical ${province}`,
                value: `${vsMedian >= 0 ? "+" : "−"}${pct(Math.abs(vsMedian), 0)}`,
                hint: `${ontario ? "Median" : "Typical"} rate ${pct(reference, 2)}`,
              },
            ]}
          />
          <Panel title="How it's calculated" icon={LandmarkIcon}>
            {ontario ? (
              <p className="text-sm text-foreground/70">
                Ontario property tax is the MPAC assessed value times the
                municipality&apos;s total rate (its own levy, the region&apos;s
                where there is one, and the provincial education rate).
                Assessments still use January 1, 2016 values until the province
                reassesses, which is why the tax is often well below the rate
                times today&apos;s price.
              </p>
            ) : (
              <p className="text-sm text-foreground/70">
                Property tax is the assessed value times the municipality&apos;s
                total residential rate (municipal levy plus any school or
                provincial portion). Rates are set each year; check the
                municipality&apos;s rates page for this year&apos;s figure.
              </p>
            )}
          </Panel>
          <Notice>
            {ontario
              ? `Rates: BMA ${PROPERTY_TAX_RATES_YEAR} Municipal Study (Toronto matches toronto.ca). New rates are set each spring; the tax bill is final.`
              : `The starting rate is a typical ${region} figure, not this municipality's. The tax bill is final.`}
          </Notice>
        </>
      }
    />
  );
}

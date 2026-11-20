"use client";

import { BuildingIcon, ReceiptTextIcon } from "lucide-react";
import { rentalAnalysis } from "@/lib/finance/investing";
import {
  BigResult,
  Breakdown,
  CalcLayout,
  ListPriceHint,
  MoneyField,
  Notice,
  Panel,
  PercentField,
  pct,
  SelectField,
  StatGrid,
  money,
} from "./calc-ui";
import type { RentalState } from "./calculators-tab";

export function RentalCalculator({
  state,
  set,
  listPrice,
  onUseListPrice,
}: {
  state: RentalState;
  set: (patch: Partial<RentalState>) => void;
  listPrice: number | null;
  onUseListPrice: () => void;
}) {
  const r = rentalAnalysis(state);
  const positive = r.cashFlow >= 0;

  return (
    <CalcLayout
      inputs={
        <>
          <MoneyField
            label="Purchase price"
            value={state.price}
            onChange={(v) => set({ price: v })}
            hint={
              <ListPriceHint
                value={state.price}
                listPrice={listPrice}
                onUse={onUseListPrice}
              />
            }
          />
          <div className="grid grid-cols-2 gap-4">
            <MoneyField
              label="Down payment"
              value={state.downPayment}
              onChange={(v) => set({ downPayment: v })}
              hint={
                state.price > 0
                  ? pct(state.downPayment / state.price, 1)
                  : undefined
              }
            />
            <MoneyField
              label="Closing costs"
              value={state.closingCosts}
              onChange={(v) => set({ closingCosts: v })}
              hint="Tax, legal, inspection"
            />
            <PercentField
              label="Interest rate"
              value={state.rate}
              onChange={(v) => set({ rate: v })}
            />
            <SelectField
              label="Amortization"
              value={state.amortizationYears}
              onChange={(v) => set({ amortizationYears: v })}
              options={[20, 25, 30].map((a) => ({
                value: a,
                label: `${a} years`,
              }))}
            />
            <MoneyField
              label="Rent (per month)"
              value={state.rent}
              onChange={(v) => set({ rent: v })}
              hint="All units"
            />
            <MoneyField
              label="Other income"
              value={state.otherIncome}
              onChange={(v) => set({ otherIncome: v })}
              hint="Parking, laundry"
            />
            <PercentField
              label="Vacancy"
              value={state.vacancy}
              onChange={(v) => set({ vacancy: v })}
              max={50}
              hint="Of rent"
            />
            <PercentField
              label="Property tax"
              value={state.propertyTaxRate}
              onChange={(v) => set({ propertyTaxRate: v })}
              max={5}
              hint="Of price, per year"
            />
            <MoneyField
              label="Insurance (per month)"
              value={state.insuranceMonthly}
              onChange={(v) => set({ insuranceMonthly: v })}
            />
            <MoneyField
              label="Condo fees (per month)"
              value={state.condoFeesMonthly}
              onChange={(v) => set({ condoFeesMonthly: v })}
            />
            <MoneyField
              label="Utilities you pay"
              value={state.utilitiesMonthly}
              onChange={(v) => set({ utilitiesMonthly: v })}
              hint="Per month"
            />
            <PercentField
              label="Maintenance"
              value={state.maintenance}
              onChange={(v) => set({ maintenance: v })}
              max={50}
              hint="Of rent"
            />
            <PercentField
              label="Management"
              value={state.management}
              onChange={(v) => set({ management: v })}
              max={50}
              hint="Of rent (0 if self-managed)"
            />
            <PercentField
              label="Value growth"
              value={state.appreciation}
              onChange={(v) => set({ appreciation: v })}
              max={20}
              hint="Per year"
            />
          </div>
        </>
      }
      results={
        <>
          <BigResult
            label="Monthly cash flow"
            value={`${positive ? "" : "−"}${money(Math.abs(r.cashFlowMonthly))}`}
            tone={positive ? "good" : "bad"}
            caption={`After the mortgage (${money(r.mortgageMonthly)}/month) and all operating costs.`}
          />
          {!positive && r.breakEvenRent != null ? (
            <Notice tone="warn">
              It breaks even at about {money(r.breakEvenRent)} a month in rent.
            </Notice>
          ) : null}
          <StatGrid
            items={[
              {
                label: "Cap rate",
                value: pct(r.capRate),
                hint: "Net income ÷ price",
              },
              {
                label: "Cash-on-cash",
                value: pct(r.cashOnCash),
                hint: "Cash flow ÷ cash in",
              },
              {
                label: "Total return (yr 1)",
                value: pct(r.totalReturn),
                hint: "With equity and growth",
              },
              {
                label: "Debt coverage",
                value: r.dscr != null ? `${r.dscr.toFixed(2)}×` : "—",
                hint: "Lenders want 1.2× or more",
              },
              {
                label: "Net operating income",
                value: money(r.noi),
                hint: "Per year, before mortgage",
              },
              {
                label: "Cash invested",
                value: money(r.cashInvested),
                hint: "Down + closing + setup",
              },
            ]}
          />
          <Panel title="Year one" icon={ReceiptTextIcon}>
            <Breakdown
              rows={[
                { label: "Rent and other income", value: money(r.grossRent) },
                {
                  label: "Vacancy",
                  value: `−${money(r.vacancyLoss)}`,
                  muted: true,
                },
                {
                  label: "Property tax",
                  value: `−${money(r.operating.propertyTax)}`,
                },
                {
                  label: "Insurance",
                  value: `−${money(r.operating.insurance)}`,
                },
                ...(r.operating.condoFees
                  ? [
                      {
                        label: "Condo fees",
                        value: `−${money(r.operating.condoFees)}`,
                      },
                    ]
                  : []),
                ...(r.operating.utilities
                  ? [
                      {
                        label: "Utilities",
                        value: `−${money(r.operating.utilities)}`,
                      },
                    ]
                  : []),
                {
                  label: "Maintenance",
                  value: `−${money(r.operating.maintenance)}`,
                },
                ...(r.operating.management
                  ? [
                      {
                        label: "Management",
                        value: `−${money(r.operating.management)}`,
                      },
                    ]
                  : []),
                { label: "Net operating income", value: money(r.noi) },
                {
                  label: "Mortgage payments",
                  value: `−${money(r.debtService)}`,
                },
              ]}
              total={{ label: "Cash flow", value: money(r.cashFlow) }}
            />
          </Panel>
          <Panel title="Wealth built in year one" icon={BuildingIcon}>
            <Breakdown
              rows={[
                { label: "Cash flow", value: money(r.cashFlow) },
                {
                  label: "Mortgage principal paid by rent",
                  value: money(r.principalPaydown),
                },
                {
                  label: `Value growth at ${pct(state.appreciation)}`,
                  value: money(r.appreciation),
                },
              ]}
              total={{
                label: "Total gain",
                value: money(r.cashFlow + r.principalPaydown + r.appreciation),
              }}
            />
          </Panel>
          <Notice>
            Rental properties usually need 20% down (insured mortgages are for
            owner-occupied homes). Ontario rent control caps increases for units
            first occupied before November 15, 2018. Rental income is taxable.
          </Notice>
        </>
      }
    />
  );
}

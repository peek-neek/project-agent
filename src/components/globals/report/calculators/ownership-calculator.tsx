"use client";

import { WalletCardsIcon } from "lucide-react";
import { ownershipCost } from "@/lib/finance/ownership";
import {
  BigResult,
  CalcLayout,
  ListPriceHint,
  MoneyField,
  Notice,
  Panel,
  PercentField,
  SelectField,
  SplitBar,
  StatGrid,
  money,
} from "./calc-ui";
import type {
  AffordState,
  OwnershipState,
  PurchaseState,
} from "./calculators-tab";

const COLORS: Record<string, string> = {
  mortgage: "#1c1917",
  tax: "#c4161c",
  insurance: "#2563eb",
  utilities: "#d97706",
  condo: "#7c3aed",
  maintenance: "#16a34a",
  other: "#a8a29e",
};

export function OwnershipCalculator({
  purchase,
  setPurchase,
  afford,
  setAfford,
  state,
  set,
  listPrice,
  onUseListPrice,
}: {
  purchase: PurchaseState;
  setPurchase: (patch: Partial<PurchaseState>) => void;
  afford: AffordState;
  setAfford: (patch: Partial<AffordState>) => void;
  state: OwnershipState;
  set: (patch: Partial<OwnershipState>) => void;
  listPrice: number | null;
  onUseListPrice: () => void;
}) {
  const r = ownershipCost({
    price: purchase.price,
    downPayment: purchase.downPayment,
    rate: purchase.rate,
    rateType: purchase.rateType,
    amortizationYears: purchase.amortization,
    propertyTaxRate: afford.taxRate,
    condoFeesMonthly: afford.condoFees,
    insuranceMonthly: state.insurance,
    utilitiesMonthly: state.utilities,
    maintenanceRate: state.maintenanceRate,
    otherMonthly: state.other,
  });

  return (
    <CalcLayout
      inputs={
        <>
          <MoneyField
            label="Purchase price"
            value={purchase.price}
            onChange={(v) => setPurchase({ price: v })}
            hint={
              <ListPriceHint
                value={purchase.price}
                listPrice={listPrice}
                onUse={onUseListPrice}
              />
            }
          />
          <MoneyField
            label="Down payment"
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
              options={[15, 20, 25, 30].map((a) => ({
                value: a,
                label: `${a} years`,
              }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <PercentField
              label="Property tax (per year)"
              value={afford.taxRate}
              onChange={(v) => setAfford({ taxRate: v })}
              max={5}
              hint="Share of the price"
            />
            <MoneyField
              label="Condo fees (per month)"
              value={afford.condoFees}
              onChange={(v) => setAfford({ condoFees: v })}
            />
            <MoneyField
              label="Home insurance (per month)"
              value={state.insurance}
              onChange={(v) => set({ insurance: v })}
            />
            <MoneyField
              label="Utilities (per month)"
              value={state.utilities}
              onChange={(v) => set({ utilities: v })}
              hint="Hydro, water, heat"
            />
            <PercentField
              label="Maintenance (per year)"
              value={state.maintenanceRate}
              onChange={(v) => set({ maintenanceRate: v })}
              max={5}
              hint="Share of the price"
            />
            <MoneyField
              label="Other (per month)"
              value={state.other}
              onChange={(v) => set({ other: v })}
              hint="Internet, parking…"
            />
          </div>
        </>
      }
      results={
        <>
          <BigResult
            label="Monthly cost of owning"
            value={money(r.monthly)}
            caption={`${money(r.annual)} a year, everything included.`}
          />
          <StatGrid
            items={[
              {
                label: "Mortgage payment",
                value: money(r.mortgage),
                hint: `On ${money(r.loan)}`,
              },
              {
                label: "Builds equity",
                value: money(r.equityMonthly),
                hint: "Principal, first payment",
              },
              {
                label: "True monthly cost",
                value: money(r.trueCostMonthly),
                hint: "Excluding equity",
              },
            ]}
          />
          <Panel title="Where the money goes each month" icon={WalletCardsIcon}>
            <SplitBar
              total={r.monthly}
              segments={r.items.map((i) => ({
                label: i.label,
                amount: i.amount,
                color: COLORS[i.id] ?? "#a8a29e",
              }))}
            />
          </Panel>
          <Notice>
            Property tax is estimated from a typical rate for the area; the
            municipality&apos;s tax bill has the exact amount. Maintenance of
            about 1% of the value a year is a common rule for houses (less for
            condos, where fees cover the building).
          </Notice>
        </>
      }
    />
  );
}

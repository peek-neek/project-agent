"use client";

import { LEGAL_FEE_TAX } from "@/lib/finance/provinces";
import { ReceiptTextIcon } from "lucide-react";
import { buyerClosingCosts } from "@/lib/finance/closing";
import { minDownPayment } from "@/lib/finance/mortgage";
import {
  BigResult,
  Breakdown,
  CalcLayout,
  ListPriceHint,
  MoneyField,
  Notice,
  Panel,
  pct,
  StatGrid,
  SwitchField,
  money,
} from "./calc-ui";
import type { ClosingState, PurchaseState } from "./calculators-tab";

export function ClosingCostsCalculator({
  purchase,
  setPurchase,
  state,
  set,
  listPrice,
  onUseListPrice,
}: {
  purchase: PurchaseState;
  setPurchase: (patch: Partial<PurchaseState>) => void;
  state: ClosingState;
  set: (patch: Partial<ClosingState>) => void;
  listPrice: number | null;
  onUseListPrice: () => void;
}) {
  const r = buyerClosingCosts({
    price: purchase.price,
    downPayment: purchase.downPayment,
    amortizationYears: purchase.amortization,
    province: purchase.province,
    toronto: purchase.province === "ON" && purchase.toronto,
    montreal: purchase.province === "QC" && purchase.montreal,
    firstTimeBuyer: purchase.firstTimeBuyer,
    singleFamily: purchase.singleFamily,
    nonResident: purchase.nonResident,
    ...state,
  });
  const legalTax = LEGAL_FEE_TAX[purchase.province].label;
  const minDown = minDownPayment(purchase.price);

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
            invalid={purchase.downPayment + 0.5 < minDown}
            hint={`${purchase.price > 0 ? pct(purchase.downPayment / purchase.price, 1) : "0%"} · minimum ${money(minDown)}`}
          />
          <SwitchField
            label="First-time buyer"
            description="Transfer tax relief, where the province offers it."
            checked={purchase.firstTimeBuyer}
            onChange={(v) => setPurchase({ firstTimeBuyer: v })}
          />
          {purchase.province === "ON" && (
            <SwitchField
              label="In the City of Toronto"
              description="Adds Toronto's land transfer tax."
              checked={purchase.toronto}
              onChange={(v) => setPurchase({ toronto: v })}
            />
          )}
          {purchase.province === "QC" && (
            <SwitchField
              label="In the City of Montréal"
              description="Montréal's higher welcome tax brackets."
              checked={purchase.montreal}
              onChange={(v) => setPurchase({ montreal: v })}
            />
          )}
          <SwitchField
            label="Condo"
            description={
              purchase.province === "ON"
                ? `Adds the status certificate ($100 + ${legalTax}).`
                : `Adds the condo documents (estoppel certificate, about $100 + ${legalTax}).`
            }
            checked={state.condo}
            onChange={(v) => set({ condo: v })}
          />
          <div className="grid grid-cols-2 gap-4">
            <MoneyField
              label="Legal fees"
              value={state.legalFees}
              onChange={(v) => set({ legalFees: v })}
              hint={`Before ${legalTax}`}
            />
            <MoneyField
              label="Title insurance"
              value={state.titleInsurance}
              onChange={(v) => set({ titleInsurance: v })}
            />
            <MoneyField
              label="Home inspection"
              value={state.homeInspection}
              onChange={(v) => set({ homeInspection: v })}
            />
            <MoneyField
              label="Appraisal"
              value={state.appraisal}
              onChange={(v) => set({ appraisal: v })}
              hint="Often the lender's"
            />
            <MoneyField
              label="Tax adjustments"
              value={state.adjustments}
              onChange={(v) => set({ adjustments: v })}
              hint="Seller's prepaid tax"
            />
            <MoneyField
              label="Moving"
              value={state.moving}
              onChange={(v) => set({ moving: v })}
            />
          </div>
          <MoneyField
            label="Other costs"
            value={state.other}
            onChange={(v) => set({ other: v })}
            hint="Furniture, repairs, utility hook-ups…"
          />
        </>
      }
      results={
        <>
          <BigResult
            label="Cash needed on closing day"
            value={money(r.cashToClose)}
            caption={`${money(r.downPayment)} down payment plus ${money(r.closingCosts)} in closing costs.`}
          />
          <StatGrid
            items={[
              {
                label: "Closing costs",
                value: money(r.closingCosts),
                hint: `${pct(r.closingCostShare, 1)} of the price`,
              },
              {
                label: "Land transfer tax",
                value: money(r.ltt.total),
                hint: purchase.firstTimeBuyer ? "After rebates" : undefined,
              },
              {
                label: "Down payment",
                value: money(r.downPayment),
                hint:
                  purchase.price > 0
                    ? pct(r.downPayment / purchase.price, 1)
                    : undefined,
              },
            ]}
          />
          {r.insurance.required &&
          !r.insurance.available &&
          r.insurance.reason ? (
            <Notice tone="warn">{r.insurance.reason}</Notice>
          ) : null}
          <Panel title="Closing costs" icon={ReceiptTextIcon}>
            <Breakdown
              rows={r.lines
                .filter((l) => l.amount > 0)
                .map((l) => ({ label: l.label, value: money(l.amount) }))}
              total={{
                label: "Total closing costs",
                value: money(r.closingCosts),
              }}
            />
          </Panel>
          <Notice>
            Plan for 1.5% to 4% of the price on top of the down payment. The
            lawyer&apos;s statement of adjustments, a few days before closing,
            has the final figures.
          </Notice>
        </>
      }
    />
  );
}

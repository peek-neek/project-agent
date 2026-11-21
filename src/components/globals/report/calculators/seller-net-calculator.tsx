"use client";

import { COMMISSION_TAX, LEGAL_FEE_TAX, type Province } from "@/lib/finance/provinces";
import { PieChartIcon, ReceiptTextIcon } from "lucide-react";
import { sellerNet } from "@/lib/finance/closing";
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
  Segmented,
  SelectField,
  SplitBar,
  StatGrid,
  SwitchField,
  money,
} from "./calc-ui";
import type { SellerState } from "./calculators-tab";

export function SellerNetCalculator({
  state,
  set,
  province,
  listPrice,
  onUseListPrice,
}: {
  state: SellerState;
  province: Province;
  set: (patch: Partial<SellerState>) => void;
  listPrice: number | null;
  onUseListPrice: () => void;
}) {
  const r = sellerNet({ ...state, province });
  const commissionTax = COMMISSION_TAX[province].label;
  const legalTax = LEGAL_FEE_TAX[province].label;
  const line = (id: string) => r.lines.find((l) => l.id === id)?.amount ?? 0;
  const fees =
    line("discharge") +
    line("legal") +
    line("legalHst") +
    line("staging") +
    line("moving") +
    line("other");
  const breaking = state.monthsLeftInTerm > 0 && !state.portingMortgage;

  return (
    <CalcLayout
      inputs={
        <>
          <MoneyField
            label="Sale price"
            value={state.salePrice}
            onChange={(v) => set({ salePrice: v })}
            hint={
              <ListPriceHint
                value={state.salePrice}
                listPrice={listPrice}
                onUse={onUseListPrice}
              />
            }
          />
          <div className="grid grid-cols-2 gap-4">
            <PercentField
              label="Listing commission"
              value={state.listingCommission}
              onChange={(v) => set({ listingCommission: v })}
              max={10}
            />
            <PercentField
              label="Buyer agent commission"
              value={state.buyerCommission}
              onChange={(v) => set({ buyerCommission: v })}
              max={10}
            />
          </div>
          <MoneyField
            label="Mortgage balance at closing"
            value={state.mortgageBalance}
            onChange={(v) => set({ mortgageBalance: v })}
          />
          {state.mortgageBalance > 0 ? (
            <>
              <SelectField
                label="Time left in the mortgage term"
                value={state.monthsLeftInTerm}
                onChange={(v) => set({ monthsLeftInTerm: v })}
                options={[0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60].map(
                  (m) => ({
                    value: m,
                    label:
                      m === 0
                        ? "Term ends at closing (no penalty)"
                        : `${m} months`,
                  }),
                )}
              />
              {state.monthsLeftInTerm > 0 ? (
                <>
                  <SwitchField
                    label="Porting the mortgage to the next home"
                    description="Moving it to the new home usually avoids the penalty."
                    checked={state.portingMortgage}
                    onChange={(v) => set({ portingMortgage: v })}
                  />
                  {!state.portingMortgage ? (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <PercentField
                          label="Mortgage rate"
                          value={state.mortgageRate}
                          onChange={(v) => set({ mortgageRate: v })}
                        />
                        <Segmented
                          label="Rate type"
                          value={state.rateType}
                          onChange={(v) => set({ rateType: v })}
                          options={[
                            { value: "fixed", label: "Fixed" },
                            { value: "variable", label: "Variable" },
                          ]}
                        />
                      </div>
                      {state.rateType === "fixed" ? (
                        <PercentField
                          label="Lender's rate for the time left"
                          value={state.comparisonRate}
                          onChange={(v) => set({ comparisonRate: v })}
                          hint="Used for the interest rate differential."
                        />
                      ) : null}
                    </>
                  ) : null}
                </>
              ) : null}
            </>
          ) : null}
          <div className="grid grid-cols-2 gap-4">
            <MoneyField
              label="Legal fees"
              value={state.legalFees}
              onChange={(v) => set({ legalFees: v })}
              hint={`Before ${legalTax}`}
            />
            <MoneyField
              label="Discharge fee"
              value={state.dischargeFee}
              onChange={(v) => set({ dischargeFee: v })}
              hint="Lender's fee"
            />
            <MoneyField
              label="Staging and repairs"
              value={state.staging}
              onChange={(v) => set({ staging: v })}
            />
            <MoneyField
              label="Moving"
              value={state.moving}
              onChange={(v) => set({ moving: v })}
            />
            <MoneyField
              label="Prepaid tax refunded"
              value={state.taxAdjustment}
              onChange={(v) => set({ taxAdjustment: v })}
              hint="Credited back at closing"
            />
            <MoneyField
              label="Other costs"
              value={state.other}
              onChange={(v) => set({ other: v })}
            />
          </div>
        </>
      }
      results={
        <>
          <BigResult
            label="Estimated net proceeds"
            value={money(r.net)}
            tone={r.net >= 0 ? "default" : "bad"}
            caption={`What the seller walks away with from a ${money(state.salePrice)} sale, after the mortgage and all selling costs.`}
          />
          {r.net < 0 ? (
            <Notice tone="warn">
              The costs and mortgage are more than the sale price: the seller
              would need to bring money to closing.
            </Notice>
          ) : null}
          <StatGrid
            items={[
              {
                label: "Selling costs",
                value: money(r.sellingCosts),
                hint: `${pct(r.sellingCostShare, 1)} of the price`,
              },
              {
                label: `Commission + ${commissionTax}`,
                value: money(r.commission),
                hint:
                  pct(state.listingCommission + state.buyerCommission, 2) +
                  " total",
              },
              {
                label: "Prepayment penalty",
                value: money(r.penalty.penalty),
                hint: state.portingMortgage
                  ? "Porting the mortgage"
                  : r.penalty.method === "ird"
                    ? "Interest rate differential"
                    : r.penalty.method === "threeMonths"
                      ? "3 months' interest"
                      : "None",
              },
            ]}
          />
          <Panel title="Where the sale price goes" icon={PieChartIcon}>
            <SplitBar
              total={state.salePrice}
              segments={[
                {
                  label: "Net to seller",
                  amount: Math.max(0, r.net - state.taxAdjustment),
                  color: "#16a34a",
                },
                {
                  label: "Mortgage payout",
                  amount: state.mortgageBalance,
                  color: "#1c1917",
                },
                {
                  label: `Commission + ${commissionTax}`,
                  amount: r.commission,
                  color: "#c4161c",
                },
                {
                  label: "Penalty",
                  amount: r.penalty.penalty,
                  color: "#d97706",
                },
                {
                  label: "Legal, fees and moving",
                  amount: fees,
                  color: "#a8a29e",
                },
              ]}
            />
          </Panel>
          <Panel title="Net sheet" icon={ReceiptTextIcon}>
            <Breakdown
              rows={[
                { label: "Sale price", value: money(state.salePrice) },
                ...r.lines
                  .filter((l) => l.amount > 0)
                  .map((l) => ({
                    label: l.label,
                    value: `−${money(l.amount)}`,
                    muted: l.id === "mortgage",
                  })),
                ...(state.taxAdjustment > 0
                  ? [
                      {
                        label: "Prepaid property tax refunded",
                        value: `+${money(state.taxAdjustment)}`,
                      },
                    ]
                  : []),
              ]}
              total={{ label: "Net proceeds", value: money(r.net) }}
            />
          </Panel>
          <Notice>
            {breaking
              ? "Penalties are estimates: lenders calculate the interest rate differential in different ways, so ask for a payout statement. "
              : ""}
            A principal residence is normally exempt from capital gains tax;
            investment properties may owe tax on the gain.
          </Notice>
        </>
      }
    />
  );
}

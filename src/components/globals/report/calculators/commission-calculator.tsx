"use client";

import { COMMISSION_TAX, type Province } from "@/lib/finance/provinces";
import { WalletIcon } from "lucide-react";
import { commission } from "@/lib/finance/commission";
import {
  BigResult,
  Breakdown,
  CalcLayout,
  ListPriceHint,
  MoneyField,
  Panel,
  PercentField,
  pct,
  Segmented,
  SplitBar,
  StatGrid,
  money,
} from "./calc-ui";
import type { CommissionState } from "./calculators-tab";

export function CommissionCalculator({
  state,
  set,
  province,
  listPrice,
  onUseListPrice,
}: {
  state: CommissionState;
  province: Province;
  set: (patch: Partial<CommissionState>) => void;
  listPrice: number | null;
  onUseListPrice: () => void;
}) {
  const r = commission({ ...state, province });
  const tax = COMMISSION_TAX[province].label;

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
          <Segmented
            label="Commission"
            value={state.structure}
            onChange={(v) => set({ structure: v })}
            options={[
              { value: "flat", label: "Flat rate" },
              { value: "tiered", label: "Tiered" },
            ]}
          />
          {state.structure === "flat" ? (
            <PercentField
              label="Your side's commission"
              value={state.rate}
              onChange={(v) => set({ rate: v })}
              max={10}
            />
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <PercentField
                label="On the first part"
                value={state.tierRate}
                onChange={(v) => set({ tierRate: v })}
                max={10}
              />
              <MoneyField
                label="First part up to"
                value={state.tierAmount}
                onChange={(v) => set({ tierAmount: v })}
              />
              <PercentField
                label="On the rest"
                value={state.restRate}
                onChange={(v) => set({ restRate: v })}
                max={10}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <PercentField
              label="Your split"
              value={state.agentSplit}
              onChange={(v) => set({ agentSplit: v })}
              max={100}
              hint="Your share after the brokerage"
            />
            <PercentField
              label="Referral fee"
              value={state.referralFee}
              onChange={(v) => set({ referralFee: v })}
              max={100}
              hint="Paid out of the gross"
            />
          </div>
          <MoneyField
            label="Brokerage transaction fee"
            value={state.transactionFee}
            onChange={(v) => set({ transactionFee: v })}
            hint="Per deal (desk, admin or E&O fees)."
          />
        </>
      }
      results={
        <>
          <BigResult
            label="Your take-home"
            value={money(r.net)}
            caption={`Before income tax, from ${money(r.gross)} gross commission (${pct(r.effectiveRate)} of ${money(state.salePrice)}).`}
          />
          <StatGrid
            items={[
              {
                label: "Gross commission",
                value: money(r.gross),
                hint: `Before ${tax}`,
              },
              {
                label: `${tax} collected`,
                value: money(r.hst),
                hint: "Remitted, not income",
              },
              {
                label: "Client pays",
                value: money(r.grossWithHst),
                hint: `This side, with ${tax}`,
              },
            ]}
          />
          <Panel title="How the commission splits" icon={WalletIcon}>
            <SplitBar
              total={r.gross}
              segments={[
                {
                  label: "You (after fees)",
                  amount: Math.max(0, r.net),
                  color: "#16a34a",
                },
                { label: "Brokerage", amount: r.brokerage, color: "#1c1917" },
                { label: "Referral fee", amount: r.referral, color: "#d97706" },
                {
                  label: "Transaction fee",
                  amount: Math.min(r.transactionFee, r.agentGross),
                  color: "#a8a29e",
                },
              ]}
            />
            <div className="mt-4">
              <Breakdown
                rows={[
                  { label: "Gross commission", value: money(r.gross) },
                  ...(r.referral
                    ? [
                        {
                          label: "Referral fee",
                          value: `−${money(r.referral)}`,
                        },
                      ]
                    : []),
                  {
                    label: `Brokerage share (${pct(1 - state.agentSplit, 0)})`,
                    value: `−${money(r.brokerage)}`,
                  },
                  ...(r.transactionFee
                    ? [
                        {
                          label: "Transaction fee",
                          value: `−${money(r.transactionFee)}`,
                        },
                      ]
                    : []),
                ]}
                total={{ label: "Your take-home", value: money(r.net) }}
              />
            </div>
          </Panel>
        </>
      }
    />
  );
}

"use client";

import { ArrowLeftRightIcon } from "lucide-react";
import { bridgeFinancing } from "@/lib/finance/investing";
import {
  BigResult,
  Breakdown,
  CalcLayout,
  MoneyField,
  Notice,
  Panel,
  PercentField,
  SelectField,
  StatGrid,
  money,
} from "./calc-ui";
import type { BridgeState } from "./calculators-tab";

export function BridgeCalculator({
  state,
  set,
}: {
  state: BridgeState;
  set: (patch: Partial<BridgeState>) => void;
}) {
  const r = bridgeFinancing(state);

  return (
    <CalcLayout
      inputs={
        <>
          <MoneyField
            label="Bridge loan amount"
            value={state.bridgeAmount}
            onChange={(v) => set({ bridgeAmount: v })}
            hint="Equity from the current home needed before its sale closes."
          />
          <div className="grid grid-cols-2 gap-4">
            <PercentField
              label="Bridge rate"
              value={state.bridgeRate}
              onChange={(v) => set({ bridgeRate: v })}
              hint="Often prime + 2–3%"
            />
            <SelectField
              label="Days between closings"
              value={state.days}
              onChange={(v) => set({ days: v })}
              options={[7, 14, 21, 30, 45, 60, 90, 120].map((d) => ({
                value: d,
                label: `${d} days`,
              }))}
            />
            <MoneyField
              label="Lender admin fee"
              value={state.adminFee}
              onChange={(v) => set({ adminFee: v })}
            />
            <MoneyField
              label="Extra legal fee"
              value={state.legalFee}
              onChange={(v) => set({ legalFee: v })}
              hint="Before HST"
            />
            <MoneyField
              label="Current home costs"
              value={state.currentHomeMonthly}
              onChange={(v) => set({ currentHomeMonthly: v })}
              hint="Mortgage, tax, utilities / month"
            />
            <MoneyField
              label="New home costs"
              value={state.newHomeMonthly}
              onChange={(v) => set({ newHomeMonthly: v })}
              hint="Per month"
            />
          </div>
        </>
      }
      results={
        <>
          <BigResult
            label="Extra cost of buying before selling"
            value={money(r.totalExtra)}
            caption={`For ${state.days} days of overlap: the bridge loan plus carrying the current home.`}
          />
          <StatGrid
            items={[
              {
                label: "Bridge interest",
                value: money(r.interest),
                hint: `${money(r.dailyInterest)} a day`,
              },
              {
                label: "Bridge fees",
                value: money(state.adminFee + r.legal),
                hint: "Admin + legal (with HST)",
              },
              {
                label: "Carrying both homes",
                value: money(r.doubleCarrying),
                hint: `Over ${state.days} days`,
              },
            ]}
          />
          <Panel title="Breakdown" icon={ArrowLeftRightIcon}>
            <Breakdown
              rows={[
                { label: "Bridge loan interest", value: money(r.interest) },
                { label: "Lender admin fee", value: money(state.adminFee) },
                { label: "Legal fee (with HST)", value: money(r.legal) },
                {
                  label: "Current home's carrying costs",
                  value: money(r.extraCarrying),
                },
              ]}
              total={{ label: "Total extra cost", value: money(r.totalExtra) }}
            />
          </Panel>
          <Notice>
            Lenders usually need a firm (unconditional) sale of the current home
            before approving a bridge loan, and cap it at 90–120 days. The new
            home&apos;s costs aren&apos;t counted as extra: they start either
            way.
          </Notice>
        </>
      }
    />
  );
}

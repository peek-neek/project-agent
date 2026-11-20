"use client";

import { TrendingDownIcon } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { prepayment } from "@/lib/finance/investing";
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
  years,
} from "./calc-ui";
import type { PrepayState } from "./calculators-tab";

const chartConfig = {
  base: { label: "Regular payments", color: "#a8a29e" },
  prepay: { label: "With prepayments", color: "#16a34a" },
} satisfies ChartConfig;

export function PrepaymentCalculator({
  state,
  set,
}: {
  state: PrepayState;
  set: (patch: Partial<PrepayState>) => void;
}) {
  const r = prepayment(state);

  return (
    <CalcLayout
      inputs={
        <>
          <MoneyField
            label="Mortgage balance"
            value={state.balance}
            onChange={(v) => set({ balance: v })}
          />
          <div className="grid grid-cols-2 gap-4">
            <PercentField
              label="Interest rate"
              value={state.rate}
              onChange={(v) => set({ rate: v })}
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
          <MoneyField
            label="Extra with each monthly payment"
            value={state.extraMonthly}
            onChange={(v) => set({ extraMonthly: v })}
          />
          <MoneyField
            label="Lump sum every year"
            value={state.annualLump}
            onChange={(v) => set({ annualLump: v })}
            hint="On each anniversary (bonus, tax refund)."
          />
          <MoneyField
            label="Lump sum now"
            value={state.lumpNow}
            onChange={(v) => set({ lumpNow: v })}
          />
        </>
      }
      results={
        <>
          <BigResult
            label="Interest saved"
            value={money(r.interestSaved)}
            tone={r.interestSaved > 0 ? "good" : "default"}
            caption={
              r.monthsSaved > 0
                ? `Mortgage-free ${years(r.monthsSaved / 12)} sooner: in ${years(r.newMonths / 12)} instead of ${years(r.baseMonths / 12)}.`
                : "Add an extra payment or a lump sum to see the savings."
            }
          />
          {r.yearOneShare > 0.15 ? (
            <Notice tone="warn">
              That&apos;s {pct(r.yearOneShare, 0)} of the balance in the first
              year. Many lenders allow 10–20% a year without penalty; check the
              mortgage&apos;s prepayment privileges.
            </Notice>
          ) : null}
          <StatGrid
            items={[
              {
                label: "Monthly payment",
                value: money(r.basePayment, true),
                hint: "Regular",
              },
              {
                label: "With extra",
                value: money(r.newPayment, true),
                hint: "Each month",
              },
              {
                label: "Total prepaid",
                value: money(r.totalPrepaid),
                hint: "Over the life",
              },
              { label: "Interest, regular", value: money(r.baseInterest) },
              {
                label: "Interest, with prepayments",
                value: money(r.newInterest),
              },
              {
                label: "Time saved",
                value: r.monthsSaved > 0 ? years(r.monthsSaved / 12) : "—",
              },
            ]}
          />
          <Panel title="Balance over time" icon={TrendingDownIcon}>
            <ChartContainer
              config={chartConfig}
              className="aspect-auto h-64 w-full"
            >
              <AreaChart data={r.chart} margin={{ left: 4, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="year"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={6}
                  fontSize={11}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={52}
                  fontSize={11}
                  tickFormatter={(v: number) => `$${Math.round(v / 1000)}K`}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(_, p) =>
                        `Year ${p?.[0]?.payload?.year ?? ""}`
                      }
                      formatter={(value, name) => (
                        <div className="flex w-full justify-between gap-4">
                          <span className="text-foreground/60">
                            {
                              chartConfig[name as keyof typeof chartConfig]
                                ?.label
                            }
                          </span>
                          <span className="font-medium tabular-nums">
                            {money(Number(value))}
                          </span>
                        </div>
                      )}
                    />
                  }
                />
                <Area
                  dataKey="base"
                  stroke="var(--color-base)"
                  fill="var(--color-base)"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
                <Area
                  dataKey="prepay"
                  stroke="var(--color-prepay)"
                  fill="var(--color-prepay)"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </Panel>
        </>
      }
    />
  );
}

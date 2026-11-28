"use client";

import { PROVINCE_NAMES } from "@/lib/finance/provinces";
import { BarChart3Icon, ReceiptIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  amortize,
  FREQUENCIES,
  type Frequency,
  minDownPayment,
  mortgageInsurance,
} from "@/lib/finance/mortgage";
import { AMORTIZATION } from "@/lib/finance/ontario-rules";
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
  StatGrid,
  SwitchField,
  money,
  years,
} from "./calc-ui";
import type { PurchaseState } from "./calculators-tab";

const chartConfig = {
  // Near-black vanishes on the dark card, so a lighter zinc there.
  principal: {
    label: "Principal",
    theme: { light: "#1c1917", dark: "#a1a1aa" },
  },
  interest: { label: "Interest", color: "#c4161c" },
} satisfies ChartConfig;

const DOWN_CHIPS = [
  { label: "Minimum", value: "min" },
  { label: "10%", value: 0.1 },
  { label: "20%", value: 0.2 },
] as const;

export function MortgageCalculator({
  state,
  set,
  listPrice,
  onUseListPrice,
}: {
  state: PurchaseState;
  set: (patch: Partial<PurchaseState>) => void;
  listPrice: number | null;
  onUseListPrice: () => void;
}) {
  const {
    price,
    downPayment,
    rate,
    rateType,
    amortization,
    frequency,
    termYears,
  } = state;
  const minDown = minDownPayment(price);
  const belowMin = downPayment + 0.5 < minDown;
  const ins = mortgageInsurance({
    price,
    downPayment,
    amortizationYears: amortization,
    province: state.province,
  });
  // 30 years on an insured mortgage: first-time buyers and new builds only.
  const thirtyBlocked =
    ins.required &&
    amortization > AMORTIZATION.insuredMax &&
    !state.firstTimeBuyer &&
    !state.newBuild;
  const loan =
    Math.max(0, price - downPayment) + (ins.available ? ins.premium : 0);
  const run = amortize({
    principal: loan,
    annualRate: rate,
    years: amortization,
    frequency,
    termYears,
    rateType,
  });
  const perPayment = FREQUENCIES[frequency].label.toLowerCase();
  const accelerated = frequency.startsWith("accelerated");
  const chart = run.schedule.map((y) => ({
    year: y.year,
    principal: Math.round(y.principal),
    interest: Math.round(y.interest),
  }));

  return (
    <CalcLayout
      inputs={
        <>
          <MoneyField
            label="Purchase price"
            value={price}
            onChange={(v) => set({ price: v })}
            hint={
              <ListPriceHint
                value={price}
                listPrice={listPrice}
                onUse={onUseListPrice}
              />
            }
          />
          <div className="space-y-2">
            <MoneyField
              label="Down payment"
              value={downPayment}
              onChange={(v) => set({ downPayment: v })}
              invalid={belowMin}
              hint={
                <>
                  {price > 0 ? pct(downPayment / price, 1) : "0%"} of the price
                  · minimum {money(minDown)}
                </>
              }
            />
            <div className="flex flex-wrap gap-1.5">
              {DOWN_CHIPS.map((c) => (
                <Button
                  key={c.label}
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    set({
                      downPayment: Math.ceil(
                        c.value === "min" ? minDown : price * c.value,
                      ),
                    })
                  }
                  className="h-7 bg-card px-2.5 text-xs"
                >
                  {c.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <PercentField
              label="Interest rate"
              value={rate}
              onChange={(v) => set({ rate: v })}
            />
            <SelectField
              label="Term"
              value={termYears}
              onChange={(v) => set({ termYears: v })}
              options={[1, 2, 3, 4, 5, 7, 10].map((t) => ({
                value: t,
                label: `${t} year${t === 1 ? "" : "s"}`,
              }))}
            />
          </div>
          <Segmented
            label="Rate type"
            value={rateType}
            onChange={(v) => set({ rateType: v })}
            options={[
              { value: "fixed", label: "Fixed" },
              { value: "variable", label: "Variable" },
            ]}
          />
          <div className="grid grid-cols-2 gap-4">
            <SelectField
              label="Amortization"
              value={amortization}
              onChange={(v) => set({ amortization: v })}
              options={[10, 15, 20, 25, 30].map((a) => ({
                value: a,
                label: `${a} years`,
              }))}
            />
            <SelectField<Frequency>
              label="Payments"
              value={frequency}
              onChange={(v) => set({ frequency: v })}
              options={(Object.keys(FREQUENCIES) as Frequency[]).map((f) => ({
                value: f,
                label: FREQUENCIES[f].label,
              }))}
            />
          </div>
          <SwitchField
            label="First-time buyer"
            description="Can choose 30 years on an insured mortgage."
            checked={state.firstTimeBuyer}
            onChange={(v) => set({ firstTimeBuyer: v })}
          />
          <SwitchField
            label="New build"
            description="New builds can also choose 30 years insured."
            checked={state.newBuild}
            onChange={(v) => set({ newBuild: v })}
          />
        </>
      }
      results={
        <>
          <BigResult
            label={`${FREQUENCIES[frequency].label} payment`}
            value={money(run.payment, true)}
            caption={
              <>
                On a {money(loan)} mortgage at {pct(rate)} {rateType}, over{" "}
                {amortization} years
                {accelerated ? ` (paid off in ${years(run.payoffYears)})` : ""}.
              </>
            }
          />
          {belowMin ? (
            <Notice tone="warn">
              The down payment is below the {money(minDown)} minimum for this
              price.
            </Notice>
          ) : null}
          {ins.required && !ins.available && ins.reason ? (
            <Notice tone="warn">{ins.reason}</Notice>
          ) : null}
          {thirtyBlocked ? (
            <Notice tone="warn">
              With less than 20% down, 30 years is only for first-time buyers
              and new builds; others are capped at 25.
            </Notice>
          ) : null}
          <StatGrid
            items={[
              {
                label: "Mortgage amount",
                value: money(loan),
                hint:
                  ins.premium && ins.available
                    ? "Includes insurance"
                    : "Price less down payment",
              },
              {
                label: `Interest over ${termYears}-yr term`,
                value: money(run.term?.interest ?? 0),
              },
              {
                label: "Balance at end of term",
                value: money(run.term?.balance ?? 0),
                hint: `After ${termYears} year${termYears === 1 ? "" : "s"}`,
              },
              {
                label: "Total interest",
                value: money(run.totalInterest),
                hint: `Over ${years(run.payoffYears)}`,
              },
              {
                label: "Total cost",
                value: money(run.totalPaid),
                hint: "Mortgage plus interest",
              },
              {
                label: `Payments (${perPayment})`,
                value: Math.round(run.payoffYears * run.perYear).toLocaleString(
                  "en-CA",
                ),
                hint: `${run.perYear} a year`,
              },
            ]}
          />
          <Panel title="Mortgage insurance" icon={ReceiptIcon}>
            {ins.required && ins.available ? (
              <Breakdown
                rows={[
                  {
                    label: "Loan before insurance",
                    value: money(price - downPayment),
                  },
                  {
                    label: `Premium (${pct(ins.rate)} of the loan, added to the mortgage)`,
                    value: money(ins.premium),
                  },
                  ...(ins.pst > 0
                    ? [
                        {
                          label: `${PROVINCE_NAMES[state.province]} tax on the premium (paid at closing)`,
                          value: money(ins.pst),
                        },
                      ]
                    : []),
                ]}
                total={{ label: "Insured mortgage", value: money(loan) }}
              />
            ) : (
              <p className="text-sm text-foreground/60">
                {ins.required
                  ? "Insurance isn't available here; at least 20% down is needed."
                  : "None needed: the down payment is 20% or more."}
              </p>
            )}
          </Panel>
          <Panel
            title="Principal and interest, year by year"
            icon={BarChart3Icon}
          >
            <ChartContainer
              config={chartConfig}
              className="aspect-auto h-64 w-full"
            >
              <BarChart data={chart} margin={{ left: 4, right: 4, top: 4 }}>
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
                  width={48}
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
                <Bar
                  dataKey="principal"
                  stackId="a"
                  fill="var(--color-principal)"
                />
                <Bar
                  dataKey="interest"
                  stackId="a"
                  fill="var(--color-interest)"
                />
              </BarChart>
            </ChartContainer>
            <p className="mt-2 text-xs text-foreground/55">
              Early payments are mostly interest; the principal share grows
              every year.
            </p>
          </Panel>
        </>
      }
    />
  );
}

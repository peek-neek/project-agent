"use client";

import { LineChartIcon } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { rentVsBuy } from "@/lib/finance/investing";
import {
  BigResult,
  CalcLayout,
  ListPriceHint,
  MoneyField,
  Notice,
  Panel,
  PercentField,
  SelectField,
  StatGrid,
  money,
} from "./calc-ui";
import type { PurchaseState, RentVsBuyState } from "./calculators-tab";

const chartConfig = {
  buy: { label: "Buying", color: "#1c1917" },
  rent: { label: "Renting", color: "#c4161c" },
} satisfies ChartConfig;

export function RentVsBuyCalculator({
  purchase,
  setPurchase,
  state,
  set,
  taxRate,
  listPrice,
  onUseListPrice,
}: {
  purchase: PurchaseState;
  setPurchase: (patch: Partial<PurchaseState>) => void;
  state: RentVsBuyState;
  set: (patch: Partial<RentVsBuyState>) => void;
  taxRate: number;
  listPrice: number | null;
  onUseListPrice: () => void;
}) {
  const r = rentVsBuy({
    price: purchase.price,
    downPayment: purchase.downPayment,
    rate: purchase.rate,
    amortizationYears: purchase.amortization,
    province: purchase.province,
    toronto: purchase.province === "ON" && purchase.toronto,
    montreal: purchase.province === "QC" && purchase.montreal,
    firstTimeBuyer: purchase.firstTimeBuyer,
    propertyTaxRate: taxRate,
    ...state,
  });
  const buyWins = r.advantage >= 0;
  const chart = r.years.map((y) => ({
    year: y.year,
    buy: Math.round(y.buyNetWorth),
    rent: Math.round(y.rentNetWorth),
  }));

  return (
    <CalcLayout
      inputs={
        <>
          <MoneyField
            label="Home price"
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
          <div className="grid grid-cols-2 gap-4">
            <MoneyField
              label="Down payment"
              value={purchase.downPayment}
              onChange={(v) => setPurchase({ downPayment: v })}
            />
            <PercentField
              label="Mortgage rate"
              value={purchase.rate}
              onChange={(v) => setPurchase({ rate: v })}
            />
            <MoneyField
              label="Rent instead (per month)"
              value={state.rentMonthly}
              onChange={(v) => set({ rentMonthly: v })}
            />
            <PercentField
              label="Rent increase"
              value={state.rentIncrease}
              onChange={(v) => set({ rentIncrease: v })}
              max={20}
              hint="Per year"
            />
            <PercentField
              label="Home value growth"
              value={state.appreciation}
              onChange={(v) => set({ appreciation: v })}
              max={20}
              hint="Per year"
            />
            <PercentField
              label="Investment return"
              value={state.investmentReturn}
              onChange={(v) => set({ investmentReturn: v })}
              max={20}
              hint="On money not in the home"
            />
            <PercentField
              label="Maintenance"
              value={state.maintenanceRate}
              onChange={(v) => set({ maintenanceRate: v })}
              max={5}
              hint="Of value, per year"
            />
            <MoneyField
              label="Condo fees"
              value={state.condoFeesMonthly}
              onChange={(v) => set({ condoFeesMonthly: v })}
              hint="Per month"
            />
            <PercentField
              label="Selling costs"
              value={state.sellingCostRate}
              onChange={(v) => set({ sellingCostRate: v })}
              max={15}
              hint="Commission + legal at the end"
            />
            <SelectField
              label="Compare over"
              value={state.years}
              onChange={(v) => set({ years: v })}
              options={[3, 5, 7, 10, 15, 20, 25].map((y) => ({
                value: y,
                label: `${y} years`,
              }))}
            />
          </div>
        </>
      }
      results={
        <>
          <BigResult
            label={`After ${state.years} years, ${buyWins ? "buying" : "renting"} comes out ahead by`}
            value={money(Math.abs(r.advantage))}
            tone={buyWins ? "good" : "bad"}
            caption={
              r.breakEvenYear
                ? `Buying pulls ahead in year ${r.breakEvenYear}.`
                : `Buying doesn't catch up within ${state.years} years at these assumptions.`
            }
          />
          <StatGrid
            items={[
              {
                label: "Net worth if buying",
                value: money(r.buyNetWorth),
                hint: "Equity after selling costs",
              },
              {
                label: "Net worth if renting",
                value: money(r.rentNetWorth),
                hint: "Invested savings",
              },
              {
                label: "Cash to buy",
                value: money(r.upfront),
                hint: "Down + closing costs",
              },
              {
                label: "Owning, first month",
                value: money(r.firstOwnerMonthly),
                hint: "Mortgage, tax, upkeep",
              },
              {
                label: "Renting, first month",
                value: money(state.rentMonthly + state.rentInsuranceMonthly),
              },
              { label: "Home value at the end", value: money(r.homeValue) },
            ]}
          />
          <Panel title="Net worth, year by year" icon={LineChartIcon}>
            <ChartContainer
              config={chartConfig}
              className="aspect-auto h-64 w-full"
            >
              <LineChart data={chart} margin={{ left: 4, right: 8, top: 8 }}>
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
                <Line
                  dataKey="buy"
                  stroke="var(--color-buy)"
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  dataKey="rent"
                  stroke="var(--color-rent)"
                  strokeWidth={2.5}
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
            <div className="mt-2 flex gap-4 text-xs text-foreground/60">
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 bg-foreground" /> Buying
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 bg-primary" /> Renting
              </span>
            </div>
          </Panel>
          <Notice>
            The renter invests what the buyer puts down, plus the monthly
            difference whenever renting is cheaper (and the owner invests it
            when owning is cheaper). Results hinge on value growth and the
            investment return: try a few scenarios.
          </Notice>
        </>
      }
    />
  );
}

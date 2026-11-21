"use client";

import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { cn } from "cn";
import { useEffect, useId } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { landTransferTax } from "@/lib/finance/land-transfer-tax";
import { mortgageInsurance, payment } from "@/lib/finance/mortgage";
import { SAMPLE_HOME } from "../sample";
import { EASE, Frame, Rolling, SampleTag, useAutoCycle } from "../shared";

const RATE = 0.0449;
const YEARS = 25;
const SHARES = [0.1, 0.15, 0.2];
const money = (v: number, cents = false) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  }).format(v);

const price = SAMPLE_HOME.price;
const ltt = landTransferTax({ price, toronto: false, firstTimeBuyer: false });
const SCENARIOS = SHARES.map((share) => {
  const down = price * share;
  const ins = mortgageInsurance({
    price,
    downPayment: down,
    amortizationYears: YEARS,
  });
  const loan = price - down + (ins.available ? ins.premium : 0);
  return {
    share,
    down,
    ins,
    loan,
    monthly: payment({
      principal: loan,
      annualRate: RATE,
      years: YEARS,
      frequency: "monthly",
    }),
    cash: down + ltt.total + ins.pst + 2_500,
  };
});

/** The monthly payment, counting to each new value. */
function Payment({ value }: { value: number }) {
  const mv = useMotionValue(value);
  const text = useTransform(() => money(mv.get(), true));
  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.6, ease: EASE });
    return () => controls.stop();
  }, [mv, value]);
  return <motion.span className="tabular-nums">{text}</motion.span>;
}

export function CalculatorVisual() {
  const id = useId();
  const { ref, index, select } = useAutoCycle(SCENARIOS.length, 3000);
  const s = SCENARIOS[index];
  const rows = [
    {
      label: "CMHC insurance",
      value: s.ins.required ? money(s.ins.premium) : "Not needed",
      note: s.ins.required ? "Added to the mortgage" : "20% or more down",
    },
    {
      label: "Mortgage",
      value: money(s.loan),
      note: `${YEARS}-yr amortization`,
    },
    {
      label: "Ontario land transfer tax",
      value: money(ltt.total),
      note: "Oakville: no municipal tax",
    },
    {
      label: "Cash needed on closing",
      value: money(s.cash),
      note: "Down payment, tax, legal and moving",
    },
  ];

  return (
    <div ref={ref}>
      <Frame
        title={
          <span>
            Mortgage at {money(price)}{" "}
            <span className="font-normal text-foreground/50">
              · {(RATE * 100).toFixed(2)}% fixed
            </span>
          </span>
        }
      >
        <div className="grid gap-6 p-5 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div>
            <p className="text-xs font-medium tracking-wide text-foreground/50 uppercase">
              Down payment
            </p>
            <ToggleGroup
              aria-label="Down payment"
              value={[String(s.share)]}
              onValueChange={(v) => {
                const i = SHARES.indexOf(Number(v[0]));
                if (i >= 0) select(i);
              }}
              spacing={0}
              className="mt-2 border p-0.5"
            >
              {SCENARIOS.map((sc) => {
                const active = sc.share === s.share;
                return (
                  <ToggleGroupItem
                    key={sc.share}
                    value={String(sc.share)}
                    className={cn(
                      "relative rounded-none px-4 text-sm font-medium hover:bg-transparent data-pressed:bg-transparent",
                      active
                        ? "text-background hover:text-background"
                        : "text-foreground/60 hover:text-foreground",
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId={`down-${id}`}
                        transition={{
                          type: "spring",
                          bounce: 0.15,
                          duration: 0.45,
                        }}
                        className="absolute inset-0 bg-foreground"
                      />
                    )}
                    <span className="relative">{sc.share * 100}%</span>
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
            <p className="mt-2 text-sm text-foreground/60">
              <Rolling value={money(s.down)} /> down
            </p>

            <p className="mt-6 text-xs font-medium tracking-wide text-foreground/50 uppercase">
              Monthly payment
            </p>
            <p className="mt-1 text-4xl font-semibold tracking-tight">
              <Payment value={s.monthly} />
            </p>
            <p className="mt-1 text-xs text-foreground/50">
              Canadian semi-annual compounding
            </p>
          </div>
          <ul className="divide-y border-t md:border-t-0">
            {rows.map((r) => (
              <li
                key={r.label}
                className="flex items-baseline justify-between gap-4 py-3"
              >
                <span>
                  <span className="block text-sm">{r.label}</span>
                  <span className="block text-xs text-foreground/50">
                    {r.note}
                  </span>
                </span>
                <Rolling value={r.value} className="text-sm font-semibold" />
              </li>
            ))}
          </ul>
        </div>
      </Frame>
      <SampleTag className="mt-3" />
    </div>
  );
}

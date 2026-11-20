// How much home a household qualifies for: the highest price where the
// stress-tested payment keeps GDS and TDS within the lender limits, with
// the down payment covering the minimum and insurance added when needed.

import { minDownPayment, mortgageInsurance, payment } from "./mortgage";
import { QUALIFYING } from "./ontario-rules";

export type AffordabilityInput = {
  /** Gross household income per year. */
  annualIncome: number;
  /** Car loans, minimum card and line-of-credit payments, per month. */
  monthlyDebts: number;
  downPayment: number;
  /** Contract rate, decimal. */
  annualRate: number;
  amortizationYears: number;
  /** Property tax as a share of the price, per year (decimal). */
  propertyTaxRate: number;
  heatingMonthly: number;
  condoFeesMonthly: number;
};

export const qualifyingRate = (contractRate: number) =>
  Math.max(QUALIFYING.floorRate, contractRate + QUALIFYING.buffer);

type Check = {
  price: number;
  loan: number;
  insured: boolean;
  qualifyingPayment: number;
  contractPayment: number;
  housingCosts: number;
  gds: number;
  tds: number;
  ok: boolean;
  limitedBy: "down-payment" | "gds" | "tds" | "insurance" | null;
};

function check(price: number, input: AffordabilityInput): Check {
  const income = input.annualIncome / 12;
  const ins = mortgageInsurance({
    price,
    downPayment: input.downPayment,
    amortizationYears: input.amortizationYears,
  });
  const loan = Math.max(0, price - input.downPayment) + ins.premium;
  const qRate = qualifyingRate(input.annualRate);
  const qualifyingPayment = payment({
    principal: loan,
    annualRate: qRate,
    years: input.amortizationYears,
    frequency: "monthly",
  });
  const contractPayment = payment({
    principal: loan,
    annualRate: input.annualRate,
    years: input.amortizationYears,
    frequency: "monthly",
  });
  const housingCosts =
    (price * input.propertyTaxRate) / 12 +
    input.heatingMonthly +
    input.condoFeesMonthly * QUALIFYING.condoFeeShare;
  const gds =
    income > 0 ? (qualifyingPayment + housingCosts) / income : Infinity;
  const tds =
    income > 0
      ? (qualifyingPayment + housingCosts + input.monthlyDebts) / income
      : Infinity;

  let limitedBy: Check["limitedBy"] = null;
  if (input.downPayment + 0.005 < minDownPayment(price))
    limitedBy = "down-payment";
  else if (ins.required && !ins.available) limitedBy = "insurance";
  else if (gds > QUALIFYING.maxGds) limitedBy = "gds";
  else if (tds > QUALIFYING.maxTds) limitedBy = "tds";

  return {
    price,
    loan,
    insured: ins.required,
    qualifyingPayment,
    contractPayment,
    housingCosts,
    gds,
    tds,
    ok: limitedBy === null,
    limitedBy,
  };
}

export type Affordability = Check & {
  qualifyingRate: number;
  /** What stopped the price going higher. */
  bindingLimit: NonNullable<Check["limitedBy"]> | null;
};

/**
 * Highest affordable price. Affordability isn't monotonic (insurance
 * appears under 20% down and is unavailable at $1.5M+), so scan in
 * $1,000 steps, then refine.
 */
export function maxAffordable(input: AffordabilityInput): Affordability {
  const qRate = qualifyingRate(input.annualRate);
  let best = check(0, input);
  let firstFail: Check | null = null;
  const cap = Math.max(5_000_000, input.downPayment * 20);
  for (let price = 1_000; price <= cap; price += 1_000) {
    const c = check(price, input);
    if (c.ok) {
      best = c;
      firstFail = null;
    } else if (!firstFail) {
      firstFail = c;
    }
    // Past the income limits and well past the best price: stop.
    if (
      !c.ok &&
      (c.limitedBy === "gds" || c.limitedBy === "tds") &&
      price > best.price + 200_000
    ) {
      break;
    }
  }
  // Refine to the dollar between best and best + $1,000.
  let lo = best.price;
  let hi = best.price + 1_000;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (check(mid, input).ok) lo = mid;
    else hi = mid;
  }
  const result = check(Math.floor(lo), input);
  const blocker = check(Math.floor(lo) + 1_000, input);
  return {
    ...result,
    qualifyingRate: qRate,
    bindingLimit: blocker.limitedBy ?? firstFail?.limitedBy ?? null,
  };
}

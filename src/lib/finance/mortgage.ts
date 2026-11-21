// Canadian mortgage math. Fixed-rate mortgages compound semi-annually by
// law (Interest Act), so the per-payment rate is derived from the
// semi-annual rate, not annual / 12. Variable rates compound monthly.

import {
  AMORTIZATION,
  CMHC_30_YEAR_SURCHARGE,
  CMHC_NON_TRADITIONAL_RATE,
  CMHC_PREMIUMS,
  DOWN_PAYMENT,
} from "./ontario-rules";
import { PREMIUM_TAX, type Province } from "./provinces";

export const FREQUENCIES = {
  monthly: { label: "Monthly", perYear: 12 },
  semiMonthly: { label: "Semi-monthly", perYear: 24 },
  biWeekly: { label: "Bi-weekly", perYear: 26 },
  acceleratedBiWeekly: { label: "Accelerated bi-weekly", perYear: 26 },
  weekly: { label: "Weekly", perYear: 52 },
  acceleratedWeekly: { label: "Accelerated weekly", perYear: 52 },
} as const;
export type Frequency = keyof typeof FREQUENCIES;

export type RateType = "fixed" | "variable";

/** Interest rate per payment period. `annualRate` is a decimal (0.05). */
export function periodicRate(
  annualRate: number,
  perYear: number,
  rateType: RateType = "fixed",
) {
  if (annualRate <= 0) return 0;
  return rateType === "fixed"
    ? Math.pow(1 + annualRate / 2, 2 / perYear) - 1
    : Math.pow(1 + annualRate / 12, 12 / perYear) - 1;
}

/** Level payment that repays `principal` over `periods` at `rate`. */
export function levelPayment(principal: number, rate: number, periods: number) {
  if (principal <= 0 || periods <= 0) return 0;
  if (rate === 0) return principal / periods;
  return (principal * rate) / (1 - Math.pow(1 + rate, -periods));
}

/**
 * Payment for any frequency. Accelerated payments are the monthly payment
 * split in two (bi-weekly) or four (weekly): an extra month a year goes
 * to principal. The others are amortized at their own frequency.
 */
export function payment({
  principal,
  annualRate,
  years,
  frequency,
  rateType = "fixed",
}: {
  principal: number;
  annualRate: number;
  years: number;
  frequency: Frequency;
  rateType?: RateType;
}) {
  if (
    frequency === "acceleratedBiWeekly" ||
    frequency === "acceleratedWeekly"
  ) {
    const monthly = levelPayment(
      principal,
      periodicRate(annualRate, 12, rateType),
      years * 12,
    );
    return monthly / (frequency === "acceleratedBiWeekly" ? 2 : 4);
  }
  const perYear = FREQUENCIES[frequency].perYear;
  return levelPayment(
    principal,
    periodicRate(annualRate, perYear, rateType),
    years * perYear,
  );
}

export type ScheduleYear = {
  year: number;
  principal: number;
  interest: number;
  /** Balance at the end of the year. */
  balance: number;
};

/**
 * Pays the loan down period by period. Returns yearly totals, the payoff
 * time (accelerated payments finish early) and the balance at end of term.
 */
export function amortize({
  principal,
  annualRate,
  years,
  frequency,
  termYears,
  rateType = "fixed",
  extraPerPayment = 0,
}: {
  principal: number;
  annualRate: number;
  years: number;
  frequency: Frequency;
  termYears?: number;
  rateType?: RateType;
  extraPerPayment?: number;
}) {
  const perYear = FREQUENCIES[frequency].perYear;
  const rate = periodicRate(annualRate, perYear, rateType);
  const pay =
    payment({ principal, annualRate, years, frequency, rateType }) +
    extraPerPayment;

  const schedule: ScheduleYear[] = [];
  let balance = principal;
  let period = 0;
  let totalInterest = 0;
  let termInterest = 0;
  let termPrincipal = 0;
  let balanceAtTerm = termYears ? null : 0;
  const termPeriods = termYears ? termYears * perYear : 0;
  const maxPeriods = years * perYear + perYear; // safety stop

  while (balance > 0.005 && period < maxPeriods) {
    const yearIndex = Math.floor(period / perYear);
    if (!schedule[yearIndex]) {
      schedule[yearIndex] = {
        year: yearIndex + 1,
        principal: 0,
        interest: 0,
        balance,
      };
    }
    const interest = balance * rate;
    const toPrincipal = Math.min(balance, pay - interest);
    balance -= toPrincipal;
    period += 1;
    totalInterest += interest;
    schedule[yearIndex].interest += interest;
    schedule[yearIndex].principal += toPrincipal;
    schedule[yearIndex].balance = Math.max(0, balance);
    if (termPeriods && period <= termPeriods) {
      termInterest += interest;
      termPrincipal += toPrincipal;
      if (period === termPeriods) balanceAtTerm = Math.max(0, balance);
    }
  }

  return {
    payment: pay,
    perYear,
    schedule,
    totalInterest,
    totalPaid: principal + totalInterest,
    payoffYears: period / perYear,
    term: termYears
      ? {
          interest: termInterest,
          principal: termPrincipal,
          balance: balanceAtTerm ?? 0,
        }
      : null,
  };
}

/** Minimum down payment for a purchase price. */
export function minDownPayment(price: number) {
  const d = DOWN_PAYMENT;
  if (price <= 0) return 0;
  if (price >= d.insuredMaxPrice) return price * d.uninsuredRate;
  if (price <= d.firstTier) return price * d.firstRate;
  return d.firstTier * d.firstRate + (price - d.firstTier) * d.secondRate;
}

export type Insurance = {
  /** Mortgage default insurance needed (under 20% down). */
  required: boolean;
  /** Possible at this price and down payment. */
  available: boolean;
  /** Why it's unavailable, when it is. */
  reason: string | null;
  /** Premium rate on the loan, surcharge included. */
  rate: number;
  premium: number;
  /** Ontario PST on the premium: paid in cash at closing. */
  pst: number;
};

/**
 * CMHC-style default insurance for a purchase: required under 20% down;
 * unavailable at $1.5M+ or below the minimum down payment.
 */
export function mortgageInsurance({
  price,
  downPayment,
  amortizationYears,
  nonTraditional = false,
  province = "ON",
}: {
  price: number;
  downPayment: number;
  amortizationYears: number;
  nonTraditional?: boolean;
  /** Ontario, Quebec and Saskatchewan tax the premium (paid at closing). */
  province?: Province;
}): Insurance {
  const loan = Math.max(0, price - downPayment);
  const ltv = price > 0 ? loan / price : 0;
  const none = { rate: 0, premium: 0, pst: 0 };
  if (ltv <= 0.8) {
    return { required: false, available: true, reason: null, ...none };
  }
  if (price >= DOWN_PAYMENT.insuredMaxPrice) {
    return {
      required: true,
      available: false,
      reason:
        "Insured mortgages are only available under $1.5M; 20% down is needed.",
      ...none,
    };
  }
  if (downPayment + 0.005 < minDownPayment(price)) {
    return {
      required: true,
      available: false,
      reason: "The down payment is below the minimum for this price.",
      ...none,
    };
  }
  // Rounding can put a minimum down payment a hair over 95%: top tier.
  const tier =
    CMHC_PREMIUMS.find((t) => ltv <= t.maxLtv + 1e-6) ?? CMHC_PREMIUMS.at(-1)!;
  let rate = tier.rate;
  if (nonTraditional && ltv > 0.9) rate = CMHC_NON_TRADITIONAL_RATE;
  if (amortizationYears > AMORTIZATION.insuredMax)
    rate += CMHC_30_YEAR_SURCHARGE;
  const premium = loan * rate;
  return {
    required: true,
    available: true,
    reason: null,
    rate,
    premium,
    pst: premium * PREMIUM_TAX[province],
  };
}

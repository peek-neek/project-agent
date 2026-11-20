// Renewal or refinance: the new payment, the cost of breaking early and
// how long the savings take to cover it.

import { FREQUENCIES, type Frequency, payment, periodicRate } from "./mortgage";
import { REFINANCE_MAX_LTV } from "./ontario-rules";

export type RefinanceInput = {
  balance: number;
  currentRate: number;
  /** Years left on the amortization. */
  remainingYears: number;
  /** Months left in the current term (0 = renewing at maturity). */
  monthsLeftInTerm: number;
  currentRateType: "fixed" | "variable";
  /** Lender's current rate for a term like the one remaining (IRD). */
  comparisonRate: number;
  newRate: number;
  newAmortizationYears: number;
  homeValue: number;
  /** Extra borrowed on top of the balance. */
  cashOut: number;
  /** Legal, appraisal and discharge fees. */
  fees: number;
  frequency: Frequency;
};

/**
 * Cost of breaking a mortgage before the term ends: 3 months' interest;
 * fixed rates pay the greater of that and the interest rate differential
 * (current rate minus the lender's rate for the time left, on the balance,
 * for the time left). Nothing at maturity. Lenders' IRD methods vary.
 */
export function breakPenalty({
  balance,
  currentRate,
  currentRateType,
  monthsLeftInTerm,
  comparisonRate,
}: {
  balance: number;
  currentRate: number;
  currentRateType: "fixed" | "variable";
  monthsLeftInTerm: number;
  comparisonRate: number;
}) {
  const breaking = monthsLeftInTerm > 0 && balance > 0;
  const threeMonths = breaking
    ? balance * (Math.pow(1 + periodicRate(currentRate, 12), 3) - 1)
    : 0;
  const ird =
    breaking && currentRateType === "fixed"
      ? Math.max(0, currentRate - comparisonRate) *
        balance *
        (monthsLeftInTerm / 12)
      : 0;
  const penalty = Math.max(threeMonths, ird);
  const method: "none" | "ird" | "threeMonths" = !breaking
    ? "none"
    : ird > threeMonths
      ? "ird"
      : "threeMonths";
  return { threeMonths, ird, penalty, method };
}

export function refinance(input: RefinanceInput) {
  const currentPayment = payment({
    principal: input.balance,
    annualRate: input.currentRate,
    years: input.remainingYears,
    frequency: input.frequency,
  });

  const { threeMonths, ird, penalty, method } = breakPenalty(input);

  const maxLoan = input.homeValue * REFINANCE_MAX_LTV;
  const requested = input.balance + input.cashOut;
  const newLoan = Math.min(requested, maxLoan);
  const newPayment = payment({
    principal: newLoan,
    annualRate: input.newRate,
    years: input.newAmortizationYears,
    frequency: input.frequency,
  });

  // Savings like-for-like: the same balance at the new rate and the
  // current amortization (cash-out and re-amortizing change the picture).
  const sameLoanNewPayment = payment({
    principal: input.balance,
    annualRate: input.newRate,
    years: input.remainingYears,
    frequency: input.frequency,
  });
  const savingPerPayment = currentPayment - sameLoanNewPayment;
  const costToSwitch = penalty + input.fees;
  const perYear = FREQUENCIES[input.frequency].perYear;
  const monthlySaving = (savingPerPayment * perYear) / 12;

  return {
    currentPayment,
    newPayment,
    newLoan,
    maxLoan,
    /** Equity that could still be borrowed against, up to 80%. */
    availableEquity: Math.max(0, maxLoan - input.balance),
    cashOutCapped: requested > maxLoan,
    penalty,
    penaltyMethod: method,
    threeMonths,
    ird,
    costToSwitch,
    savingPerPayment,
    monthlySaving,
    /** Months of savings to cover the penalty and fees (null if never). */
    breakEvenMonths: monthlySaving > 0 ? costToSwitch / monthlySaving : null,
  };
}

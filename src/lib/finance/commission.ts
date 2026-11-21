// An agent's take-home from one deal: the side's commission, the split
// with the brokerage, and fees.

import { COMMISSION_TAX, type Province } from "./provinces";

export type CommissionInput = {
  salePrice: number;
  /** "flat": one rate on the whole price; "tiered": a rate on the first
   *  `tierAmount`, another on the rest (common in Ontario listings). */
  structure: "flat" | "tiered";
  rate: number;
  tierAmount: number;
  tierRate: number;
  restRate: number;
  /** Agent's share of the commission after the brokerage split. */
  agentSplit: number;
  /** Referral fee paid out of the gross, decimal. */
  referralFee: number;
  /** Per-deal brokerage transaction or desk fee. */
  transactionFee: number;
  /** Sets the sales tax the client pays on top. Default Ontario. */
  province?: Province;
};

export function commission(input: CommissionInput) {
  const gross =
    input.structure === "flat"
      ? input.salePrice * input.rate
      : Math.min(input.salePrice, input.tierAmount) * input.tierRate +
        Math.max(0, input.salePrice - input.tierAmount) * input.restRate;
  const hst = gross * COMMISSION_TAX[input.province ?? "ON"].rate;
  const referral = gross * input.referralFee;
  const afterReferral = gross - referral;
  const agentGross = afterReferral * input.agentSplit;
  const brokerage = afterReferral - agentGross;
  const net = agentGross - input.transactionFee;
  return {
    gross,
    hst,
    /** What the client pays for this side, HST included. */
    grossWithHst: gross + hst,
    effectiveRate: input.salePrice > 0 ? gross / input.salePrice : 0,
    referral,
    brokerage,
    agentGross,
    transactionFee: input.transactionFee,
    /** Agent's take-home before income tax. */
    net,
  };
}

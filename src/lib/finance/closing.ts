// What a sale nets the seller, and what a buyer needs on closing day.

import { landTransferTax } from "./land-transfer-tax";
import { mortgageInsurance } from "./mortgage";
import { ONTARIO_HST, STATUS_CERTIFICATE_FEE } from "./ontario-rules";
import { breakPenalty } from "./refinance";

export type CostLine = {
  id: string;
  label: string;
  amount: number;
  /** Shown but not part of the total (e.g. HST already inside a line). */
  info?: boolean;
};

// ---------------------------------------------------------------------------
// Seller net sheet
// ---------------------------------------------------------------------------

export type SellerNetInput = {
  salePrice: number;
  /** Listing brokerage commission, decimal of the price. */
  listingCommission: number;
  /** Buyer brokerage commission, decimal of the price. */
  buyerCommission: number;
  mortgageBalance: number;
  mortgageRate: number;
  rateType: "fixed" | "variable";
  /** Months left in the term at closing (0 = ends at closing). */
  monthsLeftInTerm: number;
  /** Lender's rate for the time left (fixed-rate penalty). */
  comparisonRate: number;
  /** Porting the mortgage to the next home avoids the penalty. */
  portingMortgage: boolean;
  legalFees: number;
  dischargeFee: number;
  staging: number;
  moving: number;
  /** Prepaid property tax credited back (+) or owed (−) at closing. */
  taxAdjustment: number;
  other: number;
};

export function sellerNet(input: SellerNetInput) {
  const listingComm = input.salePrice * input.listingCommission;
  const buyerComm = input.salePrice * input.buyerCommission;
  const commission = listingComm + buyerComm;
  const commissionHst = commission * ONTARIO_HST;
  const legalHst = input.legalFees * ONTARIO_HST;
  const penalty = input.portingMortgage
    ? { penalty: 0, method: "none" as const, threeMonths: 0, ird: 0 }
    : breakPenalty({
        balance: input.mortgageBalance,
        currentRate: input.mortgageRate,
        currentRateType: input.rateType,
        monthsLeftInTerm: input.monthsLeftInTerm,
        comparisonRate: input.comparisonRate,
      });

  const lines: CostLine[] = [
    {
      id: "listing",
      label: "Listing brokerage commission",
      amount: listingComm,
    },
    { id: "buyer", label: "Buyer brokerage commission", amount: buyerComm },
    {
      id: "commissionHst",
      label: "HST on commission (13%)",
      amount: commissionHst,
    },
    { id: "mortgage", label: "Mortgage payout", amount: input.mortgageBalance },
    {
      id: "penalty",
      label: "Mortgage prepayment penalty",
      amount: penalty.penalty,
    },
    {
      id: "discharge",
      label: "Mortgage discharge fee",
      amount: input.dischargeFee,
    },
    { id: "legal", label: "Legal fees", amount: input.legalFees },
    { id: "legalHst", label: "HST on legal fees", amount: legalHst },
    {
      id: "staging",
      label: "Staging, repairs and cleaning",
      amount: input.staging,
    },
    { id: "moving", label: "Moving", amount: input.moving },
    { id: "other", label: "Other costs", amount: input.other },
  ];
  const costs = lines.reduce((sum, l) => sum + l.amount, 0);
  const net = input.salePrice - costs + input.taxAdjustment;
  // Costs of selling, excluding paying off the mortgage (that's the
  // seller's own equity being released, not a cost).
  const sellingCosts = costs - input.mortgageBalance;

  return {
    lines,
    commission: commission + commissionHst,
    penalty,
    sellingCosts,
    sellingCostShare: input.salePrice > 0 ? sellingCosts / input.salePrice : 0,
    /** Equity before costs: price less the mortgage. */
    equity: input.salePrice - input.mortgageBalance,
    net,
  };
}

// ---------------------------------------------------------------------------
// Buyer closing costs (cash to close)
// ---------------------------------------------------------------------------

export type BuyerClosingInput = {
  price: number;
  downPayment: number;
  amortizationYears: number;
  toronto: boolean;
  firstTimeBuyer: boolean;
  singleFamily: boolean;
  nonResident: boolean;
  condo: boolean;
  legalFees: number;
  titleInsurance: number;
  homeInspection: number;
  appraisal: number;
  /** Seller's prepaid property tax and utilities, reimbursed at closing. */
  adjustments: number;
  moving: number;
  other: number;
};

export function buyerClosingCosts(input: BuyerClosingInput) {
  const ltt = landTransferTax({
    price: input.price,
    toronto: input.toronto,
    firstTimeBuyer: input.firstTimeBuyer,
    singleFamily: input.singleFamily,
    nonResident: input.nonResident,
  });
  const ins = mortgageInsurance({
    price: input.price,
    downPayment: input.downPayment,
    amortizationYears: input.amortizationYears,
  });
  const statusCertificate = input.condo
    ? STATUS_CERTIFICATE_FEE * (1 + ONTARIO_HST)
    : 0;
  const legalHst = input.legalFees * ONTARIO_HST;

  const lines: CostLine[] = [
    {
      id: "ltt",
      label: input.toronto
        ? "Land transfer tax (Ontario + Toronto)"
        : "Land transfer tax",
      amount: ltt.total,
    },
    {
      id: "legal",
      label: "Legal fees and disbursements",
      amount: input.legalFees,
    },
    { id: "legalHst", label: "HST on legal fees", amount: legalHst },
    { id: "title", label: "Title insurance", amount: input.titleInsurance },
    {
      id: "inspection",
      label: "Home inspection",
      amount: input.homeInspection,
    },
    { id: "appraisal", label: "Appraisal", amount: input.appraisal },
    ...(input.condo
      ? [
          {
            id: "status",
            label: "Condo status certificate",
            amount: statusCertificate,
          },
        ]
      : []),
    ...(ins.required && ins.available
      ? [{ id: "pst", label: "PST on mortgage insurance", amount: ins.pst }]
      : []),
    {
      id: "adjustments",
      label: "Property tax and utility adjustments",
      amount: input.adjustments,
    },
    { id: "moving", label: "Moving", amount: input.moving },
    { id: "other", label: "Other costs", amount: input.other },
  ];
  const closingCosts = lines.reduce((sum, l) => sum + l.amount, 0);

  return {
    lines,
    ltt,
    insurance: ins,
    closingCosts,
    closingCostShare: input.price > 0 ? closingCosts / input.price : 0,
    downPayment: input.downPayment,
    cashToClose: input.downPayment + closingCosts,
  };
}

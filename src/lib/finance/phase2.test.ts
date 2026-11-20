import { describe, expect, it } from "vitest";
import { buyerClosingCosts, sellerNet } from "./closing";
import { commission } from "./commission";
import { ownershipCost } from "./ownership";

const seller = {
  salePrice: 1_000_000,
  listingCommission: 0.025,
  buyerCommission: 0.025,
  mortgageBalance: 400_000,
  mortgageRate: 0.05,
  rateType: "fixed" as const,
  monthsLeftInTerm: 0,
  comparisonRate: 0.045,
  portingMortgage: false,
  legalFees: 1_200,
  dischargeFee: 350,
  staging: 0,
  moving: 0,
  taxAdjustment: 0,
  other: 0,
};

describe("seller net sheet", () => {
  it("takes commission plus 13% HST, the payout and fees off the price", () => {
    const r = sellerNet(seller);
    // 5% of $1M = $50,000 + $6,500 HST.
    expect(r.commission).toBeCloseTo(56_500, 6);
    const expected = 1_000_000 - 56_500 - 400_000 - 350 - 1_200 * 1.13;
    expect(r.net).toBeCloseTo(expected, 6);
    expect(r.sellingCosts).toBeCloseTo(56_500 + 350 + 1_356, 6);
    expect(r.equity).toBe(600_000);
  });

  it("adds a penalty when breaking mid-term, none when porting", () => {
    const breaking = sellerNet({ ...seller, monthsLeftInTerm: 24 });
    // IRD: 0.5% × $400K × 2 years = $4,000 vs 3 months' interest (~$4,940).
    expect(breaking.penalty.method).toBe("threeMonths");
    expect(breaking.penalty.penalty).toBeGreaterThan(4_900);
    const ported = sellerNet({
      ...seller,
      monthsLeftInTerm: 24,
      portingMortgage: true,
    });
    expect(ported.penalty.penalty).toBe(0);
  });

  it("credits a prepaid tax adjustment back to the seller", () => {
    const a = sellerNet(seller).net;
    const b = sellerNet({ ...seller, taxAdjustment: 1_000 }).net;
    expect(b - a).toBeCloseTo(1_000, 6);
  });
});

describe("buyer closing costs", () => {
  const buyer = {
    price: 500_000,
    downPayment: 100_000,
    amortizationYears: 25,
    toronto: false,
    firstTimeBuyer: false,
    singleFamily: true,
    nonResident: false,
    condo: false,
    legalFees: 1_800,
    titleInsurance: 400,
    homeInspection: 550,
    appraisal: 0,
    adjustments: 0,
    moving: 0,
    other: 0,
  };

  it("adds land transfer tax, legal with HST and the rest", () => {
    const r = buyerClosingCosts(buyer);
    const expected = 6_475 + 1_800 * 1.13 + 400 + 550;
    expect(r.closingCosts).toBeCloseTo(expected, 6);
    expect(r.cashToClose).toBeCloseTo(100_000 + expected, 6);
    // 20% down: no insurance PST line.
    expect(r.lines.some((l) => l.id === "pst")).toBe(false);
  });

  it("includes PST on insurance under 20% down and the condo certificate", () => {
    const r = buyerClosingCosts({ ...buyer, downPayment: 25_000, condo: true });
    const pst = r.lines.find((l) => l.id === "pst")!;
    expect(pst.amount).toBeCloseTo(475_000 * 0.04 * 0.08, 6);
    const status = r.lines.find((l) => l.id === "status")!;
    expect(status.amount).toBeCloseTo(113, 6);
  });
});

describe("commission", () => {
  const base = {
    salePrice: 1_000_000,
    structure: "flat" as const,
    rate: 0.025,
    tierAmount: 100_000,
    tierRate: 0.04,
    restRate: 0.02,
    agentSplit: 0.7,
    referralFee: 0,
    transactionFee: 500,
  };

  it("splits a flat commission and takes off fees", () => {
    const r = commission(base);
    expect(r.gross).toBeCloseTo(25_000, 6);
    expect(r.hst).toBeCloseTo(3_250, 6);
    expect(r.agentGross).toBeCloseTo(17_500, 6);
    expect(r.brokerage).toBeCloseTo(7_500, 6);
    expect(r.net).toBeCloseTo(17_000, 6);
  });

  it("handles tiered commissions and referral fees", () => {
    const r = commission({ ...base, structure: "tiered", referralFee: 0.25 });
    // 4% of $100K + 2% of $900K = $22,000.
    expect(r.gross).toBeCloseTo(22_000, 6);
    expect(r.referral).toBeCloseTo(5_500, 6);
    expect(r.agentGross).toBeCloseTo(16_500 * 0.7, 6);
  });
});

describe("monthly cost of ownership", () => {
  it("adds the mortgage, tax, insurance, utilities and upkeep", () => {
    const r = ownershipCost({
      price: 600_000,
      downPayment: 120_000,
      rate: 0.05,
      rateType: "fixed",
      amortizationYears: 25,
      propertyTaxRate: 0.01,
      insuranceMonthly: 150,
      utilitiesMonthly: 300,
      condoFeesMonthly: 0,
      maintenanceRate: 0.01,
      otherMonthly: 0,
    });
    // $480K at 5% / 25 yrs = 4.8 × $581.60.
    expect(r.mortgage).toBeCloseTo(2_791.68, 0);
    expect(r.monthly).toBeCloseTo(r.mortgage + 500 + 150 + 300 + 500, 6);
    expect(r.items.some((i) => i.id === "condo")).toBe(false);
    expect(r.equityMonthly).toBeGreaterThan(700);
    expect(r.trueCostMonthly).toBeCloseTo(r.monthly - r.equityMonthly, 6);
  });
});

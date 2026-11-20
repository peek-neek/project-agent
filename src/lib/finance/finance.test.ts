import { describe, expect, it } from "vitest";
import { maxAffordable, qualifyingRate } from "./affordability";
import { bracketTax, landTransferTax } from "./land-transfer-tax";
import {
  amortize,
  minDownPayment,
  mortgageInsurance,
  payment,
  periodicRate,
} from "./mortgage";
import { ONTARIO_LTT } from "./ontario-rules";
import { refinance } from "./refinance";

describe("payments (Canadian semi-annual compounding)", () => {
  it("matches published tables: 5%, 25 years = $581.60 per $100K", () => {
    const p = payment({
      principal: 100_000,
      annualRate: 0.05,
      years: 25,
      frequency: "monthly",
    });
    expect(p).toBeCloseTo(581.6, 1);
  });

  it("is lower than US-style monthly compounding", () => {
    const canadian = periodicRate(0.05, 12, "fixed");
    expect(canadian).toBeLessThan(0.05 / 12);
    expect(periodicRate(0.05, 12, "variable")).toBeCloseTo(0.05 / 12, 10);
  });

  it("accelerated bi-weekly is half the monthly and pays off sooner", () => {
    const base = { principal: 500_000, annualRate: 0.05, years: 25 };
    const monthly = payment({ ...base, frequency: "monthly" });
    const acc = payment({ ...base, frequency: "acceleratedBiWeekly" });
    expect(acc).toBeCloseTo(monthly / 2, 6);
    const run = amortize({ ...base, frequency: "acceleratedBiWeekly" });
    expect(run.payoffYears).toBeLessThan(23);
    const normal = amortize({ ...base, frequency: "monthly" });
    expect(normal.payoffYears).toBeCloseTo(25, 1);
  });

  it("amortizes to zero and reports the end-of-term balance", () => {
    const run = amortize({
      principal: 400_000,
      annualRate: 0.045,
      years: 25,
      frequency: "monthly",
      termYears: 5,
    });
    expect(run.schedule.at(-1)!.balance).toBeLessThan(0.01);
    expect(run.term!.balance).toBeGreaterThan(300_000);
    expect(run.term!.balance).toBeLessThan(400_000);
    expect(run.totalPaid).toBeCloseTo(400_000 + run.totalInterest, 6);
  });

  it("handles a 0% rate", () => {
    expect(
      payment({
        principal: 120_000,
        annualRate: 0,
        years: 10,
        frequency: "monthly",
      }),
    ).toBeCloseTo(1_000, 6);
  });
});

describe("down payment and insurance", () => {
  it("minimum down payment follows the 5% / 10% / 20% bands", () => {
    expect(minDownPayment(400_000)).toBe(20_000);
    expect(minDownPayment(500_000)).toBe(25_000);
    expect(minDownPayment(700_000)).toBe(45_000);
    expect(minDownPayment(1_500_000)).toBe(300_000);
  });

  it("charges 4.00% at 95% loan-to-value", () => {
    const ins = mortgageInsurance({
      price: 500_000,
      downPayment: 25_000,
      amortizationYears: 25,
    });
    expect(ins.required).toBe(true);
    expect(ins.rate).toBeCloseTo(0.04, 10);
    expect(ins.premium).toBeCloseTo(19_000, 6);
    expect(ins.pst).toBeCloseTo(1_520, 6);
  });

  it("adds the 0.20% surcharge for 30-year amortization", () => {
    const ins = mortgageInsurance({
      price: 500_000,
      downPayment: 50_000,
      amortizationYears: 30,
    });
    expect(ins.rate).toBeCloseTo(0.031 + 0.002, 10);
  });

  it("needs no insurance at 20% down and none is possible at $1.5M+", () => {
    expect(
      mortgageInsurance({
        price: 800_000,
        downPayment: 160_000,
        amortizationYears: 25,
      }).required,
    ).toBe(false);
    const big = mortgageInsurance({
      price: 1_600_000,
      downPayment: 200_000,
      amortizationYears: 25,
    });
    expect(big.available).toBe(false);
  });
});

describe("land transfer tax", () => {
  it("Ontario on $500K is $6,475", () => {
    expect(bracketTax(500_000, ONTARIO_LTT)).toBeCloseTo(6_475, 6);
  });

  it("Toronto doubles it, and first-time rebates stack", () => {
    const t = landTransferTax({
      price: 500_000,
      toronto: true,
      firstTimeBuyer: false,
    });
    expect(t.total).toBeCloseTo(12_950, 6);
    const ftb = landTransferTax({
      price: 500_000,
      toronto: true,
      firstTimeBuyer: true,
    });
    expect(ftb.provincialRebate).toBe(4_000);
    expect(ftb.municipalRebate).toBe(4_475);
    expect(ftb.total).toBeCloseTo(12_950 - 8_475, 6);
  });

  it("first-time buyers pay nothing under $368,333 in Ontario", () => {
    const t = landTransferTax({
      price: 368_000,
      toronto: false,
      firstTimeBuyer: true,
    });
    expect(t.total).toBe(0);
  });

  it("applies Toronto's 2026 luxury bands above $3M", () => {
    const at3 = landTransferTax({
      price: 3_000_000,
      toronto: true,
      firstTimeBuyer: false,
    });
    const at4 = landTransferTax({
      price: 4_000_000,
      toronto: true,
      firstTimeBuyer: false,
    });
    // The extra $1M costs 2.5% provincially + 4.40% municipally.
    expect(at4.total - at3.total).toBeCloseTo(1_000_000 * (0.025 + 0.044), 4);
  });

  it("adds 25% NRST (plus 10% in Toronto) for non-residents", () => {
    const t = landTransferTax({
      price: 1_000_000,
      toronto: true,
      firstTimeBuyer: true,
      nonResident: true,
    });
    expect(t.provincialRebate).toBe(0);
    expect(t.nonResident).toBeCloseTo(350_000, 6);
  });
});

describe("affordability", () => {
  it("qualifies at the greater of 5.25% or rate + 2%", () => {
    expect(qualifyingRate(0.03)).toBeCloseTo(0.0525, 10);
    expect(qualifyingRate(0.045)).toBeCloseTo(0.065, 10);
  });

  it("finds a price within GDS / TDS limits", () => {
    const r = maxAffordable({
      annualIncome: 150_000,
      monthlyDebts: 500,
      downPayment: 100_000,
      annualRate: 0.045,
      amortizationYears: 25,
      propertyTaxRate: 0.01,
      heatingMonthly: 100,
      condoFeesMonthly: 0,
    });
    expect(r.ok).toBe(true);
    expect(r.gds).toBeLessThanOrEqual(0.39 + 1e-9);
    expect(r.tds).toBeLessThanOrEqual(0.44 + 1e-9);
    expect(r.price).toBeGreaterThan(450_000);
    expect(r.price).toBeLessThan(800_000);
    expect(r.bindingLimit).not.toBeNull();
  });

  it("is limited by the down payment when savings are small", () => {
    const r = maxAffordable({
      annualIncome: 400_000,
      monthlyDebts: 0,
      downPayment: 20_000,
      annualRate: 0.045,
      amortizationYears: 25,
      propertyTaxRate: 0.01,
      heatingMonthly: 100,
      condoFeesMonthly: 0,
    });
    // 5% minimum: $20K buys at most $400K.
    expect(r.price).toBeLessThanOrEqual(400_000);
    expect(r.bindingLimit).toBe("down-payment");
  });
});

describe("renewal and refinance", () => {
  const base = {
    balance: 400_000,
    currentRate: 0.055,
    remainingYears: 20,
    monthsLeftInTerm: 24,
    currentRateType: "fixed" as const,
    comparisonRate: 0.045,
    newRate: 0.045,
    newAmortizationYears: 20,
    homeValue: 900_000,
    cashOut: 0,
    fees: 1_500,
    frequency: "monthly" as const,
  };

  it("uses the larger of 3 months' interest and the IRD for fixed", () => {
    const r = refinance(base);
    // IRD: 1% × $400K × 2 years = $8,000.
    expect(r.ird).toBeCloseTo(8_000, 6);
    expect(r.penalty).toBe(r.ird);
    expect(r.penaltyMethod).toBe("ird");
    expect(r.monthlySaving).toBeGreaterThan(0);
    expect(r.breakEvenMonths).toBeGreaterThan(0);
  });

  it("variable rates pay only 3 months' interest; none at maturity", () => {
    const v = refinance({ ...base, currentRateType: "variable" });
    expect(v.penaltyMethod).toBe("threeMonths");
    expect(v.penalty).toBeGreaterThan(5_000);
    expect(v.penalty).toBeLessThan(6_000);
    expect(refinance({ ...base, monthsLeftInTerm: 0 }).penalty).toBe(0);
  });

  it("caps borrowing at 80% of the home's value", () => {
    const r = refinance({ ...base, cashOut: 500_000 });
    expect(r.newLoan).toBe(720_000);
    expect(r.cashOutCapped).toBe(true);
    expect(r.availableEquity).toBe(320_000);
  });
});

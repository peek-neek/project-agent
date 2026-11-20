import { describe, expect, it } from "vitest";
import {
  bridgeFinancing,
  prepayment,
  rentalAnalysis,
  rentVsBuy,
} from "./investing";
import { propertyTaxRateFor, PROPERTY_TAX_RATES } from "./property-tax-rates";

describe("property tax rates", () => {
  it("has Toronto's 2025 rate (matches toronto.ca 0.754087%)", () => {
    expect(PROPERTY_TAX_RATES.Toronto).toBeCloseTo(0.007541, 6);
  });
  it("finds a city from the report, tolerating 'City of'", () => {
    expect(propertyTaxRateFor("City of Ottawa")?.rate).toBeCloseTo(0.01232, 6);
    expect(propertyTaxRateFor("richmond hill")?.name).toBe("Richmond Hill");
    expect(propertyTaxRateFor("Atlantis")).toBeNull();
  });
});

describe("rental analysis", () => {
  const base = {
    price: 600_000,
    downPayment: 120_000,
    rate: 0.05,
    amortizationYears: 25,
    rent: 3_000,
    otherIncome: 0,
    vacancy: 0.04,
    propertyTaxRate: 0.01,
    insuranceMonthly: 150,
    condoFeesMonthly: 0,
    utilitiesMonthly: 0,
    maintenance: 0.05,
    management: 0,
    closingCosts: 10_000,
    setupCosts: 0,
    appreciation: 0.03,
  };

  it("computes NOI, cap rate, cash flow and coverage", () => {
    const r = rentalAnalysis(base);
    // Income: 36,000 − 4% = 34,560. Costs: 6,000 tax + 1,800 + 1,800 maint.
    expect(r.effectiveIncome).toBeCloseTo(34_560, 6);
    expect(r.noi).toBeCloseTo(34_560 - 9_600, 6);
    expect(r.capRate).toBeCloseTo(24_960 / 600_000, 6);
    expect(r.cashFlow).toBeCloseTo(24_960 - r.debtService, 6);
    expect(r.dscr).toBeCloseTo(24_960 / r.debtService, 6);
    expect(r.cashInvested).toBe(130_000);
  });

  it("break-even rent gives zero cash flow", () => {
    const r = rentalAnalysis(base);
    const atBreakEven = rentalAnalysis({ ...base, rent: r.breakEvenRent! });
    expect(atBreakEven.cashFlow).toBeCloseTo(0, 4);
  });
});

describe("rent vs buy", () => {
  const base = {
    price: 700_000,
    downPayment: 140_000,
    rate: 0.045,
    amortizationYears: 25,
    toronto: false,
    firstTimeBuyer: false,
    otherBuyingCosts: 3_000,
    propertyTaxRate: 0.01,
    maintenanceRate: 0.01,
    insuranceMonthly: 150,
    condoFeesMonthly: 0,
    rentMonthly: 3_000,
    rentInsuranceMonthly: 25,
    rentIncrease: 0.03,
    appreciation: 0.03,
    investmentReturn: 0.05,
    sellingCostRate: 0.055,
    years: 10,
  };

  it("tracks both net worths each year", () => {
    const r = rentVsBuy(base);
    expect(r.years).toHaveLength(10);
    expect(r.upfront).toBeGreaterThan(140_000);
    // The renter starts by investing the buyer's upfront cash.
    expect(r.years[0].rentNetWorth).toBeGreaterThan(r.upfront);
  });

  it("buying wins with strong appreciation; renting with none", () => {
    const hot = rentVsBuy({ ...base, appreciation: 0.07 });
    const flat = rentVsBuy({ ...base, appreciation: 0 });
    expect(hot.advantage).toBeGreaterThan(0);
    expect(flat.advantage).toBeLessThan(0);
  });
});

describe("prepayment", () => {
  it("extra payments save interest and time", () => {
    const r = prepayment({
      balance: 400_000,
      rate: 0.05,
      remainingYears: 25,
      extraMonthly: 200,
      annualLump: 5_000,
      lumpNow: 0,
    });
    expect(r.baseMonths).toBe(300);
    expect(r.newMonths).toBeLessThan(250);
    expect(r.interestSaved).toBeGreaterThan(50_000);
    expect(r.chart[0].base).toBe(400_000);
  });

  it("no prepayment means no change", () => {
    const r = prepayment({
      balance: 300_000,
      rate: 0.04,
      remainingYears: 20,
      extraMonthly: 0,
      annualLump: 0,
      lumpNow: 0,
    });
    expect(r.monthsSaved).toBe(0);
    expect(r.interestSaved).toBeCloseTo(0, 6);
  });
});

describe("bridge financing", () => {
  it("charges simple daily interest plus fees", () => {
    const r = bridgeFinancing({
      bridgeAmount: 200_000,
      bridgeRate: 0.073,
      adminFee: 500,
      days: 30,
      currentHomeMonthly: 3_000,
      newHomeMonthly: 4_000,
      legalFee: 300,
    });
    expect(r.interest).toBeCloseTo(200_000 * 0.073 * (30 / 365), 6);
    expect(r.legal).toBeCloseTo(339, 6);
    expect(r.extraCarrying).toBeCloseTo((3_000 * 30 * 12) / 365, 6);
    expect(r.totalExtra).toBeCloseTo(r.bridgeCost + r.extraCarrying, 6);
  });
});

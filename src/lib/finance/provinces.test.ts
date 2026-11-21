import { describe, expect, it } from "vitest";
import { landTransferTax } from "./land-transfer-tax";
import { mortgageInsurance } from "./mortgage";
import { COMMISSION_TAX, transferTax } from "./provinces";

const tax = (province: Parameters<typeof transferTax>[0]["province"], price: number, extra = {}) =>
  transferTax({ province, price, firstTimeBuyer: false, ...extra });

describe("transfer tax by province", () => {
  it("Ontario matches the existing Ontario/Toronto calculation", () => {
    for (const toronto of [false, true]) {
      const before = landTransferTax({ price: 1_250_000, toronto, firstTimeBuyer: true });
      const after = transferTax({ province: "ON", price: 1_250_000, toronto, firstTimeBuyer: true });
      expect(after.total).toBeCloseTo(before.total, 6);
    }
  });

  it("BC: 1% to $200K, 2% to $2M, 3% to $3M, 5% above", () => {
    expect(tax("BC", 1_000_000).total).toBe(18_000);
    expect(tax("BC", 3_500_000).total).toBe(2_000 + 36_000 + 30_000 + 25_000);
  });

  it("BC first-time buyers: tax on the first $500K forgiven, phased out $835K–$860K", () => {
    expect(tax("BC", 800_000, { firstTimeBuyer: true }).total).toBe(14_000 - 8_000);
    expect(tax("BC", 600_000, { firstTimeBuyer: true }).provincialRebate).toBe(8_000);
    expect(tax("BC", 847_500, { firstTimeBuyer: true }).provincialRebate).toBeCloseTo(4_000, 6);
    expect(tax("BC", 900_000, { firstTimeBuyer: true }).provincialRebate).toBe(0);
  });

  it("BC foreign buyers pay 20% more; non-residents get no first-time relief", () => {
    const r = tax("BC", 1_000_000, { nonResident: true, firstTimeBuyer: true });
    expect(r.nonResident).toBe(200_000);
    expect(r.provincialRebate).toBe(0);
  });

  it("Quebec standard and Montréal brackets (2026)", () => {
    expect(tax("QC", 500_000).total).toBeCloseTo(314.5 + 2_521 + 2_775, 6);
    expect(tax("QC", 1_000_000, { montreal: true }).total).toBeCloseTo(
      314.5 + 2_521 + 3_559.5 + 8_954,
      6,
    );
  });

  it("Quebec first-time buyer credit: first $5,000 + 25% of the next $3,500", () => {
    const r = tax("QC", 500_000, { firstTimeBuyer: true });
    expect(r.municipalRebate).toBeCloseTo(5_000 + 0.25 * 610.5, 6);
    const big = tax("QC", 2_000_000, { montreal: true, firstTimeBuyer: true });
    expect(big.municipalRebate).toBe(5_875);
  });

  it("Manitoba: $400K → $5,650", () => {
    expect(tax("MB", 400_000).total).toBe(5_650);
  });

  it("Alberta: $50 + $5 per $5,000 (part counts as whole)", () => {
    expect(tax("AB", 300_000).total).toBe(350);
    expect(tax("AB", 300_001).total).toBe(355);
    expect(tax("AB", 300_000).isTax).toBe(false);
  });

  it("Saskatchewan: 0.4% above $6,300", () => {
    expect(tax("SK", 1_000_000).total).toBe(4_000);
    expect(tax("SK", 5_000).total).toBe(25);
  });

  it("New Brunswick 1%; PEI 1% with first-time buyers exempt", () => {
    expect(tax("NB", 350_000).total).toBe(3_500);
    expect(tax("PE", 400_000).total).toBe(4_000);
    expect(tax("PE", 400_000, { firstTimeBuyer: true }).total).toBe(0);
  });

  it("Nova Scotia: 1.5% deed transfer tax, +10% for non-residents", () => {
    expect(tax("NS", 500_000).total).toBe(7_500);
    expect(tax("NS", 500_000, { nonResident: true }).total).toBe(57_500);
  });

  it("Newfoundland and Labrador: $100 + $0.40 per $100 above $500", () => {
    expect(tax("NL", 300_000).total).toBeCloseTo(1_298, 6);
    expect(tax("NL", 500_000).total).toBeCloseTo(2_098, 6);
  });

  it("territories are flagged as estimates", () => {
    for (const p of ["YT", "NT", "NU"] as const) {
      const r = tax(p, 500_000);
      expect(r.estimate).toBe(true);
      expect(r.total).toBeGreaterThan(0);
    }
  });
});

describe("province sales taxes", () => {
  it("mortgage insurance premium tax: ON 8%, QC 9%, SK 6%, none in BC", () => {
    const at = (province: "ON" | "QC" | "SK" | "BC") =>
      mortgageInsurance({ price: 500_000, downPayment: 25_000, amortizationYears: 25, province });
    const premium = at("ON").premium;
    expect(at("ON").pst).toBeCloseTo(premium * 0.08, 6);
    expect(at("QC").pst).toBeCloseTo(premium * 0.09, 6);
    expect(at("SK").pst).toBeCloseTo(premium * 0.06, 6);
    expect(at("BC").pst).toBe(0);
  });

  it("commission tax: HST, GST + QST, or GST", () => {
    expect(COMMISSION_TAX.ON.rate).toBe(0.13);
    expect(COMMISSION_TAX.NS.rate).toBe(0.14);
    expect(COMMISSION_TAX.QC.rate).toBeCloseTo(0.14975, 6);
    expect(COMMISSION_TAX.AB.rate).toBe(0.05);
  });
});

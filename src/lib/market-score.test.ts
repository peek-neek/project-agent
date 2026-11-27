import { describe, expect, it } from "vitest";
import { incomeToQualify } from "./finance/affordability";
import { payment } from "./finance/mortgage";
import { marketScore } from "./market-score";
import type { AmenitiesData, SafetyData } from "./report-sections";

// Minimal report data: enough factors for a score (errands + safety + env).
const place = (minutes: number) => ({
  id: `p${minutes}`,
  name: "Place",
  lat: 0,
  lng: 0,
  address: "1 Main St",
  distanceMeters: minutes * 80,
  walkMinutes: minutes,
  driveMinutes: minutes / 4,
});
const amenities = {
  categories: Object.fromEntries(
    ["groceries", "pharmacies", "cafes", "restaurants", "parks"].map((c) => [
      c,
      [place(8)],
    ]),
  ),
} as unknown as AmenitiesData;
const safety = {
  crime: { lowerRateThanShare: 0.6 },
  areaCrime: null,
  flood: { status: "outside" },
  noise: { highway: null, railway: null, airport: false },
  airQuality: null,
} as unknown as SafetyData;
const base = { amenities, commute: null, schools: null, safety, upside: null };

describe("price point", () => {
  it("works out the income to qualify by hand", () => {
    // $849K, 20% down, stress test max(5.25%, 4.49% + 2%) = 6.49%.
    const monthly = payment({
      principal: 679_200,
      annualRate: 0.0649,
      years: 25,
      frequency: "monthly",
    });
    const housing = monthly + (849_000 * 0.00737) / 12 + 100;
    expect(
      incomeToQualify({
        price: 849_000,
        annualRate: 0.0449,
        amortizationYears: 25,
        propertyTaxRate: 0.00737,
        heatingMonthly: 100,
      }),
    ).toBeCloseTo((housing / 0.39) * 12, 0);
  });

  it("only appears with a list price", () => {
    const without = marketScore(base, "walk")!;
    expect(without.factors.some((f) => f.id === "price")).toBe(false);
    const withPrice = marketScore({ ...base, listPrice: 849_000 }, "walk")!;
    const price = withPrice.factors.find((f) => f.id === "price")!;
    expect(price.detail).toMatch(/^\$849K needs about \$\d+K household income/);
  });

  it("lowers the score as the price rises", () => {
    const at = (listPrice: number) =>
      marketScore({ ...base, listPrice, city: "Toronto" }, "walk")!;
    const cheap = at(500_000);
    const mid = at(1_100_000);
    const dear = at(3_000_000);
    expect(cheap.ease).toBeGreaterThan(mid.ease);
    expect(mid.ease).toBeGreaterThan(dear.ease);
    expect(cheap.factors.find((f) => f.id === "price")!.score).toBe(1);
    expect(dear.factors.find((f) => f.id === "price")!.score).toBe(0);
    expect(dear.factors.find((f) => f.id === "price")!.detail).toMatch(
      /^\$3M needs/,
    );
  });
});

import { describe, expect, it } from "vitest";
import { calculatorTools, type FinanceContext } from "./calculator-tools";

type Exec = (
  input: Record<string, unknown>,
) => Promise<Record<string, unknown>>;
const opts = { toolCallId: "t", messages: [] } as never;

function run(ctx: FinanceContext, name: string, input = {}) {
  const tools = calculatorTools(ctx) as unknown as Record<
    string,
    { execute: (i: unknown, o: never) => ReturnType<Exec> }
  >;
  return tools[name].execute(input, opts);
}

const listed: FinanceContext = {
  listPrice: 849_000,
  city: "Toronto",
  propertyType: null,
  saved: null,
};
const bare: FinanceContext = {
  listPrice: null,
  city: null,
  propertyType: null,
  saved: null,
};

describe("chat calculator tools", () => {
  it("uses the list price and matches the PDF's default payment", async () => {
    const r = await run(listed, "mortgage_payment");
    expect(r.price).toBe(849_000);
    expect(r.downPayment).toBe(170_000);
    // Same figure as the PDF's default scenario at $849K.
    expect(r.payment).toBeCloseTo(3_754.31, 0);
  });

  it("asks for a price when there is none", async () => {
    const r = await run(bare, "mortgage_payment");
    expect(r.error).toMatch(/price/i);
    const t = await run(bare, "mortgage_payment", { price: 700_000 });
    expect(t.price).toBe(700_000);
  });

  it("prefers a saved price and saved down payment share", async () => {
    const r = await run(
      {
        ...listed,
        saved: { purchase: { price: 500_000, downPayment: 50_000 } },
      },
      "mortgage_payment",
    );
    expect(r.price).toBe(500_000);
    expect(r.downPayment).toBe(50_000);
    expect(r.insurance).toMatchObject({ addedToMortgage: true });
  });

  it("adds Toronto land transfer tax on closing costs", async () => {
    const r = (await run(listed, "closing_costs", {
      firstTimeBuyer: true,
    })) as {
      landTransferTax: { toronto: number; torontoRebate: number };
    };
    expect(r.landTransferTax.toronto).toBeGreaterThan(0);
    expect(r.landTransferTax.torontoRebate).toBe(4_475);
  });

  it("uses Toronto's tax rate", async () => {
    const r = await run(listed, "property_tax", { assessedValue: 1_000_000 });
    expect(r.annualTax).toBe(7_541);
  });

  it("splits a total commission between both sides", async () => {
    const r = await run(listed, "seller_net", {
      salePrice: 1_000_000,
      commissionTotalPercent: 5,
      mortgageBalance: 0,
    });
    expect(r.commissionWithHst).toBe(56_500);
  });

  it("returns the rest without throwing", async () => {
    for (const name of [
      "affordability",
      "rental_analysis",
      "rent_vs_buy",
      "commission",
    ]) {
      const r = await run(listed, name);
      expect(r.error).toBeUndefined();
    }
  });
});

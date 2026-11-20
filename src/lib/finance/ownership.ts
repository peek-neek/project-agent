// The real monthly cost of owning: mortgage plus everything around it.

import { mortgageInsurance, payment, periodicRate } from "./mortgage";

export type OwnershipInput = {
  price: number;
  downPayment: number;
  rate: number;
  rateType: "fixed" | "variable";
  amortizationYears: number;
  /** Property tax per year, share of the price (decimal). */
  propertyTaxRate: number;
  insuranceMonthly: number;
  utilitiesMonthly: number;
  condoFeesMonthly: number;
  /** Maintenance set aside per year, share of the price (decimal). */
  maintenanceRate: number;
  otherMonthly: number;
};

export function ownershipCost(input: OwnershipInput) {
  const ins = mortgageInsurance({
    price: input.price,
    downPayment: input.downPayment,
    amortizationYears: input.amortizationYears,
  });
  const loan =
    Math.max(0, input.price - input.downPayment) +
    (ins.available ? ins.premium : 0);
  const mortgage = payment({
    principal: loan,
    annualRate: input.rate,
    years: input.amortizationYears,
    frequency: "monthly",
    rateType: input.rateType,
  });
  // First payment's split: how much of the mortgage builds equity.
  const firstInterest = loan * periodicRate(input.rate, 12, input.rateType);
  const items = [
    { id: "mortgage", label: "Mortgage payment", amount: mortgage },
    {
      id: "tax",
      label: "Property tax",
      amount: (input.price * input.propertyTaxRate) / 12,
    },
    {
      id: "insurance",
      label: "Home insurance",
      amount: input.insuranceMonthly,
    },
    {
      id: "utilities",
      label: "Utilities (hydro, water, heat)",
      amount: input.utilitiesMonthly,
    },
    { id: "condo", label: "Condo fees", amount: input.condoFeesMonthly },
    {
      id: "maintenance",
      label: "Maintenance reserve",
      amount: (input.price * input.maintenanceRate) / 12,
    },
    { id: "other", label: "Other", amount: input.otherMonthly },
  ].filter((i) => i.amount > 0 || i.id === "mortgage");
  const monthly = items.reduce((sum, i) => sum + i.amount, 0);
  const equityMonthly = Math.max(0, mortgage - firstInterest);
  return {
    items,
    loan,
    mortgage,
    monthly,
    annual: monthly * 12,
    /** Principal in the first payment: builds equity, not a pure cost. */
    equityMonthly,
    /** Cost without the equity part. */
    trueCostMonthly: monthly - equityMonthly,
  };
}

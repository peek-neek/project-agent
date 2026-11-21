// Calculator inputs: one shape for the calculators tab, the inputs saved on
// a report, the PDF's financial scenarios and the chat's calculator tools.
// Saved inputs are partial; they're merged over the defaults, so adding a
// field later never breaks older saves.

import { z } from "zod";
import { DEFAULTS, EXAMPLE_PRICE, roundTo } from "./defaults";
import { TYPICAL } from "./ontario-rules";
import {
  LEGAL_FEE_TAX,
  PROVINCE_CODES,
  provinceOr,
  TYPICAL_PROPERTY_TAX,
  transferTax,
} from "./provinces";
import {
  ONTARIO_MEDIAN_TAX_RATE,
  propertyTaxRateFor,
} from "./property-tax-rates";

const money = z.number().min(0).max(1_000_000_000);
const rate = z.number().min(0).max(1);
const years = z.number().int().min(0).max(40);
const rateType = z.enum(["fixed", "variable"]);
const frequency = z.enum([
  "monthly",
  "semiMonthly",
  "biWeekly",
  "acceleratedBiWeekly",
  "weekly",
  "acceleratedWeekly",
]);

export const purchaseSchema = z.object({
  price: money,
  downPayment: money,
  rate,
  rateType,
  amortization: years,
  frequency,
  termYears: years,
  firstTimeBuyer: z.boolean(),
  newBuild: z.boolean(),
  /** The property's province: sets transfer tax and sales taxes. */
  province: z.enum(PROVINCE_CODES),
  /** Inside the City of Toronto (Ontario municipal land transfer tax). */
  toronto: z.boolean(),
  /** Inside the City of Montréal (higher welcome tax brackets). */
  montreal: z.boolean(),
  singleFamily: z.boolean(),
  nonResident: z.boolean(),
});
export const affordSchema = z.object({
  income: money,
  debts: money,
  taxRate: rate,
  heating: money,
  condoFees: money,
});
export const refiSchema = z.object({
  homeValue: money,
  balance: money,
  currentRate: rate,
  remainingYears: years,
  monthsLeftInTerm: z.number().int().min(0).max(120),
  currentRateType: rateType,
  comparisonRate: rate,
  newRate: rate,
  newAmortizationYears: years,
  cashOut: money,
  fees: money,
});
export const closingSchema = z.object({
  condo: z.boolean(),
  legalFees: money,
  titleInsurance: money,
  homeInspection: money,
  appraisal: money,
  adjustments: money,
  moving: money,
  other: money,
});
export const sellerSchema = z.object({
  salePrice: money,
  listingCommission: rate,
  buyerCommission: rate,
  mortgageBalance: money,
  mortgageRate: rate,
  rateType,
  monthsLeftInTerm: z.number().int().min(0).max(120),
  comparisonRate: rate,
  portingMortgage: z.boolean(),
  legalFees: money,
  dischargeFee: money,
  staging: money,
  moving: money,
  taxAdjustment: money,
  other: money,
});
export const commissionSchema = z.object({
  salePrice: money,
  structure: z.enum(["flat", "tiered"]),
  rate,
  tierAmount: money,
  tierRate: rate,
  restRate: rate,
  agentSplit: rate,
  referralFee: rate,
  transactionFee: money,
});
export const ownershipSchema = z.object({
  insurance: money,
  utilities: money,
  maintenanceRate: rate,
  other: money,
});
export const rentalSchema = z.object({
  price: money,
  downPayment: money,
  rate,
  amortizationYears: years,
  rent: money,
  otherIncome: money,
  vacancy: rate,
  propertyTaxRate: rate,
  insuranceMonthly: money,
  condoFeesMonthly: money,
  utilitiesMonthly: money,
  maintenance: rate,
  management: rate,
  closingCosts: money,
  setupCosts: money,
  appreciation: rate,
});
export const rentVsBuySchema = z.object({
  otherBuyingCosts: money,
  maintenanceRate: rate,
  insuranceMonthly: money,
  condoFeesMonthly: money,
  rentMonthly: money,
  rentInsuranceMonthly: money,
  rentIncrease: rate,
  appreciation: rate,
  investmentReturn: rate,
  sellingCostRate: rate,
  years: years,
});
export const prepaySchema = z.object({
  balance: money,
  rate,
  remainingYears: years,
  extraMonthly: money,
  annualLump: money,
  lumpNow: money,
});
export const bridgeSchema = z.object({
  bridgeAmount: money,
  bridgeRate: rate,
  adminFee: money,
  days: z.number().int().min(1).max(365),
  currentHomeMonthly: money,
  newHomeMonthly: money,
  legalFee: money,
});
export const taxSchema = z.object({
  municipality: z.string().max(80),
  customRate: rate,
  assessedValue: money,
});

const shapes = {
  purchase: purchaseSchema,
  afford: affordSchema,
  refi: refiSchema,
  closing: closingSchema,
  seller: sellerSchema,
  comm: commissionSchema,
  own: ownershipSchema,
  rental: rentalSchema,
  rvb: rentVsBuySchema,
  prepay: prepaySchema,
  bridge: bridgeSchema,
  tax: taxSchema,
};

export type PurchaseState = z.infer<typeof purchaseSchema>;
export type AffordState = z.infer<typeof affordSchema>;
export type RefiState = z.infer<typeof refiSchema>;
export type ClosingState = z.infer<typeof closingSchema>;
export type SellerState = z.infer<typeof sellerSchema>;
export type CommissionState = z.infer<typeof commissionSchema>;
export type OwnershipState = z.infer<typeof ownershipSchema>;
export type RentalState = z.infer<typeof rentalSchema>;
export type RentVsBuyState = z.infer<typeof rentVsBuySchema>;
export type PrepayState = z.infer<typeof prepaySchema>;
export type BridgeState = z.infer<typeof bridgeSchema>;
export type TaxState = z.infer<typeof taxSchema>;

export type CalculatorInputs = {
  [K in keyof typeof shapes]: z.infer<(typeof shapes)[K]>;
};

/**
 * What's stored on a report: any subset of the inputs (each calculator
 * partial too), so saves stay valid as fields are added.
 */
export const savedCalculatorsSchema = z.object({
  purchase: purchaseSchema.partial().optional(),
  afford: affordSchema.partial().optional(),
  refi: refiSchema.partial().optional(),
  closing: closingSchema.partial().optional(),
  seller: sellerSchema.partial().optional(),
  comm: commissionSchema.partial().optional(),
  own: ownershipSchema.partial().optional(),
  rental: rentalSchema.partial().optional(),
  rvb: rentVsBuySchema.partial().optional(),
  prepay: prepaySchema.partial().optional(),
  bridge: bridgeSchema.partial().optional(),
  tax: taxSchema.partial().optional(),
  savedAt: z.string().optional(),
});
export type SavedCalculators = z.infer<typeof savedCalculatorsSchema>;

/** Custom property tax rate marker in `tax.municipality`. */
export const CUSTOM_MUNICIPALITY = "__custom";

export type ScenarioContext = {
  listPrice: number | null;
  city: string | null;
  /** Two-letter province code from the report; Ontario when unknown. */
  province?: string | null;
  propertyType: string | null;
};

/** The starting inputs for a report (before any saved changes). */
export function defaultInputs({
  listPrice,
  city,
  province: provinceCode,
  propertyType,
}: ScenarioContext): CalculatorInputs {
  const price = listPrice ?? EXAMPLE_PRICE;
  const type = propertyType?.toLowerCase() ?? "";
  const condo = type.includes("condo");
  const province = provinceOr(provinceCode);
  const cityName = city?.trim().toLowerCase() ?? "";
  const toronto = province === "ON" && cityName === "toronto";
  const montreal = province === "QC" && (cityName === "montréal" || cityName === "montreal");
  // Municipal rates are on file for Ontario; elsewhere, a provincial typical.
  const cityTax = province === "ON" ? propertyTaxRateFor(city) : null;
  const taxRate =
    cityTax?.rate ?? (province === "ON" ? TYPICAL.propertyTaxOther : TYPICAL_PROPERTY_TAX[province]);
  const legalWithTax = TYPICAL.buyerLegalFees * (1 + LEGAL_FEE_TAX[province].rate);
  const insurance = condo ? TYPICAL.insuranceCondo : TYPICAL.insuranceHouse;
  const maintenanceRate = condo
    ? TYPICAL.maintenanceCondo
    : TYPICAL.maintenanceHouse;
  const condoFees = condo ? DEFAULTS.condoFees : 0;

  return {
    purchase: {
      price,
      downPayment: roundTo(price * DEFAULTS.downShare, 1_000),
      rate: DEFAULTS.rate,
      rateType: "fixed",
      amortization: DEFAULTS.amortization,
      frequency: "monthly",
      termYears: DEFAULTS.termYears,
      firstTimeBuyer: false,
      newBuild: false,
      province,
      toronto,
      montreal,
      singleFamily: !condo && !type.includes("multiplex"),
      nonResident: false,
    },
    afford: {
      income: DEFAULTS.income,
      debts: DEFAULTS.monthlyDebts,
      taxRate,
      heating: DEFAULTS.heating,
      condoFees,
    },
    refi: {
      homeValue: price,
      balance: roundTo(price * DEFAULTS.refiBalanceShare, 1_000),
      currentRate: DEFAULTS.currentRate,
      remainingYears: DEFAULTS.refiRemainingYears,
      monthsLeftInTerm: 0,
      currentRateType: "fixed",
      comparisonRate: DEFAULTS.rate,
      newRate: DEFAULTS.rate,
      newAmortizationYears: DEFAULTS.refiRemainingYears,
      cashOut: 0,
      fees: 1_500,
    },
    closing: {
      condo,
      legalFees: TYPICAL.buyerLegalFees,
      titleInsurance: TYPICAL.titleInsurance,
      homeInspection: TYPICAL.homeInspection,
      appraisal: TYPICAL.appraisal,
      adjustments: 0,
      moving: TYPICAL.moving,
      other: 0,
    },
    seller: {
      salePrice: price,
      listingCommission: TYPICAL.commissionPerSide,
      buyerCommission: TYPICAL.commissionPerSide,
      mortgageBalance: roundTo(price * DEFAULTS.sellerBalanceShare, 1_000),
      mortgageRate: DEFAULTS.sellerRate,
      rateType: "fixed",
      monthsLeftInTerm: 0,
      comparisonRate: DEFAULTS.rate,
      portingMortgage: false,
      legalFees: TYPICAL.sellerLegalFees,
      dischargeFee: TYPICAL.mortgageDischargeFee,
      staging: 0,
      moving: TYPICAL.moving,
      taxAdjustment: 0,
      other: 0,
    },
    comm: {
      salePrice: price,
      structure: "flat",
      rate: TYPICAL.commissionPerSide,
      tierAmount: 100_000,
      tierRate: 0.04,
      restRate: 0.02,
      agentSplit: DEFAULTS.agentSplit,
      referralFee: 0,
      transactionFee: 0,
    },
    own: {
      insurance,
      utilities: condo ? TYPICAL.utilitiesCondo : TYPICAL.utilitiesHouse,
      maintenanceRate,
      other: 0,
    },
    rental: {
      price,
      downPayment: roundTo(price * DEFAULTS.downShare, 1_000),
      rate: DEFAULTS.rentalRate,
      amortizationYears: DEFAULTS.amortization,
      // Example rent (~0.45% of the price a month); agents enter the real one.
      rent: roundTo(price * DEFAULTS.rentShare, 50),
      otherIncome: 0,
      vacancy: DEFAULTS.vacancy,
      propertyTaxRate: taxRate,
      insuranceMonthly: insurance,
      condoFeesMonthly: condoFees,
      utilitiesMonthly: 0,
      maintenance: DEFAULTS.rentalMaintenance,
      management: 0,
      closingCosts: Math.round(
        transferTax({ province, price, toronto, montreal, firstTimeBuyer: false }).total +
          legalWithTax +
          TYPICAL.homeInspection,
      ),
      setupCosts: 0,
      appreciation: DEFAULTS.appreciation,
    },
    rvb: {
      otherBuyingCosts: Math.round(
        legalWithTax +
          TYPICAL.titleInsurance +
          TYPICAL.homeInspection,
      ),
      maintenanceRate,
      insuranceMonthly: insurance,
      condoFeesMonthly: condoFees,
      rentMonthly: roundTo(price * DEFAULTS.rentShare, 50),
      rentInsuranceMonthly: DEFAULTS.rentInsurance,
      rentIncrease: DEFAULTS.rentIncrease,
      appreciation: DEFAULTS.appreciation,
      investmentReturn: DEFAULTS.investmentReturn,
      sellingCostRate: DEFAULTS.sellingCostRate,
      years: DEFAULTS.rentVsBuyYears,
    },
    prepay: {
      balance: roundTo(price * DEFAULTS.refiBalanceShare, 1_000),
      rate: DEFAULTS.rate,
      remainingYears: DEFAULTS.amortization,
      extraMonthly: DEFAULTS.extraMonthly,
      annualLump: 0,
      lumpNow: 0,
    },
    bridge: {
      bridgeAmount: roundTo(price * DEFAULTS.bridgeShare, 1_000),
      bridgeRate: DEFAULTS.bridgeRate,
      adminFee: DEFAULTS.bridgeAdminFee,
      days: DEFAULTS.bridgeDays,
      currentHomeMonthly: DEFAULTS.currentHomeMonthly,
      newHomeMonthly: DEFAULTS.newHomeMonthly,
      legalFee: DEFAULTS.bridgeLegalFee,
    },
    tax: {
      municipality: cityTax?.name ?? CUSTOM_MUNICIPALITY,
      customRate: province === "ON" ? ONTARIO_MEDIAN_TAX_RATE : TYPICAL_PROPERTY_TAX[province],
      assessedValue: price,
    },
  };
}

/** Defaults with the saved changes laid over them. */
export function mergeInputs(
  defaults: CalculatorInputs,
  saved: SavedCalculators | null | undefined,
): CalculatorInputs {
  if (!saved) return defaults;
  const out = { ...defaults } as Record<string, object>;
  for (const key of Object.keys(shapes) as (keyof CalculatorInputs)[]) {
    const part = saved[key];
    if (part) out[key] = { ...defaults[key], ...stripUndefined(part) };
  }
  return out as CalculatorInputs;
}

const stripUndefined = (o: object) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

/** Whether anything has been saved (beyond the timestamp). */
export const hasSavedInputs = (saved: SavedCalculators | null | undefined) =>
  !!saved &&
  Object.keys(shapes).some((k) => saved[k as keyof typeof shapes] != null);

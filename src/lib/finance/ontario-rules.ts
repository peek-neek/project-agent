// Every rate, bracket and limit the calculators use, in one place.
// Each block notes its effective date and source; when a rule changes,
// update it here (and the tests) and every calculator follows.

/** Bracket: the rate applies to the part of the price above `from`. */
export type Bracket = { from: number; rate: number };

// ---------------------------------------------------------------------------
// Land transfer tax
// ---------------------------------------------------------------------------

/**
 * Ontario land transfer tax. The 2.5% band applies only to land with one or
 * two single-family residences; other property stays at 2% above $400K.
 * Source: Ontario Ministry of Finance (Land Transfer Tax Act).
 */
export const ONTARIO_LTT: Bracket[] = [
  { from: 0, rate: 0.005 },
  { from: 55_000, rate: 0.01 },
  { from: 250_000, rate: 0.015 },
  { from: 400_000, rate: 0.02 },
  { from: 2_000_000, rate: 0.025 },
];
export const ONTARIO_LTT_OTHER: Bracket[] = ONTARIO_LTT.slice(0, 4);

/** Ontario first-time buyer refund: up to $4,000. */
export const ONTARIO_FTB_REFUND = 4_000;

/** Ontario Non-Resident Speculation Tax (foreign buyers), province-wide. */
export const ONTARIO_NRST = 0.25;

/**
 * Toronto Municipal Land Transfer Tax, homes with one or two single-family
 * residences, including the graduated rates above $3M effective
 * April 1, 2026. Other residential property tops out at 2% above $400K.
 * Source: toronto.ca, MLTT rates and fees (modified April 7, 2026).
 */
export const TORONTO_MLTT: Bracket[] = [
  { from: 0, rate: 0.005 },
  { from: 55_000, rate: 0.01 },
  { from: 250_000, rate: 0.015 },
  { from: 400_000, rate: 0.02 },
  { from: 2_000_000, rate: 0.025 },
  { from: 3_000_000, rate: 0.044 },
  { from: 4_000_000, rate: 0.0545 },
  { from: 5_000_000, rate: 0.065 },
  { from: 10_000_000, rate: 0.0755 },
  { from: 20_000_000, rate: 0.086 },
];
export const TORONTO_MLTT_OTHER: Bracket[] = TORONTO_MLTT.slice(0, 4);

/** Toronto first-time purchaser rebate: up to $4,475 (toronto.ca). */
export const TORONTO_FTB_REBATE = 4_475;

/** Toronto Municipal Non-Resident Speculation Tax, since Jan 1, 2025. */
export const TORONTO_MNRST = 0.1;

// ---------------------------------------------------------------------------
// Mortgages (federal rules)
// ---------------------------------------------------------------------------

/**
 * Minimum down payment: 5% of the first $500K, 10% of the rest up to
 * $1.5M; 20% of the whole price at $1.5M or more.
 * Source: canada.ca (FCAC, Down payment; Dec 15, 2024 reforms).
 */
export const DOWN_PAYMENT = {
  firstTier: 500_000,
  firstRate: 0.05,
  secondRate: 0.1,
  /** Insured mortgages are unavailable at or above this price. */
  insuredMaxPrice: 1_500_000,
  uninsuredRate: 0.2,
};

/**
 * CMHC homeowner premiums on the total loan, by loan-to-value.
 * Source: cmhc-schl.gc.ca, Mortgage loan insurance cost.
 */
export const CMHC_PREMIUMS: { maxLtv: number; rate: number }[] = [
  { maxLtv: 0.65, rate: 0.006 },
  { maxLtv: 0.75, rate: 0.017 },
  { maxLtv: 0.8, rate: 0.024 },
  { maxLtv: 0.85, rate: 0.028 },
  { maxLtv: 0.9, rate: 0.031 },
  { maxLtv: 0.95, rate: 0.04 },
];
/** 90.01–95% LTV with a non-traditional (borrowed) down payment. */
export const CMHC_NON_TRADITIONAL_RATE = 0.045;
/** Added to the premium for 30-year insured amortizations. */
export const CMHC_30_YEAR_SURCHARGE = 0.002;
/** Ontario charges 8% PST on the premium, paid at closing (not financed). */
export const ONTARIO_PST_ON_PREMIUM = 0.08;

/**
 * Insured amortization: 25 years, or 30 for first-time buyers and buyers
 * of new builds (since Dec 15, 2024, canada.ca). Uninsured: up to 30.
 */
export const AMORTIZATION = {
  insuredMax: 25,
  insuredExtendedMax: 30,
  uninsuredMax: 30,
};

/**
 * Stress test: qualify at the greater of 5.25% or the contract rate + 2%.
 * Debt service limits: GDS 39%, TDS 44% (CMHC insured guidelines; most
 * lenders use the same). Lenders count 50% of condo fees.
 */
export const QUALIFYING = {
  floorRate: 0.0525,
  buffer: 0.02,
  maxGds: 0.39,
  maxTds: 0.44,
  condoFeeShare: 0.5,
};

/** Refinance: at most 80% of the home's value (uninsured). */
export const REFINANCE_MAX_LTV = 0.8;

// ---------------------------------------------------------------------------
// Taxes on services, regulated fees
// ---------------------------------------------------------------------------

/** Ontario HST: charged on commissions, legal fees and most services. */
export const ONTARIO_HST = 0.13;

/** Condo status certificate: capped at $100 + HST (Condominium Act). */
export const STATUS_CERTIFICATE_FEE = 100;

// ---------------------------------------------------------------------------
// Typical costs: editable starting points in the calculators, not rules.
// ---------------------------------------------------------------------------

export const TYPICAL = {
  /** Commission per side (listing / buyer), negotiable. */
  commissionPerSide: 0.025,
  buyerLegalFees: 1_800,
  sellerLegalFees: 1_200,
  titleInsurance: 400,
  homeInspection: 550,
  /** Often covered by the lender; set when the buyer pays. */
  appraisal: 0,
  mortgageDischargeFee: 350,
  moving: 1_500,
  /** Home insurance per month: house / condo unit. */
  insuranceHouse: 150,
  insuranceCondo: 45,
  /** Hydro, water and gas (heating) per month: house / condo. */
  utilitiesHouse: 320,
  utilitiesCondo: 150,
  /** Maintenance set aside per year, share of the home's value. */
  maintenanceHouse: 0.01,
  maintenanceCondo: 0.003,
  /** Approximate residential property tax rate: Toronto / elsewhere. */
  propertyTaxToronto: 0.0072,
  propertyTaxOther: 0.01,
};

/** When these rules were last checked against their sources. */
export const RULES_CHECKED = "2026-11-19";

// Province-by-province rules: transfer taxes and registration fees, sales
// tax on services, and provincial tax on mortgage insurance premiums.
// Ontario's detailed rules (and Toronto's) stay in ontario-rules.ts.
//
// Checked 2026-11-20 against provincial sources and current guides:
// BC PTT and first-time buyer exemption (gov.bc.ca; $835K/$860K thresholds
// since Apr 1, 2024); Quebec transfer duties 2026 (indexed thresholds,
// Ville de Montréal 2026 schedule, first-time buyer credit from Jan 1, 2026);
// Manitoba LTT; Alberta Land Titles fees ($50 + $5 per $5,000 since
// Oct 20, 2024); Saskatchewan ISC (0.4% above $6,300); New Brunswick and
// PEI (1%); Nova Scotia deed transfer tax (municipal, Halifax 1.5%;
// non-resident 10%); Newfoundland and Labrador registration ($100 + $0.40
// per $100 above $500); territories' land titles fees (estimates).
// Sales tax: CRA GST/HST rates (Nova Scotia HST 14% since Apr 1, 2025).

import { type Bracket, ONTARIO_HST, ONTARIO_PST_ON_PREMIUM } from "./ontario-rules";
import { bracketTax, landTransferTax, type LandTransferTax } from "./land-transfer-tax";

export const PROVINCE_CODES = [
  "ON", "BC", "AB", "SK", "MB", "QC", "NB", "NS", "PE", "NL", "YT", "NT", "NU",
] as const;
export type Province = (typeof PROVINCE_CODES)[number];

export const PROVINCE_NAMES: Record<Province, string> = {
  ON: "Ontario",
  BC: "British Columbia",
  AB: "Alberta",
  SK: "Saskatchewan",
  MB: "Manitoba",
  QC: "Quebec",
  NB: "New Brunswick",
  NS: "Nova Scotia",
  PE: "Prince Edward Island",
  NL: "Newfoundland and Labrador",
  YT: "Yukon",
  NT: "Northwest Territories",
  NU: "Nunavut",
};

export function isProvince(value: unknown): value is Province {
  return PROVINCE_CODES.includes(value as Province);
}

/** A report's province, defaulting to Ontario when it's unknown. */
export function provinceOr(value: string | null | undefined, fallback: Province = "ON"): Province {
  return isProvince(value) ? value : fallback;
}

// ---------------------------------------------------------------------------
// Sales tax on services
// ---------------------------------------------------------------------------

/**
 * Tax on real estate commissions: GST/HST (plus QST in Quebec). BC,
 * Saskatchewan and Manitoba don't charge PST on commissions.
 */
export const COMMISSION_TAX: Record<Province, { rate: number; label: string }> = {
  ON: { rate: ONTARIO_HST, label: "HST" },
  NS: { rate: 0.14, label: "HST" },
  NB: { rate: 0.15, label: "HST" },
  NL: { rate: 0.15, label: "HST" },
  PE: { rate: 0.15, label: "HST" },
  QC: { rate: 0.14975, label: "GST + QST" },
  BC: { rate: 0.05, label: "GST" },
  AB: { rate: 0.05, label: "GST" },
  SK: { rate: 0.05, label: "GST" },
  MB: { rate: 0.05, label: "GST" },
  YT: { rate: 0.05, label: "GST" },
  NT: { rate: 0.05, label: "GST" },
  NU: { rate: 0.05, label: "GST" },
};

/** Tax on legal fees: GST/HST, plus PST where legal services carry it. */
export const LEGAL_FEE_TAX: Record<Province, { rate: number; label: string }> = {
  ...COMMISSION_TAX,
  BC: { rate: 0.12, label: "GST + PST" },
  SK: { rate: 0.11, label: "GST + PST" },
  MB: { rate: 0.12, label: "GST + RST" },
};

/**
 * Provincial tax on mortgage default insurance premiums, paid in cash at
 * closing: Ontario 8%, Quebec 9%, Saskatchewan 6%; none elsewhere.
 */
export const PREMIUM_TAX: Record<Province, number> = {
  ON: ONTARIO_PST_ON_PREMIUM,
  QC: 0.09,
  SK: 0.06,
  BC: 0, AB: 0, MB: 0, NB: 0, NS: 0, PE: 0, NL: 0, YT: 0, NT: 0, NU: 0,
};

/**
 * Outside Ontario (where the calculators have each municipality's rate):
 * a typical residential property tax rate for the province, as an editable
 * starting point. Mid-range of published 2025 big-city rates (Vancouver
 * ~0.3%, Calgary ~0.7%, Winnipeg ~1.3%, Montréal ~0.85%, Halifax ~1.2%).
 */
export const TYPICAL_PROPERTY_TAX: Record<Province, number> = {
  ON: 0.0142,
  BC: 0.004,
  AB: 0.0075,
  SK: 0.011,
  MB: 0.013,
  QC: 0.0085,
  NB: 0.015,
  NS: 0.012,
  PE: 0.01,
  NL: 0.01,
  YT: 0.008,
  NT: 0.009,
  NU: 0.008,
};

// ---------------------------------------------------------------------------
// Transfer taxes
// ---------------------------------------------------------------------------

/** BC property transfer tax, residential (extra 2% above $3M). */
export const BC_PTT: Bracket[] = [
  { from: 0, rate: 0.01 },
  { from: 200_000, rate: 0.02 },
  { from: 2_000_000, rate: 0.03 },
  { from: 3_000_000, rate: 0.05 },
];
/** BC first-time buyers: tax on the first $500K forgiven up to $835K, phasing out by $860K. */
export const BC_FTB = { exemptPortion: 500_000, fullUpTo: 835_000, noneFrom: 860_000 };
/** BC additional tax for foreign buyers in Metro Vancouver, Fraser Valley, Capital, Central Okanagan and Nanaimo. */
export const BC_FOREIGN_BUYER_TAX = 0.2;

/** Quebec transfer duties ("welcome tax"), 2026 indexed thresholds. */
export const QUEBEC_DUTIES: Bracket[] = [
  { from: 0, rate: 0.005 },
  { from: 62_900, rate: 0.01 },
  { from: 315_000, rate: 0.015 },
];
/** City of Montréal's higher brackets, 2026. */
export const MONTREAL_DUTIES: Bracket[] = [
  ...QUEBEC_DUTIES,
  { from: 552_300, rate: 0.02 },
  { from: 1_104_700, rate: 0.025 },
  { from: 2_136_500, rate: 0.035 },
  { from: 3_113_000, rate: 0.04 },
];
/** Quebec first-time buyer credit (from Jan 1, 2026): 100% of the first $5,000 of duties + 25% of the next $3,500. */
export const QUEBEC_FTB = { full: 5_000, partial: 3_500, partialRate: 0.25 };

/** Manitoba land transfer tax. No first-time buyer rebate. */
export const MANITOBA_LTT: Bracket[] = [
  { from: 0, rate: 0 },
  { from: 30_000, rate: 0.005 },
  { from: 90_000, rate: 0.01 },
  { from: 150_000, rate: 0.015 },
  { from: 200_000, rate: 0.02 },
];

/** Nova Scotia municipal deed transfer tax: Halifax 1.5%; others 0.5–1.5%. */
export const NOVA_SCOTIA_DEED_TAX = 0.015;
/** Nova Scotia non-resident deed transfer tax (provincial). */
export const NOVA_SCOTIA_NON_RESIDENT = 0.1;

const per = (amount: number, step: number) => Math.ceil(Math.max(0, amount) / step);

export type TransferTaxResult = LandTransferTax & {
  /** What the province calls it, e.g. "Property transfer tax". */
  label: string;
  /** False where it's a registration fee rather than a tax. */
  isTax: boolean;
  /** Rough figure (territories' fee schedules). */
  estimate: boolean;
  /** One line on how it's worked out. */
  note: string;
};

const result = (
  label: string,
  parts: Partial<LandTransferTax>,
  extra: { isTax?: boolean; estimate?: boolean; note: string },
): TransferTaxResult => {
  const provincial = parts.provincial ?? 0;
  const provincialRebate = parts.provincialRebate ?? 0;
  const municipal = parts.municipal ?? 0;
  const municipalRebate = parts.municipalRebate ?? 0;
  const nonResident = parts.nonResident ?? 0;
  return {
    provincial,
    provincialRebate,
    municipal,
    municipalRebate,
    nonResident,
    total: provincial - provincialRebate + municipal - municipalRebate + nonResident,
    label,
    isTax: extra.isTax ?? true,
    estimate: extra.estimate ?? false,
    note: extra.note,
  };
};

export type TransferTaxInput = {
  province: Province;
  price: number;
  firstTimeBuyer: boolean;
  nonResident?: boolean;
  /** One or two single-family residences (Ontario/Toronto top bands). */
  singleFamily?: boolean;
  /** Inside the City of Toronto (Ontario only). */
  toronto?: boolean;
  /** Inside the City of Montréal (Quebec only). */
  montreal?: boolean;
};

/** Transfer tax (or registration fees) a buyer pays, by province. */
export function transferTax(input: TransferTaxInput): TransferTaxResult {
  const { price, province } = input;
  // First-time buyer relief never applies to non-residents.
  const ftb = input.firstTimeBuyer && !input.nonResident;
  const nonResident = Boolean(input.nonResident);

  switch (province) {
    case "ON": {
      const t = landTransferTax({
        price,
        toronto: Boolean(input.toronto),
        firstTimeBuyer: input.firstTimeBuyer,
        singleFamily: input.singleFamily ?? true,
        nonResident,
      });
      return {
        ...t,
        label: input.toronto ? "Land transfer tax (Ontario + Toronto)" : "Land transfer tax",
        isTax: true,
        estimate: false,
        note: input.toronto
          ? "Ontario and Toronto municipal land transfer tax."
          : "Ontario land transfer tax.",
      };
    }
    case "BC": {
      const provincial = bracketTax(price, BC_PTT);
      let rebate = 0;
      if (ftb && price < BC_FTB.noneFrom) {
        const forgiven = Math.min(provincial, bracketTax(BC_FTB.exemptPortion, BC_PTT));
        rebate =
          price <= BC_FTB.fullUpTo
            ? forgiven
            : (forgiven * (BC_FTB.noneFrom - price)) / (BC_FTB.noneFrom - BC_FTB.fullUpTo);
      }
      return result(
        "Property transfer tax",
        {
          provincial,
          provincialRebate: rebate,
          nonResident: nonResident ? price * BC_FOREIGN_BUYER_TAX : 0,
        },
        {
          note: "1% to $200K, 2% to $2M, 3% to $3M, 5% above. Foreign buyers pay 20% more in Metro Vancouver, Fraser Valley, Capital, Central Okanagan and Nanaimo.",
        },
      );
    }
    case "QC": {
      const duties = bracketTax(price, input.montreal ? MONTREAL_DUTIES : QUEBEC_DUTIES);
      const rebate = ftb
        ? Math.min(duties, QUEBEC_FTB.full) +
          QUEBEC_FTB.partialRate *
            Math.min(Math.max(duties - QUEBEC_FTB.full, 0), QUEBEC_FTB.partial)
        : 0;
      return result(
        "Welcome tax (transfer duties)",
        { municipal: duties, municipalRebate: rebate },
        {
          note: input.montreal
            ? "City of Montréal brackets, on the greater of price and assessed value. Some municipalities charge more above $500K."
            : "Quebec's standard brackets, on the greater of price and assessed value. Some municipalities charge up to 3% above $500K.",
        },
      );
    }
    case "MB":
      return result(
        "Land transfer tax",
        { provincial: bracketTax(price, MANITOBA_LTT) },
        { note: "0% to $30K, then 0.5%, 1%, 1.5%, and 2% above $200K. No first-time buyer rebate." },
      );
    case "AB":
      return result(
        "Land title transfer fee",
        { provincial: 50 + 5 * per(price, 5_000) },
        {
          isTax: false,
          note: "Alberta has no land transfer tax: $50 + $5 per $5,000 of value. Registering a mortgage adds $50 + $5 per $5,000 borrowed.",
        },
      );
    case "SK":
      return result(
        "Land title transfer fee",
        { provincial: price <= 500 ? 0 : price <= 6_300 ? 25 : price * 0.004 },
        { isTax: false, note: "Saskatchewan has no land transfer tax: ISC charges 0.4% of the value." },
      );
    case "NB":
      return result(
        "Real property transfer tax",
        { provincial: price * 0.01 },
        { note: "1% of the greater of price and assessed value." },
      );
    case "PE":
      return result(
        "Real property transfer tax",
        { provincial: price * 0.01, provincialRebate: ftb ? price * 0.01 : 0 },
        { note: "1% of the greater of price and assessed value. Eligible first-time buyers are exempt." },
      );
    case "NS":
      return result(
        "Deed transfer tax",
        {
          municipal: price * NOVA_SCOTIA_DEED_TAX,
          nonResident: nonResident ? price * NOVA_SCOTIA_NON_RESIDENT : 0,
        },
        {
          note: "Municipal: 1.5% in Halifax (0.5–1.5% elsewhere). Non-residents pay a further 10%.",
        },
      );
    case "NL":
      return result(
        "Deed registration fee",
        { provincial: 100 + 0.4 * per(price - 500, 100) },
        {
          isTax: false,
          note: "No land transfer tax: $100 + $0.40 per $100 above $500. Registering a mortgage costs about the same again.",
        },
      );
    case "YT":
      return result(
        "Land titles fees",
        { provincial: 50 + 20 + 10 * per(price - 10_000, 10_000) },
        {
          isTax: false,
          estimate: true,
          note: "No land transfer tax. Estimate: transfer registration plus the assurance fund fee ($20 + $10 per $10,000); confirm with Land Titles.",
        },
      );
    case "NT":
      return result(
        "Land titles fees",
        {
          provincial:
            price <= 1_000_000
              ? Math.max(100, 2 * per(price, 1_000))
              : 2_000 + 1.5 * per(price - 1_000_000, 1_000),
        },
        {
          isTax: false,
          estimate: true,
          note: "No land transfer tax. Estimate: $2 per $1,000 of value (minimum $100); confirm with Land Titles.",
        },
      );
    case "NU":
      return result(
        "Land titles fees",
        { provincial: Math.max(60, 1.5 * per(price, 1_000)) },
        {
          isTax: false,
          estimate: true,
          note: "No land transfer tax. Estimate: $1.50 per $1,000 of value (minimum $60); confirm with Land Titles.",
        },
      );
  }
}

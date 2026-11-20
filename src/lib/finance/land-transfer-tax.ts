import {
  type Bracket,
  ONTARIO_FTB_REFUND,
  ONTARIO_LTT,
  ONTARIO_LTT_OTHER,
  ONTARIO_NRST,
  TORONTO_FTB_REBATE,
  TORONTO_MLTT,
  TORONTO_MLTT_OTHER,
  TORONTO_MNRST,
} from "./ontario-rules";

/** Marginal tax over brackets (each rate on its slice of the price). */
export function bracketTax(price: number, brackets: Bracket[]) {
  let tax = 0;
  for (let i = 0; i < brackets.length; i++) {
    const { from, rate } = brackets[i];
    const to = brackets[i + 1]?.from ?? Infinity;
    if (price <= from) break;
    tax += (Math.min(price, to) - from) * rate;
  }
  return tax;
}

export type LandTransferTax = {
  provincial: number;
  provincialRebate: number;
  municipal: number;
  municipalRebate: number;
  /** Non-resident speculation tax (provincial + Toronto). */
  nonResident: number;
  total: number;
};

/**
 * Ontario land transfer tax, plus Toronto's MLTT inside the city.
 * `singleFamily`: one or two single-family residences (the higher bands
 * above $2M only apply to these).
 */
export function landTransferTax({
  price,
  toronto,
  firstTimeBuyer,
  singleFamily = true,
  nonResident = false,
}: {
  price: number;
  toronto: boolean;
  firstTimeBuyer: boolean;
  singleFamily?: boolean;
  nonResident?: boolean;
}): LandTransferTax {
  const provincial = bracketTax(
    price,
    singleFamily ? ONTARIO_LTT : ONTARIO_LTT_OTHER,
  );
  const municipal = toronto
    ? bracketTax(price, singleFamily ? TORONTO_MLTT : TORONTO_MLTT_OTHER)
    : 0;
  // Non-residents can't claim first-time buyer rebates.
  const ftb = firstTimeBuyer && !nonResident;
  const provincialRebate = ftb ? Math.min(provincial, ONTARIO_FTB_REFUND) : 0;
  const municipalRebate = ftb ? Math.min(municipal, TORONTO_FTB_REBATE) : 0;
  const nonResidentTax = nonResident
    ? price * ONTARIO_NRST + (toronto ? price * TORONTO_MNRST : 0)
    : 0;
  return {
    provincial,
    provincialRebate,
    municipal,
    municipalRebate,
    nonResident: nonResidentTax,
    total:
      provincial -
      provincialRebate +
      municipal -
      municipalRebate +
      nonResidentTax,
  };
}

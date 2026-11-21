// Calculator tools for the property chat. Inputs the model leaves out come
// from the agent's saved calculator figures, then the report (list price,
// city, property type), then the defaults: the same numbers as the
// Calculators tab and the PDF.

import { tool } from "ai";
import {
  affordabilitySchema,
  closingCostsSchema,
  commissionSchema,
  mortgagePaymentSchema,
  propertyTaxSchema,
  rentalAnalysisSchema,
  rentVsBuySchema,
  sellerNetSchema,
} from "../../lib/chat-tools";
import { maxAffordable, qualifyingRate } from "../../lib/finance/affordability";
import { buyerClosingCosts, sellerNet } from "../../lib/finance/closing";
import { commission } from "../../lib/finance/commission";
import { roundTo } from "../../lib/finance/defaults";
import { rentalAnalysis, rentVsBuy } from "../../lib/finance/investing";
import {
  amortize,
  minDownPayment,
  mortgageInsurance,
} from "../../lib/finance/mortgage";
import {
  COMMISSION_TAX,
  PROVINCE_NAMES,
  TYPICAL_PROPERTY_TAX,
} from "../../lib/finance/provinces";
import {
  ONTARIO_MEDIAN_TAX_RATE,
  PROPERTY_TAX_RATES_YEAR,
  propertyTaxRateFor,
} from "../../lib/finance/property-tax-rates";
import {
  defaultInputs,
  mergeInputs,
  type SavedCalculators,
  savedCalculatorsSchema,
} from "../../lib/finance/scenario";
import { listingSchema, SECTION_KEYS } from "../../lib/report-sections";

export type FinanceContext = {
  listPrice: number | null;
  city: string | null;
  province?: string | null;
  propertyType: string | null;
  saved: SavedCalculators | null;
};

/** Pulls what the calculators need from a report. */
export function financeContext(report: {
  property: { city: string | null; province?: string | null } | null;
  sections: { key: string; data: unknown }[];
}): FinanceContext {
  const section = (key: string) =>
    report.sections.find((s) => s.key === key)?.data;
  const listing = listingSchema.safeParse(section(SECTION_KEYS.listing));
  const saved = savedCalculatorsSchema.safeParse(
    section(SECTION_KEYS.calculators),
  );
  return {
    listPrice: listing.success ? listing.data.listPrice : null,
    city: report.property?.city ?? null,
    province: report.property?.province ?? null,
    propertyType: listing.success ? listing.data.propertyType : null,
    saved: saved.success ? saved.data : null,
  };
}

const $ = (v: number) => Math.round(v);
const $2 = (v: number) => Math.round(v * 100) / 100;
const pct = (v: number) => `${Math.round(v * 10_000) / 100}%`;
const fromPct = (v: number | undefined) => (v == null ? undefined : v / 100);
const DISCLAIMER =
  "Estimate for discussion; lenders, insurers and lawyers confirm final figures.";

export function calculatorTools(ctx: FinanceContext) {
  const inputs = mergeInputs(defaultInputs(ctx), ctx.saved);
  const province = inputs.purchase.province;
  const {
    purchase,
    afford,
    closing: cl,
    seller: sl,
    rental: rt,
    rvb,
    comm,
  } = inputs;
  /**
   * The price the model gave, else one the agent saved in that calculator
   * (it wins in the tab too), else the list price.
   */
  const priceOr = (given: number | undefined, saved: number | undefined) =>
    given ?? saved ?? ctx.listPrice ?? null;
  const noPrice = {
    error:
      "No price given and this report has no list price. Ask the agent which price to use.",
  };
  const savedDownShare =
    ctx.saved?.purchase?.downPayment != null && purchase.price > 0
      ? purchase.downPayment / purchase.price
      : 0.2;
  const downFor = (price: number, down?: number, downPct?: number) =>
    down ??
    (downPct != null
      ? price * (downPct / 100)
      : roundTo(price * savedDownShare, 1_000));

  return {
    mortgage_payment: tool({
      ...mortgagePaymentSchema,
      execute: async (a) => {
        const price = priceOr(a.price, ctx.saved?.purchase?.price);
        if (price == null) return noPrice;
        const down = downFor(price, a.downPayment, a.downPercent);
        const rate = fromPct(a.ratePercent) ?? purchase.rate;
        const years = a.amortizationYears ?? purchase.amortization;
        const term = a.termYears ?? purchase.termYears;
        const frequency = a.frequency ?? purchase.frequency;
        const ins = mortgageInsurance({
          price,
          downPayment: down,
          amortizationYears: years,
          province,
        });
        const loan = price - down + (ins.available ? ins.premium : 0);
        const run = amortize({
          principal: loan,
          annualRate: rate,
          years,
          frequency,
          termYears: term,
          rateType: purchase.rateType,
        });
        return {
          price: $(price),
          downPayment: $(down),
          downPercent: pct(down / price),
          minimumDownPayment: $(minDownPayment(price)),
          belowMinimum: down + 0.5 < minDownPayment(price),
          insurance: ins.required
            ? ins.available
              ? {
                  premium: $(ins.premium),
                  rate: pct(ins.rate),
                  pstAtClosing: $(ins.pst),
                  addedToMortgage: true,
                }
              : { unavailable: ins.reason }
            : "none needed (20%+ down)",
          mortgage: $(loan),
          payment: $2(run.payment),
          frequency,
          interestOverTerm: $(run.term?.interest ?? 0),
          balanceAtTermEnd: $(run.term?.balance ?? 0),
          totalInterest: $(run.totalInterest),
          paidOffInYears: Math.round(run.payoffYears * 10) / 10,
          assumptions: `${pct(rate)} ${purchase.rateType}, ${years}-yr amortization, ${term}-yr term, Canadian semi-annual compounding.`,
          note: DISCLAIMER,
        };
      },
    }),

    affordability: tool({
      ...affordabilitySchema,
      execute: async (a) => {
        const income = a.annualIncome ?? afford.income;
        const down = a.downPayment ?? purchase.downPayment;
        const rate = fromPct(a.ratePercent) ?? purchase.rate;
        const r = maxAffordable({
          annualIncome: income,
          monthlyDebts: a.monthlyDebts ?? afford.debts,
          downPayment: down,
          annualRate: rate,
          amortizationYears: purchase.amortization,
          propertyTaxRate: afford.taxRate,
          heatingMonthly: afford.heating,
          condoFeesMonthly: a.condoFeesMonthly ?? afford.condoFees,
        });
        return {
          maxPrice: $(r.price),
          mortgage: $(r.loan),
          monthlyPayment: $(r.contractPayment),
          qualifyingRate: pct(qualifyingRate(rate)),
          gds: pct(r.gds),
          tds: pct(r.tds),
          limitedBy: r.bindingLimit,
          thisHome: ctx.listPrice
            ? r.price >= ctx.listPrice
              ? `Within budget (list price ${$(ctx.listPrice)})`
              : `Over budget by ${$(ctx.listPrice - r.price)} (list price ${$(ctx.listPrice)})`
            : "No list price on the report",
          assumptions: `Income ${$(income)}, ${$(down)} down, ${pct(rate)} rate, ${purchase.amortization}-yr amortization, property tax ${pct(afford.taxRate)} of price, heating ${$(afford.heating)}/month; GDS 39% / TDS 44%.`,
          note: DISCLAIMER,
        };
      },
    }),

    closing_costs: tool({
      ...closingCostsSchema,
      execute: async (a) => {
        const price = priceOr(a.price, ctx.saved?.purchase?.price);
        if (price == null) return noPrice;
        const down = downFor(price, a.downPayment, a.downPercent);
        const r = buyerClosingCosts({
          price,
          downPayment: down,
          amortizationYears: purchase.amortization,
          province,
          toronto: province === "ON" && purchase.toronto,
          montreal: province === "QC" && purchase.montreal,
          firstTimeBuyer: a.firstTimeBuyer ?? purchase.firstTimeBuyer,
          singleFamily: purchase.singleFamily,
          nonResident: a.nonResident ?? purchase.nonResident,
          ...cl,
        });
        return {
          price: $(price),
          province: PROVINCE_NAMES[province],
          landTransferTax: {
            name: r.ltt.label,
            provincial: $(r.ltt.provincial),
            provincialRebate: $(r.ltt.provincialRebate),
            municipal: $(r.ltt.municipal),
            municipalRebate: $(r.ltt.municipalRebate),
            nonResidentTax: $(r.ltt.nonResident),
            total: $(r.ltt.total),
            howItWorks: r.ltt.note,
            ...(r.ltt.estimate ? { estimate: true } : {}),
          },
          lines: r.lines
            .filter((l) => l.amount > 0)
            .map((l) => ({ item: l.label, amount: $(l.amount) })),
          closingCosts: $(r.closingCosts),
          closingCostsShareOfPrice: pct(r.closingCostShare),
          downPayment: $(down),
          cashNeededOnClosing: $(r.cashToClose),
          note: DISCLAIMER,
        };
      },
    }),

    seller_net: tool({
      ...sellerNetSchema,
      execute: async (a) => {
        const price = priceOr(a.salePrice, ctx.saved?.seller?.salePrice);
        if (price == null) return noPrice;
        const share =
          sl.salePrice > 0 ? sl.mortgageBalance / sl.salePrice : 0.4;
        const totalComm = fromPct(a.commissionTotalPercent);
        const r = sellerNet({
          ...sl,
          province,
          salePrice: price,
          listingCommission:
            totalComm != null ? totalComm / 2 : sl.listingCommission,
          buyerCommission:
            totalComm != null ? totalComm / 2 : sl.buyerCommission,
          mortgageBalance: a.mortgageBalance ?? roundTo(price * share, 1_000),
          monthsLeftInTerm: a.monthsLeftInTerm ?? sl.monthsLeftInTerm,
          mortgageRate: fromPct(a.mortgageRatePercent) ?? sl.mortgageRate,
        });
        return {
          salePrice: $(price),
          lines: r.lines
            .filter((l) => l.amount > 0)
            .map((l) => ({ item: l.label, amount: $(l.amount) })),
          commissionWithSalesTax: $(r.commission),
          prepaymentPenalty: $(r.penalty.penalty),
          penaltyMethod: r.penalty.method,
          sellingCosts: $(r.sellingCosts),
          sellingCostsShareOfPrice: pct(r.sellingCostShare),
          netProceeds: $(r.net),
          note: `${DISCLAIMER} A principal residence is normally exempt from capital gains tax.`,
        };
      },
    }),

    rental_analysis: tool({
      ...rentalAnalysisSchema,
      execute: async (a) => {
        const price = priceOr(a.price, ctx.saved?.rental?.price);
        if (price == null) return noPrice;
        const rentShare = rt.price > 0 ? rt.rent / rt.price : 0.0045;
        const rentGiven =
          a.monthlyRent != null || ctx.saved?.rental?.rent != null;
        const downShare =
          a.downPercent != null
            ? a.downPercent / 100
            : rt.price > 0
              ? rt.downPayment / rt.price
              : 0.2;
        const r = rentalAnalysis({
          ...rt,
          province,
          price,
          downPayment: price * downShare,
          rent: a.monthlyRent ?? roundTo(price * rentShare, 50),
          rate: fromPct(a.ratePercent) ?? rt.rate,
          condoFeesMonthly: a.condoFeesMonthly ?? rt.condoFeesMonthly,
          management: fromPct(a.managementPercent) ?? rt.management,
          closingCosts: rt.closingCosts,
        });
        return {
          price: $(price),
          monthlyRent: $(a.monthlyRent ?? roundTo(price * rentShare, 50)),
          rentIsExample: !rentGiven,
          mortgagePerMonth: $(r.mortgageMonthly),
          monthlyCashFlow: $(r.cashFlowMonthly),
          netOperatingIncome: $(r.noi),
          capRate: pct(r.capRate),
          cashOnCash: pct(r.cashOnCash),
          debtCoverage: r.dscr != null ? Math.round(r.dscr * 100) / 100 : null,
          breakEvenRent: r.breakEvenRent != null ? $(r.breakEvenRent) : null,
          cashInvested: $(r.cashInvested),
          assumptions: `${pct(downShare)} down at ${pct(fromPct(a.ratePercent) ?? rt.rate)}, ${pct(rt.vacancy)} vacancy, ${pct(rt.maintenance)} maintenance, property tax ${pct(rt.propertyTaxRate)} of price.`,
          note: `${DISCLAIMER} Never present this as a promised return. Rental income is taxable.`,
        };
      },
    }),

    rent_vs_buy: tool({
      ...rentVsBuySchema,
      execute: async (a) => {
        const price = priceOr(a.price, ctx.saved?.purchase?.price);
        if (price == null) return noPrice;
        const rentShare =
          purchase.price > 0 ? rvb.rentMonthly / purchase.price : 0.0045;
        const r = rentVsBuy({
          ...rvb,
          price,
          downPayment: roundTo(price * savedDownShare, 1_000),
          rate: purchase.rate,
          amortizationYears: purchase.amortization,
          province,
          toronto: province === "ON" && purchase.toronto,
          montreal: province === "QC" && purchase.montreal,
          firstTimeBuyer: purchase.firstTimeBuyer,
          propertyTaxRate: afford.taxRate,
          rentMonthly: a.monthlyRent ?? roundTo(price * rentShare, 50),
          years: a.years ?? rvb.years,
          appreciation: fromPct(a.appreciationPercent) ?? rvb.appreciation,
          investmentReturn:
            fromPct(a.investmentReturnPercent) ?? rvb.investmentReturn,
        });
        return {
          price: $(price),
          years: a.years ?? rvb.years,
          buyNetWorth: $(r.buyNetWorth),
          rentNetWorth: $(r.rentNetWorth),
          aheadBy: $(Math.abs(r.advantage)),
          winner: r.advantage >= 0 ? "buying" : "renting",
          buyingPullsAheadInYear: r.breakEvenYear,
          cashToBuy: $(r.upfront),
          owningFirstMonth: $(r.firstOwnerMonthly),
          assumptions: `Rent ${$(a.monthlyRent ?? roundTo(price * rentShare, 50))}/month rising ${pct(rvb.rentIncrease)}/yr, ${pct(fromPct(a.appreciationPercent) ?? rvb.appreciation)} value growth, ${pct(fromPct(a.investmentReturnPercent) ?? rvb.investmentReturn)} investment return, ${pct(rvb.sellingCostRate)} selling costs.`,
          note: `${DISCLAIMER} Results depend heavily on value growth and returns; never promise future value.`,
        };
      },
    }),

    property_tax: tool({
      ...propertyTaxSchema,
      execute: async (a) => {
        const place = a.municipality ?? ctx.city;
        const ontario = province === "ON";
        const found = ontario ? propertyTaxRateFor(place) : null;
        const rate =
          found?.rate ?? (ontario ? ONTARIO_MEDIAN_TAX_RATE : TYPICAL_PROPERTY_TAX[province]);
        const assessed = a.assessedValue ?? inputs.tax.assessedValue;
        return {
          municipality:
            found?.name ??
            `${place ?? "Unknown"} (${ontario ? "not in the table: Ontario median used" : `typical ${PROVINCE_NAMES[province]} rate used; municipal rates are on file for Ontario only`})`,
          rate: `${Math.round(rate * 1_000_000) / 10_000}%`,
          ...(found ? { rateYear: PROPERTY_TAX_RATES_YEAR } : {}),
          assessedValue: $(assessed),
          annualTax: $(assessed * rate),
          monthlyTax: $((assessed * rate) / 12),
          note: ontario
            ? "Ontario tax is the MPAC assessed value (still based on 2016 values) times the municipal rate; the tax bill is final."
            : "Property tax is the assessed value times the municipality's residential rate; this uses a typical provincial rate, so check the municipality's rate. The tax bill is final.",
        };
      },
    }),

    commission: tool({
      ...commissionSchema,
      execute: async (a) => {
        const price = priceOr(a.salePrice, ctx.saved?.comm?.salePrice);
        if (price == null) return noPrice;
        const r = commission({
          ...comm,
          province,
          salePrice: price,
          structure: a.sideCommissionPercent != null ? "flat" : comm.structure,
          rate: fromPct(a.sideCommissionPercent) ?? comm.rate,
          agentSplit: fromPct(a.agentSplitPercent) ?? comm.agentSplit,
        });
        return {
          salePrice: $(price),
          grossCommission: $(r.gross),
          salesTaxCollected: $(r.hst),
          referralFee: $(r.referral),
          brokerageShare: $(r.brokerage),
          transactionFee: $(r.transactionFee),
          takeHome: $(r.net),
          note: `Before income tax. ${COMMISSION_TAX[province].label} (${pct(COMMISSION_TAX[province].rate)}) is collected and remitted, not income.`,
        };
      },
    }),
  };
}

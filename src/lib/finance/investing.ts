// Rental property returns, rent vs buy, prepayments and bridge financing.


import { amortize, mortgageInsurance, payment, periodicRate } from "./mortgage";
import { LEGAL_FEE_TAX, type Province, transferTax } from "./provinces";

// ---------------------------------------------------------------------------
// Rental property
// ---------------------------------------------------------------------------

export type RentalInput = {
  price: number;
  downPayment: number;
  rate: number;
  amortizationYears: number;
  /** Rent per month (all units). */
  rent: number;
  otherIncome: number;
  /** Share of rent lost to vacancy and bad debt (decimal). */
  vacancy: number;
  /** Property tax per year, share of the price (decimal). */
  propertyTaxRate: number;
  insuranceMonthly: number;
  condoFeesMonthly: number;
  utilitiesMonthly: number;
  /** Maintenance and repairs, share of rent (decimal). */
  maintenance: number;
  /** Property management, share of rent (decimal). */
  management: number;
  /** Land transfer tax, legal and other one-time purchase costs. */
  closingCosts: number;
  /** Repairs or furnishing before the first tenant. */
  setupCosts: number;
  /** Home value growth per year (decimal), for the total return. */
  appreciation: number;
  /** Default Ontario. */
  province?: Province;
};

export function rentalAnalysis(input: RentalInput) {
  const ins = mortgageInsurance({
    price: input.price,
    downPayment: input.downPayment,
    amortizationYears: input.amortizationYears,
    province: input.province,
  });
  const loan =
    Math.max(0, input.price - input.downPayment) +
    (ins.available ? ins.premium : 0);
  const mortgageMonthly = payment({
    principal: loan,
    annualRate: input.rate,
    years: input.amortizationYears,
    frequency: "monthly",
  });

  const grossRent = (input.rent + input.otherIncome) * 12;
  const vacancyLoss = grossRent * input.vacancy;
  const effectiveIncome = grossRent - vacancyLoss;
  const operating = {
    propertyTax: input.price * input.propertyTaxRate,
    insurance: input.insuranceMonthly * 12,
    condoFees: input.condoFeesMonthly * 12,
    utilities: input.utilitiesMonthly * 12,
    maintenance: input.rent * 12 * input.maintenance,
    management: input.rent * 12 * input.management,
  };
  const operatingTotal = Object.values(operating).reduce((a, b) => a + b, 0);
  const noi = effectiveIncome - operatingTotal;
  const debtService = mortgageMonthly * 12;
  const cashFlow = noi - debtService;
  const cashInvested =
    input.downPayment + input.closingCosts + input.setupCosts;

  // First-year principal paid: equity the tenant's rent builds.
  const year1 =
    amortize({
      principal: loan,
      annualRate: input.rate,
      years: input.amortizationYears,
      frequency: "monthly",
    }).schedule[0]?.principal ?? 0;
  const appreciation = input.price * input.appreciation;

  // Rent at which cash flow is zero (vacancy and % costs scale with rent).
  const fixedCosts =
    operating.propertyTax +
    operating.insurance +
    operating.condoFees +
    operating.utilities +
    debtService;
  const perRentDollar =
    1 - input.vacancy - input.maintenance - input.management;
  const breakEvenRent =
    perRentDollar > 0
      ? (fixedCosts / perRentDollar -
          (input.otherIncome * 12 * (1 - input.vacancy)) / perRentDollar) /
        12
      : null;

  return {
    loan,
    mortgageMonthly,
    grossRent,
    vacancyLoss,
    effectiveIncome,
    operating,
    operatingTotal,
    noi,
    debtService,
    cashFlow,
    cashFlowMonthly: cashFlow / 12,
    capRate: input.price > 0 ? noi / input.price : 0,
    cashOnCash: cashInvested > 0 ? cashFlow / cashInvested : 0,
    /** Debt service coverage: lenders usually want 1.2 or more. */
    dscr: debtService > 0 ? noi / debtService : null,
    cashInvested,
    principalPaydown: year1,
    appreciation,
    /** Cash flow + principal paid + appreciation, over cash invested. */
    totalReturn:
      cashInvested > 0 ? (cashFlow + year1 + appreciation) / cashInvested : 0,
    breakEvenRent: breakEvenRent != null ? Math.max(0, breakEvenRent) : null,
    /** Gross rent multiplier: price over a year's gross rent. */
    grm: grossRent > 0 ? input.price / grossRent : null,
  };
}

// ---------------------------------------------------------------------------
// Rent vs buy
// ---------------------------------------------------------------------------

export type RentVsBuyInput = {
  price: number;
  downPayment: number;
  rate: number;
  amortizationYears: number;
  toronto: boolean;
  firstTimeBuyer: boolean;
  /** Default Ontario. */
  province?: Province;
  /** Inside the City of Montréal (Quebec only). */
  montreal?: boolean;
  /** Legal, inspection and other buying costs besides land transfer tax. */
  otherBuyingCosts: number;
  propertyTaxRate: number;
  /** Maintenance per year, share of the home's value. */
  maintenanceRate: number;
  insuranceMonthly: number;
  condoFeesMonthly: number;
  rentMonthly: number;
  rentInsuranceMonthly: number;
  rentIncrease: number;
  appreciation: number;
  /** Return on money not tied up in the home (decimal per year). */
  investmentReturn: number;
  /** Commission and legal on selling, share of the price. */
  sellingCostRate: number;
  years: number;
};

export type RentVsBuyYear = {
  year: number;
  buyNetWorth: number;
  rentNetWorth: number;
};

/**
 * Month by month: the owner pays the mortgage and running costs; the renter
 * pays rent and invests what the owner put down. Whoever spends less each
 * month invests the difference. Net worth compares the owner's equity
 * after selling costs (plus any savings) with the renter's portfolio.
 */
export function rentVsBuy(input: RentVsBuyInput) {
  const ins = mortgageInsurance({
    price: input.price,
    downPayment: input.downPayment,
    amortizationYears: input.amortizationYears,
    province: input.province,
  });
  const loan =
    Math.max(0, input.price - input.downPayment) +
    (ins.available ? ins.premium : 0);
  const ltt = transferTax({
    province: input.province ?? "ON",
    price: input.price,
    toronto: input.toronto,
    montreal: input.montreal,
    firstTimeBuyer: input.firstTimeBuyer,
  }).total;
  const upfront = input.downPayment + ltt + input.otherBuyingCosts + ins.pst;
  const rMonth = periodicRate(input.rate, 12);
  const mortgage = payment({
    principal: loan,
    annualRate: input.rate,
    years: input.amortizationYears,
    frequency: "monthly",
  });
  const growMonth = (annual: number) => Math.pow(1 + annual, 1 / 12) - 1;
  const investMonth = growMonth(input.investmentReturn);
  const homeMonth = growMonth(input.appreciation);

  let balance = loan;
  let homeValue = input.price;
  let rent = input.rentMonthly;
  let renterPortfolio = upfront;
  let ownerPortfolio = 0;
  let ownerSpent = 0;
  let renterSpent = 0;
  const yearsOut: RentVsBuyYear[] = [];

  for (let m = 1; m <= input.years * 12; m++) {
    const interest = balance * rMonth;
    const mortgagePaid =
      balance > 0 ? Math.min(mortgage, balance + interest) : 0;
    balance = Math.max(0, balance + interest - mortgagePaid);
    const ownerCost =
      mortgagePaid +
      (homeValue * (input.propertyTaxRate + input.maintenanceRate)) / 12 +
      input.insuranceMonthly +
      input.condoFeesMonthly;
    const renterCost = rent + input.rentInsuranceMonthly;
    ownerSpent += ownerCost;
    renterSpent += renterCost;

    renterPortfolio *= 1 + investMonth;
    ownerPortfolio *= 1 + investMonth;
    if (ownerCost > renterCost) renterPortfolio += ownerCost - renterCost;
    else ownerPortfolio += renterCost - ownerCost;

    homeValue *= 1 + homeMonth;
    if (m % 12 === 0) {
      rent *= 1 + input.rentIncrease;
      yearsOut.push({
        year: m / 12,
        buyNetWorth:
          homeValue * (1 - input.sellingCostRate) - balance + ownerPortfolio,
        rentNetWorth: renterPortfolio,
      });
    }
  }

  const last = yearsOut.at(-1) ?? {
    year: 0,
    buyNetWorth: 0,
    rentNetWorth: upfront,
  };
  const breakEven = yearsOut.find((y) => y.buyNetWorth >= y.rentNetWorth);
  return {
    upfront,
    ltt,
    mortgage,
    firstOwnerMonthly:
      mortgage +
      (input.price * (input.propertyTaxRate + input.maintenanceRate)) / 12 +
      input.insuranceMonthly +
      input.condoFeesMonthly,
    years: yearsOut,
    buyNetWorth: last.buyNetWorth,
    rentNetWorth: last.rentNetWorth,
    /** Positive: buying comes out ahead. */
    advantage: last.buyNetWorth - last.rentNetWorth,
    breakEvenYear: breakEven?.year ?? null,
    ownerSpent,
    renterSpent,
    homeValue,
    balance,
  };
}

// ---------------------------------------------------------------------------
// Prepayment
// ---------------------------------------------------------------------------

export type PrepaymentInput = {
  balance: number;
  rate: number;
  remainingYears: number;
  /** Extra added to every monthly payment. */
  extraMonthly: number;
  /** Lump sum paid once a year (on each anniversary). */
  annualLump: number;
  /** Lump sum paid now. */
  lumpNow: number;
};

function runDown(
  balance: number,
  rate: number,
  basePayment: number,
  extraMonthly: number,
  annualLump: number,
  maxMonths: number,
) {
  const r = periodicRate(rate, 12);
  let interestTotal = 0;
  let month = 0;
  const balances: number[] = [balance];
  while (balance > 0.005 && month < maxMonths) {
    const interest = balance * r;
    interestTotal += interest;
    balance = Math.max(0, balance + interest - basePayment - extraMonthly);
    month += 1;
    if (annualLump > 0 && month % 12 === 0) {
      balance = Math.max(0, balance - annualLump);
    }
    if (month % 12 === 0 || balance <= 0.005) balances.push(balance);
  }
  return { months: month, interest: interestTotal, balances };
}

export function prepayment(input: PrepaymentInput) {
  const basePayment = payment({
    principal: input.balance,
    annualRate: input.rate,
    years: input.remainingYears,
    frequency: "monthly",
  });
  const max = input.remainingYears * 12 + 12;
  const base = runDown(input.balance, input.rate, basePayment, 0, 0, max);
  const faster = runDown(
    Math.max(0, input.balance - input.lumpNow),
    input.rate,
    basePayment,
    input.extraMonthly,
    input.annualLump,
    max,
  );
  const chart = Array.from(
    { length: Math.max(base.balances.length, faster.balances.length) },
    (_, i) => ({
      year: i,
      base: Math.round(base.balances[i] ?? 0),
      prepay: Math.round(faster.balances[i] ?? 0),
    }),
  );
  return {
    basePayment,
    newPayment: basePayment + input.extraMonthly,
    baseMonths: base.months,
    newMonths: faster.months,
    monthsSaved: base.months - faster.months,
    baseInterest: base.interest,
    newInterest: faster.interest,
    interestSaved: base.interest - faster.interest,
    totalPrepaid:
      input.lumpNow +
      input.extraMonthly * faster.months +
      input.annualLump * Math.floor(faster.months / 12),
    chart,
    /** Share of the balance prepaid in a year (lenders cap ~15–20%). */
    yearOneShare:
      input.balance > 0
        ? (input.lumpNow + input.annualLump + input.extraMonthly * 12) /
          input.balance
        : 0,
  };
}

// ---------------------------------------------------------------------------
// Bridge financing (buy before you sell)
// ---------------------------------------------------------------------------

export type BridgeInput = {
  /** Equity needed from the current home before its sale closes. */
  bridgeAmount: number;
  /** Bridge loan rate (often prime + 2–3%). */
  bridgeRate: number;
  adminFee: number;
  /** Days between the purchase closing and the sale closing. */
  days: number;
  /** Both homes' carrying costs during the overlap, per month. */
  currentHomeMonthly: number;
  newHomeMonthly: number;
  /** Extra legal work for the bridge (often charged by the lawyer). */
  legalFee: number;
  /** Default Ontario. */
  province?: Province;
};

export function bridgeFinancing(input: BridgeInput) {
  // Simple daily interest, as bridge loans are usually charged.
  const interest = input.bridgeAmount * input.bridgeRate * (input.days / 365);
  const legal = input.legalFee * (1 + LEGAL_FEE_TAX[input.province ?? "ON"].rate);
  const doubleCarrying =
    ((input.currentHomeMonthly + input.newHomeMonthly) * input.days * 12) / 365;
  // Only the old home is the extra cost: the new one is paid either way.
  const extraCarrying = (input.currentHomeMonthly * input.days * 12) / 365;
  const bridgeCost = interest + input.adminFee + legal;
  return {
    interest,
    legal,
    bridgeCost,
    doubleCarrying,
    extraCarrying,
    totalExtra: bridgeCost + extraCarrying,
    dailyInterest: (input.bridgeAmount * input.bridgeRate) / 365,
  };
}

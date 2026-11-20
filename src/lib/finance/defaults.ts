// Starting assumptions shared by the calculators tab and the PDF's
// financial scenarios, so both always show the same example numbers.

/** Example price when the agent hasn't entered a list price. */
export const EXAMPLE_PRICE = 800_000;

/** PDF scenario prices without a list price. */
export const EXAMPLE_PRICES = [600_000, 800_000, 1_000_000];

export const DEFAULTS = {
  rate: 0.0449,
  amortization: 25,
  termYears: 5,
  /** Down payment as a share of the price. */
  downShare: 0.2,
  income: 150_000,
  monthlyDebts: 500,
  heating: 100,
  condoFees: 550,
  /** Renewal: current rate vs today's, and the balance share. */
  currentRate: 0.0549,
  refiBalanceShare: 0.6,
  refiRemainingYears: 20,
  /** Seller's mortgage as a share of the price. */
  sellerBalanceShare: 0.4,
  sellerRate: 0.0499,
  agentSplit: 0.7,
  /** Example rent per month as a share of the price (agents enter rent). */
  rentShare: 0.0045,
  rentalRate: 0.0499,
  vacancy: 0.04,
  rentalMaintenance: 0.05,
  appreciation: 0.03,
  rentIncrease: 0.025,
  investmentReturn: 0.05,
  rentInsurance: 25,
  /** 5% commission + HST, plus legal. */
  sellingCostRate: 0.0585,
  rentVsBuyYears: 10,
  extraMonthly: 200,
  bridgeShare: 0.2,
  bridgeRate: 0.0745,
  bridgeAdminFee: 500,
  bridgeLegalFee: 350,
  bridgeDays: 30,
  currentHomeMonthly: 3_500,
  newHomeMonthly: 4_000,
} as const;

export const roundTo = (n: number, step: number) => Math.round(n / step) * step;

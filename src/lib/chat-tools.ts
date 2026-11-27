// Property chat tool schemas: descriptions and inputs only, no executes.
// ⚠️ Import nothing heavier than `ai` and `zod` here. The Head Start route
// (step 1 of a chat's first message, in the warm Next.js server) imports
// this module; the executes live with the Trigger.dev agent
// (server/ai/property-chat.ts), which runs the tools.
import { tool } from "ai";
import { z } from "zod";

export const findPlacesSchema = tool({
  description:
    "Search Google Maps for businesses or places near the property that aren't in the report (e.g. 'Costco', 'Montessori school', 'EV charger', 'dog groomer'). Returns the nearest matches with straight-line distance and estimated walk and drive times.",
  inputSchema: z.object({
    query: z.string().describe("What to look for, in plain words."),
    radiusKm: z
      .number()
      .min(0.5)
      .max(50)
      .default(10)
      .describe("Search radius around the property in km."),
  }),
});

export const travelTimeSchema = tool({
  description:
    "Get a real route time and distance from the property to any address or named place (e.g. 'Square One Mississauga', 'Toronto General Hospital'), by walk, drive or transit.",
  inputSchema: z.object({
    destination: z
      .string()
      .describe("Address or place name, ideally with the city."),
    mode: z.enum(["walk", "drive", "transit"]),
    weekdayMorning: z
      .boolean()
      .default(false)
      .describe(
        "True for a typical weekday 8 a.m. departure (rush hour); false for now.",
      ),
  }),
});

// ---------------------------------------------------------------------------
// Calculators. Every input is optional: the agent fills gaps from the
// report's list price and the agent's saved calculator figures, then the
// defaults. Percentages are plain numbers (4.5 means 4.5%).
// ---------------------------------------------------------------------------

const pctInput = (what: string) =>
  z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe(`${what}, as a percent (4.5 = 4.5%).`);
const moneyInput = (what: string) =>
  z.number().min(0).max(1_000_000_000).optional().describe(what);

export const mortgagePaymentSchema = tool({
  description:
    "Calculate a Canadian mortgage payment (semi-annual compounding) with CMHC insurance when under 20% down: payment, insurance premium, interest over the term and in total, balance at term end. Defaults to this home's list price and the agent's saved figures.",
  inputSchema: z.object({
    price: moneyInput("Purchase price in dollars."),
    downPayment: moneyInput("Down payment in dollars."),
    downPercent: pctInput("Down payment share of the price"),
    ratePercent: pctInput("Interest rate"),
    amortizationYears: z.number().int().min(5).max(30).optional(),
    termYears: z.number().int().min(1).max(10).optional(),
    frequency: z
      .enum([
        "monthly",
        "semiMonthly",
        "biWeekly",
        "acceleratedBiWeekly",
        "weekly",
        "acceleratedWeekly",
      ])
      .optional(),
    firstTimeBuyer: z.boolean().optional(),
  }),
});

export const affordabilitySchema = tool({
  description:
    "Work out the most a household can afford under Canada's stress test (higher of 5.25% or rate + 2%) and the 39% GDS / 44% TDS limits, and whether this home's list price fits.",
  inputSchema: z.object({
    annualIncome: moneyInput("Gross household income per year."),
    monthlyDebts: moneyInput(
      "Car, card and line-of-credit payments per month.",
    ),
    downPayment: moneyInput("Down payment saved, in dollars."),
    ratePercent: pctInput("Mortgage rate"),
    condoFeesMonthly: moneyInput("Condo fees per month."),
  }),
});

export const closingCostsSchema = tool({
  description:
    "Buyer's closing costs and cash needed on closing day, using the property's province: land transfer tax or the province's equivalent (Toronto's and Montréal's municipal rates, first-time buyer relief, foreign-buyer taxes), legal fees with sales tax, title insurance, inspection, provincial tax on mortgage insurance (ON, QC, SK), condo documents.",
  inputSchema: z.object({
    price: moneyInput("Purchase price in dollars."),
    downPayment: moneyInput("Down payment in dollars."),
    downPercent: pctInput("Down payment share of the price"),
    firstTimeBuyer: z.boolean().optional(),
    nonResident: z
      .boolean()
      .optional()
      .describe(
        "Buyer isn't a Canadian citizen or permanent resident (adds NRST).",
      ),
  }),
});

export const sellerNetSchema = tool({
  description:
    "Seller net sheet: proceeds after commission plus the province's sales tax (GST/HST/QST), mortgage payout, prepayment penalty, legal fees and other selling costs.",
  inputSchema: z.object({
    salePrice: moneyInput("Sale price in dollars."),
    commissionTotalPercent: pctInput("Total commission (both brokerages)"),
    mortgageBalance: moneyInput("Mortgage balance at closing."),
    monthsLeftInTerm: z
      .number()
      .int()
      .min(0)
      .max(120)
      .optional()
      .describe(
        "Months left in the mortgage term at closing (0 = no penalty).",
      ),
    mortgageRatePercent: pctInput("Current mortgage rate"),
  }),
});

export const rentalAnalysisSchema = tool({
  description:
    "Analyse the home as a rental: monthly cash flow, net operating income, cap rate, cash-on-cash return, debt coverage and break-even rent.",
  inputSchema: z.object({
    price: moneyInput("Purchase price in dollars."),
    monthlyRent: moneyInput("Expected rent per month (all units)."),
    downPercent: pctInput("Down payment share of the price"),
    ratePercent: pctInput("Mortgage rate"),
    condoFeesMonthly: moneyInput("Condo fees per month."),
    managementPercent: pctInput("Property management fee, share of rent"),
  }),
});

export const rentVsBuySchema = tool({
  description:
    "Compare buying this home with renting and investing the difference: net worth for each over the years, who comes out ahead and when buying pulls ahead.",
  inputSchema: z.object({
    price: moneyInput("Home price in dollars."),
    monthlyRent: moneyInput("Rent for a comparable home per month."),
    years: z.number().int().min(1).max(30).optional(),
    appreciationPercent: pctInput("Home value growth per year"),
    investmentReturnPercent: pctInput("Return on invested savings per year"),
  }),
});

export const propertyTaxSchema = tool({
  description:
    "Estimate property tax from the assessed value and a residential rate: Ontario has 128 municipalities' 2025 rates; elsewhere a typical provincial rate is used (say so).",
  inputSchema: z.object({
    assessedValue: moneyInput(
      "Assessed value (in Ontario the MPAC value, often below today's price).",
    ),
    municipality: z
      .string()
      .max(80)
      .optional()
      .describe(
        "Municipality, e.g. 'Mississauga'. Defaults to the home's city.",
      ),
  }),
});

export const commissionSchema = tool({
  description:
    "The agent's take-home from a sale: gross commission on their side, sales tax collected (GST/HST/QST), brokerage split and fees.",
  inputSchema: z.object({
    salePrice: moneyInput("Sale price in dollars."),
    sideCommissionPercent: pctInput("Commission on the agent's side"),
    agentSplitPercent: pctInput("Agent's share after the brokerage split"),
  }),
});

export const calculatorToolSchemas = {
  mortgage_payment: mortgagePaymentSchema,
  affordability: affordabilitySchema,
  closing_costs: closingCostsSchema,
  seller_net: sellerNetSchema,
  rental_analysis: rentalAnalysisSchema,
  rent_vs_buy: rentVsBuySchema,
  property_tax: propertyTaxSchema,
  commission: commissionSchema,
};

/** Schema-only tools for step 1 (the agent supplies the executes). */
export const chatToolSchemas = {
  find_places: findPlacesSchema,
  travel_time: travelTimeSchema,
  ...calculatorToolSchemas,
};

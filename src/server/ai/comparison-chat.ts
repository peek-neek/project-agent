// The comparison chat: both reports as context, and the property chat's
// tools with a `property` input ("A" or "B") saying which home to work from.
// Used by the comparison-chat agent (Trigger.dev).
import { type Tool, tool } from "ai";
import { z } from "zod";
import { PROVINCE_NAMES, provinceOr } from "../../lib/finance/provinces";
import { TRAVEL_MODES, type TravelMode } from "../../lib/travel";
import type { ReportWithDetails } from "../report-store";
import { calculatorTools, financeContext } from "./calculator-tools";
import {
  chatTools,
  complianceRules,
  reportContext,
  webSearchTool,
} from "./property-chat";

export type ComparedPair = { a: ReportWithDetails; b: ReportWithDetails };

const addressOf = (r: ReportWithDetails) =>
  r.property?.formattedAddress ?? r.inputAddress;

export function comparisonInstructions(
  { a, b }: ComparedPair,
  mode: TravelMode,
  canSearchWeb: boolean,
) {
  const provinces = [
    ...new Set(
      [a, b].map((r) => PROVINCE_NAMES[provinceOr(r.property?.province)]),
    ),
  ].join(" and ");
  return `You are the comparison assistant inside a real estate report app for agents in Canada. A licensed agent is comparing two properties side by side:
- Property A: ${addressOf(a)}
- Property B: ${addressOf(b)}

Scope: answer only about these two properties: comparing them, either one on its own, their areas, and helping the agent present or choose between them. If asked about anything else (other properties, unrelated topics), say briefly that this chat covers Property A and Property B, and offer a related question you can answer.

How to answer:
- Start from the two reports below. Each covers amenities and travel times (walk, bike and drive), commute and transit, nearby schools (with EQAO results for Ontario schools), safety (crime, flood regulation, noise, air quality), census figures, future projects and development applications, and the AI-written marketing copy. Use the exact names and numbers from them.
- Always say which property you mean ("A", "B", or the street). When comparing, put both side by side, ideally in a Markdown table with a column per property, and say which comes out ahead on each point and by how much. Don't declare an overall winner unless asked; the right choice depends on the buyer's needs.
- The agent's preferred travel mode is ${TRAVEL_MODES[mode].label.toLowerCase()} ("${mode}"). Quote times in that mode unless asked otherwise; times marked estimated are approximate.
- For anything the reports don't cover, use your tools instead of guessing. Every tool takes property "A" or "B": find_places for places near that home, travel_time for trips from it, and the calculators for money questions about it (call a tool once per property to compare both). ${canSearchWeb ? "Use web_search for current or local facts (property taxes, zoning by-laws, news, market conditions, municipal services)." : "Say plainly when something can't be checked."} Say which source an answer came from ("from the report", "from Google Maps", "from the web") and link web sources.
- For money questions, call the calculator tools rather than doing the maths yourself. Leave out inputs the agent didn't give: the tools fill them from that property's list price and the agent's saved figures. State the key assumptions with the result, and say the figures are estimates that a lender, insurer or lawyer confirms. Never present rental or rent-versus-buy results as promised returns.
- If you don't know and can't check, say so. Never invent facts, prices, sales, distances or features.
- Be concise and practical: lead with the answer, then the supporting detail. Write in Canadian English.

${complianceRules(provinces)}

<property_a_report>
${reportContext(a, mode)}
</property_a_report>

<property_b_report>
${reportContext(b, mode)}
</property_b_report>`;
}

/** One property's tools: Maps and routes (when it has a location) and calculators. */
function propertyTools(report: ReportWithDetails): Record<string, Tool> {
  const lat = report.property?.latitude;
  const lng = report.property?.longitude;
  return {
    ...(lat != null && lng != null ? chatTools({ lat, lng }) : {}),
    ...calculatorTools(financeContext(report)),
  };
}

const propertyInput = z
  .enum(["A", "B"])
  .describe("Which property to work from: A or B.");

/**
 * The property chat's tools, each taking `property` ("A" or "B") and run
 * against that home's tool. A tool missing for one side (no location yet)
 * returns an error the model can explain.
 */
export function comparisonTools({ a, b }: ComparedPair, canSearchWeb: boolean) {
  const sides = { A: propertyTools(a), B: propertyTools(b) };
  const names = new Set([...Object.keys(sides.A), ...Object.keys(sides.B)]);
  const wrapped: Record<string, Tool> = {};
  for (const name of names) {
    const base = sides.A[name] ?? sides.B[name]!;
    // Every chat tool's input is a zod object (lib/chat-tools).
    const schema = base.inputSchema as unknown as z.ZodObject<z.ZodRawShape>;
    wrapped[name] = tool({
      description: `${base.description} Set property to A or B.`,
      inputSchema: schema.extend({ property: propertyInput }),
      execute: async ({ property, ...input }, options) => {
        const side = sides[property as "A" | "B"][name];
        if (!side?.execute) {
          return {
            property,
            error: `Property ${property}'s location isn't known yet, so this can't be checked for it.`,
          };
        }
        const result = await side.execute(input, options);
        return { property, ...(result as Record<string, unknown>) };
      },
    });
  }
  if (canSearchWeb) {
    // One search covers both: localised to A's city (B's when A has none).
    wrapped.web_search = webSearchTool(
      a.property?.city ?? b.property?.city,
      a.property?.province ?? b.property?.province,
    );
  }
  return wrapped;
}

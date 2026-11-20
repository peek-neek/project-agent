// The property chat: the whole report as context, plus tools for anything
// the report doesn't cover (places nearby, travel to any address, the web).
// Used by the chat route handler (Next.js only).
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { type LanguageModel, tool } from "ai";
import {
  chatToolSchemas,
  findPlacesSchema,
  travelTimeSchema,
} from "../../lib/chat-tools";
import { copySectionKey, SECTION_KEYS } from "../../lib/report-sections";
import {
  estimateMinutes,
  TRAVEL_MODES,
  type TravelMode,
} from "../../lib/travel";
import { distanceMeters, nextWeekdayMorning } from "../geo";
import { searchTextNearby } from "../google-places";
import { RoutesUnavailableError, routeToAddress } from "../google-routes";
import type { ReportWithDetails } from "../report-store";

/** The chat model: OpenAI first (it brings web search), then the others. */
export function chatModel(): {
  model: LanguageModel;
  provider: "openai" | "anthropic" | "google";
} | null {
  if (process.env.OPENAI_API_KEY) {
    return {
      model: openai(process.env.OPENAI_MODEL || "gpt-6-astra"),
      provider: "openai",
    };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      model: anthropic(process.env.ANTHROPIC_MODEL || "claude-opus-5-5"),
      provider: "anthropic",
    };
  }
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return {
      model: google(process.env.GEMINI_MODEL || "gemini-4-argon"),
      provider: "google",
    };
  }
  return null;
}

/**
 * Speed settings for chat answers (both Head Start and the agent).
 * - Low reasoning effort: the model answers instead of deliberating; the
 *   report data and tools do the heavy lifting. Override with
 *   OPENAI_REASONING_EFFORT (none, low, medium, high).
 * - A prompt cache key per report: the long system prompt (the whole
 *   report) is the same every turn, so OpenAI serves it from cache, which
 *   cuts the wait before the first word.
 */
export function chatProviderOptions(
  provider: "openai" | "anthropic" | "google",
  reportId: string,
) {
  if (provider !== "openai") return undefined;
  return {
    openai: {
      reasoningEffort: process.env.OPENAI_REASONING_EFFORT || "low",
      promptCacheKey: `report-chat:${reportId}`,
    },
  };
}

/** Fields that add tokens but nothing the model can use. */
const DROP = new Set([
  "photo",
  "photos",
  "fetchedAt",
  "generatedAt",
  "generatedBy",
  "placeId",
  "trend",
]);

/** Deep copy without noise fields, ids of external records, or empties. */
function compact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(compact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([k, v]) =>
            !DROP.has(k) &&
            // Coordinates of nearby places: tools route from the home and
            // distances are already given. "Estimated" only matters if true.
            !(k === "lat" || k === "lng") &&
            !(k.endsWith("Estimated") && v === false) &&
            !(k === "id" && typeof v === "string" && v.length > 20) &&
            v != null &&
            v !== "",
        )
        .map(([k, v]) => [k, compact(v)]),
    );
  }
  return value;
}

const AI_KEYS = [
  SECTION_KEYS.insights,
  SECTION_KEYS.marketing,
  SECTION_KEYS.campaign,
  SECTION_KEYS.showing,
] as const;

/** Everything the report knows, as compact JSON for the system prompt. */
export function reportContext(report: ReportWithDetails, mode: TravelMode) {
  const section = (key: string) =>
    report.sections.find((s) => s.key === key)?.data ?? null;
  const data: Record<string, unknown> = {};
  for (const s of report.sections) {
    // AI copy is added per mode below; settings aren't content.
    if (s.key.includes(":") || s.key === SECTION_KEYS.copySettings) continue;
    if ((AI_KEYS as readonly string[]).includes(s.key)) continue;
    data[s.key] = compact(s.data);
  }
  for (const key of AI_KEYS) {
    const copy = section(copySectionKey(key, mode)) ?? section(key);
    if (copy) data[key] = compact(copy);
  }
  const p = report.property;
  return JSON.stringify({
    property: compact({
      address: p?.formattedAddress ?? report.inputAddress,
      unit: p?.unitNumber,
      city: p?.city,
      province: p?.province,
      postalCode: p?.postalCode,
      latitude: p?.latitude,
      longitude: p?.longitude,
      pin: p?.pin,
      rollNumber: p?.rollNumber,
      legalDescription: p?.legalDescription,
    }),
    reportCreated: report.createdAt,
    sections: data,
  });
}

export function chatInstructions(
  report: ReportWithDetails,
  mode: TravelMode,
  canSearchWeb: boolean,
) {
  const address = report.property?.formattedAddress ?? report.inputAddress;
  return `You are the property assistant inside a real estate report app for agents in Ontario, Canada. You help a licensed agent understand and market one property: ${address}.

How to answer:
- Start from the report data below. It covers amenities and travel times (walk, bike and drive), commute and transit, schools with EQAO results, safety (crime, flood regulation, noise, air quality), census figures, future projects and development applications, and the AI-written marketing copy and showing playbook. Use the exact names and numbers from it.
- The agent's preferred travel mode is ${TRAVEL_MODES[mode].label.toLowerCase()} ("${mode}"). Quote times in that mode unless asked otherwise; times marked estimated are approximate.
- For anything the report doesn't cover, use your tools instead of guessing: find_places for businesses or places near the home, travel_time for trips to any address, ${canSearchWeb ? "and web_search for current or local facts (property taxes, zoning by-laws, news, market conditions, municipal services, recent sales commentary)" : "and say plainly when something can't be checked"}. Say which source an answer came from ("from the report", "from Google Maps", "from the web") and link web sources.
- For money questions (mortgage payments, how much someone can afford, closing costs and land transfer tax, a seller's net proceeds, rental cash flow, rent versus buy, property tax, commission), call the calculator tools rather than doing the maths yourself. Leave out inputs the agent didn't give: the tools fill them from the agent's saved Calculators tab figures and the list price. State the key assumptions (price, down payment, rate) with the result, and say the figures are estimates that a lender, insurer or lawyer confirms. Never present rental or rent-versus-buy results as promised returns.
- If you don't know and can't check, say so. Never invent facts, prices, sales, distances or features.
- Be concise and practical: lead with the answer, then the supporting detail. Use short paragraphs, bullet lists and tables in Markdown when they help. Write in Canadian English.
- You can draft marketing copy, emails, scripts and talking points on request, using only facts from the report or your tools.

Rules you must follow (Ontario Human Rights Code and RECO advertising rules):
- Never describe, target or steer buyers or tenants by race, ancestry, place of origin, ethnicity, citizenship, creed or religion, sex, sexual orientation, gender identity, age, marital or family status, disability, or receipt of public assistance. Describe homes and places, and buyers only by needs and lifestyle.
- Census figures describe the area's housing and residents as context; never use them to say who should or shouldn't live there.
- Never call an area "safe", "unsafe", "low-crime" or "high-crime". Report crime figures as facts with their source.
- Never say the home is in a school's catchment; give distances and advise confirming with the school board. Don't rank schools as "best".
- Never promise future value or returns.

<report_data>
${reportContext(report, mode)}
</report_data>`;
}

/** Server-side tools: places near the home and travel to any address. */
export function chatTools(origin: { lat: number; lng: number }) {
  return {
    find_places: tool({
      ...findPlacesSchema,
      execute: async ({ query, radiusKm }) => {
        const places = await searchTextNearby({
          ...origin,
          query,
          radius: Math.round(radiusKm * 1000),
          maxResults: 8,
        });
        return {
          source: "Google Maps",
          results: places.map((p) => {
            const meters = Math.round(distanceMeters(origin, p));
            return {
              name: p.name,
              address: p.address,
              rating: p.rating,
              reviews: p.ratingCount,
              distanceKm: Math.round(meters / 100) / 10,
              estWalkMin: estimateMinutes(meters, "walk"),
              estDriveMin: estimateMinutes(meters, "drive"),
              mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name} ${p.address ?? ""}`)}&query_place_id=${p.id}`,
            };
          }),
        };
      },
    }),
    travel_time: tool({
      ...travelTimeSchema,
      execute: async ({ destination, mode, weekdayMorning }) => {
        const routesMode = (
          {
            walk: "WALK",
            bike: "BICYCLE",
            drive: "DRIVE",
            transit: "TRANSIT",
          } as const
        )[mode];
        const departure = weekdayMorning ? nextWeekdayMorning() : undefined;
        try {
          const route = await routeToAddress(
            origin,
            destination,
            routesMode,
            departure,
          );
          return route
            ? {
                source: "Google Maps",
                destination,
                mode,
                minutes: Math.max(1, Math.round(route.seconds / 60)),
                km: Math.round(route.meters / 100) / 10,
                departure: weekdayMorning ? "weekday 8 a.m." : "now",
              }
            : { destination, mode, error: "No route found." };
        } catch (error) {
          return {
            destination,
            mode,
            error:
              error instanceof RoutesUnavailableError
                ? "Routing isn't available right now."
                : "Couldn't calculate that route.",
          };
        }
      },
    }),
  };
}

/**
 * Tools for the Head Start route (a chat's first step, run in the warm
 * Next.js server): schemas only, plus OpenAI's provider-run web search.
 * The agent executes any Maps or route call after the handover.
 */
export function headStartTools(
  city: string | null | undefined,
  webSearch: boolean,
) {
  return {
    ...chatToolSchemas,
    ...(webSearch ? { web_search: webSearchTool(city) } : {}),
  };
}

/** OpenAI's built-in web search, localised to the property. */
export function webSearchTool(city: string | null | undefined) {
  return openai.tools.webSearch({
    searchContextSize: "medium",
    userLocation: {
      type: "approximate",
      country: "CA",
      region: "Ontario",
      ...(city ? { city } : {}),
    },
  });
}

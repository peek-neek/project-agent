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
    "Get a real route time and distance from the property to any address or named place (e.g. 'Square One Mississauga', 'Toronto General Hospital'), by walk, bike, drive or transit.",
  inputSchema: z.object({
    destination: z
      .string()
      .describe("Address or place name, ideally with the city."),
    mode: z.enum(["walk", "bike", "drive", "transit"]),
    weekdayMorning: z
      .boolean()
      .default(false)
      .describe(
        "True for a typical weekday 8 a.m. departure (rush hour); false for now.",
      ),
  }),
});

/** Schema-only tools for step 1 (the agent supplies the executes). */
export const chatToolSchemas = {
  find_places: findPlacesSchema,
  travel_time: travelTimeSchema,
};

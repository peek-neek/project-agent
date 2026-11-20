import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  autocompleteAddresses,
  PlacesConfigError,
  resolveAddress,
} from "@/server/google-places";
import { createRateLimiter, getClientIp } from "@/server/rate-limit";
import { baseProcedure, createTRPCRouter } from "../init";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

// Debounced typing sends ~3–6 requests per address, so these leave plenty of
// headroom for real users while capping what one client can cost us.
const perClient = createRateLimiter("places:ip", [
  { limit: 30, windowMs: MINUTE },
  { limit: 300, windowMs: DAY },
]);

// Backstop for the Google bill if many clients hit the endpoint at once.
const global = createRateLimiter("places:global", [
  { limit: 5000, windowMs: DAY },
]);

const rateLimitedProcedure = baseProcedure.use(async ({ next }) => {
  const ip = await getClientIp();
  const result = perClient.check(ip);
  const allowed = result.success ? global.check("all") : result;

  if (!allowed.success) {
    const seconds = Math.ceil(allowed.retryAfterMs / 1000);
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Too many address searches. Try again in ${seconds}s.`,
    });
  }
  return next();
});

export const placesRouter = createTRPCRouter({
  autocomplete: rateLimitedProcedure
    .input(
      z.object({
        input: z.string().trim().min(3).max(200),
        sessionToken: z
          .string()
          .regex(/^[A-Za-z0-9_-]{1,64}$/)
          .optional(),
        near: z
          .object({
            lat: z.number().min(-90).max(90),
            lng: z.number().min(-180).max(180),
          })
          .nullish(),
      }),
    )
    .query(async ({ input }) => {
      try {
        return await autocompleteAddresses(input);
      } catch (error) {
        console.error("[places.autocomplete]", error);
        throw new TRPCError({
          code:
            error instanceof PlacesConfigError
              ? "PRECONDITION_FAILED"
              : "BAD_GATEWAY",
          message: "Address suggestions are unavailable right now.",
        });
      }
    }),

  /**
   * Checks a typed address (no suggestion picked) before a report is made:
   * one exact match goes ahead, otherwise the agent picks or drops a pin.
   */
  resolve: rateLimitedProcedure
    .input(z.object({ address: z.string().trim().min(3).max(500) }))
    .mutation(async ({ input }) => {
      try {
        return await resolveAddress(input.address);
      } catch (error) {
        console.error("[places.resolve]", error);
        throw new TRPCError({
          code:
            error instanceof PlacesConfigError
              ? "PRECONDITION_FAILED"
              : "BAD_GATEWAY",
          message: "Address lookup is unavailable right now.",
        });
      }
    }),
});

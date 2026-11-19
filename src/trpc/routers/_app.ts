import { z } from "zod";
import { baseProcedure, createTRPCRouter, protectedProcedure } from "../init";
import { placesRouter } from "./places";
import { reportRouter } from "./report";

export const appRouter = createTRPCRouter({
  hello: baseProcedure
    .input(
      z.object({
        text: z.string(),
      }),
    )
    .query((opts) => {
      return {
        greeting: `hello ${opts.input.text}`,
      };
    }),
  me: protectedProcedure.query(({ ctx }) => {
    return { userId: ctx.userId };
  }),
  places: placesRouter,
  report: reportRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

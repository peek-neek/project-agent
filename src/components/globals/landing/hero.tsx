import * as motion from "motion/react-client";
import { AddressSearch } from "@/components/globals/homepage/address-search";
import { HeroVisual } from "./hero-visual";

const EASE = [0.16, 1, 0.3, 1] as const;

const line = (delay: number) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.8, delay, ease: EASE },
});

export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="mx-auto grid max-w-7xl items-center gap-12 px-5 pt-6 pb-16 sm:px-8 lg:grid-cols-12 lg:gap-8 lg:pt-10 lg:pb-24"
    >
      <div className="lg:col-span-5">
        <motion.p
          {...line(0)}
          className="flex items-center gap-2 text-xs font-medium tracking-[0.14em] text-foreground/55 uppercase"
        >
          <span className="h-px w-8 bg-primary" />
          For Ontario real estate agents
        </motion.p>
        <h1
          id="hero-title"
          className="mt-6 text-[clamp(2.5rem,5.2vw,4.4rem)] leading-[0.98] font-semibold tracking-tighter text-balance"
        >
          <motion.span {...line(0.08)} className="block">
            Know the street
          </motion.span>
          <motion.span {...line(0.16)} className="block">
            better than the
          </motion.span>
          <motion.span {...line(0.24)} className="block text-primary">
            seller does.
          </motion.span>
        </h1>
        <motion.p
          {...line(0.36)}
          className="mt-6 max-w-md text-lg leading-relaxed text-foreground/70 text-pretty"
        >
          Type any Ontario address. In minutes you have the neighbourhood
          research, the listing copy and the showing prep you&apos;d normally
          spend an evening on, with every figure sourced.
        </motion.p>
        {/* The real composer: signed-out visitors sign in, then land on
            the report for the address they typed. */}
        <motion.div {...line(0.46)} className="relative z-20 mt-8">
          <AddressSearch />
        </motion.div>
        <motion.p {...line(0.56)} className="mt-5 text-sm text-foreground/50">
          From C$59 a month · Cancel anytime · Built for Ontario
        </motion.p>
      </div>

      <div className="lg:col-span-7">
        <HeroVisual />
      </div>
    </section>
  );
}

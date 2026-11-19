import * as motion from "motion/react-client";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AddressSearch } from "./address-search";
import { easeOutExpo } from "./motion-presets";
import { ParallaxImage } from "./parallax-image";
import { SplitHeading } from "./split-heading";

const floatingFacts = [
  { label: "Walk Score", value: "88", note: "Very walkable" },
  { label: "To downtown", value: "24 min", note: "By transit" },
  { label: "Air quality", value: "Good", note: "AQI 21" },
];

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative pb-6">
      <div className="mx-auto max-w-5xl px-5 pt-2 text-center sm:px-8 md:pt-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: easeOutExpo }}
          className="mb-5"
        >
          <Badge
            variant="outline"
            className="h-auto gap-2 bg-card px-3 py-1.5 text-xs text-foreground/80 sm:text-sm"
          >
            <span className="size-1.5 bg-primary" />
            AI property report generator for Ontario agents
          </Badge>
        </motion.div>
        <SplitHeading
          lines={[
            { text: "Property reports for" },
            { text: "any address, in minutes" },
          ]}
          className="text-[clamp(2.25rem,5.4vw,4.75rem)] leading-[0.95] font-semibold tracking-tighter"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.45, ease: easeOutExpo }}
        className="relative z-20 mx-auto mt-7 max-w-3xl px-4 sm:mt-9 sm:px-8"
      >
        <AddressSearch align="center" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 1, delay: 0.25, ease: easeOutExpo }}
        className="mx-auto mt-10 max-w-[90rem] px-3 sm:mt-12 sm:px-5"
      >
        <ParallaxImage
          src="/images/hero-home.jpg"
          alt="Modern two-storey home with wood siding and a large tree in the front yard at dusk"
          preload
          sizes="(min-width: 1440px) 1440px, 100vw"
          className="h-[34rem] sm:h-[36rem]"
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/75" />

          <div className="absolute inset-x-5 bottom-6 flex flex-col gap-6 sm:inset-x-8 sm:bottom-8 md:flex-row md:items-end md:justify-between lg:inset-x-10 lg:bottom-10">
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.8, ease: easeOutExpo }}
              className="max-w-md text-sm leading-relaxed text-white/85 sm:text-base"
            >
              Type an address and get a branded report covering the property,
              neighbourhood, transit, demographics and safety, ready to share
              with clients.
            </motion.p>

            <ul
              aria-label="Sample report facts"
              className="hidden gap-3 md:flex"
            >
              {floatingFacts.map((fact, i) => (
                <motion.li
                  key={fact.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.7,
                    delay: 1 + i * 0.12,
                    ease: easeOutExpo,
                  }}
                >
                  <Card className="w-40 gap-3 bg-white/15 px-4 py-3.5 text-white ring-white/25 backdrop-blur-md lg:w-44">
                    <span className="text-2xl font-semibold whitespace-nowrap">
                      {fact.value}
                    </span>
                    <span>
                      <span className="block text-xs text-white/80">
                        {fact.label}
                      </span>
                      <span className="block text-xs text-white/65">
                        {fact.note}
                      </span>
                    </span>
                  </Card>
                </motion.li>
              ))}
            </ul>
          </div>
        </ParallaxImage>
      </motion.div>
    </section>
  );
}

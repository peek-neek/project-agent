import * as motion from "motion/react-client";
import { AddressSearch } from "./address-search";
import { fadeUp, inViewOnce, stagger } from "./motion-presets";

export function Cta() {
  return (
    <section
      aria-labelledby="cta-title"
      className="px-3 py-20 sm:px-5 sm:py-28"
    >
      <motion.div
        variants={stagger(0.1)}
        initial="hidden"
        whileInView="visible"
        viewport={inViewOnce}
        className="relative mx-auto max-w-[90rem] overflow-hidden bg-primary px-5 py-20 text-primary-foreground sm:px-8 sm:py-28"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 -right-40 size-[32rem] bg-primary-foreground/10 blur-3xl"
        />
        <div className="relative mx-auto max-w-3xl text-center">
          <motion.h2
            id="cta-title"
            variants={fadeUp}
            className="text-[clamp(2.25rem,5vw,4rem)] leading-[1] font-semibold tracking-tighter text-balance"
          >
            Create your first property report today
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="mx-auto mt-5 max-w-xl text-base text-primary-foreground/80 sm:text-lg"
          >
            Have the whole picture before the first showing. Enter an address to
            get started.
          </motion.p>
          <motion.div variants={fadeUp} className="mt-10 text-left">
            <AddressSearch align="center" showExamples={false} />
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}

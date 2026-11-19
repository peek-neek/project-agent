import type { Metadata } from "next";
import * as motion from "motion/react-client";
import { AddressSearch } from "@/components/globals/homepage/address-search";
import { fadeUp, stagger } from "@/components/globals/homepage/motion-presets";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-8">
      <motion.div
        variants={stagger(0.08)}
        initial="hidden"
        animate="visible"
        className="w-full max-w-2xl"
      >
        <motion.h1
          variants={fadeUp}
          className="text-center text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
        >
          Which property are you selling?
        </motion.h1>
        <motion.p
          variants={fadeUp}
          className="mt-3 text-center text-foreground/65 text-pretty"
        >
          Enter an Ontario address. We&apos;ll build the report while you get on
          with your day.
        </motion.p>
        <motion.div variants={fadeUp} className="mt-8">
          <AddressSearch />
        </motion.div>
      </motion.div>
    </div>
  );
}

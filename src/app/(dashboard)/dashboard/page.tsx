import type { Metadata } from "next";
import * as motion from "motion/react-client";
import { Suspense } from "react";
import {
  BillingPanel,
  BillingPanelSkeleton,
} from "@/components/globals/dashboard/billing-panel";
import { AddressSearch } from "@/components/globals/homepage/address-search";
import { fadeUp, stagger } from "@/components/globals/homepage/motion-presets";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export default function DashboardPage({
  searchParams,
}: PageProps<"/dashboard">) {
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
          Know more. Sell with confidence.
        </motion.h1>
        {/* <motion.p
          variants={fadeUp}
          className="mt-3 text-center text-foreground/65 text-pretty"
        >
          The more you know about a home, the more confident you are, and the
          more confident you are, the more you sell. Enter a Canadian address
          and we&apos;ll build the report while you get on with your day.
        </motion.p> */}
        <motion.div variants={fadeUp} className="mt-8">
          <AddressSearch />
        </motion.div>
        {/* <motion.div variants={fadeUp} className="mt-6">
          <Suspense fallback={<BillingPanelSkeleton />}>
            <BillingPanel searchParams={searchParams} />
          </Suspense>
        </motion.div> */}
      </motion.div>
    </div>
  );
}

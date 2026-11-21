import { ArrowRightIcon } from "lucide-react";
import * as motion from "motion/react-client";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const EASE = [0.16, 1, 0.3, 1] as const;

export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="relative overflow-hidden">
      <Image
        src="/images/hero-home.jpg"
        alt=""
        fill
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/20" />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.8, ease: EASE }}
        className="relative mx-auto max-w-7xl px-5 py-24 text-white sm:px-8 sm:py-32"
      >
        <h2
          id="cta-title"
          className="max-w-2xl text-[clamp(2rem,4vw,3.4rem)] leading-[1.04] font-semibold tracking-tight text-balance"
        >
          Your next listing appointment is the best place to start.
        </h2>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/75 text-pretty">
          Run the report on the drive over. Walk in knowing the street, the
          schools and the numbers, with the marketing already written.
        </p>
        <Button
          nativeButton={false}
          render={<Link href="/sign-up" />}
          className="group mt-9 h-12 px-6 text-base"
        >
          Start your first report
          <ArrowRightIcon
            data-icon="inline-end"
            className="transition-transform group-hover:translate-x-0.5"
          />
        </Button>
      </motion.div>
    </section>
  );
}

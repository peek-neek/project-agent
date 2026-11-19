import * as motion from "motion/react-client";
import { Badge } from "@/components/ui/badge";
import { dataSources } from "./content";
import { fadeUp, inViewOnce } from "./motion-presets";

function SourceList({ hidden }: { hidden?: boolean }) {
  return (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 gap-3 pr-3">
      {dataSources.map((source) => (
        <Badge
          key={source}
          variant="outline"
          render={<li />}
          className="h-auto bg-card px-5 py-2.5 text-sm font-normal text-foreground/80"
        >
          {source}
        </Badge>
      ))}
    </ul>
  );
}

export function DataSources() {
  return (
    <section aria-labelledby="sources-title" className="py-16 sm:py-20">
      <motion.h2
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={inViewOnce}
        id="sources-title"
        className="px-5 text-center text-sm font-medium text-foreground/65"
      >
        Every report draws on {dataSources.length} public and licensed data
        sources
      </motion.h2>
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={inViewOnce}
        transition={{ duration: 0.8, delay: 0.15 }}
        className="relative mt-8 overflow-hidden mask-x-from-85% mask-x-to-100%"
      >
        <div className="flex w-max animate-marquee hover:[animation-play-state:paused] motion-reduce:animate-none">
          <SourceList />
          <SourceList hidden />
        </div>
      </motion.div>
    </section>
  );
}

import Image from "next/image";
import * as motion from "motion/react-client";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  dataSources,
  reportSections,
  site,
} from "@/components/globals/homepage/content";
import { Logo } from "@/components/globals/homepage/logo";
import {
  easeOutExpo,
  fadeUp,
  stagger,
} from "@/components/globals/homepage/motion-presets";

const facts = [
  { value: String(reportSections.length), label: "Report sections" },
  { value: String(dataSources.length), label: "Data sources" },
  { value: "Minutes", label: "Not hours" },
];

export function AuthShowcase() {
  return (
    <aside className="relative hidden p-3 lg:block">
      <div className="relative h-full min-h-[40rem] overflow-hidden">
        <Image
          src="/images/hero-home.jpg"
          alt=""
          fill
          preload
          sizes="50vw"
          className="animate-ken-burns object-cover motion-reduce:animate-none"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/40" />

        <div className="relative flex h-full flex-col justify-between p-10 xl:p-12">
          <Logo className="text-white" />

          <motion.figure
            variants={stagger(0.1, 0.2)}
            initial="hidden"
            animate="visible"
            className="max-w-xl text-white"
          >
            <motion.div variants={fadeUp}>
              <Badge
                variant="outline"
                className="h-auto gap-2 border-white/30 bg-white/10 px-3 py-1 text-white backdrop-blur-md"
              >
                <span className="size-1.5 bg-primary" />
                Built for Ontario real estate agents
              </Badge>
            </motion.div>
            <motion.blockquote
              variants={fadeUp}
              className="mt-6 text-3xl leading-tight font-semibold tracking-tight text-balance xl:text-4xl"
            >
              “Walk into every showing already knowing the street, the schools
              and the commute.”
            </motion.blockquote>
            <motion.figcaption
              variants={fadeUp}
              className="mt-4 text-sm text-white/70"
            >
              {site.name} property reports
            </motion.figcaption>

            <motion.ul
              variants={fadeUp}
              transition={{ duration: 0.7, ease: easeOutExpo }}
              className="mt-10 grid grid-cols-3 gap-3"
            >
              {facts.map((fact) => (
                <li key={fact.label}>
                  <Card className="gap-1 bg-white/10 px-4 py-3.5 text-white ring-white/20 backdrop-blur-md">
                    <span className="text-xl font-semibold">{fact.value}</span>
                    <span className="text-xs text-white/70">{fact.label}</span>
                  </Card>
                </li>
              ))}
            </motion.ul>
          </motion.figure>
        </div>
      </div>
    </aside>
  );
}

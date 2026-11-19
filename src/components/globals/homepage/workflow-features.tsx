import {
  Columns3Icon,
  HistoryIcon,
  LayersIcon,
  Link2Icon,
  SlidersHorizontalIcon,
} from "lucide-react";
import * as motion from "motion/react-client";
import { cn } from "cn";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { site, workflowFeatures } from "./content";
import { fadeUp, inViewOnce, stagger } from "./motion-presets";
import { SectionHeading } from "./section-heading";

const icons = [
  SlidersHorizontalIcon,
  Link2Icon,
  HistoryIcon,
  Columns3Icon,
  LayersIcon,
];
const spans = [
  "lg:col-span-3",
  "lg:col-span-3",
  "lg:col-span-2",
  "lg:col-span-2",
  "lg:col-span-2",
];

export function WorkflowFeatures() {
  return (
    <section aria-labelledby="workflow-title" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading
          id="workflow-title"
          eyebrow="Built for busy agents"
          title="Share, compare and generate property reports in bulk"
          description={`${site.name} fits around your listings, not the other way round.`}
          align="center"
        />
        <motion.ul
          variants={stagger(0.08)}
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-6"
        >
          {workflowFeatures.map((feature, i) => {
            const Icon = icons[i];
            return (
              <motion.li
                key={feature.title}
                variants={fadeUp}
                className={cn(
                  spans[i],
                  i === workflowFeatures.length - 1 && "sm:col-span-2",
                )}
              >
                <Card className="group h-full gap-10 ring-border transition-shadow duration-300 [--card-spacing:--spacing(7)] hover:shadow-xl">
                  <CardHeader>
                    <span className="grid size-12 place-items-center bg-muted text-foreground transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
                      <Icon aria-hidden className="size-5" />
                    </span>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <CardTitle className="text-lg font-semibold tracking-tight">
                      <h3>{feature.title}</h3>
                    </CardTitle>
                    <CardDescription className="leading-relaxed text-foreground/65">
                      {feature.body}
                    </CardDescription>
                  </CardContent>
                </Card>
              </motion.li>
            );
          })}
        </motion.ul>
      </div>
    </section>
  );
}

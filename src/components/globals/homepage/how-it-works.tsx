import * as motion from "motion/react-client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { steps } from "./content";
import { inViewOnce, slideIn, stagger } from "./motion-presets";
import { SectionHeading } from "./section-heading";

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-title"
      className="scroll-mt-8 overflow-x-clip py-20 sm:py-28"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading
          id="how-it-works-title"
          eyebrow="How it works"
          title="How to create a property report in three steps"
          description="No spreadsheets or browser tabs. Enter an address and the report is ready before your coffee is."
        />

        <motion.ol
          variants={stagger(0.12)}
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          className="mt-14 grid gap-4 md:grid-cols-3"
        >
          {steps.map((step, i) => (
            <motion.li key={step.title} variants={slideIn}>
              <Card className="group h-full min-h-72 justify-between ring-border transition-shadow duration-300 [--card-spacing:--spacing(7)] hover:shadow-xl sm:[--card-spacing:--spacing(8)]">
                <CardHeader>
                  <span
                    aria-hidden
                    className="text-7xl font-semibold tracking-tighter text-foreground/10 transition-colors duration-300 group-hover:text-primary/15"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </CardHeader>
                <CardContent className="space-y-3">
                  <CardTitle className="text-xl font-semibold tracking-tight">
                    <h3>{step.title}</h3>
                  </CardTitle>
                  <CardDescription className="leading-relaxed text-foreground/65 sm:text-base">
                    {step.body}
                  </CardDescription>
                </CardContent>
              </Card>
            </motion.li>
          ))}
        </motion.ol>
      </div>
    </section>
  );
}

import { CheckIcon } from "lucide-react";
import * as motion from "motion/react-client";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { reportSections, site } from "./content";
import { easeOutExpo, inViewOnce } from "./motion-presets";
import { SectionHeading } from "./section-heading";

function SoonBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("h-4 bg-muted px-1.5 text-[10px] leading-4", className)}
    >
      Soon
    </Badge>
  );
}

export function ReportSections() {
  return (
    <section
      id="whats-inside"
      aria-labelledby="whats-inside-title"
      className="scroll-mt-8 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            id="whats-inside-title"
            eyebrow="What's inside"
            title={`Everything in a ${site.name} property report`}
            description="Twelve sections, from the cover page to the data sources. Hide any of them before you share."
          />
          <p className="flex shrink-0 items-center gap-4 text-sm text-foreground/65">
            <span className="inline-flex items-center gap-1.5">
              <CheckIcon aria-hidden className="size-4 text-primary" />
              Available now
            </span>
            <span className="inline-flex items-center gap-1.5">
              <SoonBadge />
              Coming soon
            </span>
          </p>
        </div>

        <ol className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reportSections.map((section, i) => {
            const comingSoon = section.items.every((item) => !item.available);
            return (
              <motion.li
                key={section.id}
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={inViewOnce}
                transition={{
                  duration: 0.7,
                  delay: (i % 3) * 0.08,
                  ease: easeOutExpo,
                }}
              >
                <Card
                  aria-labelledby={`section-${section.id}`}
                  className={cn(
                    "group h-full gap-5 ring-border transition duration-300 [--card-spacing:--spacing(6)] hover:-translate-y-1 hover:shadow-xl sm:[--card-spacing:--spacing(7)]",
                    comingSoon && "bg-card/60",
                  )}
                >
                  <CardHeader className="gap-2">
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <span
                        aria-hidden
                        className="text-sm font-medium text-foreground/65 tabular-nums transition-colors group-hover:text-primary"
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {section.agentOnly && (
                        <Badge className="bg-foreground px-2.5 text-[11px] text-background">
                          Agent version only
                        </Badge>
                      )}
                      {comingSoon && (
                        <Badge
                          variant="outline"
                          className="bg-muted px-2.5 text-[11px]"
                        >
                          Coming soon
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-xl font-semibold tracking-tight">
                      <h3 id={`section-${section.id}`}>{section.title}</h3>
                    </CardTitle>
                    <CardDescription className="leading-relaxed text-foreground/65">
                      {section.summary}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <Separator />
                    <ul className="space-y-2.5 text-sm">
                      {section.items.map((item) => (
                        <li
                          key={item.label}
                          className="flex items-start gap-2.5"
                        >
                          {item.available ? (
                            <CheckIcon
                              aria-label="Available"
                              className="mt-0.5 size-4 shrink-0 text-primary"
                            />
                          ) : (
                            <SoonBadge className="mt-0.5 shrink-0" />
                          )}
                          <span
                            className={cn(
                              !item.available && "text-foreground/65",
                            )}
                          >
                            {item.label}
                            {item.source && (
                              <span className="block text-xs text-foreground/65">
                                {item.source}
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

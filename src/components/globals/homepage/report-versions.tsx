"use client";

import { AnimatePresence, motion } from "motion/react";
import { cn } from "cn";
import { useId, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { reportSections } from "./content";
import { easeOutExpo } from "./motion-presets";

const versions = [
  {
    id: "client",
    label: "Client version",
    title: "A clean report your buyers will want to keep",
    body: "The full property, neighbourhood and money picture, with your branding on every page. Ready to email, print or share as a link.",
  },
  {
    id: "agent",
    label: "Agent version",
    title: "Your private playbook for every showing",
    body: "Everything in the client version, plus talking points, likely objections with suggested answers, an ideal buyer profile and a showing checklist.",
  },
] as const;

type Version = (typeof versions)[number]["id"];

const toggleable = reportSections.filter(
  (s) => s.id !== "cover" && s.id !== "sources",
);

export function ReportVersions() {
  const id = useId();
  const [version, setVersion] = useState<Version>("agent");
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(["money"]));
  const active = versions.find((v) => v.id === version)!;

  const toggle = (sectionId: string, on: boolean) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (on) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
      <div className="lg:sticky lg:top-24">
        <ToggleGroup
          aria-label="Report version"
          spacing={1}
          value={[version]}
          onValueChange={(value) => {
            const next = value[0] as Version | undefined;
            if (next) setVersion(next);
          }}
          className="bg-background/10 p-1 ring-1 ring-background/20"
        >
          {versions.map((v) => (
            <ToggleGroupItem
              key={v.id}
              value={v.id}
              className="relative h-auto px-5 py-2.5 text-background/70 hover:bg-transparent hover:text-background aria-pressed:bg-transparent aria-pressed:text-foreground"
            >
              {v.id === version && (
                <motion.span
                  layoutId={`${id}-version`}
                  transition={{
                    type: "spring",
                    bounce: 0.2,
                    visualDuration: 0.35,
                  }}
                  className="absolute inset-0 bg-background"
                />
              )}
              <span className="relative">{v.label}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <div className="mt-8 min-h-44" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: easeOutExpo }}
            >
              <h3 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {active.title}
              </h3>
              <p className="mt-4 max-w-lg leading-relaxed text-background/70">
                {active.body}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <Card className="gap-0 bg-background p-3 shadow-2xl ring-0 sm:p-4">
        <CardHeader className="grid-cols-[1fr_auto] items-center px-3 pt-2 pb-4">
          <CardTitle className="text-sm font-semibold">
            Report sections
          </CardTitle>
          <CardDescription className="text-xs text-foreground/65">
            Toggle what you share
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Card className="gap-0 py-0 ring-border">
            <ul className="divide-y">
              {toggleable.map((section) => {
                const lockedOut = section.agentOnly && version === "client";
                const on = !lockedOut && !hidden.has(section.id);
                const switchId = `${id}-${section.id}`;
                return (
                  <li
                    key={section.id}
                    className={cn(
                      "flex items-center justify-between gap-4 px-4 py-3",
                      lockedOut && "opacity-50",
                    )}
                  >
                    <Label
                      htmlFor={switchId}
                      className="flex-col items-start gap-0.5"
                    >
                      <span>{section.title}</span>
                      {lockedOut && (
                        <span className="text-xs font-normal text-foreground/65">
                          Agent version only
                        </span>
                      )}
                    </Label>
                    <Switch
                      id={switchId}
                      checked={on}
                      disabled={lockedOut}
                      onCheckedChange={(checked) => toggle(section.id, checked)}
                    />
                  </li>
                );
              })}
            </ul>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { CheckIcon, MinusIcon } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { cn } from "cn";
import { Fragment, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EASE, Rolling } from "./shared";

type Billing = "monthly" | "annual";

const PLANS = [
  {
    id: "basic",
    name: "Basic",
    for: "Try it on one of your listings, free.",
    was: null,
    monthly: 0,
    annual: 0,
    reports: 1,
    chat: 5,
    highlight: false,
  },
  {
    id: "starter",
    name: "Starter",
    for: "For agents with one or two listings a month.",
    was: 79,
    monthly: 59,
    annual: 590,
    reports: 3,
    chat: 30,
    highlight: false,
  },
  {
    id: "pro",
    name: "Pro",
    for: "For active agents who also run reports for buyers.",
    was: 159,
    monthly: 139,
    annual: 1390,
    reports: 10,
    chat: 100,
    highlight: true,
  },
] as const;

type Cell = boolean | string;
/** Rows: label, then Basic, Starter, Pro. */
const FEATURES: { group: string; rows: [string, Cell, Cell, Cell][] }[] = [
  {
    group: "Reports and chat",
    rows: [
      ["New reports", "1 free", "3 a month", "10 a month"],
      ["AI chat messages", "5 free", "30 a month", "100 a month"],
      ["Extra reports", "C$15 each", "C$15 each", "C$15 each"],
    ],
  },
  {
    group: "The report",
    rows: [
      ["Satellite views of the property and property details", true, true, true],
      ["Sell / rent ease score, with the price point", true, true, true],
      [
        "23 amenity categories, timed on foot and by car",
        true,
        true,
        true,
      ],
      ["Commute to downtowns and airports at rush hour", true, true, true],
      [
        "Nearest schools (every board and EQAO results in Ontario)",
        true,
        true,
        true,
      ],
      ["Crime, flood regulation, noise and air quality", true, true, true],
      ["Housing mix and planned development nearby", true, true, true],
    ],
  },
  {
    group: "Marketing",
    rows: [
      ["MLS descriptions in 4 tones, social posts and email", true, true, true],
      [
        "5-stage listing campaign, Reel script, carousel and ads",
        true,
        true,
        true,
      ],
      ["Showing playbook, buyer answers and checklists", true, true, true],
      ["Rewrite or translate any block", true, true, true],
      ["Regenerate all AI copy", "1 per report", "1 per report", "Unlimited"],
    ],
  },
  {
    group: "Tools",
    rows: [
      [
        "13 calculators: mortgage, land transfer tax, closing costs and more",
        true,
        true,
        true,
      ],
      ["Saved calculator figures in the PDF and chat", false, false, true],
      ["PDF download with clickable contents", true, true, true],
      ["Your logo and details on every PDF page", false, false, true],
      ["Support", "Email", "Email", "Priority"],
    ],
  },
];

function Mark({ value }: { value: Cell }) {
  if (typeof value === "string")
    return <span className="text-sm font-medium">{value}</span>;
  return value ? (
    <CheckIcon aria-label="Included" className="size-4 text-foreground" />
  ) : (
    <MinusIcon
      aria-label="Not included"
      className="size-4 text-foreground/30"
    />
  );
}

export function Pricing() {
  const id = useId();
  const [billing, setBilling] = useState<Billing>("monthly");

  return (
    <section
      id="pricing"
      aria-labelledby="pricing-title"
      className="scroll-mt-24 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h2
              id="pricing-title"
              className="text-[clamp(1.9rem,3.4vw,2.9rem)] leading-[1.08] font-semibold tracking-tight text-balance"
            >
              Less than the cost of one listing photo shoot.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-foreground/65 text-pretty">
              Start free with one full report, no card needed. Plans add monthly
              reports and AI chat. Prices in Canadian dollars, plus applicable
              sales tax. Cancel anytime.
            </p>
          </div>
          <ToggleGroup
            aria-label="Billing period"
            value={[billing]}
            onValueChange={(v) => v[0] && setBilling(v[0] as Billing)}
            spacing={0}
            className="border bg-card p-0.5"
          >
            {(
              [
                ["monthly", "Monthly"],
                ["annual", "Annual · 2 months free"],
              ] as const
            ).map(([value, label]) => (
              <ToggleGroupItem
                key={value}
                value={value}
                className={cn(
                  "relative rounded-none px-4 text-sm font-medium hover:bg-transparent data-pressed:bg-transparent",
                  billing === value
                    ? "text-background hover:text-background"
                    : "text-foreground/60 hover:text-foreground",
                )}
              >
                {billing === value && (
                  <motion.span
                    layoutId={`billing-${id}`}
                    transition={{
                      type: "spring",
                      bounce: 0.15,
                      duration: 0.45,
                    }}
                    className="absolute inset-0 bg-foreground"
                  />
                )}
                <span className="relative">{label}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {/* The three plans, side by side */}
        <div className="mt-12 grid border-y md:grid-cols-3 md:divide-x">
          {PLANS.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.7, delay: i * 0.1, ease: EASE }}
              className={cn(
                "relative py-10 md:px-10 md:first:pl-0 md:last:pr-0",
                i > 0 && "border-t md:border-t-0",
              )}
            >
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-semibold">{p.name}</h3>
                {p.highlight && (
                  <span className="bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                    Most agents choose this
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-foreground/60">{p.for}</p>
              <p className="mt-6 flex items-end gap-3">
                <span className="text-5xl leading-none font-semibold tracking-tight">
                  {p.id === "basic" ? (
                    "Free"
                  ) : (
                    <Rolling
                      value={`C$${billing === "monthly" ? p.monthly : p.annual.toLocaleString("en-CA")}`}
                    />
                  )}
                </span>
                {p.id !== "basic" && (
                  <span className="pb-1 text-foreground/55">
                    {billing === "monthly" ? "/ month" : "/ year"}
                  </span>
                )}
                {billing === "monthly" && p.was != null && (
                  <span className="pb-1 text-foreground/40 line-through">
                    C${p.was}
                  </span>
                )}
              </p>
              <p className="mt-2 text-sm text-foreground/55">
                {p.id === "basic"
                  ? `${p.reports} full report and ${p.chat} chat messages, once · no card needed`
                  : `${p.reports} new reports and ${p.chat} chat messages a month · extra reports C$15`}
              </p>
              <Button
                nativeButton={false}
                render={
                  <Link
                    // Sign up, then (paid plans) straight to Stripe Checkout
                    // for this plan and billing period; Basic lands on the
                    // dashboard with its free report.
                    href={`/sign-up?redirect_url=${encodeURIComponent(
                      p.id === "basic"
                        ? "/dashboard"
                        : `/billing/checkout?plan=${p.id}&interval=${billing}`,
                    )}`}
                  />
                }
                variant={p.highlight ? "default" : "outline"}
                className="mt-8 h-12 w-full px-6 text-base sm:w-auto"
              >
                {p.id === "basic" ? "Start free" : `Choose ${p.name}`}
              </Button>
            </motion.div>
          ))}
        </div>

        {/* Everything each plan includes */}
        <div className="mt-12 overflow-x-auto">
          <Table className="min-w-[42rem]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[52%]">
                  <span className="sr-only">Feature</span>
                </TableHead>
                <TableHead className="text-foreground">Basic</TableHead>
                <TableHead className="text-foreground">Starter</TableHead>
                <TableHead className="text-foreground">Pro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {FEATURES.map((g) => (
                <Fragment key={g.group}>
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={4}
                      className="pt-8 text-xs font-medium tracking-[0.14em] text-foreground/50 uppercase"
                    >
                      {g.group}
                    </TableCell>
                  </TableRow>
                  {g.rows.map(([label, basic, starter, pro]) => (
                    <TableRow key={`${g.group}-${label}`}>
                      <TableCell className="py-3 whitespace-normal text-foreground/80">
                        {label}
                      </TableCell>
                      <TableCell className="py-3">
                        <Mark value={basic} />
                      </TableCell>
                      <TableCell className="py-3">
                        <Mark value={starter} />
                      </TableCell>
                      <TableCell className="py-3">
                        <Mark value={pro} />
                      </TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  );
}

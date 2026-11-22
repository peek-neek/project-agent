"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "cn";
import { ButtonGroup } from "@/components/ui/button-group";
import type { BillingInterval } from "@/lib/billing";

export type PickerPlan = {
  id: "starter" | "pro";
  name: string;
  reports: number;
  chat: number;
  prices: Record<BillingInterval, number>;
};

const money = (n: number) => `C$${n.toLocaleString("en-CA")}`;

/**
 * Pick a plan (Starter / Pro) and a billing period, then one button to Stripe
 * Checkout for that choice.
 */
export function PlanPicker({ plans }: { plans: PickerPlan[] }) {
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  // Pro by default: the pricing page's "Most agents choose this".
  const [planId, setPlanId] = useState<PickerPlan["id"]>(
    plans.some((p) => p.id === "pro") ? "pro" : (plans[0]?.id ?? "starter"),
  );
  const selected = plans.find((p) => p.id === planId) ?? plans[0];
  const per = interval === "monthly" ? "month" : "year";

  return (
    <div className="grid gap-3">
      {/* Joined like the header's Report | Chat switch; the current one filled. */}
      <ButtonGroup aria-label="Billing period" className="justify-self-center">
        {(
          [
            ["monthly", "Monthly"],
            ["annual", "Annual · 2 months free"],
          ] as const
        ).map(([value, label]) => {
          const current = interval === value;
          return (
            <Button
              key={value}
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={current}
              onClick={() => setInterval(value)}
              className={cn(
                "h-8 bg-card px-3",
                current &&
                  "bg-foreground text-background hover:bg-foreground/90 hover:text-background",
              )}
            >
              {label}
            </Button>
          );
        })}
      </ButtonGroup>

      <RadioGroup
        aria-label="Plan"
        value={planId}
        onValueChange={(v) => setPlanId(v as PickerPlan["id"])}
        className="gap-3 sm:grid-cols-2"
      >
        {plans.map((plan) => (
          <Item
            key={plan.id}
            variant="outline"
            render={<label />}
            className="cursor-pointer has-data-checked:border-primary has-data-checked:bg-primary/5"
          >
            <ItemContent>
              <ItemTitle>
                {plan.name}
                <span className="font-normal text-foreground/60">
                  {money(plan.prices[interval])} / {per}
                </span>
              </ItemTitle>
              <ItemDescription>
                {plan.reports} reports and {plan.chat} chat messages a month
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <RadioGroupItem value={plan.id} aria-label={plan.name} />
            </ItemActions>
          </Item>
        ))}
      </RadioGroup>

      {selected && (
        // Plain <a>: the route creates a Stripe session, so no prefetch.
        <Button
          nativeButton={false}
          render={<a href={`/billing/checkout?plan=${selected.id}&interval=${interval}`} />}
          className="w-full"
        >
          Continue with {selected.name} · {money(selected.prices[interval])} / {per}
        </Button>
      )}
    </div>
  );
}

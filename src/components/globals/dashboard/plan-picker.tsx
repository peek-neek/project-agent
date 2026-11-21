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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { BillingInterval } from "@/lib/billing";

export type PickerPlan = {
  id: "starter" | "pro";
  name: string;
  reports: number;
  chat: number;
  prices: Record<BillingInterval, number>;
};

const money = (n: number) => `C$${n.toLocaleString("en-CA")}`;

/** Starter / Pro cards with a Monthly / Annual switch, for agents with no plan. */
export function PlanPicker({ plans }: { plans: PickerPlan[] }) {
  const [interval, setInterval] = useState<BillingInterval>("monthly");

  return (
    <div className="grid gap-3">
      <ToggleGroup
        aria-label="Billing period"
        value={[interval]}
        onValueChange={(v) => v[0] && setInterval(v[0] as BillingInterval)}
        variant="outline"
        size="sm"
        className="justify-self-center"
      >
        <ToggleGroupItem value="monthly">Monthly</ToggleGroupItem>
        <ToggleGroupItem value="annual">Annual · 2 months free</ToggleGroupItem>
      </ToggleGroup>
      <div className="grid gap-3 sm:grid-cols-2">
        {plans.map((plan) => (
          <Item key={plan.id} variant="outline">
            <ItemContent>
              <ItemTitle>
                {plan.name}
                <span className="font-normal text-foreground/60">
                  {money(plan.prices[interval])} /{" "}
                  {interval === "monthly" ? "month" : "year"}
                </span>
              </ItemTitle>
              <ItemDescription>
                {plan.reports} reports and {plan.chat} chat messages a month
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              {/* Plain <a>: the route creates a Stripe session, so no prefetch. */}
              <Button
                nativeButton={false}
                render={
                  <a href={`/billing/checkout?plan=${plan.id}&interval=${interval}`} />
                }
                variant={plan.id === "pro" ? "default" : "outline"}
                size="sm"
              >
                Choose {plan.name}
              </Button>
            </ItemActions>
          </Item>
        ))}
      </div>
    </div>
  );
}

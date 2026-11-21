import { auth } from "@clerk/nextjs/server";
import { AlertCircleIcon, CheckCircle2Icon } from "lucide-react";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemTitle,
} from "@/components/ui/item";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { BILLING_ERRORS } from "@/lib/billing";
import { PlanPicker } from "./plan-picker";
import type { Plan } from "@/generated/prisma/client";
import {
  getEntitlement,
  getExtraReportPrice,
  getPlanPrices,
  PLANS,
} from "@/server/billing";

const dateFormat = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" });

/** Plain <a> (not next/link): the route creates a Stripe session, so no prefetch. */
function BuyExtraButton({
  variant = "outline",
  label = "Buy extra reports",
}: {
  variant?: "outline" | "ghost";
  label?: string;
}) {
  return (
    <Button
      nativeButton={false}
      render={<a href="/billing/extra-reports?quantity=1" />}
      variant={variant}
      size="sm"
    >
      {label}
    </Button>
  );
}

/** Plain <a> (not next/link): the route creates a Stripe session, so no prefetch. */
function ManageButton({ label = "Manage billing" }: { label?: string }) {
  return (
    <Button
      nativeButton={false}
      render={<a href="/billing/portal" />}
      variant="outline"
      size="sm"
    >
      {label}
    </Button>
  );
}

/**
 * Under the address search: the agent's plan and this period's report usage,
 * or the plan picker when they don't have one yet. Also explains why a report
 * was refused (?billing=…) and confirms a finished checkout (?checkout=…).
 */
export async function BillingPanel({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ userId }, params] = await Promise.all([auth(), searchParams]);
  if (!userId) return null;
  const entitlement = await getEntitlement(userId);

  const justPaid = params.checkout === "success";
  const reason = params.billing;

  if (!entitlement.active) {
    const prices = await getPlanPrices();
    return (
      <div className="grid gap-3">
        {justPaid ? (
          <Alert>
            <CheckCircle2Icon />
            <AlertTitle>Payment received</AlertTitle>
            <AlertDescription>
              We&apos;re activating your plan. Refresh in a few seconds.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant={reason ? "destructive" : "default"}>
            <AlertCircleIcon />
            <AlertTitle>
              {entitlement.status === "canceled" || entitlement.status === "unpaid"
                ? "Your plan has ended"
                : "Choose a plan to run reports"}
            </AlertTitle>
            <AlertDescription>
              Every report runs fresh lookups against live data. Prices in
              Canadian dollars, plus applicable sales tax. Cancel anytime.
            </AlertDescription>
          </Alert>
        )}
        <PlanPicker
          plans={(Object.keys(PLANS) as Plan[]).map((plan) => ({
            id: plan,
            name: PLANS[plan].name,
            reports: PLANS[plan].reports,
            chat: PLANS[plan].chat,
            prices: {
              monthly: prices[plan].monthly.amount,
              annual: prices[plan].annual.amount,
            },
          }))}
        />
      </div>
    );
  }

  const {
    planName,
    interval,
    status,
    reportsUsed,
    reportsLimit,
    reportsResetAt,
    currentPeriodEnd,
    extraReportCredits: credits,
    chatUsed,
    chatLimit,
  } = entitlement;
  const atLimit = reportsUsed >= reportsLimit;
  const extraPrice = (await getExtraReportPrice()).amount;
  const extraReports = (n: number) => `${n} extra report${n === 1 ? "" : "s"}`;
  const renews = currentPeriodEnd ? dateFormat.format(currentPeriodEnd) : null;
  const resets = reportsResetAt ? dateFormat.format(reportsResetAt) : null;

  return (
    <div className="grid gap-3">
      {justPaid && (
        <Alert>
          <CheckCircle2Icon />
          <AlertTitle>You&apos;re on {planName}</AlertTitle>
          <AlertDescription>Thanks! Your first report is a search away.</AlertDescription>
        </Alert>
      )}
      {status === "past_due" && (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>Your last payment didn&apos;t go through</AlertTitle>
          <AlertDescription>
            Update your card to keep your plan. We&apos;ll retry automatically.
          </AlertDescription>
        </Alert>
      )}
      {params.extra === "success" && (
        <Alert>
          <CheckCircle2Icon />
          <AlertTitle>Extra reports added</AlertTitle>
          <AlertDescription>
            {credits > 0
              ? `You have ${extraReports(credits)} ready to use.`
              : "They'll appear here in a few seconds. Refresh if not."}
          </AlertDescription>
        </Alert>
      )}
      {atLimit && credits > 0 && (
        <Alert>
          <AlertCircleIcon />
          <AlertTitle>You&apos;ve used this month&apos;s plan reports</AlertTitle>
          <AlertDescription>
            Your next report uses one of your {extraReports(credits)}.
            {resets ? ` Plan reports reset on ${resets}.` : ""}
          </AlertDescription>
        </Alert>
      )}
      {((atLimit && credits === 0) || reason === BILLING_ERRORS.limit) && (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>You&apos;ve used this month&apos;s reports</AlertTitle>
          <AlertDescription>
            {resets ? `More on ${resets}. ` : ""}
            Buy extra reports at C${extraPrice} each
            {entitlement.plan === "starter"
              ? ", or switch to Pro for 10 reports a month."
              : "."}
          </AlertDescription>
          <AlertAction>
            <BuyExtraButton />
          </AlertAction>
        </Alert>
      )}
      <Item variant="outline">
        <ItemContent className="gap-2">
          <ItemTitle>
            <Badge variant="secondary">
              {planName} · {interval === "annual" ? "Annual" : "Monthly"}
            </Badge>
            <span className="font-normal text-foreground/60">
              {entitlement.cancelAtPeriodEnd
                ? `Ends ${renews}`
                : renews && `Renews ${renews}`}
            </span>
          </ItemTitle>
          <Progress value={Math.min(100, (reportsUsed / reportsLimit) * 100)}>
            <ProgressLabel className="font-normal text-foreground/70">
              Reports this month
            </ProgressLabel>
            {/* Plain span: ProgressValue takes a function child, which can't
                cross from this Server Component into the client component. */}
            <span className="ml-auto text-sm text-muted-foreground tabular-nums">
              {Math.min(reportsUsed, reportsLimit)} of {reportsLimit}
              {credits > 0 && ` · +${extraReports(credits)}`}
            </span>
          </Progress>
          <Progress value={Math.min(100, (chatUsed / chatLimit) * 100)}>
            <ProgressLabel className="font-normal text-foreground/70">
              AI chat messages this month
            </ProgressLabel>
            <span className="ml-auto text-sm text-muted-foreground tabular-nums">
              {Math.min(chatUsed, chatLimit)} of {chatLimit}
            </span>
          </Progress>
        </ItemContent>
        <ItemActions>
          {!atLimit && <BuyExtraButton variant="ghost" label="Buy extra" />}
          <ManageButton
            label={atLimit && entitlement.plan === "starter" ? "Upgrade" : undefined}
          />
        </ItemActions>
      </Item>
    </div>
  );
}

export function BillingPanelSkeleton() {
  return <Skeleton className="h-[106px] w-full" />;
}

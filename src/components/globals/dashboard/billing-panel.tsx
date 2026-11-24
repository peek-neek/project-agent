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
import { SeePlansButton } from "./see-plans-prompt";
import { getEntitlement, getExtraReportPrice } from "@/server/billing";

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
 * Under the address search: the agent's plan and this period's report usage
 * (Basic: the free report and chat messages, with "See plans"). Also explains
 * why a report was refused (?billing=…) and confirms a finished checkout
 * (?checkout=…).
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

  if (!entitlement.subscribed) {
    return <BasicPanel entitlement={entitlement} params={params} />;
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
      {reason === BILLING_ERRORS.compareLimit && !(atLimit && credits === 0) && (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>Not enough reports left for this comparison</AlertTitle>
          <AlertDescription>
            Comparing two new addresses uses two reports, and you have{" "}
            {Math.max(0, reportsLimit - reportsUsed) + credits} left. Nothing
            was used. Buy extra reports at C${extraPrice} each, or compare
            with a property you already have a report for (from the last 30
            days), which is free.
          </AlertDescription>
          <AlertAction>
            <BuyExtraButton />
          </AlertAction>
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

type Entitlement = Awaited<ReturnType<typeof getEntitlement>>;

/**
 * Basic (no subscription): the free report and chat messages, extra reports
 * on hand, and the way to more (a plan, or extra reports).
 */
async function BasicPanel({
  entitlement,
  params,
}: {
  entitlement: Entitlement;
  params: Record<string, string | string[] | undefined>;
}) {
  const {
    reportsUsed,
    reportsLimit,
    chatUsed,
    chatLimit,
    extraReportCredits: credits,
    status,
  } = entitlement;
  const extraPrice = (await getExtraReportPrice()).amount;
  const freeLeft = Math.max(0, reportsLimit - reportsUsed);
  const out = freeLeft === 0 && credits === 0;
  const ended = status === "canceled" || status === "unpaid";
  const extraReports = (n: number) => `${n} extra report${n === 1 ? "" : "s"}`;

  return (
    <div className="grid gap-3">
      {params.checkout === "success" && (
        <Alert>
          <CheckCircle2Icon />
          <AlertTitle>Payment received</AlertTitle>
          <AlertDescription>
            We&apos;re activating your plan. Refresh in a few seconds.
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
      {ended && (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>Your plan has ended</AlertTitle>
          <AlertDescription>
            You&apos;re on Basic now. Choose a plan for monthly reports, or buy
            extra reports at C${extraPrice} each.
          </AlertDescription>
        </Alert>
      )}
      {params.billing === BILLING_ERRORS.compareLimit && !out && (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>Not enough reports left for this comparison</AlertTitle>
          <AlertDescription>
            Comparing two new addresses uses two reports, and you have{" "}
            {freeLeft + credits} left. Nothing was used. Choose a plan, buy
            extra reports at C${extraPrice} each, or compare with a property
            you already have a report for (from the last 30 days), which is
            free.
          </AlertDescription>
          <AlertAction>
            <BuyExtraButton />
          </AlertAction>
        </Alert>
      )}
      {out && !ended && (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>You&apos;ve used your free report</AlertTitle>
          <AlertDescription>
            Choose a plan for monthly reports and AI chat, or buy extra reports
            at C${extraPrice} each with no subscription.
          </AlertDescription>
          <AlertAction>
            <BuyExtraButton />
          </AlertAction>
        </Alert>
      )}
      <Item variant="outline">
        <ItemContent className="gap-2">
          <ItemTitle>
            <Badge variant="secondary">Basic · Free</Badge>
            <span className="font-normal text-foreground/60">
              Try it with {reportsLimit} free report and {chatLimit} AI chat
              messages
            </span>
          </ItemTitle>
          <Progress value={Math.min(100, (reportsUsed / reportsLimit) * 100)}>
            <ProgressLabel className="font-normal text-foreground/70">
              Free report
            </ProgressLabel>
            <span className="ml-auto text-sm text-muted-foreground tabular-nums">
              {Math.min(reportsUsed, reportsLimit)} of {reportsLimit} used
              {credits > 0 && ` · +${extraReports(credits)}`}
            </span>
          </Progress>
          <Progress value={Math.min(100, (chatUsed / chatLimit) * 100)}>
            <ProgressLabel className="font-normal text-foreground/70">
              Free AI chat messages
            </ProgressLabel>
            <span className="ml-auto text-sm text-muted-foreground tabular-nums">
              {Math.min(chatUsed, chatLimit)} of {chatLimit} used
            </span>
          </Progress>
        </ItemContent>
        <ItemActions>
          {!out && <BuyExtraButton variant="ghost" label="Buy extra" />}
          <SeePlansButton
            label="Choose a plan"
            variant={out ? "default" : "outline"}
          />
        </ItemActions>
      </Item>
    </div>
  );
}

export function BillingPanelSkeleton() {
  return <Skeleton className="h-[106px] w-full" />;
}

"use client";

import {
  CalendarClockIcon,
  ChevronDownIcon,
  CircleCheckIcon,
  ClapperboardIcon,
  FileTextIcon,
  GalleryHorizontalIcon,
  HeadingIcon,
  HouseIcon,
  type LucideIcon,
  MailIcon,
  MailboxIcon,
  MegaphoneIcon,
  PartyPopperIcon,
  QuoteIcon,
  RocketIcon,
  Share2Icon,
  ShieldCheckIcon,
  SparklesIcon,
  SunIcon,
  TagIcon,
  TriangleAlertIcon,
  UsersIcon,
} from "lucide-react";
import { cn } from "cn";
import type { ComponentType, SVGProps } from "react";
import {
  BRAND_COLORS,
  FacebookIcon,
  InstagramIcon,
  LinkedinIcon,
} from "@/components/globals/brand-icons";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { checkCompliance } from "@/lib/compliance";
import {
  CAMPAIGN_STAGES,
  type CampaignData,
  type CampaignStage,
  type InsightsData,
  type MarketingData,
} from "@/lib/report-sections";
import { ComplianceBadge, CopyBlock, FlaggedText } from "./copy-block";
import { CopyButton } from "./copy-button";
import { DashCard } from "./dash-card";
import { WIDGET } from "./widget-styles";

const TONES: Record<
  MarketingData["listingDescriptions"][number]["tone"],
  string
> = {
  professional: "Professional",
  warm: "Warm",
  luxury: "Luxury",
};

const PLATFORMS: Record<
  MarketingData["socialPosts"][number]["platform"],
  {
    label: string;
    icon: ComponentType<SVGProps<SVGSVGElement>>;
    color: string;
    limit?: number;
  }
> = {
  instagram: {
    label: "Instagram",
    icon: InstagramIcon,
    color: BRAND_COLORS.instagram,
    limit: 2200,
  },
  facebook: {
    label: "Facebook",
    icon: FacebookIcon,
    color: BRAND_COLORS.facebook,
  },
  linkedin: {
    label: "LinkedIn",
    icon: LinkedinIcon,
    color: BRAND_COLORS.linkedin,
    limit: 3000,
  },
};

const STAGE_ICONS: Record<CampaignStage, LucideIcon> = {
  comingSoon: CalendarClockIcon,
  justListed: RocketIcon,
  openHouse: HouseIcon,
  priceImproved: TagIcon,
  sold: PartyPopperIcon,
};

/** MLS public remarks: most Ontario boards cap these near 500 characters. */
const MLS_LIMIT = 450;
const AD_HEADLINE_LIMIT = 30;
const AD_DESCRIPTION_LIMIT = 90;

const hashtag = (tag: string) => (tag.startsWith("#") ? tag : `#${tag}`);
const withTags = (caption: string, tags: string[]) =>
  tags.length ? `${caption}\n\n${tags.map(hashtag).join(" ")}` : caption;

/** Square, underlined tabs used inside cards. */
const tabListClass =
  "h-auto w-full justify-start gap-0 overflow-x-auto border-b bg-transparent p-0 group-data-horizontal/tabs:h-auto";
const tabClass =
  "h-10 flex-none gap-1.5 border-0 px-3 text-foreground/60 hover:text-foreground data-active:bg-transparent data-active:text-foreground data-active:shadow-none group-data-horizontal/tabs:after:-bottom-px group-data-horizontal/tabs:after:h-[3px] after:bg-primary";

/** Every piece of copy on the tab, for the compliance summary. */
function allCopy(
  insights: InsightsData,
  marketing: MarketingData,
  campaign: CampaignData | null,
) {
  return [
    insights.headline,
    insights.summary,
    insights.dayInTheLife,
    ...insights.highlights.flatMap((h) => [h.title, h.detail]),
    ...marketing.listingDescriptions.map((d) => d.text),
    ...marketing.socialPosts.map((p) => p.caption),
    marketing.email.subject,
    marketing.email.body,
    ...(campaign
      ? [
          ...campaign.headlines,
          campaign.mlsShort,
          ...campaign.stagePosts.map((p) => p.caption),
          campaign.reel.hook,
          ...campaign.reel.scenes.flatMap((s) => [s.voiceover, s.onScreenText]),
          campaign.reel.caption,
          ...campaign.carousel.flatMap((s) => [s.title, s.body]),
          ...campaign.ads.headlines,
          ...campaign.ads.descriptions,
          campaign.openHouseEmail.body,
          campaign.neighbourLetter.body,
        ]
      : []),
  ];
}

/** One summary line across all copy: all clear, or what to review. */
function ComplianceSummary({ texts }: { texts: string[] }) {
  const flagged = texts
    .map((t) => checkCompliance(t))
    .filter((f) => f.length > 0);
  const phrases = flagged.reduce((n, f) => n + f.length, 0);
  const clear = phrases === 0;
  return (
    <div
      className={cn(
        WIDGET,
        "flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 lg:col-span-12",
      )}
    >
      <span
        className={cn(
          "flex items-center gap-2 text-sm font-medium",
          clear ? "text-emerald-700 dark:text-emerald-500" : "text-amber-700",
        )}
      >
        {clear ? (
          <ShieldCheckIcon aria-hidden className="size-4" />
        ) : (
          <TriangleAlertIcon aria-hidden className="size-4" />
        )}
        {clear
          ? `Compliance check: all ${texts.length} pieces clear`
          : `Compliance check: ${phrases} phrase${phrases === 1 ? "" : "s"} to review in ${flagged.length} piece${flagged.length === 1 ? "" : "s"}`}
      </span>
      <span className="text-xs text-foreground/55">
        Screens for Human Rights Code and RECO advertising issues (who a home is
        &ldquo;for&rdquo;, safety and school claims, promises).{" "}
        {clear ? "" : "Flagged words are highlighted below; hover for a fix. "}A
        guide, not legal advice.
      </span>
    </div>
  );
}

/** Placeholder for older reports without the campaign kit. */
function CampaignMissing({
  pending,
  onGenerate,
}: {
  pending: boolean;
  onGenerate: () => void;
}) {
  return (
    <DashCard
      title="Full listing campaign"
      icon={MegaphoneIcon}
      className="lg:col-span-12"
    >
      {pending ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-2xl text-sm text-foreground/70">
            Headline options, an MLS short version, a post for every campaign
            stage, a Reel script, Instagram carousel slides, ad copy, an open
            house invitation and a letter to neighbours. Written from this
            report&apos;s data.
          </p>
          <Button onClick={onGenerate}>
            <SparklesIcon data-icon="inline-start" />
            Generate campaign
          </Button>
        </div>
      )}
    </DashCard>
  );
}

export function MarketingTab({
  reportId,
  insights,
  marketing,
  campaign,
  campaignPending,
  onGenerate,
}: {
  reportId: string;
  insights: InsightsData;
  marketing: MarketingData;
  campaign: CampaignData | null;
  /** The AI step is running (the campaign is on its way). */
  campaignPending: boolean;
  onGenerate: () => void;
}) {
  const highlightsText = insights.highlights
    .map((h) => `• ${h.title}: ${h.detail}`)
    .join("\n");
  const pitch = `${insights.headline}\n\n${insights.summary}`;

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <ComplianceSummary texts={allCopy(insights, marketing, campaign)} />

      {/* The pitch: one line to lead with, the story on demand. */}
      <DashCard
        title="The pitch"
        icon={QuoteIcon}
        action={<CopyButton text={pitch} />}
        className={campaign ? "lg:col-span-7" : "lg:col-span-12"}
      >
        <FlaggedText
          text={insights.headline}
          findings={checkCompliance(insights.headline)}
          className="text-xl leading-snug font-semibold tracking-tight text-balance"
        />
        <FlaggedText
          text={insights.summary}
          findings={checkCompliance(insights.summary)}
          className="mt-2 max-w-3xl text-sm leading-relaxed text-foreground/70"
        />
        <Collapsible className="mt-3">
          <CollapsibleTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className="-ml-2 text-foreground/70"
              />
            }
          >
            <SunIcon data-icon="inline-start" className="text-primary" />A day
            in this neighbourhood
            <ChevronDownIcon
              data-icon="inline-end"
              className="transition-transform in-data-panel-open:rotate-180"
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="max-w-3xl pt-2">
            <CopyBlock reportId={reportId} text={insights.dayInTheLife} />
          </CollapsibleContent>
        </Collapsible>
      </DashCard>

      {campaign && (
        <DashCard
          title="Headline options"
          icon={HeadingIcon}
          action={
            <CopyButton text={campaign.headlines.join("\n")} label="Copy all" />
          }
          className="lg:col-span-5"
        >
          <ol className="divide-y">
            {campaign.headlines.map((h, i) => (
              <li key={h} className="flex items-start gap-3 py-2.5">
                <span className="grid size-6 shrink-0 place-items-center bg-foreground text-xs font-semibold text-background tabular-nums">
                  {i + 1}
                </span>
                <FlaggedText
                  text={h}
                  findings={checkCompliance(h)}
                  className="min-w-0 flex-1 text-sm font-medium"
                />
                <span
                  className={cn(
                    "shrink-0 text-xs tabular-nums",
                    h.length > 60 ? "text-destructive" : "text-foreground/45",
                  )}
                >
                  {h.length}
                </span>
                <CopyButton text={h} label="" />
              </li>
            ))}
          </ol>
        </DashCard>
      )}

      {/* MLS copy: pick a tone (or the short MLS version), use it. */}
      <DashCard
        title="Listing description"
        icon={FileTextIcon}
        className="lg:col-span-7"
        bodyClassName="p-0"
      >
        <Tabs
          defaultValue={marketing.listingDescriptions[0]?.tone}
          className="gap-0"
        >
          <TabsList variant="line" className={tabListClass}>
            {marketing.listingDescriptions.map((d) => (
              <TabsTrigger key={d.tone} value={d.tone} className={tabClass}>
                {TONES[d.tone]}
              </TabsTrigger>
            ))}
            {campaign && (
              <TabsTrigger value="mls" className={tabClass}>
                MLS short
              </TabsTrigger>
            )}
          </TabsList>
          {marketing.listingDescriptions.map((d) => (
            <TabsContent key={d.tone} value={d.tone} className="p-4">
              <CopyBlock reportId={reportId} text={d.text} />
            </TabsContent>
          ))}
          {campaign && (
            <TabsContent value="mls" className="p-4">
              <CopyBlock
                reportId={reportId}
                text={campaign.mlsShort}
                limit={MLS_LIMIT}
              />
            </TabsContent>
          )}
        </Tabs>
      </DashCard>

      {/* Social: one post per platform. */}
      <DashCard
        title="Social posts"
        icon={Share2Icon}
        className="lg:col-span-5"
        bodyClassName="p-0"
      >
        <Tabs
          defaultValue={marketing.socialPosts[0]?.platform}
          className="gap-0"
        >
          <TabsList variant="line" className={tabListClass}>
            {marketing.socialPosts.map((post) => {
              const { label, icon: Icon, color } = PLATFORMS[post.platform];
              return (
                <TabsTrigger
                  key={post.platform}
                  value={post.platform}
                  className={tabClass}
                >
                  <Icon aria-hidden style={{ color }} />
                  {label}
                </TabsTrigger>
              );
            })}
          </TabsList>
          {marketing.socialPosts.map((post) => (
            <TabsContent
              key={post.platform}
              value={post.platform}
              className="p-4"
            >
              <CopyBlock
                reportId={reportId}
                text={withTags(post.caption, post.hashtags)}
                limit={PLATFORMS[post.platform].limit}
              />
            </TabsContent>
          ))}
        </Tabs>
      </DashCard>

      {campaign ? (
        <>
          {/* Campaign timeline: a post for every stage of the listing. */}
          <DashCard
            title="Campaign timeline"
            icon={MegaphoneIcon}
            className="lg:col-span-12"
            bodyClassName="p-0"
          >
            <Tabs
              defaultValue={campaign.stagePosts[0]?.stage}
              className="gap-0"
            >
              <TabsList variant="line" className={tabListClass}>
                {campaign.stagePosts.map((p, i) => {
                  const Icon = STAGE_ICONS[p.stage];
                  return (
                    <TabsTrigger
                      key={p.stage}
                      value={p.stage}
                      className={tabClass}
                    >
                      <span className="grid size-5 place-items-center bg-muted text-[11px] font-semibold tabular-nums">
                        {i + 1}
                      </span>
                      <Icon aria-hidden />
                      {CAMPAIGN_STAGES[p.stage]}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              {campaign.stagePosts.map((p) => (
                <TabsContent key={p.stage} value={p.stage} className="p-4">
                  <CopyBlock
                    reportId={reportId}
                    text={withTags(p.caption, p.hashtags)}
                  />
                </TabsContent>
              ))}
            </Tabs>
          </DashCard>

          {/* Reel / TikTok: a shot list to film from. */}
          <DashCard
            title="Reel & TikTok script"
            icon={ClapperboardIcon}
            action={
              <CopyButton
                label="Copy script"
                text={[
                  `HOOK: ${campaign.reel.hook}`,
                  ...campaign.reel.scenes.map(
                    (s, i) =>
                      `${i + 1}. SHOT: ${s.shot}\n   VO: ${s.voiceover}\n   TEXT: ${s.onScreenText}`,
                  ),
                  `CTA: ${campaign.reel.callToAction}`,
                ].join("\n\n")}
              />
            }
            className="lg:col-span-7"
          >
            <p className="border-l-[3px] border-primary bg-muted/50 py-2 pr-2 pl-3 text-sm font-medium">
              <span className="mr-1.5 text-xs font-semibold text-primary uppercase">
                Hook
              </span>
              {campaign.reel.hook}
            </p>
            <ol className="mt-3 divide-y">
              {campaign.reel.scenes.map((s, i) => (
                <li
                  key={i}
                  className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3 gap-y-1 py-2.5 sm:grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1.2fr)]"
                >
                  <span className="grid size-6 place-items-center bg-foreground text-xs font-semibold text-background tabular-nums">
                    {i + 1}
                  </span>
                  <span className="text-xs text-foreground/60">
                    <span className="block font-medium text-foreground/80">
                      {s.shot}
                    </span>
                    <span className="mt-1 inline-block bg-foreground px-1.5 py-0.5 text-[11px] font-semibold text-background">
                      {s.onScreenText}
                    </span>
                  </span>
                  <span className="col-start-2 text-sm text-foreground/85 sm:col-start-3">
                    {s.voiceover}
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-3 border-t pt-3">
              <p className="mb-2 text-xs font-medium text-foreground/55">
                Caption · call to action: {campaign.reel.callToAction}
              </p>
              <CopyBlock reportId={reportId} text={campaign.reel.caption} />
            </div>
          </DashCard>

          {/* Carousel: slide previews, ready for Canva or Instagram. */}
          <DashCard
            title="Instagram carousel"
            icon={GalleryHorizontalIcon}
            action={
              <CopyButton
                label="Copy all"
                text={campaign.carousel
                  .map((s, i) => `Slide ${i + 1}: ${s.title}\n${s.body}`)
                  .join("\n\n")}
              />
            }
            className="lg:col-span-5"
          >
            <div className="grid grid-cols-2 gap-2">
              {campaign.carousel.map((s, i) => {
                const edge = i === 0 || i === campaign.carousel.length - 1;
                return (
                  <div
                    key={i}
                    className={cn(
                      "relative flex aspect-square flex-col justify-between p-3",
                      edge
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "text-[10px] font-semibold tabular-nums",
                        edge
                          ? "text-primary-foreground/70"
                          : "text-foreground/45",
                      )}
                    >
                      {i + 1}/{campaign.carousel.length}
                    </span>
                    <span>
                      <span className="block text-sm leading-tight font-semibold text-balance">
                        {s.title}
                      </span>
                      <span
                        className={cn(
                          "mt-1 block text-[11px] leading-snug",
                          edge
                            ? "text-primary-foreground/85"
                            : "text-foreground/65",
                        )}
                      >
                        {s.body}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </DashCard>

          {/* Ads: every line counted against Google/Meta limits. */}
          <DashCard
            title="Ad copy"
            icon={TagIcon}
            action={
              <CopyButton
                label="Copy all"
                text={`Headlines:\n${campaign.ads.headlines.join("\n")}\n\nDescriptions:\n${campaign.ads.descriptions.join("\n")}`}
              />
            }
            className="lg:col-span-5"
          >
            {(
              [
                ["Headlines", campaign.ads.headlines, AD_HEADLINE_LIMIT],
                [
                  "Descriptions",
                  campaign.ads.descriptions,
                  AD_DESCRIPTION_LIMIT,
                ],
              ] as const
            ).map(([label, lines, limit]) => (
              <div key={label} className="mb-3 last:mb-0">
                <p className="mb-1 text-xs font-medium text-foreground/55">
                  {label} · {limit} characters max
                </p>
                <ul className="divide-y">
                  {lines.map((line) => (
                    <li key={line} className="flex items-center gap-2 py-2">
                      <FlaggedText
                        text={line}
                        findings={checkCompliance(line)}
                        className="min-w-0 flex-1 text-sm"
                      />
                      <span
                        className={cn(
                          "shrink-0 text-xs tabular-nums",
                          line.length > limit
                            ? "font-medium text-destructive"
                            : "text-foreground/45",
                        )}
                      >
                        {line.length}/{limit}
                      </span>
                      <CopyButton text={line} label="" />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </DashCard>

          {/* Emails: buyer list, open house, neighbours. */}
          <DashCard
            title="Emails & letters"
            icon={MailIcon}
            className="lg:col-span-7"
            bodyClassName="p-0"
          >
            <Tabs defaultValue="buyers" className="gap-0">
              <TabsList variant="line" className={tabListClass}>
                <TabsTrigger value="buyers" className={tabClass}>
                  <UsersIcon aria-hidden />
                  Buyer list
                </TabsTrigger>
                <TabsTrigger value="openHouse" className={tabClass}>
                  <HouseIcon aria-hidden />
                  Open house
                </TabsTrigger>
                <TabsTrigger value="neighbours" className={tabClass}>
                  <MailboxIcon aria-hidden />
                  Neighbours
                </TabsTrigger>
              </TabsList>
              {(
                [
                  ["buyers", marketing.email],
                  ["openHouse", campaign.openHouseEmail],
                  ["neighbours", campaign.neighbourLetter],
                ] as const
              ).map(([value, email]) => (
                <TabsContent key={value} value={value} className="p-4">
                  <EmailBlock reportId={reportId} email={email} />
                </TabsContent>
              ))}
            </Tabs>
          </DashCard>
        </>
      ) : (
        <>
          <DashCard
            title="Email to your buyer list"
            icon={MailIcon}
            className="lg:col-span-7"
          >
            <EmailBlock reportId={reportId} email={marketing.email} />
          </DashCard>
          <CampaignMissing pending={campaignPending} onGenerate={onGenerate} />
        </>
      )}

      <DashCard
        title="Points to feature"
        icon={CircleCheckIcon}
        action={<CopyButton text={highlightsText} label="Copy all" />}
        className={campaign ? "lg:col-span-12" : "lg:col-span-5"}
      >
        <ul
          className={cn(
            "divide-y",
            campaign && "lg:grid lg:grid-cols-2 lg:gap-x-6 lg:divide-y-0",
          )}
        >
          {insights.highlights.map((h) => (
            <li key={h.title} className="flex items-start gap-3 py-2.5">
              <CircleCheckIcon
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-emerald-600"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{h.title}</span>
                <span className="block text-xs text-foreground/60">
                  {h.detail}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-2 border-t pt-2.5">
          <ComplianceBadge
            findings={insights.highlights.flatMap((h) =>
              checkCompliance(`${h.title} ${h.detail}`),
            )}
          />
        </div>
      </DashCard>
    </div>
  );
}

/** Subject line plus the body as a copy block (copy includes the subject). */
function EmailBlock({
  reportId,
  email,
}: {
  reportId: string;
  email: { subject: string; body: string };
}) {
  return (
    <>
      <div className="mb-3 flex items-baseline gap-2 border-b pb-3">
        <span className="text-xs text-foreground/50">Subject</span>
        <FlaggedText
          text={email.subject}
          findings={checkCompliance(email.subject)}
          className="min-w-0 flex-1 text-sm font-semibold"
        />
        <CopyButton
          text={`Subject: ${email.subject}\n\n${email.body}`}
          label="Copy email"
        />
      </div>
      <CopyBlock reportId={reportId} text={email.body} />
    </>
  );
}

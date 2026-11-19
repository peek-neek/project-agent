"use client";

import {
  BriefcaseBusinessIcon,
  CameraIcon,
  ChevronDownIcon,
  CircleCheckIcon,
  FileTextIcon,
  type LucideIcon,
  MailIcon,
  QuoteIcon,
  Share2Icon,
  SunIcon,
  UsersIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { InsightsData, MarketingData } from "@/lib/report-sections";
import { CopyButton } from "./copy-button";
import { DashCard } from "./dash-card";

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
  { label: string; icon: LucideIcon; limit?: number }
> = {
  instagram: { label: "Instagram", icon: CameraIcon, limit: 2200 },
  facebook: { label: "Facebook", icon: UsersIcon },
  linkedin: { label: "LinkedIn", icon: BriefcaseBusinessIcon, limit: 3000 },
};

const hashtag = (tag: string) => (tag.startsWith("#") ? tag : `#${tag}`);
const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/** Square, underlined tabs used inside cards. */
const tabListClass =
  "h-auto w-full justify-start gap-0 border-b bg-transparent p-0 group-data-horizontal/tabs:h-auto";
const tabClass =
  "h-10 flex-none gap-1.5 border-0 px-3 text-foreground/60 hover:text-foreground data-active:bg-transparent data-active:text-foreground data-active:shadow-none group-data-horizontal/tabs:after:-bottom-px group-data-horizontal/tabs:after:h-[3px] after:bg-primary";

export function MarketingTab({
  insights,
  marketing,
}: {
  insights: InsightsData;
  marketing: MarketingData;
}) {
  const highlightsText = insights.highlights
    .map((h) => `• ${h.title}: ${h.detail}`)
    .join("\n");

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      {/* The pitch: one line to lead with, everything else on demand. */}
      <DashCard
        title="The pitch"
        icon={QuoteIcon}
        action={
          <CopyButton text={`${insights.headline}\n\n${insights.summary}`} />
        }
        className="lg:col-span-12"
      >
        <p className="text-xl leading-snug font-semibold tracking-tight text-balance">
          {insights.headline}
        </p>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-foreground/70">
          {insights.summary}
        </p>
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
          <CollapsibleContent className="max-w-3xl pt-2 text-sm leading-relaxed text-foreground/75">
            {insights.dayInTheLife}
          </CollapsibleContent>
        </Collapsible>
      </DashCard>

      {/* MLS copy: pick a tone, copy it. */}
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
          </TabsList>
          {marketing.listingDescriptions.map((d) => (
            <TabsContent key={d.tone} value={d.tone} className="p-4">
              <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/85">
                {d.text}
              </p>
              <div className="mt-3 flex items-center justify-between border-t pt-3">
                <span className="text-xs text-foreground/50 tabular-nums">
                  {words(d.text)} words · {d.text.length} characters
                </span>
                <CopyButton text={d.text} />
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </DashCard>

      {/* Social: one post per platform, hashtags as chips. */}
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
              const { label, icon: Icon } = PLATFORMS[post.platform];
              return (
                <TabsTrigger
                  key={post.platform}
                  value={post.platform}
                  className={tabClass}
                >
                  <Icon aria-hidden />
                  {label}
                </TabsTrigger>
              );
            })}
          </TabsList>
          {marketing.socialPosts.map((post) => {
            const tags = post.hashtags.map(hashtag);
            const full = `${post.caption}\n\n${tags.join(" ")}`;
            const limit = PLATFORMS[post.platform].limit;
            return (
              <TabsContent
                key={post.platform}
                value={post.platform}
                className="p-4"
              >
                <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/85">
                  {post.caption}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="font-normal"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between border-t pt-3">
                  <span className="text-xs text-foreground/50 tabular-nums">
                    {full.length}
                    {limit ? ` / ${limit.toLocaleString("en-CA")}` : ""}{" "}
                    characters
                  </span>
                  <CopyButton text={full} />
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </DashCard>

      <DashCard
        title="Email to your buyer list"
        icon={MailIcon}
        action={
          <CopyButton
            text={`Subject: ${marketing.email.subject}\n\n${marketing.email.body}`}
          />
        }
        className="lg:col-span-7"
      >
        <div className="flex items-baseline gap-2 border-b pb-3">
          <span className="text-xs text-foreground/50">Subject</span>
          <span className="min-w-0 flex-1 text-sm font-semibold">
            {marketing.email.subject}
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-foreground/80">
          {marketing.email.body}
        </p>
      </DashCard>

      <DashCard
        title="Points to feature"
        icon={CircleCheckIcon}
        action={<CopyButton text={highlightsText} label="Copy all" />}
        className="lg:col-span-5"
      >
        <ul className="divide-y">
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
      </DashCard>
    </div>
  );
}

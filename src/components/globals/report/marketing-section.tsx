import {
  BriefcaseBusinessIcon,
  CameraIcon,
  FileTextIcon,
  type LucideIcon,
  MailIcon,
  Share2Icon,
  UsersIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { MarketingData } from "@/lib/report-sections";
import { CopyButton } from "./copy-button";
import { ReportSubsection } from "./report-layout";

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
  { label: string; icon: LucideIcon }
> = {
  instagram: { label: "Instagram", icon: CameraIcon },
  facebook: { label: "Facebook", icon: UsersIcon },
  linkedin: { label: "LinkedIn", icon: BriefcaseBusinessIcon },
};

const hashtag = (tag: string) => (tag.startsWith("#") ? tag : `#${tag}`);

export function MarketingSection({ marketing }: { marketing: MarketingData }) {
  return (
    <>
      <ReportSubsection title="MLS listing descriptions" icon={FileTextIcon}>
        <div className="space-y-3">
          {marketing.listingDescriptions.map((d) => (
            <div
              key={d.tone}
              className="break-inside-avoid p-4 ring-1 ring-border print:border print:border-border print:ring-0"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <Badge variant="outline" className="h-auto px-2.5 py-0.5">
                  {TONES[d.tone]}
                </Badge>
                <CopyButton text={d.text} />
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/85">
                {d.text}
              </p>
            </div>
          ))}
        </div>
      </ReportSubsection>

      <ReportSubsection title="Social posts" icon={Share2Icon}>
        <div className="grid gap-3 md:grid-cols-3 print:grid-cols-3">
          {marketing.socialPosts.map((post) => {
            const { label, icon: Icon } = PLATFORMS[post.platform];
            const tags = post.hashtags.map(hashtag).join(" ");
            return (
              <div
                key={post.platform}
                className="flex break-inside-avoid flex-col p-4 ring-1 ring-border print:border print:border-border print:ring-0"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <Icon aria-hidden className="size-4 text-foreground/60" />
                    {label}
                  </span>
                  <CopyButton text={`${post.caption}\n\n${tags}`} />
                </div>
                <p className="flex-1 text-sm leading-relaxed whitespace-pre-line text-foreground/85">
                  {post.caption}
                </p>
                <p className="mt-2 text-xs text-primary">{tags}</p>
              </div>
            );
          })}
        </div>
      </ReportSubsection>

      <ReportSubsection title="Email to your buyer list" icon={MailIcon}>
        <div className="break-inside-avoid p-4 ring-1 ring-border print:border print:border-border print:ring-0">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm">
              <span className="text-foreground/60">Subject: </span>
              <span className="font-semibold">{marketing.email.subject}</span>
            </p>
            <CopyButton
              text={`Subject: ${marketing.email.subject}\n\n${marketing.email.body}`}
            />
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/85">
            {marketing.email.body}
          </p>
        </div>
      </ReportSubsection>
    </>
  );
}

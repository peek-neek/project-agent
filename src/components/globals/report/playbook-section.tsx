import {
  ClipboardCheckIcon,
  MessageCircleQuestionIcon,
  MessagesSquareIcon,
  SquareCheckIcon,
  UserRoundIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { MarketingData } from "@/lib/report-sections";
import { ReportSubsection } from "./report-layout";

export function PlaybookSection({
  playbook,
}: {
  playbook: MarketingData["playbook"];
}) {
  return (
    <>
      <ReportSubsection
        title="Talking points for showings"
        icon={MessagesSquareIcon}
      >
        <ul className="space-y-2">
          {playbook.talkingPoints.map((point) => (
            <li key={point} className="flex gap-2.5 text-sm">
              <span className="mt-2 size-1.5 shrink-0 bg-primary" />
              {point}
            </li>
          ))}
        </ul>
      </ReportSubsection>

      <ReportSubsection
        title="Likely objections"
        icon={MessageCircleQuestionIcon}
      >
        <div className="space-y-3">
          {playbook.objections.map((o) => (
            <div
              key={o.objection}
              className="break-inside-avoid p-4 ring-1 ring-border print:border print:border-border print:ring-0"
            >
              <p className="text-sm font-semibold">
                &ldquo;{o.objection}&rdquo;
              </p>
              <p className="mt-1.5 text-sm text-foreground/75">{o.response}</p>
            </div>
          ))}
        </div>
      </ReportSubsection>

      <ReportSubsection title="Likely buyer" icon={UserRoundIcon}>
        <div className="break-inside-avoid bg-muted/60 p-4">
          <p className="text-sm font-semibold">{playbook.buyerProfile.title}</p>
          <p className="mt-1 text-sm text-foreground/75">
            {playbook.buyerProfile.summary}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {playbook.buyerProfile.motivations.map((m) => (
              <Badge
                key={m}
                variant="outline"
                className="h-auto bg-card px-2.5 py-0.5"
              >
                {m}
              </Badge>
            ))}
          </div>
        </div>
      </ReportSubsection>

      <ReportSubsection title="Showing checklist" icon={ClipboardCheckIcon}>
        <ul className="grid gap-2 sm:grid-cols-2 print:grid-cols-2">
          {playbook.showingChecklist.map((item) => (
            <li key={item} className="flex gap-2 text-sm">
              <SquareCheckIcon
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-foreground/45"
              />
              {item}
            </li>
          ))}
        </ul>
      </ReportSubsection>
    </>
  );
}

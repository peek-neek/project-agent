"use client";

import { useQuery } from "@tanstack/react-query";
import {
  FileTextIcon,
  GitCompareArrowsIcon,
  type LucideIcon,
  SparklesIcon,
} from "lucide-react";
import { cn } from "cn";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { FadeImg } from "@/components/globals/report/fade-img";
import { startNavigationProgress } from "@/components/globals/top-progress";
import { useHydrated } from "@/components/globals/travel-mode";
import { useTRPC } from "@/trpc/client";

type View = "report" | "chat";

const VIEWS = [
  { id: "report", label: "Report", icon: FileTextIcon, path: "" },
  { id: "chat", label: "Chat", icon: SparklesIcon, path: "/chat" },
] as const;

/**
 * The property's Street View photo in the Report button, fading in over the
 * icon (same fixed-size slot, so nothing moves). Client-only, after
 * hydration: the server can't know the photo's version. Reads the history
 * the sidebar already loaded; never fetches. No photo: the icon stays.
 */
function ReportPhoto({
  reportId,
  icon: Icon,
}: {
  reportId: string | null;
  icon: LucideIcon;
}) {
  const hydrated = useHydrated();
  return (
    <span className="relative grid size-5 shrink-0 place-items-center">
      <Icon aria-hidden className="size-4" />
      {/* After hydration only: a query in the header during the server
          render would block the page's prefetched data from hydrating. */}
      {hydrated && reportId ? (
        <Photo key={reportId} reportId={reportId} />
      ) : null}
    </span>
  );
}

function Photo({ reportId }: { reportId: string }) {
  const [failed, setFailed] = useState(false);
  const trpc = useTRPC();
  // Subscribes to the sidebar's history (enabled: false: never fetches), so
  // the photo appears as soon as that list is in.
  const { data } = useQuery({
    ...trpc.report.list.queryOptions(),
    enabled: false,
  });
  const p = data?.find((r) => r.id === reportId)?.property;
  if (failed || p?.latitude == null || p.longitude == null) return null;
  return (
    <FadeImg
      src={`/api/reports/${reportId}/street-view?size=thumb&v=${encodeURIComponent(String(p.updatedAt ?? ""))}`}
      alt=""
      decoding="async"
      onError={() => setFailed(true)}
      className="absolute inset-0 size-full object-cover"
    />
  );
}

/**
 * Report | Chat switch in the app header, on reports and comparisons.
 * `base` (e.g. `/reports/<id>`) is null in the prerendered shell: it renders
 * identically, just without links yet, so nothing moves or changes when the
 * real one takes over. `photoReportId` puts that report's Street View photo
 * in the Report button (reports only). `kind` picks the Report button's
 * icon (a plain string: server components render this too).
 */
export function ReportViewSwitch({
  active,
  base,
  photoReportId = null,
  kind = "report",
}: {
  active: View;
  base: string | null;
  photoReportId?: string | null;
  kind?: "report" | "comparison";
}) {
  const icon = kind === "comparison" ? GitCompareArrowsIcon : FileTextIcon;
  return (
    <ButtonGroup aria-label="Report view">
      {VIEWS.map((v) => {
        const current = v.id === active;
        // Icon and name; icon only on phones (the header is tight there),
        // where the name stays for screen readers (same words as shown).
        const label = v.label;
        // dark: variants too: the outline button sets its own dark
        // background, which plain bg-* classes don't override.
        const className = cn(
          "h-8 w-8 gap-1.5 bg-card px-0 sm:w-auto sm:px-3 dark:bg-card dark:hover:bg-muted",
          current &&
            "bg-foreground text-background hover:bg-foreground/90 hover:text-background dark:bg-foreground dark:hover:bg-foreground/90",
        );
        const body = (
          <>
            {v.id === "report" ? (
              <ReportPhoto reportId={photoReportId} icon={icon} />
            ) : (
              <v.icon aria-hidden />
            )}
            <span className="hidden sm:inline">{v.label}</span>
          </>
        );
        return base ? (
          <Button
            key={v.id}
            variant="outline"
            size="sm"
            nativeButton={false}
            aria-label={label}
            aria-current={current ? "page" : undefined}
            render={
              <Link
                href={`${base}${v.path}`}
                onNavigate={current ? undefined : startNavigationProgress}
              />
            }
            className={className}
          >
            {body}
          </Button>
        ) : (
          <Button
            key={v.id}
            variant="outline"
            size="sm"
            aria-label={label}
            aria-current={current ? "page" : undefined}
            className={className}
          >
            {body}
          </Button>
        );
      })}
    </ButtonGroup>
  );
}

/** The live switch: reads the report or comparison id from the URL. */
export function ReportViewSwitchLive({
  active,
  kind,
}: {
  active: View;
  kind: "report" | "comparison";
}) {
  const { reportId, comparisonId } = useParams<{
    reportId?: string;
    comparisonId?: string;
  }>();
  return kind === "report" ? (
    <ReportViewSwitch
      active={active}
      base={reportId ? `/reports/${reportId}` : null}
      photoReportId={reportId ?? null}
    />
  ) : (
    <ReportViewSwitch
      active={active}
      base={comparisonId ? `/compare/${comparisonId}` : null}
      kind="comparison"
    />
  );
}

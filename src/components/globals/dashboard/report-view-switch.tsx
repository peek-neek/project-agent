"use client";

import { FileTextIcon, SparklesIcon } from "lucide-react";
import { cn } from "cn";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { startNavigationProgress } from "@/components/globals/top-progress";

type View = "report" | "chat";

const VIEWS = [
  { id: "report", label: "Report", icon: FileTextIcon, path: "" },
  { id: "chat", label: "Chat", icon: SparklesIcon, path: "/chat" },
] as const;

/**
 * Report | Chat switch in the app header. `reportId` is null in the
 * prerendered shell: it renders identically, just without links yet, so
 * nothing moves or changes when the real one takes over.
 */
export function ReportViewSwitch({
  active,
  reportId,
}: {
  active: View;
  reportId: string | null;
}) {
  return (
    <ButtonGroup aria-label="Report view">
      {VIEWS.map((v) => {
        const current = v.id === active;
        const className = cn(
          "h-8 gap-1.5 bg-card px-3",
          current &&
            "bg-foreground text-background hover:bg-foreground/90 hover:text-background",
        );
        const body = (
          <>
            <v.icon data-icon="inline-start" />
            {v.label}
          </>
        );
        return reportId ? (
          <Button
            key={v.id}
            variant="outline"
            size="sm"
            nativeButton={false}
            aria-current={current ? "page" : undefined}
            render={
              <Link
                href={`/reports/${reportId}${v.path}`}
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

/** The live switch: reads the report id from the URL. */
export function ReportViewSwitchLive({ active }: { active: View }) {
  const { reportId } = useParams<{ reportId: string }>();
  return <ReportViewSwitch active={active} reportId={reportId} />;
}

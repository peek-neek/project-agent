"use client";

import { useMutation } from "@tanstack/react-query";
import {
  CheckCircle2Icon,
  LanguagesIcon,
  SparklesIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { cn } from "cn";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  type Language,
  LANGUAGES,
  REWRITE_ACTIONS,
  REWRITE_MAX_CHARS,
  type RewriteAction,
} from "@/lib/copy-actions";
import {
  checkCompliance,
  COMPLIANCE_CATEGORIES,
  type ComplianceFinding,
  complianceSegments,
} from "@/lib/compliance";
import { useTRPC } from "@/trpc/client";
import { CopyButton } from "./copy-button";

/** Text with flagged phrases underlined; hover one for why and a fix. */
export function FlaggedText({
  text,
  findings,
  className,
}: {
  text: string;
  findings: ComplianceFinding[];
  className?: string;
}) {
  return (
    <p className={cn("whitespace-pre-line", className)}>
      {complianceSegments(text, findings).map((seg, i) =>
        seg.finding ? (
          <Tooltip key={i}>
            <TooltipTrigger
              render={
                <mark className="cursor-help bg-amber-200/60 text-inherit underline decoration-amber-600 decoration-wavy underline-offset-2 dark:bg-amber-500/25" />
              }
            >
              {seg.text}
            </TooltipTrigger>
            <TooltipContent className="max-w-64">
              <span className="block font-medium">
                {COMPLIANCE_CATEGORIES[seg.finding.category]}
              </span>
              {seg.finding.why} {seg.finding.suggestion}
            </TooltipContent>
          </Tooltip>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </p>
  );
}

/** "Clear" or "N to review", with the list on click. */
export function ComplianceBadge({
  findings,
}: {
  findings: ComplianceFinding[];
}) {
  if (findings.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-500">
        <CheckCircle2Icon aria-hidden className="size-3.5" />
        Compliant
      </span>
    );
  }
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="xs"
            className="text-amber-700 hover:text-amber-800 dark:text-amber-500"
          />
        }
      >
        <TriangleAlertIcon data-icon="inline-start" />
        {findings.length} to review
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 gap-3 p-3">
        <p className="text-xs text-foreground/60">
          Wording that can breach the Human Rights Code or RECO advertising
          rules. A guide, not legal advice.
        </p>
        <ul className="space-y-2.5">
          {findings.map((f, i) => (
            <li key={i} className="space-y-0.5 text-xs">
              <span className="flex items-center gap-1.5">
                <mark className="bg-amber-200/60 px-0.5 font-medium text-inherit dark:bg-amber-500/25">
                  {f.match}
                </mark>
                <span className="text-foreground/50">
                  {COMPLIANCE_CATEGORIES[f.category]}
                </span>
              </span>
              <span className="block text-foreground/70">
                {f.why} {f.suggestion}
              </span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/** Rewrite menu: tone and length changes, and translations. */
function RewriteMenu({
  disabled,
  onPick,
}: {
  disabled?: boolean;
  onPick: (action: RewriteAction, language?: Language) => void;
}) {
  const actions = (Object.keys(REWRITE_ACTIONS) as RewriteAction[]).filter(
    (a) => a !== "translate",
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="xs"
            disabled={disabled}
            className="text-foreground/65 print:hidden"
          />
        }
      >
        <SparklesIcon data-icon="inline-start" />
        Rewrite
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {actions.map((a) => (
          <DropdownMenuItem key={a} onClick={() => onPick(a)}>
            {REWRITE_ACTIONS[a].label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <LanguagesIcon />
            Translate
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-80 min-w-44 overflow-y-auto">
            {LANGUAGES.map((l) => (
              <DropdownMenuItem key={l} onClick={() => onPick("translate", l)}>
                {l}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Character count against a limit (red when over). */
function Counter({ text, limit }: { text: string; limit?: number }) {
  const chars = text.length;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return (
    <span
      className={cn(
        "text-xs tabular-nums",
        limit && chars > limit
          ? "font-medium text-destructive"
          : "text-foreground/50",
      )}
    >
      {limit ? `${chars} / ${limit} chars` : `${words} words · ${chars} chars`}
    </span>
  );
}

/**
 * One piece of generated copy, ready to use: compliance highlights, a
 * character counter (against `limit` when given), one-click rewrites and
 * translations, and copy. Rewrites appear underneath, never replacing the
 * original.
 */
export function CopyBlock({
  reportId,
  text,
  limit,
  rewritable = true,
  className,
  textClassName = "text-sm leading-relaxed text-foreground/85",
}: {
  reportId: string;
  text: string;
  /** Character limit to count against (MLS, ads…). */
  limit?: number;
  rewritable?: boolean;
  className?: string;
  textClassName?: string;
}) {
  const trpc = useTRPC();
  const rewrite = useMutation(trpc.report.rewriteCopy.mutationOptions());
  const [label, setLabel] = useState<string | null>(null);
  const findings = checkCompliance(text);
  const result = rewrite.data?.text;
  const resultFindings = result ? checkCompliance(result) : [];

  const pick = (action: RewriteAction, language?: Language) => {
    setLabel(
      action === "translate"
        ? (language ?? "French")
        : REWRITE_ACTIONS[action].label,
    );
    rewrite.mutate({ id: reportId, text, action, language });
  };

  return (
    <div className={className}>
      <FlaggedText text={text} findings={findings} className={textClassName} />
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2.5">
        <Counter text={text} limit={limit} />
        <ComplianceBadge findings={findings} />
        <span className="ml-auto flex items-center gap-1">
          {rewritable && text.length <= REWRITE_MAX_CHARS && (
            <RewriteMenu disabled={rewrite.isPending} onPick={pick} />
          )}
          <CopyButton text={text} />
        </span>
      </div>

      {/* The rewrite, under the original: shimmer while it's written. */}
      {(rewrite.isPending || result || rewrite.error) && (
        <div className="mt-3 border-l-[3px] border-primary bg-muted/40 py-2.5 pr-2.5 pl-3">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
              {label === "French" || LANGUAGES.includes(label as Language) ? (
                <LanguagesIcon aria-hidden className="size-3.5" />
              ) : (
                <SparklesIcon aria-hidden className="size-3.5" />
              )}
              {label}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Discard rewrite"
              onClick={() => rewrite.reset()}
              className="text-foreground/50"
            >
              <XIcon />
            </Button>
          </div>
          {rewrite.isPending ? (
            <div className="space-y-2 py-1" aria-label="Rewriting">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-11/12" />
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="h-3.5 w-2/5" />
            </div>
          ) : rewrite.error ? (
            <p className="text-sm text-destructive">{rewrite.error.message}</p>
          ) : result ? (
            <>
              <FlaggedText
                text={result}
                findings={resultFindings}
                className={textClassName}
              />
              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <Counter text={result} limit={limit} />
                <ComplianceBadge findings={resultFindings} />
                <span className="ml-auto">
                  <CopyButton text={result} />
                </span>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

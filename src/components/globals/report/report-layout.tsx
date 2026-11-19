import type { LucideIcon } from "lucide-react";
import { cn } from "cn";
import { Separator } from "@/components/ui/separator";
import {
  type FieldProvenance,
  formatShortDate,
  sourceLabels,
} from "./report-format";

/** A numbered top-level report section (e.g. "03 Amenities & walkability"). */
export function ReportSection({
  number,
  title,
  description,
  icon: Icon,
  action,
  children,
}: {
  number: number;
  title: string;
  description?: string;
  icon: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const id = `section-${number}`;
  return (
    <section aria-labelledby={id} className="mt-14 first:mt-0 print:mt-10">
      <div className="flex items-start justify-between gap-4 print:break-after-avoid">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center bg-primary/10 text-primary">
            <Icon aria-hidden className="size-5" />
          </span>
          <div>
            <span className="block text-xs font-semibold tracking-wide text-primary tabular-nums">
              {String(number).padStart(2, "0")}
            </span>
            <h2
              id={id}
              className="text-2xl leading-tight font-semibold tracking-tight print:text-xl"
            >
              {title}
            </h2>
          </div>
        </div>
        {action && <div className="shrink-0 print:hidden">{action}</div>}
      </div>
      {description && (
        <p className="mt-3 text-sm text-foreground/65 print:break-after-avoid">
          {description}
        </p>
      )}
      <Separator className="mt-4 bg-foreground/15 print:break-after-avoid" />
      <div className="mt-6 space-y-8">{children}</div>
    </section>
  );
}

/** A subsection inside a section. */
export function ReportSubsection({
  title,
  icon: Icon,
  action,
  className,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("break-inside-avoid", className)}>
      <div className="mb-3 flex items-center justify-between gap-4 print:break-after-avoid">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          {Icon && <Icon aria-hidden className="size-4 text-foreground/55" />}
          {title}
        </h3>
        {action && <div className="print:hidden">{action}</div>}
      </div>
      {children}
    </div>
  );
}

/** Label / value row with optional icon and provenance. */
export function FieldRow({
  label,
  icon: Icon,
  hint,
  provenance,
  empty,
  className,
  children,
}: {
  label: string;
  icon?: LucideIcon;
  hint?: string;
  provenance?: FieldProvenance;
  /** Shown instead of children when the value is missing. */
  empty?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  const hasValue =
    children !== null &&
    children !== undefined &&
    children !== false &&
    children !== "";
  return (
    <div
      className={cn(
        "grid break-inside-avoid gap-1 border-b border-foreground/10 py-3.5 last:border-b-0 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-6 print:grid-cols-[11rem_minmax(0,1fr)] print:gap-6 print:py-2.5",
        className,
      )}
    >
      <dt className="flex items-start gap-2 text-sm text-foreground/65">
        {Icon && <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />}
        <span>
          {label}
          {hint && (
            <span className="block text-xs text-foreground/45">{hint}</span>
          )}
        </span>
      </dt>
      <dd className="min-w-0 text-sm">
        {hasValue ? (
          <>
            <div className="font-medium wrap-break-word">{children}</div>
            {provenance && (
              <div className="mt-0.5 text-xs text-foreground/50">
                {sourceLabels[provenance.source]} ·{" "}
                {formatShortDate(provenance.asOf)}
              </div>
            )}
          </>
        ) : (
          empty
        )}
      </dd>
    </div>
  );
}

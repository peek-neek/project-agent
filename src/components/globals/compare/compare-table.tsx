"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "cn";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DashCard } from "@/components/globals/report/dash-card";
import {
  type CompareProperty,
  SIDE,
  SideChip,
  WinCrown,
  type Side,
  type SideState,
  SIDES,
} from "./compare-shared";

/** One side's value: the figure, plus an optional detail line under it. */
export type CompareCell = { value: React.ReactNode; sub?: React.ReactNode };

export type CompareRow = {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  /** Icon colour (e.g. the amenity category's). */
  iconColor?: string;
  /** Null: nothing to show for that side ("—"). */
  a: CompareCell | null;
  b: CompareCell | null;
  /** The better side, marked with its colour; null for a tie or no verdict. */
  winner?: Side | null;
};

/**
 * The spec sheet behind every comparison tab: one metric per row, property
 * A and B in the columns, the better value marked in that property's
 * colour. `states` holds back a side whose section is still being made.
 */
export function CompareTable({
  title,
  icon,
  a,
  b,
  rows,
  states,
  action,
  footer,
  className,
}: {
  title: string;
  icon: LucideIcon;
  a: CompareProperty;
  b: CompareProperty;
  rows: CompareRow[];
  states?: Record<Side, SideState>;
  action?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  const props = { a, b };
  return (
    <DashCard
      title={title}
      icon={icon}
      action={action}
      className={className}
      bodyClassName="px-0 pb-2"
    >
      <Table className="table-fixed">
        <colgroup>
          <col className="w-[38%] sm:w-[34%]" />
          <col />
          <col />
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-4 text-xs font-medium text-foreground/50">
              <span className="sr-only">Metric</span>
            </TableHead>
            {SIDES.map((side) => (
              <TableHead key={side} className="pr-4 last:pr-4">
                <span className="flex min-w-0 items-center gap-2">
                  <SideChip side={side} />
                  <span className="truncate text-xs font-semibold">
                    {props[side].street}
                  </span>
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className="hover:bg-muted/40">
              <TableCell className="py-3 pl-4 align-top whitespace-normal">
                <span className="flex items-start gap-2">
                  {row.icon && (
                    <row.icon
                      aria-hidden
                      className="mt-0.5 size-4 shrink-0 text-foreground/50"
                      style={
                        row.iconColor ? { color: row.iconColor } : undefined
                      }
                    />
                  )}
                  <span className="min-w-0">
                    <span className="block text-sm text-foreground/75">
                      {row.label}
                    </span>
                    {row.hint && (
                      <span className="block text-xs text-foreground/45">
                        {row.hint}
                      </span>
                    )}
                  </span>
                </span>
              </TableCell>
              {SIDES.map((side) => (
                <TableCell
                  key={side}
                  className={cn(
                    "py-3 pr-4 align-top whitespace-normal",
                    row.winner === side && SIDE[side].tint,
                  )}
                >
                  <Cell
                    cell={row[side]}
                    state={states?.[side] ?? "ready"}
                    won={row.winner === side}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {footer && (
        <p className="px-4 pt-2 text-xs text-foreground/50">{footer}</p>
      )}
    </DashCard>
  );
}

function Cell({
  cell,
  state,
  won,
}: {
  cell: CompareCell | null;
  state: SideState;
  won: boolean;
}) {
  if (state === "pending") {
    return (
      <span className="block space-y-1.5" aria-label="Loading">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-3 w-24" />
      </span>
    );
  }
  if (state === "failed") {
    return <span className="text-xs text-destructive">Couldn&apos;t load</span>;
  }
  if (!cell) return <span className="text-sm text-foreground/35">—</span>;
  return (
    <span className="block min-w-0">
      <span
        className={cn(
          "flex items-center gap-1 text-sm tabular-nums",
          won ? "font-semibold" : "font-medium",
        )}
      >
        <span className="min-w-0 break-words">{cell.value}</span>
        {won && <WinCrown className="ml-0.5" />}
      </span>
      {cell.sub && (
        <span className="mt-0.5 block text-xs break-words text-foreground/50">
          {cell.sub}
        </span>
      )}
    </span>
  );
}

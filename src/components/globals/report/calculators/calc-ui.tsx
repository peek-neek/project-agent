"use client";

import { cn } from "cn";
import { AlertTriangleIcon, InfoIcon, type LucideIcon } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { WIDGET } from "../widget-styles";

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const cad0 = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});
const cad2 = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "$1,234" (or "$1,234.56" with cents). */
export const money = (v: number, cents = false) =>
  (cents ? cad2 : cad0).format(Number.isFinite(v) ? v : 0);

/** 0.0429 → "4.29%". */
export const pct = (v: number, digits = 2) =>
  `${(v * 100)
    .toFixed(digits)
    .replace(/(\.\d*?)0+$/, "$1")
    .replace(/\.$/, "")}%`;

export const years = (v: number) => {
  const whole = Math.floor(v);
  const months = Math.round((v - whole) * 12);
  if (months === 12) return `${whole + 1} years`;
  return months
    ? `${whole} yr ${months} mo`
    : `${whole} year${whole === 1 ? "" : "s"}`;
};

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/**
 * A number field that keeps what the agent types (no reformatting while
 * typing), shows thousands separators otherwise, and reports a number.
 */
function NumberInput({
  id,
  value,
  onChange,
  decimals,
  prefix,
  suffix,
  min = 0,
  max,
  ariaInvalid,
}: {
  id: string;
  value: number;
  onChange: (value: number) => void;
  decimals: number;
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
  ariaInvalid?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown =
    draft ??
    value.toLocaleString("en-CA", {
      maximumFractionDigits: decimals,
      useGrouping: decimals === 0,
    });
  return (
    <InputGroup className="h-10 bg-card">
      {prefix ? (
        <InputGroupAddon>
          <InputGroupText>{prefix}</InputGroupText>
        </InputGroupAddon>
      ) : null}
      <InputGroupInput
        id={id}
        inputMode={decimals ? "decimal" : "numeric"}
        value={shown}
        aria-invalid={ariaInvalid || undefined}
        onFocus={() => setDraft(String(value))}
        onBlur={() => setDraft(null)}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9.]/g, "");
          setDraft(raw);
          const n = Number(raw);
          if (raw !== "" && Number.isFinite(n)) {
            onChange(Math.min(max ?? Infinity, Math.max(min, n)));
          } else if (raw === "") {
            onChange(min);
          }
        }}
        className="tabular-nums"
      />
      {suffix ? (
        <InputGroupAddon align="inline-end">
          <InputGroupText>{suffix}</InputGroupText>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  );
}

/**
 * Under a price field: says it follows the list price, or (after a manual
 * edit) shows the list price with a one-click way back to it.
 */
export function ListPriceHint({
  value,
  listPrice,
  onUse,
}: {
  value: number;
  listPrice: number | null;
  onUse: () => void;
}) {
  if (listPrice == null) return null;
  if (Math.round(value) === Math.round(listPrice)) {
    return <>From the list price in the home details.</>;
  }
  return (
    <>
      List price is {money(listPrice)}.{" "}
      <Button
        variant="link"
        onClick={onUse}
        className="h-auto p-0 text-xs font-medium"
      >
        Use list price
      </Button>
    </>
  );
}

export function MoneyField({
  label,
  value,
  onChange,
  hint,
  invalid,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: React.ReactNode;
  invalid?: boolean;
}) {
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <NumberInput
        id={id}
        value={value}
        onChange={onChange}
        decimals={0}
        prefix="$"
        ariaInvalid={invalid}
      />
      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
    </Field>
  );
}

/** Percent field: shows 4.29, stores 0.0429. */
export function PercentField({
  label,
  value,
  onChange,
  hint,
  max = 25,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: React.ReactNode;
  max?: number;
}) {
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <NumberInput
        id={id}
        value={Math.round(value * 100_000) / 1_000}
        onChange={(v) => onChange(v / 100)}
        decimals={3}
        suffix="%"
        max={max}
      />
      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
    </Field>
  );
}

export function SelectField<T extends string | number>({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; disabled?: boolean }[];
  hint?: React.ReactNode;
}) {
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <NativeSelect
        id={id}
        className="w-full [&>select]:h-10 [&>select]:bg-card"
        value={String(value)}
        onChange={(e) => {
          const picked = options.find(
            (o) => String(o.value) === e.target.value,
          );
          if (picked) onChange(picked.value);
        }}
      >
        {options.map((o) => (
          <NativeSelectOption
            key={String(o.value)}
            value={String(o.value)}
            disabled={o.disabled}
          >
            {o.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
    </Field>
  );
}

export function SwitchField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <Field
      orientation="horizontal"
      className="items-start justify-between gap-4"
    >
      <div className="space-y-0.5">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {description ? (
          <FieldDescription>{description}</FieldDescription>
        ) : null}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        className="mt-0.5"
      />
    </Field>
  );
}

/** Two or three exclusive choices as a segmented control. */
export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <ToggleGroup
        variant="outline"
        value={[value]}
        onValueChange={(v) => {
          const next = v[0] as T | undefined;
          if (next) onChange(next);
        }}
        className="w-full"
      >
        {options.map((o) => (
          <ToggleGroupItem
            key={o.value}
            value={o.value}
            className="h-9 flex-1 bg-card aria-pressed:bg-foreground aria-pressed:text-background"
          >
            {o.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </Field>
  );
}

// ---------------------------------------------------------------------------
// Layout and results
// ---------------------------------------------------------------------------

/** Inputs on the left, results on the right (stacked on small screens). */
export function CalcLayout({
  inputs,
  results,
}: {
  inputs: React.ReactNode;
  results: React.ReactNode;
}) {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-12">
      <section
        aria-label="Inputs"
        className={cn(
          WIDGET,
          "space-y-5 p-5 lg:sticky lg:top-32 lg:col-span-5",
        )}
      >
        {inputs}
      </section>
      <div className="space-y-4 lg:col-span-7">{results}</div>
    </div>
  );
}

export function Panel({
  title,
  icon: Icon,
  children,
  className,
}: {
  title?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(WIDGET, "p-5", className)}>
      {title ? (
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          {Icon ? <Icon aria-hidden className="size-4 text-primary" /> : null}
          {title}
        </h3>
      ) : null}
      {children}
    </section>
  );
}

/** The headline result: label, one big number, a caption. */
export function BigResult({
  label,
  value,
  caption,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  caption?: React.ReactNode;
  tone?: "default" | "good" | "bad";
}) {
  return (
    <section className={cn(WIDGET, "p-5")}>
      <p className="text-sm font-medium text-foreground/60">{label}</p>
      <p
        className={cn(
          "mt-1 text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl",
          tone === "good" && "text-emerald-600",
          tone === "bad" && "text-primary",
        )}
      >
        {value}
      </p>
      {caption ? (
        <p className="mt-2 text-sm text-foreground/60">{caption}</p>
      ) : null}
    </section>
  );
}

/** Small KPI tiles in an even grid (all the same height). */
export function StatGrid({
  items,
}: {
  items: { label: string; value: React.ReactNode; hint?: React.ReactNode }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((it) => (
        <div key={it.label} className={cn(WIDGET, "flex flex-col p-4")}>
          <p className="text-xs font-medium text-foreground/55">{it.label}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{it.value}</p>
          {it.hint ? (
            <p className="mt-auto pt-1 text-xs text-foreground/55">{it.hint}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** A breakdown list: label on the left, amount on the right. */
export function Breakdown({
  rows,
  total,
}: {
  rows: { label: React.ReactNode; value: React.ReactNode; muted?: boolean }[];
  total?: { label: string; value: React.ReactNode };
}) {
  return (
    <dl className="text-sm">
      {rows.map((r, i) => (
        <div
          key={i}
          className={cn(
            "flex items-baseline justify-between gap-4 border-b py-2.5 last:border-b-0",
            r.muted && "text-foreground/55",
          )}
        >
          <dt>{r.label}</dt>
          <dd className="font-medium tabular-nums">{r.value}</dd>
        </div>
      ))}
      {total ? (
        <div className="mt-1 flex items-baseline justify-between gap-4 border-t-2 border-foreground pt-3 text-base font-semibold">
          <dt>{total.label}</dt>
          <dd className="tabular-nums">{total.value}</dd>
        </div>
      ) : null}
    </dl>
  );
}

/** A ratio against its lender limit, as a bar with the limit marked. */
export function RatioBar({
  label,
  value,
  limit,
  description,
}: {
  label: string;
  value: number;
  limit: number;
  description: string;
}) {
  const scale = Math.max(limit * 1.25, value);
  const over = value > limit + 1e-9;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span
          className={cn(
            "font-semibold tabular-nums",
            over ? "text-primary" : "text-emerald-600",
          )}
        >
          {pct(value, 1)}{" "}
          <span className="font-normal text-foreground/55">
            of {pct(limit, 0)} max
          </span>
        </span>
      </div>
      <div className="relative mt-2 h-2.5 bg-muted">
        <div
          className={cn(
            "absolute inset-y-0 left-0",
            over ? "bg-primary" : "bg-emerald-600",
          )}
          style={{ width: `${Math.min(100, (value / scale) * 100)}%` }}
        />
        <div
          aria-hidden
          className="absolute inset-y-[-3px] w-0.5 bg-foreground"
          style={{ left: `${(limit / scale) * 100}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-foreground/55">{description}</p>
    </div>
  );
}

/**
 * One bar split into coloured segments with a legend: where a total goes
 * (the sale price, a monthly budget). Tiny segments still get a sliver.
 */
export function SplitBar({
  segments,
  total,
}: {
  segments: { label: string; amount: number; color: string }[];
  total: number;
}) {
  const shown = segments.filter((s) => s.amount > 0);
  return (
    <div>
      <div className="flex h-4 w-full gap-px overflow-hidden bg-muted">
        {shown.map((s) => (
          <div
            key={s.label}
            title={`${s.label}: ${money(s.amount)}`}
            className="h-full min-w-[3px]"
            style={{
              width: `${total > 0 ? (s.amount / total) * 100 : 0}%`,
              backgroundColor: s.color,
            }}
          />
        ))}
      </div>
      <ul className="mt-3 grid gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
        {shown.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-2.5 shrink-0"
              style={{ backgroundColor: s.color }}
            />
            <span className="min-w-0 flex-1 truncate text-foreground/70">
              {s.label}
            </span>
            <span className="font-medium tabular-nums">{money(s.amount)}</span>
            <span className="w-10 text-right text-foreground/50 tabular-nums">
              {total > 0 ? pct(s.amount / total, 0) : "—"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn";
  children: React.ReactNode;
}) {
  const Icon = tone === "warn" ? AlertTriangleIcon : InfoIcon;
  return (
    <p
      className={cn(
        "flex gap-2 p-3 text-sm",
        tone === "warn"
          ? "bg-amber-500/10 text-amber-900"
          : "bg-muted text-foreground/70",
      )}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

import {
  Checkbox,
  Circle,
  Ellipse,
  Image,
  Line,
  Page,
  Path,
  Polygon,
  Polyline,
  Rect,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";
import {
  CarIcon,
  FootprintsIcon,
  type LucideIcon,
  MapPinIcon,
  StarIcon,
  TrainFrontIcon,
} from "lucide-react";
import type { Style } from "@react-pdf/stylesheet";
import { cloneElement, isValidElement, type ReactNode } from "react";
import { estimateMinutes, type TravelMode } from "@/lib/travel";
import type { PdfImage } from "./data";
import { C, PAGE, s } from "./theme";

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

/** Score colour: green when strong, amber in the middle, red when weak. */
export const scoreColor = (score: number | null) =>
  score == null
    ? C.faint
    : score >= 3.5
      ? C.good
      : score >= 2.5
        ? C.warn
        : C.accent;

/** "#2563eb" at `alpha` opacity, for tinted chips and backgrounds. */
export function tint(hex: string, alpha: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// ---------------------------------------------------------------------------
// Icons: the app's lucide icons, redrawn as PDF vector shapes.
// ---------------------------------------------------------------------------

export type IconNode = [string, Record<string, string>][];
type IconSource = LucideIcon | IconNode;

/** Social marks in Lucide's line style (as in brand-icons.tsx). */
export const BRAND_ICONS = {
  instagram: [
    ["rect", { width: "20", height: "20", x: "2", y: "2", rx: "5", ry: "5" }],
    ["path", { d: "M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" }],
    ["line", { x1: "17.5", x2: "17.51", y1: "6.5", y2: "6.5" }],
  ],
  facebook: [
    [
      "path",
      {
        d: "M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z",
      },
    ],
  ],
  linkedin: [
    [
      "path",
      {
        d: "M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z",
      },
    ],
    ["rect", { width: "4", height: "12", x: "2", y: "9" }],
    ["circle", { cx: "4", cy: "4", r: "2" }],
  ],
} satisfies Record<string, IconNode>;

/** A lucide icon's shapes (read from its element, no React render needed). */
function iconNode(icon: IconSource): IconNode {
  if (Array.isArray(icon)) return icon;
  // forwardRef's render returns <Icon icon={{ node }} />; read the shapes
  // without rendering (no hooks needed).
  const forwardRef = icon as unknown as {
    render: (
      props: object,
      ref: null,
    ) => { props?: { icon?: { node?: IconNode } } } | null;
  };
  return forwardRef.render({}, null)?.props?.icon?.node ?? [];
}

/**
 * Line height for text sitting beside an icon. The renderer puts the
 * baseline one ascender (0.969em for Inter) below the top of the text box,
 * so only Inter's natural height (1.21) centres the digits in it; the
 * page's inherited 1.45 lifts them and the icons look low.
 */
export const ICON_TEXT_LINE_HEIGHT = 1.21;

/**
 * Optical centring: how far below centre an icon's drawing sits, as a share
 * of its size, measured against Inter's digits (the car's body sits low in
 * its 24px box). Icons are nudged up by this so a
 * row of icon + time lines up.
 */
const OPTICAL_SHIFT = new Map<IconSource, number>([
  [FootprintsIcon, 0.01],
  [CarIcon, 0.05],
  [TrainFrontIcon, 0.01],
]);

export function Icon({
  icon,
  size = 10,
  color = C.ink,
  strokeWidth = 2,
  fill,
}: {
  icon: IconSource;
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
}) {
  const stroke = {
    stroke: color,
    strokeWidth,
    fill: fill ?? "none",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const n = (v?: string) => (v == null ? undefined : Number(v));
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={
        OPTICAL_SHIFT.has(icon)
          ? { position: "relative", top: -OPTICAL_SHIFT.get(icon)! * size }
          : undefined
      }
    >
      {iconNode(icon).map(([tag, a], i) => {
        switch (tag) {
          case "path":
            return <Path key={i} d={a.d} {...stroke} />;
          case "circle":
            return (
              <Circle
                key={i}
                cx={n(a.cx)!}
                cy={n(a.cy)!}
                r={n(a.r)!}
                {...stroke}
              />
            );
          case "ellipse":
            return (
              <Ellipse
                key={i}
                cx={n(a.cx)!}
                cy={n(a.cy)!}
                rx={n(a.rx)!}
                ry={n(a.ry)!}
                {...stroke}
              />
            );
          case "rect":
            return (
              <Rect
                key={i}
                x={n(a.x) ?? 0}
                y={n(a.y) ?? 0}
                width={n(a.width)!}
                height={n(a.height)!}
                rx={n(a.rx)}
                ry={n(a.ry)}
                {...stroke}
              />
            );
          case "line":
            return (
              <Line
                key={i}
                x1={n(a.x1)!}
                y1={n(a.y1)!}
                x2={n(a.x2)!}
                y2={n(a.y2)!}
                {...stroke}
              />
            );
          case "polyline":
            return <Polyline key={i} points={a.points} {...stroke} />;
          case "polygon":
            return <Polygon key={i} points={a.points} {...stroke} />;
          default:
            return null;
        }
      })}
    </Svg>
  );
}

/** An icon in a tinted square: the app's chip style. */
export function IconChip({
  icon,
  color,
  size = 22,
}: {
  icon: IconSource;
  color: string;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor: tint(color, 0.12),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon icon={icon} size={size * 0.55} color={color} />
    </View>
  );
}

/** Small label pill, e.g. a stop type or a stage. */
export function Chip({
  children,
  color = C.muted,
  icon,
}: {
  children: ReactNode;
  color?: string;
  icon?: IconSource;
}) {
  return (
    <View
      style={[
        s.row,
        {
          alignItems: "center",
          gap: 3,
          backgroundColor: tint(color, 0.1),
          paddingHorizontal: 4,
          paddingVertical: 1.5,
          alignSelf: "flex-start",
        },
      ]}
    >
      {icon ? <Icon icon={icon} size={7} color={color} /> : null}
      <Text style={{ fontSize: 6.8, fontWeight: 600, color, lineHeight: 1.2 }}>
        {children}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Page frame: running header, reserved brand space, page numbers.
// ---------------------------------------------------------------------------

/**
 * One report section. Every section is its own <Page>, so each starts on a
 * fresh page; long ones flow onto more pages with the same header/footer.
 */
export function ReportPage({
  section,
  address,
  children,
}: {
  section: string;
  address: string;
  children: ReactNode;
}) {
  return (
    <Page size={PAGE.size} style={s.page} wrap>
      <View style={s.runningHeader} fixed>
        <View style={[s.row, { alignItems: "center", gap: 5 }]}>
          <View style={{ width: 5, height: 5, backgroundColor: C.accent }} />
          <Text style={{ fontWeight: 600, color: C.muted }}>{section}</Text>
        </View>
        <Text>{address}</Text>
      </View>
      {children}
      <View style={s.footer} fixed>
        {/* Brand space: intentionally empty for now. */}
        <View style={s.brandSlot} />
        <Text
          style={s.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}`
          }
        />
      </View>
    </Page>
  );
}

/**
 * Section opener: number, title, one-line description. `id` is the link
 * target for the contents page, which also learns its page number here.
 */
export function SectionHead({
  id,
  number,
  eyebrow,
  title,
  lede,
  record,
}: {
  id: string;
  number?: number;
  eyebrow: string;
  title: string;
  lede?: string;
  /** Notes the page this section starts on (first layout pass only). */
  record?: (id: string, page: number) => void;
}) {
  return (
    <View id={id} style={{ marginBottom: 12 }}>
      <Text
        style={{ position: "absolute", fontSize: 1, color: C.white }}
        render={({ pageNumber }) => {
          record?.(id, pageNumber);
          return " ";
        }}
      />
      <View style={[s.row, { alignItems: "center", gap: 6 }]}>
        {number != null ? (
          <Text
            style={{
              fontSize: 7.5,
              fontWeight: 700,
              color: C.white,
              backgroundColor: C.accent,
              paddingHorizontal: 4,
              paddingVertical: 1.5,
            }}
          >
            {String(number).padStart(2, "0")}
          </Text>
        ) : null}
        <Text style={s.eyebrow}>{eyebrow}</Text>
      </View>
      <Text style={s.h1}>{title}</Text>
      {lede ? <Text style={s.lede}>{lede}</Text> : null}
    </View>
  );
}

export function H2({
  children,
  icon,
  color,
  first,
  aside,
}: {
  children: ReactNode;
  icon?: IconSource;
  color?: string;
  /** No top margin (first heading on a page or in a block). */
  first?: boolean;
  /** Right-aligned extra, e.g. a count. */
  aside?: ReactNode;
}) {
  return (
    <View
      style={[
        s.row,
        {
          alignItems: "center",
          gap: 7,
          marginTop: first ? 0 : 13,
          marginBottom: 8,
        },
      ]}
    >
      {icon ? <IconChip icon={icon} color={color ?? C.ink} size={18} /> : null}
      <Text style={[s.h2, { marginTop: 0, marginBottom: 0, flex: 1 }]}>
        {children}
      </Text>
      {aside ? <View>{aside}</View> : null}
    </View>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <Text style={[s.small, { marginTop: 6 }]}>{children}</Text>;
}

export function Para({
  children,
  style,
}: {
  children: ReactNode;
  style?: Style;
}) {
  return (
    <Text style={[s.p, { marginBottom: 6 }, style ?? {}]}>{children}</Text>
  );
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <View style={{ gap: 3 }}>
      {items.map((item, i) => (
        <View key={i} style={[s.row, { gap: 6 }]} wrap={false}>
          <View
            style={{
              width: 3.5,
              height: 3.5,
              backgroundColor: C.accent,
              marginTop: 4.5,
            }}
          />
          <Text style={[s.p, { flex: 1 }]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export function Numbered({ items }: { items: ReactNode[] }) {
  return (
    <View style={{ gap: 4 }}>
      {items.map((item, i) => (
        <View key={i} style={[s.row, { gap: 6 }]} wrap={false}>
          <View
            style={{
              width: 13,
              height: 13,
              marginTop: 0.5,
              backgroundColor: tint(C.accent, 0.1),
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontSize: 7,
                fontWeight: 700,
                color: C.accent,
                lineHeight: 1,
              }}
            >
              {i + 1}
            </Text>
          </View>
          <Text style={[s.p, { flex: 1 }]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Tickable list: real PDF checkboxes (AcroForm), so agents can tick items
 * in any PDF editor. `name` makes each field unique in the document.
 */
export function Checklist({
  name,
  items,
}: {
  name: string;
  items: ReactNode[];
}) {
  return (
    <View style={{ gap: 5 }}>
      {items.map((item, i) => (
        <View key={i} style={[s.row, { gap: 7 }]} wrap={false}>
          {/* A drawn box (always visible, also in print) with the fillable
              field laid exactly on top of it. */}
          <View
            style={{
              width: 10,
              height: 10,
              marginTop: 1.5,
              borderWidth: 0.9,
              borderColor: C.muted,
              backgroundColor: C.white,
            }}
          >
            <Checkbox
              name={`${name}-${i + 1}`}
              borderColor={C.muted}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: 8.2,
                height: 8.2,
              }}
            />
          </View>
          <Text style={[s.p, { flex: 1 }]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Cards and widgets
// ---------------------------------------------------------------------------

/**
 * Makes a grid cell's box fill the row height, so every box in a row is the
 * same size: plain Views get flexGrow; our components get a `fill` prop.
 */
function fillCell(child: ReactNode) {
  if (!isValidElement<{ style?: unknown; fill?: boolean }>(child)) return child;
  if (typeof child.type === "string") {
    const style = child.props.style;
    return cloneElement(child, {
      style: [
        ...(Array.isArray(style) ? style : style ? [style] : []),
        { flexGrow: 1 },
      ],
    } as never);
  }
  return cloneElement(child, { fill: true });
}

/** Splits `items` into rows of `columns`, each an unbreakable block. */
function gridRows(
  items: ReactNode[],
  columns: number,
  gap: number,
  cell: number,
  firstMargin: number,
) {
  const rows: ReactNode[][] = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }
  // Column-direction unbreakable block holding a plain row, emitted with no
  // wrapper: react-pdf mis-measures unbreakable row views, and wrappers
  // whose children are all unbreakable, at page ends.
  return rows.map((row, r) => (
    <View key={r} wrap={false} style={{ marginTop: r ? gap : firstMargin }}>
      <View style={[s.row, { gap }]}>
        {row.map((child, i) => (
          <View key={i} style={{ width: cell }}>
            {fillCell(child)}
          </View>
        ))}
      </View>
    </View>
  ));
}

/**
 * Equal-width columns as stacked rows, so a long grid continues on the next
 * page between rows; rows never split.
 */
export function Grid({
  columns,
  gap = 8,
  children,
  width = PAGE.content,
}: {
  columns: number;
  gap?: number;
  children: ReactNode[];
  /** Available width (defaults to the page's content width). */
  width?: number;
}) {
  const cell = (width - gap * (columns - 1)) / columns;
  return <>{gridRows(children, columns, gap, cell, 0)}</>;
}

/**
 * A heading with a card grid: the heading is locked to the first row, so it
 * can never end up alone at the bottom of a page.
 */
export function HeadedGrid({
  heading,
  columns,
  gap = 6,
  children,
  width = PAGE.content,
}: {
  heading: ReactNode;
  columns: number;
  gap?: number;
  children: ReactNode[];
  width?: number;
}) {
  const cell = (width - gap * (columns - 1)) / columns;
  const first = children.slice(0, columns);
  const rest = children.slice(columns);
  return (
    <>
      <View wrap={false}>
        {heading}
        <View style={[s.row, { gap }]}>
          {first.map((child, i) => (
            <View key={i} style={{ width: cell }}>
              {fillCell(child)}
            </View>
          ))}
        </View>
      </View>
      {gridRows(rest, columns, gap, cell, gap)}
    </>
  );
}

/** A white card with a hairline border. */
export function Card({
  children,
  style,
  accent,
  fill,
}: {
  children: ReactNode;
  style?: Style;
  /** Coloured strip on the left edge. */
  accent?: string;
  /** Grow to the grid row's height (set by Grid). */
  fill?: boolean;
}) {
  return (
    <View
      style={[
        {
          borderWidth: 0.75,
          borderColor: C.line,
          backgroundColor: C.white,
          padding: 9,
        },
        accent ? { borderLeftWidth: 2.5, borderLeftColor: accent } : {},
        fill ? { flexGrow: 1 } : {},
        style ?? {},
      ]}
    >
      {children}
    </View>
  );
}

/** A KPI tile: label, big value, optional note. */
export function Stat({
  label,
  value,
  sub,
  icon,
  color = C.accent,
  valueColor,
  fill,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: IconSource;
  color?: string;
  valueColor?: string;
  /** Grow to the grid row's height (set by Grid). */
  fill?: boolean;
}) {
  return (
    <View
      style={[
        { backgroundColor: C.wash, padding: 9, minHeight: 58 },
        fill ? { flexGrow: 1 } : {},
      ]}
    >
      <View style={[s.row, { alignItems: "center", gap: 4 }]}>
        {icon ? <Icon icon={icon} size={8.5} color={color} /> : null}
        <Text style={[s.small, { fontWeight: 500 }]}>{label}</Text>
      </View>
      <Text
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: valueColor ?? C.ink,
          marginTop: 3,
          lineHeight: 1.15,
        }}
      >
        {value}
      </Text>
      {sub ? <Text style={[s.small, { marginTop: 2 }]}>{sub}</Text> : null}
    </View>
  );
}

/** Label / value pairs in a grid of `columns`. */
export function Facts({
  items,
  columns = 3,
}: {
  items: { label: string; value: ReactNode }[];
  columns?: number;
}) {
  return (
    <View style={[s.row, { flexWrap: "wrap", rowGap: 8 }]}>
      {items.map((f, i) => (
        <View key={i} style={{ width: `${100 / columns}%`, paddingRight: 8 }}>
          <Text style={s.small}>{f.label}</Text>
          <Text style={[s.strong, { fontSize: 9.5, marginTop: 1 }]}>
            {f.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** A copy box: tinted title bar, then the text (posts, emails, scripts). */
export function Block({
  title,
  meta,
  icon,
  color = C.ink,
  children,
}: {
  title?: string;
  meta?: string;
  icon?: IconSource;
  color?: string;
  children: ReactNode;
}) {
  return (
    <View
      style={{ borderWidth: 0.75, borderColor: C.line, marginBottom: 8 }}
      wrap={false}
    >
      {title || meta ? (
        <View
          style={[
            s.row,
            {
              justifyContent: "space-between",
              alignItems: "center",
              backgroundColor: C.wash,
              paddingHorizontal: 9,
              paddingVertical: 5,
            },
          ]}
        >
          <View style={[s.row, { alignItems: "center", gap: 5 }]}>
            {icon ? <Icon icon={icon} size={9} color={color} /> : null}
            <Text style={[s.h3, { marginBottom: 0 }]}>{title ?? ""}</Text>
          </View>
          {meta ? <Text style={s.small}>{meta}</Text> : null}
        </View>
      ) : null}
      <View style={{ padding: 9 }}>{children}</View>
    </View>
  );
}

/** A photo, or a tinted icon tile when there's none. */
export function Thumb({
  image,
  icon = MapPinIcon,
  color = C.muted,
  size = 52,
  badge,
}: {
  image?: PdfImage;
  icon?: IconSource;
  color?: string;
  size?: number;
  /** Map number or letter, top-left. */
  badge?: string;
}) {
  return (
    <View
      style={{ width: size, height: size, backgroundColor: tint(color, 0.1) }}
    >
      {image ? (
        // eslint-disable-next-line jsx-a11y/alt-text -- PDF image, no alt prop
        <Image
          src={image}
          style={{ width: size, height: size, objectFit: "cover" }}
        />
      ) : (
        <View
          style={{
            width: size,
            height: size,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon icon={icon} size={size * 0.38} color={color} />
        </View>
      )}
      {badge ? (
        <Text
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            minWidth: 12,
            paddingHorizontal: 2.5,
            paddingVertical: 1.5,
            fontSize: 7,
            fontWeight: 700,
            color: C.white,
            backgroundColor: color,
            textAlign: "center",
          }}
        >
          {badge}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * A place as a card: photo in front of the name and address, then rating,
 * distance and the time in every mode.
 */
export function PlaceCard({
  image,
  icon,
  color,
  badge,
  name,
  address,
  chips,
  rating,
  distanceMeters,
  times,
  extra,
  fill,
}: {
  fill?: boolean;
  image?: PdfImage;
  icon?: IconSource;
  color: string;
  badge?: string;
  name: string;
  address?: string | null;
  chips?: ReactNode;
  rating?: { value: number | null; count?: number | null };
  distanceMeters: number;
  times: ModeTimes;
  extra?: ReactNode;
}) {
  return (
    <View
      style={[
        s.row,
        {
          gap: 8,
          borderWidth: 0.75,
          borderColor: C.line,
          padding: 6,
        },
        fill ? { flexGrow: 1 } : {},
      ]}
    >
      <Thumb image={image} icon={icon} color={color} badge={badge} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={[
            s.strong,
            { fontSize: 8.5, lineHeight: 1.25 },
            { maxLines: 2, textOverflow: "ellipsis" },
          ]}
        >
          {name}
        </Text>
        {address ? (
          <Text
            style={[
              { fontSize: 7, color: C.muted },
              { maxLines: 1, textOverflow: "ellipsis" },
            ]}
          >
            {address}
          </Text>
        ) : null}
        {chips}
        <View style={[s.row, { alignItems: "center", gap: 6, marginTop: 1 }]}>
          <Text style={{ fontSize: 7.5, color: C.body }}>
            {km(distanceMeters)}
          </Text>
          {rating && rating.value != null ? (
            <Rating value={rating.value} count={rating.count} />
          ) : null}
        </View>
        <Times times={times} size={7.5} />
        {extra}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export type Column<T> = {
  label: string;
  /** Flex share, or a fixed width in points. */
  flex?: number;
  width?: number;
  align?: "left" | "right" | "center";
  render: (row: T, index: number) => ReactNode;
};

export function Table<T>({
  columns,
  rows,
  dense,
}: {
  columns: Column<T>[];
  rows: T[];
  dense?: boolean;
}) {
  const cell = (c: Column<T>): Style => ({
    ...(c.width ? { width: c.width } : { flex: c.flex ?? 1 }),
    textAlign: c.align ?? "left",
    paddingRight: 6,
  });
  const pad = dense ? 3.5 : 5;
  return (
    <View>
      <View
        style={[
          s.row,
          { backgroundColor: C.wash, paddingVertical: 4, paddingLeft: 6 },
        ]}
      >
        {columns.map((c, i) => (
          <Text
            key={i}
            style={[
              cell(c),
              {
                fontSize: 6.8,
                fontWeight: 600,
                color: C.muted,
                textTransform: "uppercase",
                letterSpacing: 0.4,
              },
            ]}
          >
            {c.label}
          </Text>
        ))}
      </View>
      {rows.map((row, r) => (
        <View
          key={r}
          wrap={false}
          style={[
            s.row,
            {
              paddingVertical: pad,
              paddingLeft: 6,
              borderBottomWidth: 0.5,
              borderBottomColor: C.line,
              alignItems: "flex-start",
            },
          ]}
        >
          {columns.map((c, i) => {
            const content = c.render(row, r);
            return typeof content === "string" ||
              typeof content === "number" ? (
              <Text key={i} style={[cell(c), { fontSize: 8.5 }]}>
                {content}
              </Text>
            ) : (
              <View
                key={i}
                style={[
                  cell(c),
                  {
                    alignItems:
                      c.align === "right"
                        ? "flex-end"
                        : c.align === "center"
                          ? "center"
                          : "flex-start",
                  },
                ]}
              >
                {content}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Travel times: every mode at once, each with its icon.
// ---------------------------------------------------------------------------

export const MODE_ICONS: Record<TravelMode, LucideIcon> = {
  walk: FootprintsIcon,
  drive: CarIcon,
};
export const MODE_LABELS: Record<TravelMode, string> = {
  walk: "Walk",
  drive: "Car",
};
export const MODES: TravelMode[] = ["walk", "drive"];
export const TransitIcon = TrainFrontIcon;

export type ModeTimes = Partial<
  Record<
    TravelMode | "transit",
    { minutes: number | null; estimated?: boolean }
  >
>;

export const fmtMin = (m: number) =>
  m < 60
    ? `${m} min`
    : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`;

/** Times for a stored place (walk always; drive estimated if absent). */
export function placeTimes(p: {
  distanceMeters: number;
  walkMinutes: number;
  walkEstimated: boolean;
  driveMinutes?: number | null;
  driveEstimated?: boolean | null;
}): ModeTimes {
  return {
    walk: { minutes: p.walkMinutes, estimated: p.walkEstimated },
    drive:
      p.driveMinutes != null
        ? { minutes: p.driveMinutes, estimated: Boolean(p.driveEstimated) }
        : {
            minutes: estimateMinutes(p.distanceMeters, "drive"),
            estimated: true,
          },
  };
}

/** One icon per mode with its time: no section repeated per mode. */
export function Times({
  times,
  size = 8.5,
}: {
  times: ModeTimes;
  size?: number;
}) {
  const entries = ([...MODES, "transit"] as (TravelMode | "transit")[]).flatMap(
    (m) => {
      const t = times[m];
      return t && t.minutes != null ? [[m, t] as const] : [];
    },
  );
  return (
    <View style={[s.row, { gap: 7, flexWrap: "wrap" }]}>
      {entries.map(([m, t]) => (
        <View key={m} style={[s.row, { alignItems: "center", gap: 2 }]}>
          <Icon
            icon={m === "transit" ? TransitIcon : MODE_ICONS[m]}
            size={size}
            color={C.muted}
          />
          <Text
            style={{
              fontSize: size,
              lineHeight: ICON_TEXT_LINE_HEIGHT,
              color: C.ink,
              fontWeight: 500,
            }}
          >
            {t.estimated ? "~" : ""}
            {fmtMin(t.minutes!)}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** The icon key printed once per section that uses travel times. */
export function TimesLegend({ transit }: { transit?: boolean }) {
  return (
    <View style={[s.row, { gap: 10, marginBottom: 10, alignItems: "center" }]}>
      {MODES.map((m) => (
        <View key={m} style={[s.row, { gap: 3, alignItems: "center" }]}>
          <Icon icon={MODE_ICONS[m]} size={8} color={C.muted} />
          <Text style={[s.small, { lineHeight: ICON_TEXT_LINE_HEIGHT }]}>
            {MODE_LABELS[m]}
          </Text>
        </View>
      ))}
      {transit ? (
        <View style={[s.row, { gap: 3, alignItems: "center" }]}>
          <Icon icon={TransitIcon} size={8} color={C.muted} />
          <Text style={[s.small, { lineHeight: ICON_TEXT_LINE_HEIGHT }]}>
            Transit
          </Text>
        </View>
      ) : null}
      <Text style={s.small}>~ estimated from distance</Text>
    </View>
  );
}

export function Rating({
  value,
  count,
}: {
  value: number | null;
  count?: number | null;
}) {
  if (value == null)
    return <Text style={{ fontSize: 7.5, color: C.faint }}>—</Text>;
  return (
    <View style={[s.row, { alignItems: "center", gap: 2 }]}>
      <Icon icon={StarIcon} size={7} color="#f59e0b" fill="#f59e0b" />
      <Text
        style={{
          fontSize: 7.5,
          lineHeight: ICON_TEXT_LINE_HEIGHT,
          color: C.ink,
          fontWeight: 600,
        }}
      >
        {value.toFixed(1)}
      </Text>
      {count ? (
        <Text style={{ fontSize: 6.8, color: C.muted }}>
          ({count.toLocaleString("en-CA")})
        </Text>
      ) : null}
    </View>
  );
}

/** 1–5 score as five small blocks. */
export function ScoreBlocks({
  score,
  color,
  showValue = true,
  width = 9,
}: {
  score: number | null;
  color?: string;
  showValue?: boolean;
  width?: number;
}) {
  if (score == null)
    return <Text style={{ fontSize: 8.5, color: C.faint }}>—</Text>;
  return (
    <View style={[s.row, { alignItems: "center", gap: 4 }]}>
      {showValue ? (
        <Text style={[s.strong, { fontSize: 9, width: 17 }]}>
          {score.toFixed(1)}
        </Text>
      ) : null}
      <View style={[s.row, { gap: 1.5 }]}>
        {[1, 2, 3, 4, 5].map((i) => {
          const fill = Math.max(0, Math.min(1, score - (i - 1)));
          return (
            <View key={i} style={{ width, height: 5, backgroundColor: C.line }}>
              <View
                style={{
                  width: width * fill,
                  height: 5,
                  backgroundColor: color ?? scoreColor(score),
                }}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** Small yearly trend as bars (crime counts, CSI). */
export function Sparkbars({
  values,
  width = 70,
  height = 16,
  color = C.faint,
  highlight = C.ink,
}: {
  values: (number | null)[];
  width?: number;
  height?: number;
  color?: string;
  highlight?: string;
}) {
  const nums = values.map((v) => v ?? 0);
  const max = Math.max(...nums, 1);
  const bar = width / Math.max(nums.length, 1);
  return (
    <View style={[s.row, { width, height, alignItems: "flex-end" }]}>
      {nums.map((v, i) => (
        <View
          key={i}
          style={{
            width: Math.max(1, bar - 2),
            marginRight: 2,
            height: Math.max(1, (v / max) * height),
            backgroundColor: i === nums.length - 1 ? highlight : color,
          }}
        />
      ))}
    </View>
  );
}

export const km = (meters: number) =>
  meters < 1000
    ? `${Math.round(meters / 10) * 10} m`
    : `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`;

export const date = (value: Date | string) =>
  new Intl.DateTimeFormat("en-CA", { dateStyle: "long" }).format(
    new Date(value),
  );

/** "Nov 19, 2026", for table columns. */
export const shortDate = (value: Date | string) =>
  new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(
    new Date(value),
  );

export const money = (value: number) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);

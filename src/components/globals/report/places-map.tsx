"use client";

import { FadeImg } from "./fade-img";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  ArrowUpRightIcon,
  HouseIcon,
  LocateFixedIcon,
  type LucideIcon,
  StarIcon,
} from "lucide-react";
import { cn } from "cn";
import { getVersion, setWorkerUrl } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Popup as MaplibrePopup, StyleSpecification } from "maplibre-gl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { loadMapStyle } from "./map-style";
import Map, {
  type MapRef,
  Marker,
  NavigationControl,
  Popup,
  useControl,
} from "react-map-gl/maplibre";

// Same-origin copy of MapLibre's worker (scripts/copy-maplibre-worker.mjs):
// the default URL breaks once Turbopack bundles maplibre-gl into a chunk.
setWorkerUrl(`/vendor/maplibre-gl-worker-${getVersion()}.mjs`);

// Start fetching the app-themed style as soon as the map code loads.
if (typeof window !== "undefined") void loadMapStyle();

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  /** Badge text, e.g. "1". */
  badge: string;
  color: string;
  /** Icon colour on `color`; white when not given. */
  textColor?: string;
  icon: LucideIcon;
  title: string;
  /** Small coloured label above the title, e.g. "Café". */
  eyebrow?: string;
  /** Short facts shown as chips, e.g. "3 min walk". */
  facts?: { icon?: LucideIcon; label: string }[];
  rating?: { value: number; count?: number | null } | null;
  address?: string | null;
  /** Image URL for the card header. */
  photo?: string | null;
  /** Opens in a new tab (e.g. Google Maps). */
  href?: string;
  /** Link text; defaults to "Google Maps". */
  linkLabel?: string;
};

type Bounds = [[number, number], [number, number]];

function boundsOf(points: { lat: number; lng: number }[]): Bounds {
  const lngs = points.map((p) => p.lng);
  const lats = points.map((p) => p.lat);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}

const FIT = { padding: 56, maxZoom: 16 } as const;

/** Where the card sits relative to the pin tip, for each auto anchor. */
const CARD_OFFSET = {
  top: [0, 8],
  "top-left": [10, 8],
  "top-right": [-10, 8],
  bottom: [0, -46],
  "bottom-left": [10, -46],
  "bottom-right": [-10, -46],
  left: [22, -20],
  right: [-22, -20],
  center: [0, 0],
} satisfies Record<string, [number, number]>;

/** How long the card lingers after the pointer leaves (to reach its link). */
const HOVER_LEAVE_MS = 140;

/**
 * The compact card shown for a hovered or selected pin: thumbnail on the
 * left; name, key facts and rating, and a link on the right.
 */
function PinCard({ pin, hidePhoto }: { pin: MapPin; hidePhoto?: boolean }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const Icon = pin.icon;
  const showPhoto = Boolean(pin.photo) && !photoFailed && !hidePhoto;
  const facts = pin.facts?.map((f) => f.label) ?? [];

  return (
    <div className="flex w-68 animate-in gap-2.5 bg-card p-2 font-sans text-foreground duration-150 fade-in-0 zoom-in-95">
      <div
        className="relative grid size-18 shrink-0 place-items-center overflow-hidden text-white"
        style={{ backgroundColor: pin.color, color: pin.textColor }}
      >
        <Icon aria-hidden className="size-6" />
        {showPhoto && (
          <>
            <FadeImg
              src={pin.photo!}
              alt=""
              className="absolute inset-0 size-full bg-muted object-cover"
              onError={() => setPhotoFailed(true)}
            />
            <span
              className="absolute bottom-0 left-0 grid size-5 place-items-center"
              style={{ backgroundColor: pin.color }}
            >
              <Icon aria-hidden className="size-3" />
            </span>
          </>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between gap-1">
        <div className="space-y-0.5">
          <p className="line-clamp-2 text-[13px] leading-snug font-semibold">
            {pin.title}
          </p>
          {(facts.length > 0 || pin.rating) && (
            <p className="line-clamp-2 text-[11px] leading-snug text-foreground/60">
              {facts.join(" · ")}
              {pin.rating && (
                <>
                  {facts.length > 0 && " · "}
                  <span className="inline-flex items-center gap-0.5 align-bottom font-semibold text-foreground tabular-nums">
                    {pin.rating.value.toFixed(1)}
                    <StarIcon
                      aria-hidden
                      className="size-3 fill-amber-400 text-amber-400"
                    />
                  </span>
                </>
              )}
            </p>
          )}
        </div>

        {pin.href && (
          <a
            href={pin.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-fit items-center gap-0.5 text-[11px] font-medium text-primary hover:underline"
          >
            {pin.linkLabel ?? "Google Maps"}
            <ArrowUpRightIcon aria-hidden className="size-3" />
          </a>
        )}
      </div>
    </div>
  );
}

/**
 * A MapLibre control under the zoom buttons (same look): back to the home
 * and its pins. Highlighted when the home has been panned out of view.
 */
function RecenterControl({ onClick, away }: { onClick: () => void; away: boolean }) {
  // The control's box, made once; MapLibre stacks it under the earlier
  // top-right controls (the zoom buttons). Only "maplibregl-ctrl" (layout):
  // "maplibregl-ctrl-group" restyles every <button> inside and would fight
  // the shadcn Button below.
  const [container] = useState(() => {
    const el = document.createElement("div");
    el.className = "maplibregl-ctrl";
    return el;
  });
  useControl(
    () => ({ onAdd: () => container, onRemove: () => container.remove() }),
    { position: "top-right" },
  );
  return createPortal(
    // Same 29px width as MapLibre's zoom buttons above it.
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      onClick={onClick}
      title="Recenter on the property"
      aria-label="Recenter on the property"
      className="size-[29px] bg-card shadow-[0_0_0_2px_rgb(0_0_0/0.1)]"
    >
      <LocateFixedIcon
        aria-hidden
        className={cn(away ? "text-primary" : "text-foreground")}
      />
    </Button>,
    container,
  );
}

/**
 * Interactive map of places around the home: category icon pins with a
 * number badge; hover (or click) a pin for its card. Fits to the pins
 * whenever they change.
 */
export function PlacesMap({
  home,
  homes,
  pins,
  selectedId,
  onSelect,
  className,
}: {
  home: { lat: number; lng: number };
  /**
   * Several homes, each with a letter and colour (a comparison). Replaces
   * the single house marker; `home` stays the recenter anchor.
   */
  homes?: {
    lat: number;
    lng: number;
    label: string;
    color: string;
    textColor: string;
  }[];
  pins: MapPin[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  className?: string;
}) {
  const ref = useRef<MapRef>(null);
  const bounds = useMemo(
    () => boundsOf([home, ...(homes ?? []), ...pins]),
    [home, homes, pins],
  );
  const pinKey = pins.map((p) => p.id).join(",");
  const selected = pins.find((p) => p.id === selectedId) ?? null;

  // Hover shows a pin's card; leaving falls back to the selected pin's card.
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hoverIn = (id: string) => {
    clearTimeout(leaveTimer.current);
    setHoveredId(id);
  };
  const hoverOut = () => {
    clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => setHoveredId(null), HOVER_LEAVE_MS);
  };
  useEffect(() => () => clearTimeout(leaveTimer.current), []);
  const shown = pins.find((p) => p.id === hoveredId) ?? selected ?? null;

  // MapLibre picks the card's side (above/below/left/right) from its size,
  // but React fills the card after the popup is placed. Re-place it once the
  // card has a size, and again if it changes (e.g. the photo loads).
  // If the card still spills out of the map (a pin mid-way down a short
  // map has room neither above nor below), drop its photo.
  const popupRef = useRef<MaplibrePopup>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [tightId, setTightId] = useState<string | null>(null);
  const shownId = shown?.id;
  useEffect(() => {
    const card = cardRef.current;
    if (!card || !shownId) return;
    const place = () => {
      const popup = popupRef.current;
      const map = ref.current;
      if (!popup || !map) return;
      // Undefined until MapLibre has added the popup to the map.
      const el = popup.getElement() as HTMLElement | undefined;
      if (!el) return;
      popup.setOffset(CARD_OFFSET);
      const box = el.getBoundingClientRect();
      const frame = map.getContainer().getBoundingClientRect();
      if (box.top < frame.top || box.bottom > frame.bottom) {
        setTightId(shownId);
      }
    };
    const observer = new ResizeObserver(place);
    observer.observe(card);
    return () => observer.disconnect();
  }, [shownId]);

  // True once the style and first tiles are drawn (the map fades in).
  const [loaded, setLoaded] = useState(false);

  // Panned or zoomed so the home is off screen: highlight the recenter
  // button (under the zoom buttons).
  const [homeVisible, setHomeVisible] = useState(true);
  const checkHome = () => {
    const map = ref.current;
    if (map) setHomeVisible(map.getBounds().contains([home.lng, home.lat]));
  };
  const backToHome = () =>
    ref.current?.fitBounds(bounds, { ...FIT, duration: 700 });
  // The app-themed style (fetched once, then cached for every map).
  const [mapStyle, setMapStyle] = useState<StyleSpecification | string | null>(
    null,
  );
  useEffect(() => {
    let live = true;
    loadMapStyle().then((style) => live && setMapStyle(style));
    return () => {
      live = false;
    };
  }, []);

  // Refit when the set of pins changes (e.g. another category).
  useEffect(() => {
    ref.current?.fitBounds(bounds, { ...FIT, duration: 600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refit on a new pin set, not every render
  }, [pinKey]);

  // Bring a selected pin into view.
  useEffect(() => {
    if (!selected) return;
    ref.current?.easeTo({
      center: [selected.lng, selected.lat],
      duration: 500,
    });
  }, [selected]);

  return (
    <div
      className={cn(
        "relative h-[28rem] w-full overflow-hidden bg-muted lg:h-[34rem]",
        className,
      )}
    >
      {/* Shimmer until the style and first tiles are in, then fade the map
          (pins included) in over it: no blank box, no pop. */}
      <Skeleton
        aria-hidden
        className={cn(
          "absolute inset-0 transition-opacity duration-300",
          loaded && "opacity-0",
        )}
      />
      {mapStyle && (
        <Map
          ref={ref}
          mapStyle={mapStyle}
          initialViewState={{ bounds, fitBoundsOptions: FIT }}
          // Two-finger / ctrl+scroll to zoom, so the page still scrolls.
          cooperativeGestures
          // ...but without MapLibre's full-map "Use ⌘ + scroll" overlay: the
          // map footer already says how to zoom.
          onLoad={(e) => {
            const screen = e.target
              .getContainer()
              .querySelector<HTMLElement>(
                ".maplibregl-cooperative-gesture-screen",
              );
            if (screen) screen.style.display = "none";
            setLoaded(true);
          }}
          onMoveEnd={checkHome}
          onClick={() => onSelect(null)}
          style={{
            width: "100%",
            height: "100%",
            opacity: loaded ? 1 : 0,
            transition: "opacity 300ms ease-out",
          }}
        >
          <NavigationControl position="top-right" showCompass={false} />
          <RecenterControl onClick={backToHome} away={!homeVisible} />

          {/* Stacking: pins 1 (2 when selected or hovered), the house 3 so
              it's never hidden behind a pin, place cards 10 (globals.css). */}
          {homes ? (
            homes.map((h) => (
              <Marker
                key={h.label}
                longitude={h.lng}
                latitude={h.lat}
                anchor="bottom"
                style={{ zIndex: 3 }}
              >
                <span
                  title={`Property ${h.label}`}
                  className="relative grid size-9 place-items-center border-2 border-white text-white shadow-md"
                  style={{ backgroundColor: h.color, color: h.textColor }}
                >
                  <HouseIcon aria-hidden className="size-4.5" />
                  <span className="absolute -top-2 -right-2 grid size-4 place-items-center border border-foreground/15 bg-white text-[10px] leading-none font-bold text-black">
                    {h.label}
                  </span>
                </span>
              </Marker>
            ))
          ) : (
            <Marker
              longitude={home.lng}
              latitude={home.lat}
              anchor="bottom"
              style={{ zIndex: 3 }}
            >
              <span
                title="The property"
                className="grid size-9 place-items-center border-2 border-white bg-foreground text-background shadow-md"
              >
                <HouseIcon aria-hidden className="size-4.5" />
              </span>
            </Marker>
          )}

          {pins.map((pin) => {
            const active = pin.id === selectedId;
            const raised = active || pin.id === shown?.id;
            const Icon = pin.icon;
            return (
              <Marker
                key={pin.id}
                longitude={pin.lng}
                latitude={pin.lat}
                anchor="bottom"
                style={{ zIndex: raised ? 2 : 1 }}
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  onSelect(pin.id);
                }}
              >
                {/* The pin's category colour (inline) overrides the default
                    variant's background, hover included. */}
                <Button
                  type="button"
                  size="icon"
                  aria-label={`${pin.badge}. ${pin.title}`}
                  onMouseEnter={() => hoverIn(pin.id)}
                  onMouseLeave={hoverOut}
                  onFocus={() => hoverIn(pin.id)}
                  onBlur={hoverOut}
                  className={cn(
                    "relative rounded-none border-2 border-white text-white shadow-md transition-transform",
                    active ? "size-10 scale-110" : "size-8 hover:scale-110",
                  )}
                  style={{
                    backgroundColor: pin.color,
                    color: pin.textColor,
                  }}
                >
                  <Icon aria-hidden className={active ? "size-5" : "size-4"} />
                  <span className="absolute -top-2 -right-2 grid h-4 min-w-4 place-items-center border border-foreground/15 bg-white px-0.5 text-[10px] leading-none font-semibold text-foreground tabular-nums">
                    {pin.badge}
                  </span>
                </Button>
              </Marker>
            );
          })}

          {shown && (
            <Popup
              ref={popupRef}
              key={shown.id}
              longitude={shown.lng}
              latitude={shown.lat}
              offset={CARD_OFFSET}
              closeButton={false}
              closeOnClick={false}
              // Don't steal focus (or scroll the page) when a card opens on hover.
              focusAfterOpen={false}
              maxWidth="none"
              className="place-card"
            >
              <div
                ref={cardRef}
                onMouseEnter={() => hoverIn(shown.id)}
                onMouseLeave={hoverOut}
              >
                <PinCard pin={shown} hidePhoto={tightId === shown.id} />
              </div>
            </Popup>
          )}
        </Map>
      )}

    </div>
  );
}

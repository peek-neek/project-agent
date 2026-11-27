import {
  getVersion,
  LngLatBounds,
  Map as MapLibre,
  setWorkerUrl,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  staticFile,
  useDelayRender,
  useRemotionEnvironment,
} from "remotion";
import { loadMapStyle } from "../components/globals/report/map-style";
import { VIDEO } from "../lib/video";

// Same-origin worker (copied to public/vendor on install), as in the app.
setWorkerUrl(staticFile(`vendor/maplibre-gl-worker-${getVersion()}.mjs`));

/** The map is drawn this much larger than the frame, then scaled down. */
const PLATE = 1.2;
const PW = Math.round(VIDEO.width * PLATE);
const PH = Math.round(VIDEO.height * PLATE);

/** Largest CSS scale a scene uses (never above 1, so tiles stay sharp). */
export const MAX_PLATE_SCALE = 0.97;
/** Smallest scale that still fills the frame. */
export const MIN_PLATE_SCALE = 1 / PLATE;

export type ScreenPoint = { x: number; y: number };

/**
 * Space kept clear of the places, in frame pixels: the header, captions
 * and labels sit there.
 */
export type PlateFit = {
  top: number;
  bottom: number;
  side: number;
  maxZoom: number;
};

// Our pins and labels carry the story: the basemap's own POIs would compete.
const withoutPois = (style: StyleSpecification | string) =>
  typeof style === "string"
    ? style
    : { ...style, layers: style.layers.filter((l) => !l.id.startsWith("poi")) };

/**
 * A MapLibre map with a fixed camera framing `points` ([lng, lat], home
 * first). Moving the live camera every frame shimmers in renders, so the
 * camera never moves: the push-in is a CSS scale of the whole plate.
 * `children` gets each point's position in the frame (null until loaded).
 */
export function MapPlate({
  points,
  fit,
  scale,
  children,
}: {
  points: [number, number][];
  fit: PlateFit;
  scale: number;
  children: (screen: ScreenPoint[] | null) => ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => delayRender("Loading map"));
  const [projected, setProjected] = useState<ScreenPoint[] | null>(null);
  const { isRendering } = useRemotionEnvironment();
  const key = JSON.stringify([points, fit]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const [pts, f] = JSON.parse(key) as [[number, number][], PlateFit];
    let map: MapLibre | null = null;
    let cancelled = false;

    // Padding in plate pixels, so the places stay clear of the overlays at
    // the end of the push-in (the most zoomed-in moment).
    const offX = (PW - VIDEO.width / MAX_PLATE_SCALE) / 2;
    const offY = (PH - VIDEO.height / MAX_PLATE_SCALE) / 2;
    const padding = {
      top: offY + f.top / MAX_PLATE_SCALE,
      bottom: offY + f.bottom / MAX_PLATE_SCALE,
      left: offX + f.side / MAX_PLATE_SCALE,
      right: offX + f.side / MAX_PLATE_SCALE,
    };
    const bounds = pts.reduce(
      (b, p) => b.extend(p),
      new LngLatBounds(pts[0], pts[0]),
    );

    loadMapStyle("light")
      .then((style) => {
        if (cancelled) return;
        map = new MapLibre({
          container,
          style: withoutPois(style),
          bounds,
          fitBoundsOptions: { padding, maxZoom: f.maxZoom },
          interactive: false,
          attributionControl: false,
          // The plate is already 1.2× the frame; a retina Player doesn't
          // need 4× the pixels (and renders run at 1 anyway).
          pixelRatio: 1,
          fadeDuration: 0,
          canvasContextAttributes: { preserveDrawingBuffer: true },
        });
        map.on("error", (e) => console.warn("[video map]", e.error?.message));
        map.once("load", () => {
          map!.once("idle", () => {
            if (cancelled) return;
            setProjected(pts.map((p) => map!.project(p)));
            continueRender(handle);
          });
        });
      })
      .catch((error: unknown) => cancelRender(error));

    return () => {
      cancelled = true;
      // Renders keep the map (removing it can break Remotion's lifecycle);
      // the Player frees it, or scrubbing would run out of WebGL contexts.
      if (!isRendering) map?.remove();
    };
  }, [key, handle, continueRender, cancelRender, isRendering]);

  // Plate pixels → frame pixels under the current scale.
  const screen = projected?.map((p) => ({
    x: VIDEO.width / 2 + (p.x - PW / 2) * scale,
    y: VIDEO.height / 2 + (p.y - PH / 2) * scale,
  }));

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div
        ref={containerRef}
        style={{
          position: "absolute",
          width: PW,
          height: PH,
          left: (VIDEO.width - PW) / 2,
          top: (VIDEO.height - PH) / 2,
          scale,
        }}
      />
      {children(screen ?? null)}
    </AbsoluteFill>
  );
}

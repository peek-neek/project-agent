import type { LayerSpecification, StyleSpecification } from "maplibre-gl";

/**
 * OpenFreeMap "bright" (OpenStreetMap data, no API key): buildings, street
 * names, road casings and POIs. Recoloured to the app's warm neutrals so it
 * reads as ours. Roads use greys only (no reds, oranges or yellows, which
 * look like traffic); major roads stand out by weight and edge contrast.
 */
export const BASE_MAP_STYLE = "https://tiles.openfreemap.org/styles/bright";

const C = {
  // The app background (oklch 0.97 warm) and border tones.
  ground: "#f6f5f4",
  landuse: "rgba(233, 229, 224, 0.45)",
  hospital: "#f1ecea",
  school: "#f0eeeb",
  green: "#e3e9dc",
  water: "#d9e2e8",
  waterLine: "#bccbd5",
  waterText: "#5f7280",
  building: "#e4ded8",
  buildingTop: "#eeeae5",
  buildingEdge: "#d5ccc3",
  // Roads by class: [fill, casing]. Heavier roads, darker edges.
  minor: ["#ffffff", "#e0d9d2"],
  secondary: ["#ffffff", "#cdc4bb"],
  primary: ["#ffffff", "#b6aca2"],
  motorway: ["#ebe6e0", "#9a9088"],
  path: "#cbc1b7",
  rail: "#b3aaa2",
  boundary: "#c9c0b7",
  roadText: "#3d3935",
  placeText: "#1f1d1b",
  poiText: "#7c746d",
  halo: "#ffffff",
} as const;

type RoadClass = "minor" | "secondary" | "primary" | "motorway";

function roadClass(id: string): RoadClass | "path" | null {
  if (!/^(highway|bridge|tunnel)-/.test(id) || /name|shield|area/.test(id)) {
    return null;
  }
  if (/path|pedestrian/.test(id)) return "path";
  if (/motorway/.test(id)) return "motorway";
  if (/trunk|primary|-link/.test(id)) return "primary";
  if (/secondary|tertiary/.test(id)) return "secondary";
  if (/minor|service|street/.test(id)) return "minor";
  return null;
}

/** Paint overrides for one layer of the base style, or null to keep it. */
function paintFor(layer: LayerSpecification): Record<string, unknown> | null {
  const { id } = layer;

  if (id === "background") return { "background-color": C.ground };

  const road = roadClass(id);
  if (road === "path") return { "line-color": C.path };
  if (road) {
    const [fill, casing] = C[road];
    return { "line-color": id.endsWith("-casing") ? casing : fill };
  }

  if (/^landuse-(residential|suburb|railway|industrial|commercial)$/.test(id)) {
    return { "fill-color": C.landuse };
  }
  if (id === "landuse-hospital") return { "fill-color": C.hospital };
  if (id === "landuse-school") return { "fill-color": C.school };
  if (
    /^(park|landcover-grass|landcover-grass-park|landuse-cemetery)$/.test(id)
  ) {
    return { "fill-color": C.green };
  }
  if (id === "landcover-wood") {
    return { "fill-color": "#8a9a80", "fill-opacity": 0.08 };
  }
  if (id === "landcover-sand") return { "fill-color": "#eee8dc" };
  if (id === "water" || id === "water-intermittent") {
    return { "fill-color": C.water };
  }
  if (id.startsWith("waterway") && layer.type === "line") {
    return { "line-color": C.waterLine };
  }
  if (id === "building") return { "fill-color": C.building };
  if (id === "building-top") {
    return {
      "fill-color": C.buildingTop,
      "fill-outline-color": C.buildingEdge,
    };
  }
  if (/^(railway|tunnel-railway|bridge-railway)/.test(id)) {
    return { "line-color": C.rail };
  }
  if (id.startsWith("boundary")) return { "line-color": C.boundary };

  // Labels: dark warm text on a white halo, so street names stay readable.
  if (id === "highway-name-path") {
    return { "text-color": C.poiText, "text-halo-color": C.halo };
  }
  if (id.startsWith("highway-name")) {
    return {
      "text-color": C.roadText,
      "text-halo-color": C.halo,
      "text-halo-width": 1.5,
      "text-halo-blur": 0,
    };
  }
  if (id.startsWith("poi_") || id === "airport") {
    return {
      "text-color": C.poiText,
      "text-halo-color": C.halo,
      "icon-opacity": 0.6,
    };
  }
  if (id.startsWith("water_name") || id === "waterway_line_label") {
    return { "text-color": C.waterText, "text-halo-color": C.halo };
  }
  if (id.startsWith("label_")) {
    return { "text-color": C.placeText, "text-halo-color": C.halo };
  }
  return null;
}

export function themeMapStyle(style: StyleSpecification): StyleSpecification {
  return {
    ...style,
    layers: style.layers.map((layer) => {
      const paint = paintFor(layer);
      if (!paint) return layer;
      const current = "paint" in layer ? layer.paint : undefined;
      return {
        ...layer,
        paint: { ...current, ...paint },
      } as LayerSpecification;
    }),
  };
}

let themed: Promise<StyleSpecification | string> | null = null;

/**
 * The themed style, fetched once per page. Falls back to the plain base
 * style URL if the fetch fails, so the map still renders.
 */
export function loadMapStyle(): Promise<StyleSpecification | string> {
  themed ??= fetch(BASE_MAP_STYLE)
    .then((r) => {
      if (!r.ok) throw new Error(`Map style ${r.status}`);
      return r.json() as Promise<StyleSpecification>;
    })
    .then(themeMapStyle)
    .catch(() => {
      themed = null; // retry on the next map
      return BASE_MAP_STYLE;
    });
  return themed;
}

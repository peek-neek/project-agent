// The app's light theme (globals.css :root) in hex, for the video frames.
export const COLORS = {
  paper: "#f6f5f4",
  card: "#ffffff",
  ink: "#161614",
  muted: "#74716d",
  border: "#e9e5e0",
  primary: "#d10001",
} as const;

/** Keep key content inside this margin of a 1080×1920 frame. */
export const SAFE = { x: 80, top: 110, bottom: 110 } as const;

export const FONT_FAMILY = "Inter, system-ui, sans-serif";

/** Ease-out used for most entrances. */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

// Shared card surface for the report dashboard (Apple-widget style, square
// corners): always a white background plus a soft lift. Kept in TS rather
// than a CSS @utility so it never depends on globals.css being reloaded.

/** White card surface with a soft shadow. */
export const WIDGET =
  "bg-card shadow-[0_1px_2px_rgb(0_0_0/0.05),0_8px_24px_-12px_rgb(0_0_0/0.14)]";

/** Selected card: a crisp outline on top of the shadow. */
export const WIDGET_SELECTED = "ring-2 ring-foreground";

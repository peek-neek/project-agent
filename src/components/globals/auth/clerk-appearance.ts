import type { SignIn } from "@clerk/nextjs";
import type { ComponentProps } from "react";

type Appearance = NonNullable<ComponentProps<typeof SignIn>["appearance"]>;

// Flattens Clerk's card so the form sits directly on the page background.
export const authFormAppearance = {
  elements: {
    cardBox: { boxShadow: "none" },
    card: { boxShadow: "none", backgroundColor: "transparent" },
    footer: { background: "transparent" },
  },
} satisfies Appearance;

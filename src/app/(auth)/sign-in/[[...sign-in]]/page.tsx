import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthFormSkeleton } from "@/components/globals/auth/auth-form-skeleton";
import { authFormAppearance } from "@/components/globals/auth/clerk-appearance";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return (
    <Suspense fallback={<AuthFormSkeleton />}>
      <SignIn appearance={authFormAppearance} />
    </Suspense>
  );
}

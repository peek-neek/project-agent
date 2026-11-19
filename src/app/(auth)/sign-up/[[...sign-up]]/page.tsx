import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthFormSkeleton } from "@/components/globals/auth/auth-form-skeleton";
import { authFormAppearance } from "@/components/globals/auth/clerk-appearance";

export const metadata: Metadata = {
  title: "Create your account",
  robots: { index: false, follow: false },
};

export default function SignUpPage() {
  return (
    <Suspense fallback={<AuthFormSkeleton />}>
      <SignUp appearance={authFormAppearance} />
    </Suspense>
  );
}

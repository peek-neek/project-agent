import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { site } from "@/components/globals/homepage/content";
import { MotionProvider } from "@/components/globals/homepage/motion-provider";
import { LocationProvider } from "@/components/globals/location/location-provider";
import { TRPCReactProvider } from "@/trpc/client";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: site.name, template: `%s | ${site.name}` },
  description: `${site.tagline}. Branded, data-backed property reports for any Canadian address.`,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-CA" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {/* Fallbacks only: a redirect_url (e.g. back to a report) wins. */}
        <ClerkProvider
          appearance={{ theme: shadcn, variables: { borderRadius: "0" } }}
          signInFallbackRedirectUrl="/dashboard"
          signUpFallbackRedirectUrl="/dashboard"
        >
          <TRPCReactProvider>
            <LocationProvider>
              {/* One MotionConfig for the app: honours reduced motion. */}
              <MotionProvider>{children}</MotionProvider>
            </LocationProvider>
          </TRPCReactProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}

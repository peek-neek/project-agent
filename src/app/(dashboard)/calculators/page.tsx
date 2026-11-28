import type { Metadata } from "next";
import { StandaloneCalculators } from "@/components/globals/report/calculators/standalone-calculators";

export const metadata: Metadata = {
  title: "Calculators",
  robots: { index: false, follow: false },
};

/**
 * Every report calculator without opening a report: starts from an example
 * price and saves to this browser (a report's tab saves to the report).
 */
export default function CalculatorsPage() {
  return (
    <div className="flex-1 bg-muted/50 px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto w-full max-w-[90rem] space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Calculators
        </h1>
        <StandaloneCalculators />
      </div>
    </div>
  );
}

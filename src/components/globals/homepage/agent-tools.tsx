import { ReportVersions } from "./report-versions";
import { SectionHeading } from "./section-heading";

export function AgentTools() {
  return (
    <section
      id="versions"
      aria-labelledby="versions-title"
      className="scroll-mt-8 px-3 sm:px-5"
    >
      <div className="mx-auto max-w-[90rem] bg-foreground py-20 text-background sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <SectionHeading
            id="versions-title"
            tone="dark"
            eyebrow="Agent and client versions"
            title="One property report, two versions: one for clients, one for you"
            description="Switch versions with one click, and turn sections on or off before you share."
            className="mb-14"
          />
          <ReportVersions />
        </div>
      </div>
    </section>
  );
}

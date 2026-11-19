import type { Metadata } from "next";
import { AgentTools } from "@/components/globals/homepage/agent-tools";
import { faqs, site } from "@/components/globals/homepage/content";
import { Cta } from "@/components/globals/homepage/cta";
import { DataSources } from "@/components/globals/homepage/data-sources";
import { Faq } from "@/components/globals/homepage/faq";
import { Footer } from "@/components/globals/homepage/footer";
import { Header } from "@/components/globals/homepage/header";
import { Hero } from "@/components/globals/homepage/hero";
import { HowItWorks } from "@/components/globals/homepage/how-it-works";
import { ReportSections } from "@/components/globals/homepage/report-sections";
import { SnapshotPreview } from "@/components/globals/homepage/snapshot-preview";
import { WorkflowFeatures } from "@/components/globals/homepage/workflow-features";

const title = "AI Property Reports for Real Estate Agents in Ontario";
const description =
  "Generate a branded property report for any Ontario address in minutes, covering neighbourhood amenities, transit, Walk Score, demographics, safety and an agent playbook. Share it as a PDF or a link.";

export const metadata: Metadata = {
  title: { absolute: `${title} | ${site.name}` },
  description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: site.name,
    title,
    description,
    url: "/",
    images: [
      {
        url: "/images/hero-home.jpg",
        width: 2000,
        height: 1333,
        alt: "Modern home at dusk",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/images/hero-home.jpg"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: site.name,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description,
      url: site.url,
      audience: { "@type": "Audience", audienceType: "Real estate agents" },
      areaServed: { "@type": "AdministrativeArea", name: "Ontario, Canada" },
    },
    {
      "@type": "FAQPage",
      mainEntity: faqs.map((faq) => ({
        "@type": "Question",
        name: faq.q,
        acceptedAnswer: { "@type": "Answer", text: faq.a },
      })),
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <Header />
      <main id="top">
        <Hero />
        <DataSources />
        <HowItWorks />
        <SnapshotPreview />
        <ReportSections />
        <AgentTools />
        <WorkflowFeatures />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </>
  );
}

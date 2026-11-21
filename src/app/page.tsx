import type { Metadata } from "next";
import { faqs, site } from "@/components/globals/homepage/content";
import { Footer } from "@/components/globals/homepage/footer";
import { Header } from "@/components/globals/homepage/header";
import { Compliance } from "@/components/globals/landing/compliance";
import { Faq } from "@/components/globals/landing/faq";
import { Features } from "@/components/globals/landing/features";
import { FinalCta } from "@/components/globals/landing/final-cta";
import { Hero } from "@/components/globals/landing/hero";
import { Homework } from "@/components/globals/landing/homework";
import { HowItWorks } from "@/components/globals/landing/how-it-works";
import { Pricing } from "@/components/globals/landing/pricing";
import { Sources } from "@/components/globals/landing/sources";

const title =
  "Property Reports and Listing Copy for Canadian Real Estate Agents";
const description =
  "Type any Canadian address and get the neighbourhood research, compliant listing copy, showing playbook, calculators and a polished PDF in minutes. Amenities timed three ways, nearby schools, commute, safety facts and a sell / rent ease score.";

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
      areaServed: { "@type": "Country", name: "Canada" },
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
      {/* overflow-x-clip: the fanned PDF pages never cause sideways scroll. */}
      <main id="top" className="overflow-x-clip">
        <Hero />
        <Sources />
        <Homework />
        <Features />
        <HowItWorks />
        <Compliance />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}

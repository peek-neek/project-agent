export const site = {
  name: "Plotwise",
  tagline: "AI property reports for real estate agents",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
};

export const navLinks = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#compliance", label: "Compliance" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
];

export const exampleAddresses = [
  "100 Queen St W, Toronto, ON",
  "1 Elm St, Ottawa, ON",
  "77 King St N, Waterloo, ON",
  "250 Lakeshore Rd E, Oakville, ON",
];

/** Every source the reports actually read from. */
export const dataSources = [
  "Google Maps Platform (Places, Routes, Street View, Air Quality)",
  "Statistics Canada (2021 Census, crime severity)",
  "Toronto Police Service open data",
  "Land Information Ontario (road and rail networks)",
  "Conservation authority flood regulation mapping",
  "Ontario school data and EQAO results",
  "Municipal open data (development applications)",
];

export type ReportItem = {
  label: string;
  source?: string;
  available: boolean;
};

export type ReportSection = {
  id: string;
  title: string;
  summary: string;
  items: ReportItem[];
  agentOnly?: boolean;
};

export const reportSections: ReportSection[] = [
  {
    id: "cover",
    title: "Cover page",
    summary:
      "A branded first page with the property photo and your contact details.",
    items: [
      {
        label: "Street View or satellite photo, address and report date",
        source: "Google",
        available: true,
      },
      {
        label: "Your logo, photo, name, phone, email and brokerage",
        source: "Saved branding",
        available: true,
      },
    ],
  },
  {
    id: "snapshot",
    title: "Snapshot summary",
    summary: "The one-page overview of the property and the area.",
    items: [
      {
        label: "AI headline summary of the property and area",
        source: "AI",
        available: true,
      },
      {
        label: "Key facts: type, beds, baths, size and price",
        available: true,
      },
      {
        label: "Top 5 highlights and top 3 watch-outs",
        source: "AI",
        available: true,
      },
      {
        label: "Walk, transit and bike scores",
        source: "Walk Score",
        available: true,
      },
    ],
  },
  {
    id: "property",
    title: "Property details",
    summary: "Lot, zoning and permit history alongside the details you enter.",
    items: [
      {
        label: "Beds, baths, sq ft, year built, taxes, condo fees and features",
        source: "Agent-entered",
        available: true,
      },
      {
        label: "Lot size, shape and boundaries",
        source: "Ontario parcel data",
        available: false,
      },
      {
        label: "Zoning and permitted use",
        source: "City open data",
        available: false,
      },
      {
        label: "Building permits and development applications",
        source: "City open data",
        available: false,
      },
    ],
  },
  {
    id: "maps",
    title: "Maps and visuals",
    summary: "Location, Street View and satellite imagery in one place.",
    items: [
      {
        label: "Location map with nearby places pinned",
        source: "Google",
        available: true,
      },
      {
        label: "Street View and satellite images",
        source: "Google",
        available: true,
      },
      {
        label: "Solar and roof potential",
        source: "Google Solar API",
        available: false,
      },
    ],
  },
  {
    id: "neighbourhood",
    title: "Neighbourhood and amenities",
    summary:
      "What's nearby, how long it takes to get there, and what daily life looks like.",
    items: [
      {
        label:
          "Groceries, cafes, parks, gyms, pharmacies and hospitals with walk times",
        source: "Google Places",
        available: true,
      },
      {
        label: "Transit stops and lines",
        source: "Google, transit agencies",
        available: true,
      },
      {
        label: "Commute times to downtown and key hubs",
        source: "Google Routes",
        available: true,
      },
      { label: "A day in this neighbourhood", source: "AI", available: true },
      {
        label: "Nearby schools and catchment areas",
        source: "Public school data",
        available: false,
      },
    ],
  },
  {
    id: "demographics",
    title: "Demographics",
    summary: "Who lives in the area, from census data.",
    items: [
      {
        label: "Age, household makeup, income and languages",
        source: "Statistics Canada",
        available: true,
      },
      {
        label: "Renters vs owners",
        source: "Statistics Canada",
        available: true,
      },
    ],
  },
  {
    id: "safety",
    title: "Safety and environment",
    summary: "Crime, flood risk, air quality and noise around the property.",
    items: [
      { label: "Air quality", source: "Google", available: true },
      {
        label: "Crime statistics",
        source: "Police open data",
        available: false,
      },
      {
        label: "Flood zones and regulated areas",
        source: "Conservation authorities",
        available: false,
      },
      {
        label: "Noise and traffic sources",
        source: "OpenStreetMap",
        available: false,
      },
    ],
  },
  {
    id: "outlook",
    title: "Future outlook",
    summary: "What's planned nearby that could change the area.",
    items: [
      {
        label: "Nearby development and rezoning applications",
        source: "City open data",
        available: false,
      },
      {
        label: "Planned transit and infrastructure projects",
        source: "City and transit sources",
        available: false,
      },
    ],
  },
  {
    id: "money",
    title: "Money",
    summary: "Payment, closing cost and investment estimates from your inputs.",
    items: [
      { label: "Mortgage payment estimate", available: false },
      { label: "Closing costs and land transfer tax", available: false },
      { label: "Rent vs buy comparison", available: false },
      { label: "Rental yield and cash flow for investors", available: false },
      { label: "AI price positioning comment", source: "AI", available: false },
    ],
  },
  {
    id: "playbook",
    title: "Agent playbook",
    summary: "Showing prep you keep to yourself. Only in the agent version.",
    agentOnly: true,
    items: [
      { label: "Talking points for showings", source: "AI", available: true },
      {
        label: "Likely objections with suggested answers",
        source: "AI",
        available: true,
      },
      { label: "Ideal buyer profile", source: "AI", available: true },
      { label: "Showing prep checklist", source: "AI", available: true },
    ],
  },
  {
    id: "marketing",
    title: "Marketing kit",
    summary: "Listing copy and social posts, ready to use.",
    items: [
      {
        label: "MLS-ready listing description in several tones",
        source: "AI",
        available: true,
      },
      { label: "Social captions and hashtags", source: "AI", available: true },
      { label: "Email blurb", source: "AI", available: true },
      { label: "QR code linking to the shareable report", available: true },
    ],
  },
  {
    id: "sources",
    title: "Sources and disclaimer",
    summary: "Every figure is traceable to its source.",
    items: [
      { label: "Data sources with “as of” dates", available: true },
      {
        label: "Reference-only disclaimer, verify before relying on it",
        available: true,
      },
    ],
  },
];

export const faqs = [
  {
    q: "What exactly do I get for each address?",
    a: `A full location report (amenities timed on foot, by bike and by car, commute and transit, nearby schools (with EQAO results in Ontario), crime, flood, noise and air quality, housing mix and planned development), a sell / rent ease score, ready-to-post marketing copy, a showing playbook, 13 calculators, a downloadable PDF and an AI chat that can answer anything the report doesn't cover.`,
  },
  {
    q: "Which areas do you cover?",
    a: "Addresses anywhere in Canada. Amenities, commute, crime severity, census figures, schools, air quality and the calculators cover every province and territory. Some details are Ontario-only for now (EQAO results, flood regulation, highway and rail distances, infrastructure projects and development applications), and Toronto adds neighbourhood crime rates. Each section says where its data came from.",
  },
  {
    q: "Where does the data come from?",
    a: "Google Maps Platform (Places, Routes, Street View and Air Quality), Statistics Canada (the 2021 Census and crime severity for every police service), Toronto Police Service, Land Information Ontario, conservation authority flood mapping, Ontario school data with EQAO results, and municipal open data.",
  },
  {
    q: "Is the marketing copy safe to post?",
    a: "It's written with human rights law and the provincial regulators' advertising rules (RECO, BCFSA, RECA, OACIQ and the rest) built in: it describes homes and places, never who should live there, and never labels a neighbourhood. You're still the licensee, so read it before you publish.",
  },
  {
    q: "How long does a report take?",
    a: "Usually a few minutes. You can watch each section arrive, and the report is yours to revisit, regenerate or download whenever you need it.",
  },
  {
    q: "Why is there no free plan?",
    a: "Every report runs fresh lookups against live map, routing and AI services, so each one has a real cost. Plans start at C$59 a month, you can cancel anytime, and extra reports are C$15 each.",
  },
  {
    q: "Are the figures guaranteed?",
    a: "No. Reports are for reference. Data is pulled from reputable sources and labelled, but confirm anything important, such as school boundaries, zoning or the tax bill, with the relevant authority.",
  },
];

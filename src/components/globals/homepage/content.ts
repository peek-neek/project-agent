export const site = {
  name: "Plotwise",
  tagline: "AI property reports for real estate agents",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
};

export const navLinks = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#snapshot", label: "Snapshot" },
  { href: "#whats-inside", label: "What's inside" },
  { href: "#versions", label: "Agent tools" },
  { href: "#faq", label: "FAQ" },
];

export const exampleAddresses = [
  "100 Queen St W, Toronto, ON",
  "1 Elm St, Ottawa, ON",
  "77 King St N, Waterloo, ON",
  "250 Lakeshore Rd E, Oakville, ON",
];

export const dataSources = [
  "Google Maps Platform",
  "Google Places",
  "Google Routes",
  "Google Solar API",
  "Walk Score",
  "Statistics Canada",
  "Ontario parcel data",
  "City open data",
  "Police open data",
  "Conservation authorities",
  "Transit agencies",
  "Public school boards",
  "OpenStreetMap",
];

export const steps = [
  {
    title: "Enter any Ontario address",
    body: "Type a street address, or paste up to three to compare. Add beds, baths, price and taxes if you have them.",
  },
  {
    title: "We pull 20+ data sources",
    body: "Parcel data, zoning, permits, transit, schools, demographics, flood maps and air quality, gathered and checked against each other.",
  },
  {
    title: "Share a branded report",
    body: "Download an agent or client PDF with your logo and photo, or send a live link with a QR code.",
  },
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

export const workflowFeatures = [
  {
    title: "Section toggles",
    body: "Turn off any section before you share it, like demographics for a first-time buyer or the money pages for a renter.",
  },
  {
    title: "Shareable link",
    body: "Send a live report link instead of an attachment. Every PDF includes a QR code that opens it.",
  },
  {
    title: "Report history",
    body: "Every report you've made, saved and searchable. Reopen, re-run with fresh data or duplicate.",
  },
  {
    title: "Compare 2–3 addresses",
    body: "Put shortlisted homes side by side on scores, commutes, amenities and costs.",
  },
  {
    title: "Bulk mode",
    body: "Upload a list of addresses and generate a report for each one in a single run.",
  },
];

export const faqs = [
  {
    q: "What is a property report?",
    a: `A property report brings together everything a buyer asks about one address: the home's details, the neighbourhood, nearby amenities, transit, demographics and safety. ${site.name} builds one from public and licensed data in a few minutes and brands it with your details.`,
  },
  {
    q: "Which areas do you cover?",
    a: `${site.name} covers addresses across Ontario. Lot boundaries, zoning, permits and crime data come from provincial and city open data, so detail varies by municipality. Each section notes where its data came from.`,
  },
  {
    q: "Where does the data come from?",
    a: "Google Maps Platform (Places, Routes, Street View, Solar and air quality), Walk Score, Statistics Canada, Ontario parcel data, city open data portals, police open data, conservation authority maps, transit agencies and OpenStreetMap. Each report lists its sources with “as of” dates.",
  },
  {
    q: "What's the difference between the agent and client versions?",
    a: "The client version is a polished report you can hand to buyers and sellers. The agent version adds a private playbook with showing talking points, likely objections and suggested answers, an ideal buyer profile and a prep checklist.",
  },
  {
    q: "Can I add my own branding?",
    a: "Yes. Save your logo, headshot, name, phone, email and brokerage once, and they appear on the cover of every report.",
  },
  {
    q: "Is the information guaranteed to be accurate?",
    a: "No. Reports are for reference only. We pull from reputable sources and show the date of each dataset, but you should check anything important, such as zoning or lot lines, with the municipality before relying on it.",
  },
];

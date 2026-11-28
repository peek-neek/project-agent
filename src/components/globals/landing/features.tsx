import * as motion from "motion/react-client";
import { Chapter } from "./chapter";
import { AmenitiesVisual } from "./visuals/amenities-visual";
import { CalculatorVisual } from "./visuals/calculator-visual";
import { ChatVisual } from "./visuals/chat-visual";
import { CommuteVisual } from "./visuals/commute-visual";
import { MarketingVisual } from "./visuals/marketing-visual";
import { PdfVisual } from "./visuals/pdf-visual";
import { PlaybookVisual } from "./visuals/playbook-visual";
import { SafetyVisual } from "./visuals/safety-visual";
import { SchoolsVisual } from "./visuals/schools-visual";
import { ScoreVisual } from "./visuals/score-visual";

const EASE = [0.16, 1, 0.3, 1] as const;

const CHAPTERS = [
  {
    id: "amenities",
    name: "Amenities",
    title: "Every errand, timed the way your buyer gets around.",
    body: "The nearest grocery store, café, park, pharmacy, gym and 18 more categories, each with real travel times on foot and by car. Switch the mode and the whole report follows, so a cyclist and a two-car household each see their own neighbourhood.",
    points: [
      {
        lead: "23 categories",
        text: "from groceries and pharmacies to libraries, childcare, dog parks and gas.",
      },
      {
        lead: "Real routes",
        text: "travel times from Google Routes, not straight-line distance.",
      },
      {
        lead: "Photos and ratings",
        text: "for each place, so the report looks as good as it reads.",
      },
    ],
    visual: <AmenitiesVisual />,
  },
  {
    id: "commute",
    name: "Commute & transit",
    title: "Answer the commute question before it's asked.",
    body: "The nearest GO station, subway, LRT and bus stops, plus door-to-door trips to the downtowns and airports buyers actually travel to, timed at weekday rush hour by transit and by car.",
    points: [
      {
        lead: "Rush-hour times",
        text: "trips planned for a weekday 8:00 a.m. departure, not the middle of the night.",
      },
      {
        lead: "Transit and car side by side",
        text: "so buyers can weigh the GO train against the drive.",
      },
      {
        lead: "Any destination",
        text: "ask the chat for a route to a workplace and it plans it live.",
      },
    ],
    visual: <CommuteVisual />,
  },
  {
    id: "schools",
    name: "Schools",
    title: "The nearest schools, on one page.",
    body: "The closest elementary and secondary schools in every school system (English and French, public and Catholic), with walk and drive times, anywhere in Canada. In Ontario, EQAO results against the provincial average too.",
    points: [
      { lead: "Every board", text: "in Ontario, not just the one closest to the listing." },
      {
        lead: "EQAO in context",
        text: "for Ontario schools, each result next to the provincial average.",
      },
      {
        lead: "Boundary-safe wording",
        text: "distances, never a promised catchment.",
      },
    ],
    visual: <SchoolsVisual />,
  },
  {
    id: "safety",
    name: "Safety & environment",
    title: "Facts buyers ask about. Never adjectives.",
    body: "Crime severity compared with the province, neighbourhood crime rates in Toronto, flood regulation in Ontario, highway and rail distances across Canada, airports, and air quality, each with its source. You give clients facts, and you never have to describe a neighbourhood yourself.",
    points: [
      {
        lead: "Crime, compared",
        text: "the local police service's severity index next to the province's, from Statistics Canada.",
      },
      {
        lead: "Flood and noise",
        text: "conservation authority mapping (Ontario for now), and the nearest highway and main rail line anywhere in Canada.",
      },
      {
        lead: "No labels",
        text: "areas are never called safe, unsafe or high-crime.",
      },
    ],
    visual: <SafetyVisual />,
  },
  {
    id: "score",
    name: "Sell / rent ease",
    title: "A score you can explain in one sentence.",
    body: "Daily errands, transit, commute, schools, safety, flood and noise, planned investment and the price point roll up into one 1-to-5 rating for each travel mode. Every factor shows the fact behind it, so it supports your advice instead of replacing it.",
    points: [
      {
        lead: "Price-aware",
        text: "the income a buyer needs at the list price, so the pool of buyers is part of the picture.",
      },
      {
        lead: "Transparent weights",
        text: "the report shows exactly how much each factor counts.",
      },
      {
        lead: "Location, honestly",
        text: "it never pretends to know condition or recent sales.",
      },
    ],
    visual: <ScoreVisual />,
  },
  {
    id: "marketing",
    name: "Marketing kit",
    title: "Copy that sounds like you on your best day.",
    body: "MLS descriptions in four tones, Instagram, Facebook and LinkedIn posts, an email, and a full five-stage campaign from Coming Soon to Sold, written from the home's real surroundings instead of generic adjectives.",
    points: [
      {
        lead: "Four tones",
        text: "Professional, Warm, Luxury and an MLS-length short version.",
      },
      {
        lead: "A whole campaign",
        text: "stage posts, a Reel script, a carousel and ad copy.",
      },
      {
        lead: "Rewrite or translate",
        text: "any block in a click, until it sounds like you.",
      },
    ],
    visual: <MarketingVisual />,
  },
  {
    id: "playbook",
    name: "Showing playbook",
    title: "Walk into the showing with the answers.",
    body: "The questions buyers are likely to ask about this specific home and street, with answers drawn from the report, plus talking points, an open house plan and checklists you can tick off on the PDF.",
    points: [
      {
        lead: "Buyer questions",
        text: "answered with this street's real distances, schools and plans.",
      },
      {
        lead: "Open house plan",
        text: "what to highlight, in what order, for which buyers.",
      },
      { lead: "Tickable checklists", text: "fill them in on any PDF editor." },
    ],
    visual: <PlaybookVisual />,
  },
  {
    id: "calculators",
    name: "Calculators",
    title: "Run the numbers in front of the client.",
    body: "Thirteen calculators built on Canadian rules: semi-annual compounding, CMHC premiums, the stress test, every province's land transfer tax (or its equivalent) with first-time buyer relief, seller net sheets, commission splits and more, starting from the home's list price.",
    points: [
      {
        lead: "13 tools",
        text: "mortgage, affordability, land transfer tax, renewal, closing costs, seller net, commission, cost of owning, rental, rent vs buy, prepayment, bridge financing and property tax.",
      },
      {
        lead: "Provincial rules",
        text: "from Toronto's and Montréal's municipal tiers to BC's first-time buyer exemption and each province's sales tax.",
      },
      {
        lead: "Scenarios in the PDF",
        text: "three versions of every calculation, in clean tables.",
      },
    ],
    visual: <CalculatorVisual />,
  },
  {
    id: "pdf",
    name: "PDF report",
    title: "A report worth leaving on the kitchen table.",
    body: "One click turns the report into a polished PDF: photos and property details first, the scores explained, then every section, each on its own page, with a contents page that links straight to it.",
    points: [
      {
        lead: "Built for print",
        text: "clean tables, equal-sized boxes and travel times with icons.",
      },
      {
        lead: "Your branding",
        text: "a space on every page for your logo and details, on Pro.",
      },
      {
        lead: "Everything included",
        text: "every figure in the report, including the calculator scenarios.",
      },
    ],
    visual: <PdfVisual />,
  },
  {
    id: "chat",
    name: "AI chat",
    title: "Ask the report anything.",
    body: "When a client asks something the report doesn't cover, ask the chat. It reads the whole report, searches Google Maps, plans real routes, checks the web and runs the calculators, then tells you where each answer came from.",
    points: [
      {
        lead: "Grounded answers",
        text: "from the report, Google Maps, real routes or the web, always named.",
      },
      {
        lead: "Money questions",
        text: "payments, closing costs and seller net, from the calculators.",
      },
      {
        lead: "Drafts on request",
        text: "replies to buyers, captions and scripts, using only real facts.",
      },
    ],
    visual: <ChatVisual />,
  },
];

export function Features() {
  return (
    <section
      id="features"
      aria-labelledby="features-title"
      className="scroll-mt-24"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-10 pb-16 lg:grid-cols-12">
          <motion.h2
            id="features-title"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.8, ease: EASE }}
            className="text-[clamp(1.9rem,3.6vw,3.1rem)] leading-[1.06] font-semibold tracking-tight text-balance lg:col-span-6"
          >
            Everything you&apos;d research yourself, done before you arrive.
          </motion.h2>
          <motion.ol
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.04 } },
            }}
            className="grid grid-cols-2 gap-x-8 self-end text-sm lg:col-span-5 lg:col-start-8"
          >
            {CHAPTERS.map((c, i) => (
              <motion.li
                key={c.id}
                variants={{
                  hidden: { opacity: 0, y: 8 },
                  visible: { opacity: 1, y: 0 },
                }}
              >
                <a
                  href={`#${c.id}`}
                  className="group flex items-center gap-3 border-b py-2.5 text-foreground/70 transition-colors hover:text-foreground"
                >
                  <span className="text-xs text-primary tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {c.name}
                </a>
              </motion.li>
            ))}
          </motion.ol>
        </div>

        {CHAPTERS.map((c, i) => (
          <Chapter
            key={c.id}
            id={c.id}
            number={String(i + 1).padStart(2, "0")}
            name={c.name}
            title={c.title}
            body={c.body}
            points={c.points}
            visual={c.visual}
            flip={i % 2 === 1}
          />
        ))}
      </div>
    </section>
  );
}

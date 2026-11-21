// Illustrative data for the homepage visuals: one invented Oakville home.
// The street, the businesses and the schools are fictional; public places
// (Oakville GO, Union Station, Pearson) are only used for travel times.
import type { AmenityCategoryId } from "@/lib/report-sections";
import type { TravelMode } from "@/lib/travel";

export const SAMPLE_HOME = {
  street: "18 Ashgrove Crescent",
  place: "Oakville, ON",
  type: "Detached",
  beds: 4,
  baths: 3,
  price: 1_349_000,
};

export type ModeMinutes = Record<TravelMode, number>;

export const SAMPLE_PLACES: {
  category: AmenityCategoryId;
  label: string;
  name: string;
  minutes: ModeMinutes;
  /** Pin position on the sample map, as a share of its width / height. */
  pin: [number, number];
}[] = [
  {
    category: "groceries",
    label: "Groceries",
    name: "Ashgrove Fresh Market",
    minutes: { walk: 7, bike: 3, drive: 2 },
    pin: [0.62, 0.3],
  },
  {
    category: "cafes",
    label: "Café",
    name: "Little Harbour Coffee",
    minutes: { walk: 5, bike: 2, drive: 2 },
    pin: [0.38, 0.24],
  },
  {
    category: "parks",
    label: "Park",
    name: "Ashgrove Park",
    minutes: { walk: 3, bike: 1, drive: 1 },
    pin: [0.27, 0.62],
  },
  {
    category: "pharmacies",
    label: "Pharmacy",
    name: "Crescent Pharmacy",
    minutes: { walk: 9, bike: 4, drive: 3 },
    pin: [0.74, 0.55],
  },
  {
    category: "gyms",
    label: "Gym",
    name: "Northshore Fitness",
    minutes: { walk: 14, bike: 5, drive: 4 },
    pin: [0.8, 0.22],
  },
  {
    category: "libraries",
    label: "Library",
    name: "Glenview Branch Library",
    minutes: { walk: 12, bike: 5, drive: 4 },
    pin: [0.22, 0.3],
  },
];

export const SAMPLE_TRIPS = [
  {
    label: "Oakville GO",
    note: "Lakeshore West line",
    times: [
      { mode: "walk", minutes: 18 },
      { mode: "bike", minutes: 6 },
      { mode: "drive", minutes: 5 },
    ],
  },
  {
    label: "Union Station, Toronto",
    note: "Weekday, leaving 8:00 a.m.",
    times: [
      { mode: "transit", minutes: 52 },
      { mode: "drive", minutes: 46 },
    ],
  },
  {
    label: "Toronto Pearson",
    note: "Weekday, leaving 8:00 a.m.",
    times: [
      { mode: "transit", minutes: 71 },
      { mode: "drive", minutes: 27 },
    ],
  },
] as const;

/** EQAO: share of students at or above the provincial standard. */
export const SAMPLE_SCHOOLS = {
  ontario: 64,
  schools: [
    {
      system: "English public",
      name: "Hollowbrook Public School",
      level: "Elementary",
      km: 0.6,
      minutes: { walk: 8, bike: 3, drive: 2 },
      eqao: 78,
    },
    {
      system: "English Catholic",
      name: "St. Aldric Catholic Elementary",
      level: "Elementary",
      km: 1.1,
      minutes: { walk: 14, bike: 5, drive: 3 },
      eqao: 71,
    },
    {
      system: "French public",
      name: "École élémentaire Bois-Joli",
      level: "Elementary",
      km: 2.4,
      minutes: { walk: 30, bike: 9, drive: 5 },
      eqao: 69,
    },
    {
      system: "French Catholic",
      name: "École catholique Sainte-Odile",
      level: "Elementary",
      km: 3.2,
      minutes: { walk: 40, bike: 12, drive: 7 },
      eqao: 61,
    },
  ],
};

/** Sell / rent ease factors for the sample home (0 hurts … 1 helps). */
export const SAMPLE_FACTORS = [
  {
    label: "Daily errands",
    weight: 20,
    score: 0.88,
    detail: "Groceries 7 min walk · 5 of 5 essentials within 15 min",
  },
  {
    label: "Transit",
    weight: 20,
    score: 0.64,
    detail: "Oakville GO 18 min walk",
  },
  {
    label: "Commute",
    weight: 15,
    score: 0.55,
    detail: "Union Station 52 min by transit",
  },
  {
    label: "Schools",
    weight: 15,
    score: 0.74,
    detail: "4 schools within 3.2 km, above the Ontario average",
  },
  {
    label: "Safety",
    weight: 15,
    score: 0.7,
    detail: "Crime severity 48 vs Ontario 57",
  },
  {
    label: "Flood & noise",
    weight: 10,
    score: 0.9,
    detail: "Outside flood regulation · Highway 1.4 km away",
  },
  {
    label: "Future upside",
    weight: 5,
    score: 0.6,
    detail: "2 development applications within 1 km",
  },
  {
    label: "Price point",
    weight: 15,
    score: 0.35,
    detail: "C$1.35M needs about C$255K household income to qualify",
  },
];

export const SAMPLE_TONES = [
  {
    id: "professional",
    label: "Professional",
    text: "Set on a quiet crescent in Oakville's Ashgrove neighbourhood, this four-bedroom detached home pairs a renovated kitchen with a south-facing backyard and a finished lower level with a separate entrance. Groceries, cafés and Ashgrove Park are all within a 10-minute walk, and Oakville GO is a 6-minute bike ride for the trip to Union Station.",
  },
  {
    id: "warm",
    label: "Warm",
    text: "Mornings here start in a renovated kitchen filled with light from the south-facing yard. Coffee is a five-minute stroll away, Ashgrove Park is around the corner, and the finished lower level, with its own entrance, gives everyone room to spread out. When it's time to head into the city, Oakville GO is a short ride away.",
  },
  {
    id: "luxury",
    label: "Luxury",
    text: "A considered four-bedroom residence on one of Ashgrove's most private crescents. Chef-inspired kitchen, sun-drenched south garden and a fully finished lower level with independent entry. Village cafés, parkland and Oakville GO sit moments from the door, so the city is never far.",
  },
  {
    id: "mls",
    label: "MLS short",
    text: "Renovated 4-bed detached on a quiet Ashgrove crescent. South-facing yard, finished lower level with separate entrance. 7-min walk to groceries, 3 min to Ashgrove Park, 6-min bike to Oakville GO.",
  },
] as const;

export const SAMPLE_STAGES = [
  "Coming soon",
  "Just listed",
  "Open house",
  "Price improved",
  "Sold",
];

export const SAMPLE_QUESTIONS = [
  {
    q: "How far is the GO station?",
    a: "Oakville GO is an 18-minute walk or a 6-minute bike ride. Door to door, Union Station is about 52 minutes by transit at weekday rush hour.",
  },
  {
    q: "Is anything being built nearby?",
    a: "Two development applications are open within 1 km, including a six-storey mixed-use building on the main road. Both are still under review with the town.",
  },
  {
    q: "Which schools are closest?",
    a: "Hollowbrook Public is 600 m away and St. Aldric Catholic is 1.1 km. Both are above the Ontario EQAO average. Boundaries change, so confirm with the board.",
  },
];

export const SAMPLE_CHECKLIST = [
  "Print the PDF for the seller",
  "Bring the GO and rush-hour times",
  "Confirm school boundaries with the board",
  "Prep the open house sign-in plan",
];

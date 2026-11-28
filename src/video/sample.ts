import type { PropertyVideoProps } from "./props";

// Placeholder props for Remotion Studio only: generic names around a point
// in downtown Toronto. Real videos are built from a report (buildVideoProps).

const home = { lat: 43.6534, lng: -79.3839 };
const near = (dLat: number, dLng: number) => ({
  lat: home.lat + dLat,
  lng: home.lng + dLng,
});

export const sampleVideoProps: PropertyVideoProps = {
  home,
  street: "100 Sample Street",
  locality: "Toronto, ON",
  facts: ["3 bed", "2 bath", "Townhouse"],
  verb: "walk",
  branding: { kind: "areaview" },
  stats: {
    overview: {
      label: "Easy",
      color: "#65a30d",
      level: 4,
      rows: [
        { label: "Amenities", score: 4.6 },
        { label: "Commute", score: 4.1 },
        { label: "Schools", score: 3.8 },
        { label: "Safety", score: 3.4 },
        { label: "Neighbourhood", score: 4.0 },
        { label: "Upside", score: 3.2 },
      ],
    },
    safety: {
      items: [
        { label: "Crime severity", value: "18% below Ontario", tone: "good" },
        { label: "Flood", value: "Outside regulated areas", tone: "good" },
        { label: "Highway", value: "None within 500 m", tone: "good" },
        { label: "Railway", value: "320 m away", tone: "neutral" },
        { label: "Air quality", value: "Good air quality", tone: "good" },
      ],
    },
    neighbourhood: {
      homes: [
        { label: "Single-detached", share: 48 },
        { label: "Row houses", share: 22 },
        { label: "Low-rise apartments", share: 17 },
      ],
      owners: 64,
      renters: 36,
    },
    upside: {
      pins: [
        { id: "u1", name: "Sample Line Extension", label: "Transit · Under construction · 2028", ...near(0.006, -0.004), color: "#2563eb" },
        { id: "u2", name: "Sample Community Centre", label: "Recreation · Planning", ...near(-0.004, 0.005), color: "#16a34a" },
        { id: "u3", name: "12 Sample Ave", label: "Development · 240 units · 18 storeys", ...near(0.002, 0.003), color: "#a16207" },
      ],
    },
  },
  destinations: [
    { label: "Downtown Toronto", transitMinutes: 12, driveMinutes: 9 },
    { label: "Pearson Airport", transitMinutes: 48, driveMinutes: 27 },
  ],
  scenes: [
    {
      kind: "intro",
      title: "Life on Sample Street",
      voiceover:
        "Here's what everyday life looks like from 100 Sample Street, all within a short walk.",
      durationInFrames: 120,
      audioSrc: null,
      stops: [],
    },
    {
      kind: "overview",
      title: "At a glance",
      voiceover:
        "This home scores as easy to sell, led by everyday amenities and a quick commute.",
      durationInFrames: 180,
      audioSrc: null,
      stops: [],
    },
    {
      kind: "amenities",
      title: "Errands on foot",
      voiceover:
        "Groceries are a four-minute walk, coffee is three minutes away, and the park is just around the corner.",
      durationInFrames: 180,
      audioSrc: null,
      stops: [
        // A street route (an L along the grid) to show the progress bar.
        { id: "g", name: "Sample Grocer", label: "Groceries", ...near(0.0032, 0.0021), minutes: 4, estimated: false, color: "#2563eb", path: [[home.lng, home.lat], [home.lng, home.lat + 0.0032], [home.lng + 0.0021, home.lat + 0.0032]] },
        { id: "c", name: "Sample Café", label: "Cafés", ...near(-0.0018, 0.0035), minutes: 3, estimated: false, color: "#a16207" },
        { id: "p", name: "Sample Park", label: "Parks", ...near(-0.0035, -0.0028), minutes: 6, estimated: false, color: "#16a34a" },
      ],
    },
    {
      kind: "commute",
      title: "Easy commutes",
      voiceover:
        "The subway is a six-minute walk, and downtown is about twelve minutes by transit.",
      durationInFrames: 165,
      audioSrc: null,
      stops: [
        { id: "s", name: "Sample Station", label: "Subway", ...near(0.0041, -0.0019), minutes: 6, estimated: false, color: "#2563eb" },
        { id: "b", name: "Sample Ave at Main St", label: "Bus stop", ...near(-0.0012, -0.0015), minutes: 2, estimated: false, color: "#ea580c" },
      ],
    },
    {
      kind: "schools",
      title: "Schools close by",
      voiceover:
        "Two schools are within an eight-minute walk. Confirm catchment with the school board.",
      durationInFrames: 165,
      audioSrc: null,
      stops: [
        { id: "e", name: "Sample Public School", label: "English public · Elementary", ...near(0.0021, -0.0042), minutes: 5, estimated: false, color: "#2563eb" },
        { id: "h", name: "Sample Secondary School", label: "English public · Secondary", ...near(-0.0047, 0.0012), minutes: 8, estimated: false, color: "#2563eb" },
      ],
    },
    {
      kind: "safety",
      title: "Safety and setting",
      voiceover:
        "Police-reported crime severity is eighteen percent below the Ontario level, and the home sits outside flood-regulated areas.",
      durationInFrames: 180,
      audioSrc: null,
      stops: [],
    },
    {
      kind: "neighbourhood",
      title: "The housing mix",
      voiceover:
        "Single-detached homes lead the area, with row houses and low-rise apartments, and about two-thirds of homes are owned.",
      durationInFrames: 170,
      audioSrc: null,
      stops: [],
    },
    {
      kind: "upside",
      title: "What's coming",
      voiceover:
        "A transit line extension is under construction nearby, with a new community centre in planning.",
      durationInFrames: 170,
      audioSrc: null,
      stops: [],
    },
    {
      kind: "outro",
      title: "Come see it in person",
      voiceover: "Book a private showing and walk the neighbourhood for yourself.",
      durationInFrames: 120,
      audioSrc: null,
      stops: [],
    },
  ],
};

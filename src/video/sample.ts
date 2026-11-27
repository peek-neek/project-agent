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
      kind: "amenities",
      title: "Errands on foot",
      voiceover:
        "Groceries are a four-minute walk, coffee is three minutes away, and the park is just around the corner.",
      durationInFrames: 180,
      audioSrc: null,
      stops: [
        { id: "g", name: "Sample Grocer", label: "Groceries", ...near(0.0032, 0.0021), minutes: 4, estimated: false, color: "#2563eb" },
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
      kind: "outro",
      title: "Come see it in person",
      voiceover: "Book a private showing and walk the neighbourhood for yourself.",
      durationInFrames: 120,
      audioSrc: null,
      stops: [],
    },
  ],
};

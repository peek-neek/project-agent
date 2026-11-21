import * as motion from "motion/react-client";
import { BuildVisual } from "./visuals/build-visual";

const EASE = [0.16, 1, 0.3, 1] as const;

const STEPS = [
  {
    title: "Type the address",
    text: "Any Ontario address. If Google can't place it, you confirm the match or drop a pin on the map. Add the list price, beds and baths whenever you have them.",
  },
  {
    title: "Get on with your day",
    text: "Plotwise gathers the location data, times every trip and writes the copy. Most reports are ready in a few minutes, and you can watch each section arrive.",
  },
  {
    title: "Present, post and share",
    text: "Open the report in front of the seller, copy the posts into your channels, download the PDF, or ask the chat anything the report doesn't cover.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-title"
      className="scroll-mt-24 bg-card py-20 sm:py-28"
    >
      <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-5">
          <motion.h2
            id="how-title"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.8, ease: EASE }}
            className="text-[clamp(1.9rem,3.4vw,2.9rem)] leading-[1.08] font-semibold tracking-tight text-balance"
          >
            From address to appointment-ready in minutes.
          </motion.h2>
          <ol className="mt-10 space-y-8">
            {STEPS.map((s, i) => (
              <motion.li
                key={s.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.7, delay: i * 0.08, ease: EASE }}
                className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-4"
              >
                <span className="grid size-10 place-items-center border text-sm font-semibold tabular-nums">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-lg font-semibold">{s.title}</h3>
                  <p className="mt-1.5 leading-relaxed text-foreground/65 text-pretty">
                    {s.text}
                  </p>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
        <div className="lg:col-span-7 lg:pt-4">
          <BuildVisual />
        </div>
      </div>
    </section>
  );
}

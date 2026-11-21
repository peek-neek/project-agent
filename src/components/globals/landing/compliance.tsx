import * as motion from "motion/react-client";

const EASE = [0.16, 1, 0.3, 1] as const;

const RULES = [
  {
    title: "Homes and places, never people",
    text: "Copy never describes or targets buyers by race, religion, age, family status, disability or any other ground in the Ontario Human Rights Code. Buyers are described by needs and lifestyle only.",
  },
  {
    title: "No labels on neighbourhoods",
    text: "Areas are never called “safe”, “unsafe” or “high-crime”. You get the crime severity figure, the comparison and the source.",
  },
  {
    title: "Distances, not catchments",
    text: "Reports never promise a school boundary. They give distances and EQAO results, and remind you to confirm attendance areas with the board.",
  },
  {
    title: "Sourced and dated",
    text: "Every section shows where its data came from, and the money tools are clear that figures are estimates. Nothing promises future value or returns.",
  },
];

export function Compliance() {
  return (
    <section
      id="compliance"
      aria-labelledby="compliance-title"
      className="scroll-mt-24 bg-foreground py-20 text-background sm:py-28"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-12">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.8, ease: EASE }}
            className="lg:col-span-5"
          >
            <p className="flex items-center gap-2 text-xs font-medium tracking-[0.14em] text-background/55 uppercase">
              <span className="h-px w-8 bg-primary" />
              Your licence, protected
            </p>
            <h2
              id="compliance-title"
              className="mt-6 text-[clamp(1.9rem,3.4vw,2.9rem)] leading-[1.08] font-semibold tracking-tight text-balance"
            >
              Drafted with Ontario&apos;s advertising rules built in.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-background/65 text-pretty">
              One careless line about a neighbourhood can turn into a complaint.
              These rules shape every report, post and chat answer, so you start
              from a draft written with the Human Rights Code and RECO in mind.
              You still review before you publish.
            </p>
          </motion.div>
          <ol className="grid gap-px bg-background/15 sm:grid-cols-2 lg:col-span-7">
            {RULES.map((r, i) => (
              <motion.li
                key={r.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.7, delay: i * 0.08, ease: EASE }}
                className="bg-foreground p-6"
              >
                <span className="text-xs font-medium text-primary tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 text-lg font-semibold">{r.title}</h3>
                <p className="mt-2 leading-relaxed text-background/65 text-pretty">
                  {r.text}
                </p>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

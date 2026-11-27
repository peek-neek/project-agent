import * as motion from "motion/react-client";

const EASE = [0.16, 1, 0.3, 1] as const;

const MOMENTS = [
  {
    when: "At the listing appointment",
    line: "The seller asks what makes their street worth the price.",
    answer:
      "You have the schools, the commute, what's within a short walk and what's being built nearby, already laid out.",
  },
  {
    when: "At the showing",
    line: "A buyer asks how long the walk to the GO train really is.",
    answer:
      "You answer on the spot, in their way of getting around: on foot or by car.",
  },
  {
    when: "When the listing goes live",
    line: "Your description has to stand out and stay compliant.",
    answer:
      "Copy written from the home's real surroundings, in your tone, with no wording about who should live there.",
  },
];

export function Homework() {
  return (
    <section aria-labelledby="homework-title" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <motion.h2
          id="homework-title"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.8, ease: EASE }}
          className="max-w-4xl text-[clamp(1.9rem,3.6vw,3.1rem)] leading-[1.08] font-semibold tracking-tight text-balance"
        >
          Sellers don&apos;t hire the agent with the nicest brochure.{" "}
          <span className="text-foreground/45">
            They hire the one who clearly did the homework.
          </span>
        </motion.h2>

        <ol className="mt-14 grid gap-px bg-border sm:mt-16 lg:grid-cols-3">
          {MOMENTS.map((m, i) => (
            <motion.li
              key={m.when}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.7, delay: i * 0.1, ease: EASE }}
              className="bg-background py-8 lg:px-8 lg:first:pl-0 lg:last:pr-0"
            >
              <p className="text-xs font-medium tracking-[0.14em] text-primary uppercase">
                {String(i + 1).padStart(2, "0")} · {m.when}
              </p>
              <p className="mt-4 text-xl leading-snug font-medium text-pretty">
                {m.line}
              </p>
              <p className="mt-3 leading-relaxed text-foreground/65 text-pretty">
                {m.answer}
              </p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}

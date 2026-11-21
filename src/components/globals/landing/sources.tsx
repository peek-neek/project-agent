import * as motion from "motion/react-client";

/** Every source the reports actually read from. */
export const SOURCES = [
  "Google Maps Platform",
  "Statistics Canada",
  "Toronto Police Service",
  "Land Information Ontario",
  "Conservation authorities",
  "Ontario school data and EQAO",
  "Municipal open data",
];

export function Sources() {
  return (
    <section aria-label="Data sources" className="border-y bg-card">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-6 sm:px-8 lg:flex-row lg:items-center lg:gap-10">
        <p className="shrink-0 text-xs font-medium tracking-[0.14em] text-foreground/50 uppercase">
          Every figure traced to its source
        </p>
        <motion.ul
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.06 } },
          }}
          className="flex flex-wrap items-center gap-x-6 gap-y-2"
        >
          {SOURCES.map((s) => (
            <motion.li
              key={s}
              variants={{
                hidden: { opacity: 0, y: 8 },
                visible: { opacity: 1, y: 0 },
              }}
              className="text-sm font-medium text-foreground/70"
            >
              {s}
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}

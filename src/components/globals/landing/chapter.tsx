import * as motion from "motion/react-client";
import { cn } from "cn";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * One feature: number and name, a headline, the explanation, three concrete
 * points, and the visual beside it (alternating sides down the page).
 */
export function Chapter({
  id,
  number,
  name,
  title,
  body,
  points,
  visual,
  flip = false,
}: {
  id: string;
  number: string;
  name: string;
  title: string;
  body: string;
  points: { lead: string; text: string }[];
  visual: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <article
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-24 border-t py-16 sm:py-24"
    >
      <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8, ease: EASE }}
          className={cn("lg:col-span-5", flip && "lg:order-last")}
        >
          <p className="flex items-center gap-3 text-xs font-medium tracking-[0.14em] uppercase">
            <span className="text-primary tabular-nums">{number}</span>
            <span className="h-px w-6 bg-foreground/20" />
            <span className="text-foreground/55">{name}</span>
          </p>
          <h3
            id={`${id}-title`}
            className="mt-5 text-[clamp(1.75rem,3vw,2.5rem)] leading-[1.08] font-semibold tracking-tight text-balance"
          >
            {title}
          </h3>
          <p className="mt-5 text-lg leading-relaxed text-foreground/70 text-pretty">
            {body}
          </p>
          <ul className="mt-8 space-y-4 border-t pt-6">
            {points.map((p) => (
              <li key={p.lead} className="flex gap-3">
                <span className="mt-2 size-1.5 shrink-0 bg-primary" />
                <p className="leading-relaxed text-foreground/70 text-pretty">
                  <span className="font-medium text-foreground">{p.lead}.</span>{" "}
                  {p.text}
                </p>
              </li>
            ))}
          </ul>
        </motion.div>
        <div className="lg:col-span-7">{visual}</div>
      </div>
    </article>
  );
}

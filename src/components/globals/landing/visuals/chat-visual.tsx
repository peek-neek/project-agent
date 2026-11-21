"use client";

import { CheckIcon, MapIcon, RouteIcon, SparklesIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { EASE, Frame, SampleTag, useReveal } from "../shared";

const STEPS = [
  {
    icon: MapIcon,
    text: "Searching Google Maps for “Costco”",
    result: "3 places",
  },
  {
    icon: RouteIcon,
    text: "Routing a drive, weekday 8:00 a.m.",
    result: "16 min",
  },
];

export function ChatVisual() {
  const { ref, inView } = useReveal(0.4);
  const reduce = useReducedMotion();
  const show = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 10 },
    animate: inView ? { opacity: 1, y: 0 } : undefined,
    transition: { duration: 0.5, delay: reduce ? 0 : delay, ease: EASE },
  });

  return (
    <div ref={ref}>
      <Frame
        title={
          <span className="flex items-center gap-2">
            <SparklesIcon aria-hidden className="size-4 text-primary" />
            Ask about 18 Ashgrove Crescent
          </span>
        }
        bodyClassName="space-y-4 p-5"
      >
        {/* The agent's question */}
        <motion.p
          {...show(0.1)}
          className="ml-auto w-fit max-w-[85%] bg-foreground px-4 py-2.5 text-sm text-background"
        >
          Is there a Costco nearby, and how long is the drive at rush hour?
        </motion.p>

        {/* What the AI does */}
        <ul className="space-y-2">
          {STEPS.map((s, i) => (
            <motion.li
              key={s.text}
              {...show(0.7 + i * 0.7)}
              className="flex items-center gap-2.5 text-sm text-foreground/60"
            >
              <s.icon aria-hidden className="size-4 shrink-0" />
              <span className="flex-1">{s.text}</span>
              <motion.span
                initial={reduce ? false : { opacity: 0 }}
                animate={inView ? { opacity: 1 } : undefined}
                transition={{ delay: reduce ? 0 : 1.1 + i * 0.7 }}
                className="flex items-center gap-1 text-xs font-medium text-foreground"
              >
                <CheckIcon aria-hidden className="size-3.5 text-[#16a34a]" />
                {s.result}
              </motion.span>
            </motion.li>
          ))}
        </ul>

        {/* The answer */}
        <motion.div {...show(2.3)} className="border-l-2 border-primary pl-4">
          <p className="text-sm leading-relaxed">
            The closest is <strong>Costco Wholesale on Wyecroft Road</strong>,
            9.8 km away. On a weekday leaving at 8:00 a.m., the drive takes
            about <strong>16 minutes</strong>. Two other locations are 17 and 24
            km away.
          </p>
          <p className="mt-2 text-xs text-foreground/50">From Google Maps</p>
        </motion.div>
      </Frame>
      <SampleTag className="mt-3" />
    </div>
  );
}

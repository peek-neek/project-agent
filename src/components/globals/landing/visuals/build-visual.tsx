"use client";

import { CheckIcon, LoaderCircleIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { Frame, useReveal } from "../shared";

const STEPS = [
  "Confirming the address",
  "Finding 23 kinds of nearby places",
  "Timing every trip on foot and by car",
  "Checking schools, EQAO and boards",
  "Reading crime, flood, noise and air data",
  "Census housing and planned projects",
  "Writing the copy in three travel modes",
];

/** The report building itself: steps tick off as the bar fills. */
export function BuildVisual() {
  const { ref, inView } = useReveal(0.5);
  const reduce = useReducedMotion();
  const [done, setDone] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const id = setInterval(
      () => setDone((d) => (d >= STEPS.length ? d : d + 1)),
      reduce ? 60 : 650,
    );
    return () => clearInterval(id);
  }, [inView, reduce]);
  const complete = done >= STEPS.length;

  return (
    <div ref={ref}>
      <Frame
        title="18 Ashgrove Crescent, Oakville"
        action={
          <span className="text-xs text-foreground/50 tabular-nums">
            {complete ? "Ready" : `${done} of ${STEPS.length}`}
          </span>
        }
      >
        <span className="block h-1 bg-muted">
          <motion.span
            className="block h-full origin-left bg-primary"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: done / STEPS.length }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </span>
        <ul className="space-y-3 p-5">
          {STEPS.map((s, i) => {
            const state = i < done ? "done" : i === done ? "active" : "todo";
            return (
              <li key={s} className="flex items-center gap-3 text-sm">
                <span className="grid size-5 shrink-0 place-items-center">
                  {state === "done" ? (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{
                        type: "spring",
                        bounce: 0.4,
                        duration: 0.4,
                      }}
                      className="grid size-5 place-items-center bg-[#16a34a] text-white"
                    >
                      <CheckIcon aria-hidden className="size-3" />
                    </motion.span>
                  ) : state === "active" && inView ? (
                    <LoaderCircleIcon
                      aria-hidden
                      className="size-4 animate-spin text-foreground/50"
                    />
                  ) : (
                    <span className="size-2 bg-foreground/15" />
                  )}
                </span>
                <span
                  className={
                    state === "todo" ? "text-foreground/40" : "text-foreground"
                  }
                >
                  {s}
                </span>
              </li>
            );
          })}
        </ul>
      </Frame>
    </div>
  );
}

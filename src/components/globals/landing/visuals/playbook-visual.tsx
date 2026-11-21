"use client";

import { MessageCircleQuestionIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { SAMPLE_CHECKLIST, SAMPLE_QUESTIONS } from "../sample";
import { EASE, Frame, SampleTag, useAutoCycle } from "../shared";

export function PlaybookVisual() {
  const reduce = useReducedMotion();
  const { ref, index, select, inView } = useAutoCycle(
    SAMPLE_QUESTIONS.length,
    3800,
  );
  return (
    <div ref={ref}>
      <Frame bodyClassName="grid md:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
        {/* Buyer questions, with the answer ready */}
        <div className="border-b md:border-r md:border-b-0">
          <p className="border-b px-4 py-3 text-sm font-medium">
            What buyers will ask
          </p>
          <ul className="divide-y">
            {SAMPLE_QUESTIONS.map((item, i) => {
              const open = i === index;
              return (
                <li key={item.q}>
                  <Button
                    variant="ghost"
                    onClick={() => select(i)}
                    aria-expanded={open}
                    className="h-auto w-full justify-start gap-2.5 px-4 py-3 text-left text-sm font-medium whitespace-normal hover:bg-muted/50"
                  >
                    <MessageCircleQuestionIcon
                      aria-hidden
                      className={cn(
                        "shrink-0",
                        open ? "text-primary" : "text-foreground/40",
                      )}
                    />
                    {item.q}
                  </Button>
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        key="answer"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.4, ease: EASE }}
                        className="overflow-hidden"
                      >
                        <p className="ml-10 border-l-2 border-primary px-4 pb-4 text-sm leading-relaxed text-foreground/70">
                          {item.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Prep checklist, ticking itself off */}
        <div>
          <p className="border-b px-4 py-3 text-sm font-medium">
            Before the showing
          </p>
          <ul className="space-y-3 p-4">
            {SAMPLE_CHECKLIST.map((item, i) => (
              <li key={item} className="flex gap-2.5 text-sm">
                <span className="relative mt-0.5 grid size-4 shrink-0 place-items-center border border-foreground/30">
                  <svg viewBox="0 0 16 16" className="size-3" aria-hidden>
                    <motion.path
                      d="M3 8.5 6.5 12 13 4.5"
                      fill="none"
                      className="stroke-primary"
                      strokeWidth="2.2"
                      strokeLinecap="square"
                      initial={{ pathLength: reduce ? 1 : 0 }}
                      animate={inView ? { pathLength: 1 } : undefined}
                      transition={{
                        duration: 0.35,
                        delay: 0.6 + i * 0.45,
                        ease: EASE,
                      }}
                    />
                  </svg>
                </span>
                <span className="leading-snug text-foreground/75">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </Frame>
      <SampleTag className="mt-3" />
    </div>
  );
}

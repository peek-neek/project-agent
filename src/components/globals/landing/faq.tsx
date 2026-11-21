import * as motion from "motion/react-client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { faqs } from "@/components/globals/homepage/content";

const EASE = [0.16, 1, 0.3, 1] as const;

export function Faq() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      className="scroll-mt-24 border-t bg-card py-20 sm:py-28"
    >
      <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-12">
        <motion.h2
          id="faq-title"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.8, ease: EASE }}
          className="text-[clamp(1.9rem,3.4vw,2.9rem)] leading-[1.08] font-semibold tracking-tight text-balance lg:col-span-4"
        >
          Questions agents ask us.
        </motion.h2>
        <Accordion className="border-t lg:col-span-8">
          {faqs.map((faq) => (
            <AccordionItem key={faq.q} className="border-b">
              <AccordionTrigger className="py-6 text-base font-medium hover:no-underline sm:text-lg">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="pb-6 text-base leading-relaxed text-foreground/65">
                <p>{faq.a}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

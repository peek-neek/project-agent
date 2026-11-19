import * as motion from "motion/react-client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { faqs } from "./content";
import { fadeUp, inViewOnce, stagger } from "./motion-presets";
import { SectionHeading } from "./section-heading";

export function Faq() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      className="scroll-mt-8 bg-card py-20 sm:py-28"
    >
      <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <SectionHeading
          id="faq-title"
          eyebrow="FAQ"
          title="Property report questions, answered"
          description="Where the data comes from, what each version includes and how accurate it is."
        />
        <motion.div
          variants={stagger(0.06)}
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
        >
          <Accordion className="border-t">
            {faqs.map((faq) => (
              <motion.div key={faq.q} variants={fadeUp}>
                <AccordionItem className="border-b">
                  <AccordionTrigger className="py-6 text-base font-medium hover:no-underline sm:text-lg">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="pb-6 text-base leading-relaxed text-foreground/65">
                    <p>{faq.a}</p>
                  </AccordionContent>
                </AccordionItem>
              </motion.div>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}

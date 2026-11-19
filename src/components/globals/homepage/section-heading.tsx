import * as motion from "motion/react-client";
import { cn } from "cn";
import { fadeUp, inViewOnce, stagger } from "./motion-presets";

type SectionHeadingProps = {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  tone?: "light" | "dark";
  className?: string;
};

export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  align = "left",
  tone = "light",
  className,
}: SectionHeadingProps) {
  return (
    <motion.div
      variants={stagger(0.08)}
      initial="hidden"
      whileInView="visible"
      viewport={inViewOnce}
      className={cn(
        "max-w-2xl",
        align === "center" && "mx-auto text-center",
        className,
      )}
    >
      <motion.p
        variants={fadeUp}
        className={cn(
          "mb-4 inline-flex items-center gap-2 text-sm font-medium",
          tone === "dark" ? "text-background/70" : "text-foreground/65",
        )}
      >
        <span className="size-1.5 bg-primary" />
        {eyebrow}
      </motion.p>
      <motion.h2
        id={id}
        variants={fadeUp}
        className="text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.02] font-semibold tracking-tighter text-balance"
      >
        {title}
      </motion.h2>
      {description && (
        <motion.p
          variants={fadeUp}
          className={cn(
            "mt-5 text-base leading-relaxed text-pretty sm:text-lg",
            tone === "dark" ? "text-background/70" : "text-foreground/65",
          )}
        >
          {description}
        </motion.p>
      )}
    </motion.div>
  );
}

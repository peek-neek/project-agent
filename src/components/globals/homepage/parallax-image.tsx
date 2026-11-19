"use client";

import Image from "next/image";
import { motion, useScroll, useTransform } from "motion/react";
import { cn } from "cn";
import { useRef } from "react";

type ParallaxImageProps = {
  src: string;
  alt: string;
  className?: string;
  preload?: boolean;
  sizes?: string;
  children?: React.ReactNode;
};

export function ParallaxImage({
  src,
  alt,
  className,
  preload,
  sizes = "100vw",
  children,
}: ParallaxImageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);

  return (
    <div ref={ref} className={cn("relative overflow-hidden", className)}>
      <motion.div
        style={{ y }}
        className="absolute inset-0 -top-[10%] h-[120%]"
      >
        <Image
          src={src}
          alt={alt}
          fill
          preload={preload}
          sizes={sizes}
          className="object-cover"
        />
      </motion.div>
      {children}
    </div>
  );
}

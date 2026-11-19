import { cn } from "cn";

type Line = { text: string; className?: string };

type SplitHeadingProps = {
  lines: Line[];
  as?: "h1" | "h2";
  className?: string;
  delay?: number;
  step?: number;
};

export function SplitHeading({
  lines,
  as: Tag = "h1",
  className,
  delay = 0.1,
  step = 0.022,
}: SplitHeadingProps) {
  let index = 0;

  return (
    <Tag aria-label={lines.map((l) => l.text).join(" ")} className={className}>
      {lines.map((line, li) => (
        <span key={li} aria-hidden className={cn("block", line.className)}>
          {line.text.split(" ").map((word, wi, words) => (
            <span key={wi}>
              <span className="inline-block whitespace-nowrap">
                {Array.from(word).map((char, ci) => (
                  <span
                    key={ci}
                    className="inline-block origin-bottom-left animate-char-in motion-reduce:animate-none"
                    style={{ animationDelay: `${delay + index++ * step}s` }}
                  >
                    {char}
                  </span>
                ))}
              </span>
              {wi < words.length - 1 ? " " : null}
            </span>
          ))}
        </span>
      ))}
    </Tag>
  );
}

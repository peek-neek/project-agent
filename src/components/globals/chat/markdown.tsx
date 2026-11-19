"use client";

import { cn } from "cn";
import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/** Chat-sized Markdown: lists, tables and links styled for the app. */
const components: Components = {
  p: ({ className, ...props }) => (
    <p
      className={cn("leading-relaxed [&:not(:first-child)]:mt-3", className)}
      {...props}
    />
  ),
  ul: ({ className, ...props }) => (
    <ul
      className={cn(
        "mt-2 list-disc space-y-1 pl-5 marker:text-foreground/35",
        className,
      )}
      {...props}
    />
  ),
  ol: ({ className, ...props }) => (
    <ol
      className={cn(
        "mt-2 list-decimal space-y-1 pl-5 marker:text-foreground/45",
        className,
      )}
      {...props}
    />
  ),
  li: ({ className, ...props }) => (
    <li className={cn("pl-0.5 leading-relaxed", className)} {...props} />
  ),
  strong: ({ className, ...props }) => (
    <strong
      className={cn("font-semibold text-foreground", className)}
      {...props}
    />
  ),
  a: ({ className, ...props }) => (
    <a
      className={cn(
        "font-medium text-primary underline underline-offset-2 hover:text-primary/80",
        className,
      )}
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  ),
  h1: ({ className, ...props }) => (
    <h3
      className={cn("mt-4 text-base font-semibold first:mt-0", className)}
      {...props}
    />
  ),
  h2: ({ className, ...props }) => (
    <h3
      className={cn("mt-4 text-base font-semibold first:mt-0", className)}
      {...props}
    />
  ),
  h3: ({ className, ...props }) => (
    <h4
      className={cn("mt-3 text-sm font-semibold first:mt-0", className)}
      {...props}
    />
  ),
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={cn(
        "mt-3 border-l-[3px] border-primary bg-muted/50 py-1.5 pr-2 pl-3 text-foreground/80",
        className,
      )}
      {...props}
    />
  ),
  hr: () => <hr className="my-4 border-border" />,
  code: ({ className, ...props }) => (
    <code
      className={cn("bg-muted px-1 py-0.5 font-mono text-[0.85em]", className)}
      {...props}
    />
  ),
  pre: ({ className, ...props }) => (
    <pre
      className={cn(
        "mt-3 overflow-x-auto bg-muted p-3 text-xs [&_code]:bg-transparent [&_code]:p-0",
        className,
      )}
      {...props}
    />
  ),
  table: ({ className, ...props }) => (
    <div className="mt-3 overflow-x-auto">
      <table
        className={cn("w-full border-collapse text-left text-sm", className)}
        {...props}
      />
    </div>
  ),
  th: ({ className, ...props }) => (
    <th
      className={cn(
        "border-b px-2 py-1.5 text-xs font-semibold text-foreground/60",
        className,
      )}
      {...props}
    />
  ),
  td: ({ className, ...props }) => (
    <td
      className={cn("border-b px-2 py-1.5 align-top tabular-nums", className)}
      {...props}
    />
  ),
};

export const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <div className="text-sm text-foreground/90">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
});

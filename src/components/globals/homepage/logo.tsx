import Link from "next/link";
import { cn } from "cn";
import { site } from "./content";

export function Logo({
  className,
  href = "/",
}: {
  className?: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={`${site.name} home`}
      className={cn(
        "inline-flex items-center gap-2 font-semibold tracking-tight",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" aria-hidden className="size-6 text-primary">
        <path
          fill="currentColor"
          d="M12 2 3 8v14h6v-7h6v7h6V8l-9-6Zm0 3.2 6 4V19h-1v-6.5H7V19H6V9.2l6-4Z"
        />
      </svg>
      <span className="text-lg">{site.name}</span>
    </Link>
  );
}

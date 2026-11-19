"use client";

import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { AlertCircleIcon, RotateCwIcon } from "lucide-react";
import { cn } from "cn";
import { Suspense } from "react";
import { ErrorBoundary, getErrorMessage } from "react-error-boundary";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Loading + error states for anything that suspends on a query
 * (`useSuspenseQuery`, or server components streaming a prefetch):
 *
 *   QueryErrorResetBoundary → ErrorBoundary → Suspense → children
 *
 * "Try again" resets both the error boundary and the failed queries, so they
 * refetch instead of re-throwing the cached error.
 */
export function QueryBoundary({
  fallback,
  errorTitle = "Something went wrong",
  variant = "section",
  className,
  children,
}: {
  /** Shown while loading (usually a skeleton). */
  fallback: React.ReactNode;
  errorTitle?: string;
  /** `compact` for tight spaces such as the sidebar. */
  variant?: "section" | "compact";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallbackRender={({ error, resetErrorBoundary }) => (
            <QueryErrorFallback
              title={errorTitle}
              error={error}
              variant={variant}
              className={className}
              onRetry={resetErrorBoundary}
            />
          )}
        >
          <Suspense fallback={fallback}>{children}</Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}

function QueryErrorFallback({
  title,
  error,
  variant,
  className,
  onRetry,
}: {
  title: string;
  error: unknown;
  variant: "section" | "compact";
  className?: string;
  onRetry: () => void;
}) {
  // Server errors are redacted in production; show details only in dev.
  const detail =
    process.env.NODE_ENV === "development" ? getErrorMessage(error) : null;

  if (variant === "compact") {
    return (
      <div
        role="alert"
        className={cn("space-y-2 px-4 py-3 text-sm", className)}
      >
        <p className="flex items-center gap-2 text-foreground/70">
          <AlertCircleIcon aria-hidden className="size-4 text-destructive" />
          {title}
        </p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCwIcon data-icon="inline-start" />
          Try again
        </Button>
      </div>
    );
  }

  return (
    <Alert
      className={cn(
        "mx-auto max-w-[8.5in] border-foreground/15 bg-card print:hidden",
        className,
      )}
    >
      <AlertCircleIcon className="text-destructive" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="text-foreground/65">
        Check your connection and try again. If it keeps happening, refresh the
        page.
        {detail && (
          <code className="mt-2 block text-xs break-words text-foreground/55">
            {detail}
          </code>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="mt-3 w-fit"
        >
          <RotateCwIcon data-icon="inline-start" />
          Try again
        </Button>
      </AlertDescription>
    </Alert>
  );
}

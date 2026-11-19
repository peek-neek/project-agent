import { Skeleton } from "@/components/ui/skeleton";
import { LoadingSignal } from "@/components/globals/top-progress";

/** Mirrors PropertyChat: property bar, suggestions, composer. */
export function ChatSkeleton() {
  return (
    <div
      className="flex h-[calc(100svh-3.5rem)] flex-col"
      aria-busy="true"
      aria-label="Loading chat"
    >
      <LoadingSignal />
      <div className="flex h-11 shrink-0 items-center gap-2 border-b px-4 sm:px-6">
        <Skeleton className="size-4" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="ml-auto h-7 w-24" />
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-16 sm:px-6">
          <Skeleton className="size-11" />
          <Skeleton className="mt-4 h-6 w-72" />
          <Skeleton className="mt-2 h-4 w-96 max-w-full" />
          <div className="mt-8 grid w-full gap-5 md:grid-cols-3">
            {[0, 1, 2].map((g) => (
              <div key={g} className="space-y-1.5">
                <Skeleton className="mb-2 h-3 w-28" />
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="shrink-0 border-t px-4 py-3 sm:px-6">
        <Skeleton className="mx-auto h-[5.25rem] w-full max-w-3xl" />
      </div>
    </div>
  );
}

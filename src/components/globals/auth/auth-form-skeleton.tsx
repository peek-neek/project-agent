import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function AuthFormSkeleton() {
  return (
    <Card className="w-full max-w-[25rem] bg-transparent ring-0 [--card-spacing:--spacing(8)]">
      <CardContent className="space-y-4">
        <Skeleton className="mx-auto h-5 w-48" />
        <Skeleton className="mx-auto h-4 w-56" />
        <Skeleton className="mt-6 h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </CardContent>
    </Card>
  );
}

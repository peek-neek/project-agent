"use client";

import { LocateFixedIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useUserLocation } from "@/components/globals/location/location-provider";

export function LocationBanner({ className }: { className?: string }) {
  const { status, bannerVisible, requestLocation, dismissBanner } =
    useUserLocation();

  if (!bannerVisible) return null;
  const blocked = status === "denied";
  const message = blocked
    ? "Location is blocked in your browser settings."
    : "Use your location for nearby suggestions.";

  return (
    <Alert
      role="status"
      className={cn(
        "flex items-center gap-2.5 border-0 bg-muted py-1.5 pr-1.5 pl-3.5 *:[svg]:translate-y-0",
        className,
      )}
    >
      <LocateFixedIcon aria-hidden className="size-4 shrink-0 text-primary" />
      <AlertDescription
        title={message}
        className="min-w-0 flex-1 truncate text-xs text-foreground/80 sm:text-sm"
      >
        {message}
      </AlertDescription>
      {!blocked && (
        <Button
          size="xs"
          onClick={requestLocation}
          className="h-7 shrink-0 px-3"
        >
          Allow
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Dismiss location message"
        onClick={dismissBanner}
        className="size-7 shrink-0 text-foreground/60 hover:bg-background hover:text-foreground"
      >
        <XIcon />
      </Button>
    </Alert>
  );
}

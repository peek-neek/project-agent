"use client";

import { useTravelMode } from "@/components/globals/travel-mode";
import { Autocomplete } from "@base-ui/react/autocomplete";
import { ArrowUpIcon, MapPinIcon } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "cn";
import { useId, useRef, useState } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LocationBanner } from "./location-banner";
import { useUserLocation } from "@/components/globals/location/location-provider";
import {
  type AddressSuggestion,
  formatDistance,
  MIN_QUERY_LENGTH,
  suggestionLabel,
  useAddressSuggestions,
} from "./use-address-suggestions";

const modes = [
  {
    id: "single",
    label: "Single address",
    placeholder: "Enter a property address",
  },
  {
    id: "compare",
    label: "Compare",
    placeholder: "Up to 3 addresses, separated by semicolons",
  },
  {
    id: "bulk",
    label: "Bulk",
    placeholder: "Paste addresses, separated by semicolons",
  },
] as const;

type Mode = (typeof modes)[number]["id"];

type AddressSearchProps = {
  className?: string;
  showExamples?: boolean;
  align?: "start" | "center";
};

export function AddressSearch({ className }: AddressSearchProps) {
  const id = useId();
  const anchorRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>("single");
  const [address, setAddress] = useState("");
  const [open, setOpen] = useState(false);
  const [placeId, setPlaceId] = useState("");
  const [pickedSessionToken, setPickedSessionToken] = useState("");
  const [sessionToken, setSessionToken] = useState<string>();
  const { coords } = useUserLocation();
  // The AI copy's travel times follow the app-wide walk / bike / car choice.
  const { mode: travelMode } = useTravelMode();
  const active = modes.find((m) => m.id === mode)!;
  const suggestionsOpen = open && mode === "single";
  const { suggestions, status } = useAddressSuggestions(address, {
    near: coords,
    sessionToken,
    enabled: suggestionsOpen,
  });

  const heading = {
    idle: `Type at least ${MIN_QUERY_LENGTH} characters to see suggestions`,
    loading: "Searching addresses…",
    limited: "Suggestions paused",
    error: "Suggestions unavailable",
    ready: coords ? "Suggested addresses near you" : "Suggested addresses",
  }[status];

  const emptyMessage =
    status === "limited"
      ? "You've searched a lot in a short time. Suggestions will be back shortly; press Enter to search anyway."
      : status === "error"
        ? "We couldn't load suggestions. Press Enter to search for this address anyway."
        : status === "ready"
          ? "No matching addresses. Press Enter to search for it anyway."
          : null;

  return (
    <div className={cn("w-full", className)}>
      <form
        action="/reports/new"
        method="get"
        role="search"
        aria-label="Generate a property report"
      >
        <ToggleGroup
          aria-label="Report mode"
          spacing={1}
          value={[mode]}
          onValueChange={(value) => {
            const next = value[0] as Mode | undefined;
            if (next) setMode(next);
          }}
          className="relative z-10 bg-card p-1.5 pb-0"
        >
          {modes.map((m) => (
            <ToggleGroupItem
              key={m.id}
              value={m.id}
              className="relative h-auto px-3.5 py-2 text-xs text-foreground/65 hover:bg-transparent hover:text-foreground aria-pressed:bg-transparent aria-pressed:text-foreground sm:px-4 sm:text-sm"
            >
              {m.id === mode && (
                <motion.span
                  layoutId={`${id}-mode`}
                  transition={{
                    type: "spring",
                    bounce: 0.2,
                    visualDuration: 0.35,
                  }}
                  className="absolute inset-x-2 bottom-0 h-0.5 bg-primary"
                />
              )}
              {m.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <div
          ref={anchorRef}
          className="-mt-px bg-card p-2 shadow-[0_24px_60px_-20px_oklch(0.2_0_0/0.35)] sm:p-2.5"
        >
          <Autocomplete.Root<AddressSuggestion>
            items={suggestions}
            filter={null}
            value={address}
            onValueChange={(value, details) => {
              setAddress(value);
              if (details.reason === "item-press") {
                const picked = suggestions.find(
                  (s) => suggestionLabel(s) === value,
                );
                setPlaceId(picked?.id ?? "");
                // Place Details reuses this token to close the billing session.
                setPickedSessionToken(sessionToken ?? "");
                setSessionToken(undefined);
              } else {
                setPlaceId("");
                setPickedSessionToken("");
              }
            }}
            open={suggestionsOpen}
            onOpenChange={(next) => {
              setOpen(next);
              if (next) setSessionToken((t) => t ?? crypto.randomUUID());
            }}
            itemToStringValue={suggestionLabel}
            openOnInputClick
          >
            <Label htmlFor={`${id}-address`} className="sr-only">
              Property address
            </Label>
            <InputGroup className="h-auto border-0 bg-card has-[[data-slot=input-group-control]:focus-visible]:ring-0">
              <InputGroupAddon className="pl-4 sm:pl-5">
                <MapPinIcon aria-hidden className="size-5 text-primary" />
              </InputGroupAddon>
              <Autocomplete.Input
                id={`${id}-address`}
                name="address"
                required
                autoComplete="off"
                placeholder={active.placeholder}
                render={
                  <InputGroupInput className="h-14 text-base placeholder:text-foreground/50 sm:h-16 md:text-base" />
                }
              />
              <input type="hidden" name="mode" value={mode} />
              <input type="hidden" name="travelMode" value={travelMode} />
              {placeId && (
                <input type="hidden" name="placeId" value={placeId} />
              )}
              {placeId && pickedSessionToken && (
                <input
                  type="hidden"
                  name="sessionToken"
                  value={pickedSessionToken}
                />
              )}
              <InputGroupAddon align="inline-end" className="pr-2">
                <InputGroupButton
                  type="submit"
                  variant="default"
                  size="icon-sm"
                  aria-label="Generate report"
                  className="size-11 shadow-lg transition-transform hover:scale-105 active:scale-95 sm:size-12"
                >
                  <ArrowUpIcon className="size-5" />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>

            <Autocomplete.Portal>
              <Autocomplete.Positioner
                anchor={anchorRef}
                side="bottom"
                sideOffset={0}
                collisionAvoidance={{ side: "none" }}
                className="isolate z-50"
              >
                <Autocomplete.Popup className="flex max-h-[calc(var(--available-height)-0.75rem)] w-(--anchor-width) max-w-(--available-width) flex-col overflow-hidden bg-card text-card-foreground transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0">
                  {/* <Separator className="mx-4 w-auto data-horizontal:w-auto sm:mx-5" /> */}
                  <LocationBanner className="mx-2 mt-2 w-auto shrink-0" />
                  <p
                    aria-live="polite"
                    className={cn(
                      "flex shrink-0 items-center gap-2 px-5 pt-3.5 text-xs font-medium text-foreground/65",
                      status === "idle" ? "pb-4" : "pb-1",
                    )}
                  >
                    {status === "loading" && <Spinner className="size-3.5" />}
                    {heading}
                  </p>
                  <Autocomplete.Empty className="px-5 pt-1 pb-5 text-sm text-foreground/65 empty:hidden">
                    {emptyMessage}
                  </Autocomplete.Empty>
                  <Autocomplete.List className="min-h-0 flex-1 scroll-py-2 overflow-y-auto overscroll-contain p-2 pt-1 data-empty:hidden">
                    {(item: AddressSuggestion) => (
                      <Autocomplete.Item
                        key={item.id}
                        value={item}
                        className="flex cursor-default items-center gap-3 px-3 py-2 outline-none select-none data-highlighted:bg-muted"
                      >
                        <span className="grid size-8 shrink-0 place-items-center bg-muted text-foreground/70">
                          <MapPinIcon aria-hidden className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium sm:text-base">
                            {item.primary}
                          </span>
                          <span className="block truncate text-xs text-foreground/65 sm:text-sm">
                            {item.secondary}
                          </span>
                        </span>
                        {item.distanceMeters ? (
                          <span className="shrink-0 text-xs text-foreground/65 tabular-nums">
                            {formatDistance(item.distanceMeters)}
                          </span>
                        ) : null}
                      </Autocomplete.Item>
                    )}
                  </Autocomplete.List>
                  {suggestions.length > 0 && (
                    <p
                      translate="no"
                      className="shrink-0 px-5 pt-1 pb-3 text-right text-[11px] text-foreground/50"
                    >
                      Google Maps
                    </p>
                  )}
                </Autocomplete.Popup>
              </Autocomplete.Positioner>
            </Autocomplete.Portal>
          </Autocomplete.Root>
        </div>
      </form>

      {/* {showExamples && (
        <div
          aria-label="Example addresses"
          className={cn(
            "mt-4 flex flex-wrap gap-2",
            align === "center" && "justify-center",
          )}
        >
          {exampleAddresses.map((example) => (
            <Button
              key={example}
              variant="outline"
              size="sm"
              onClick={() => setAddress(example)}
              className="bg-card/85 px-3.5 font-normal backdrop-blur-md hover:bg-card"
            >
              {example}
            </Button>
          ))}
        </div>
      )} */}
    </div>
  );
}

"use client";

import { useTravelMode } from "@/components/globals/travel-mode";
import { Autocomplete } from "@base-ui/react/autocomplete";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import {
  AlertCircleIcon,
  ArrowLeftRightIcon,
  ArrowUpIcon,
  MapPinIcon,
  MapPinnedIcon,
  XIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "cn";
import { type RefObject, useEffect, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type {
  AddressCandidate,
  AddressResolution,
} from "@/server/google-places";
import { useTRPC } from "@/trpc/client";
import { startNavigationProgress } from "@/components/globals/top-progress";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Label } from "@/components/ui/label";
import {
  SideChip,
  type Side,
} from "@/components/globals/compare/compare-shared";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LocationBanner } from "./location-banner";
import { PinDropDialog } from "./pin-drop-dialog";
import {
  type Gate,
  ReportGateDialog,
  takePendingAddress,
} from "@/components/globals/dashboard/report-gate-dialog";
import type { LatLng } from "./pin-map";
import {
  type Coords,
  useUserLocation,
} from "@/components/globals/location/location-provider";
import {
  type AddressSuggestion,
  formatDistance,
  MIN_QUERY_LENGTH,
  type SuggestionStatus,
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
    placeholder: "First property address",
  },
  // {
  //   id: "bulk",
  //   label: "Bulk",
  //   placeholder: "Paste addresses, separated by semicolons",
  // },
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
  // Set on submit until the report page loads (the browser navigates away).
  const [submitting, setSubmitting] = useState(false);
  // Back button restores this page from cache: make it usable again.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) setSubmitting(false);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);
  const [address, setAddress] = useState("");
  // Compare mode: property A and B, each with the suggestion picked (if any).
  const [compare, setCompare] = useState<[ComparePick, ComparePick]>([
    EMPTY_PICK,
    EMPTY_PICK,
  ]);
  const [swaps, setSwaps] = useState(0);
  const [first, second] = compare;
  const sameProperty =
    first.address.trim() !== "" &&
    (first.address.trim().toLowerCase() ===
      second.address.trim().toLowerCase() ||
      (first.placeId !== "" && first.placeId === second.placeId));
  const [showSame, setShowSame] = useState(false);
  const submitAddress =
    mode === "compare"
      ? first.address.trim() && second.address.trim()
        ? first.address.trim()
        : ""
      : address.trim();
  const [open, setOpen] = useState(false);
  const [placeId, setPlaceId] = useState("");
  const [pickedSessionToken, setPickedSessionToken] = useState("");
  const [sessionToken, setSessionToken] = useState<string>();
  // Typed addresses (no suggestion picked) are checked before a report is
  // made: the result decides between going ahead, "Did you mean…?" and a pin.
  const trpc = useTRPC();
  const resolve = useMutation(trpc.places.resolve.mutationOptions());
  // Plan and allowance, for gating before anything runs (the server checks
  // again). Signed-out visitors on the landing page skip this: submitting
  // takes them to sign in first.
  const { isSignedIn } = useAuth();
  const { data: billing } = useQuery({
    ...trpc.billing.status.queryOptions(),
    enabled: Boolean(isSignedIn),
    staleTime: 0,
    refetchOnMount: "always",
    retry: false,
  });
  const [gate, setGate] = useState<Gate | null>(null);
  // Set for one submit after the agent agreed to spend an extra report.
  const creditConfirmed = useRef(false);
  // Nothing left (plan or free Basic report, and no extra reports): the
  // button dims, and submitting explains the options.
  const outOfReports = billing?.blocked === true;
  // Back from Stripe Checkout: put the address they'd typed back in the box.
  // Read after mount (sessionStorage doesn't exist during server rendering,
  // so a lazy initial state would mismatch on hydration).
  useEffect(() => {
    const pending = takePendingAddress();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from browser storage
    if (pending) setAddress(pending);
  }, []);
  const [resolution, setResolution] = useState<
    AddressResolution | { outcome: "error"; message: string } | null
  >(null);
  const [pin, setPin] = useState<LatLng | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinKey, setPinKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  // Set for one submit when the agent chose "Create anyway".
  const skipCheck = useRef(false);
  const { coords } = useUserLocation();
  // The AI copy's travel times follow the app-wide walk / car choice.
  const { mode: travelMode } = useTravelMode();
  const active = modes.find((m) => m.id === mode)!;
  const suggestionsOpen = open && mode === "single";
  const { suggestions, status } = useAddressSuggestions(address, {
    near: coords,
    sessionToken,
    enabled: suggestionsOpen,
  });

  /** Fills the form with the confirmed address and submits it. */
  const submitWith = (next: {
    address?: string;
    placeId?: string;
    pin?: LatLng;
  }) => {
    flushSync(() => {
      if (next.address) setAddress(next.address);
      setPlaceId(next.placeId ?? "");
      setPickedSessionToken("");
      setPin(next.pin ?? null);
      setResolution(null);
      setPinOpen(false);
    });
    formRef.current?.requestSubmit();
  };

  const openPin = () => {
    setPinKey((k) => k + 1);
    setPinOpen(true);
  };
  // Open the map near what was found (a street or town), else near the agent.
  const near =
    resolution && "candidates" in resolution
      ? resolution.candidates.find((c) => c.lat != null && c.lng != null)
      : undefined;
  const pinStart =
    near && resolution?.outcome !== "outside"
      ? { center: { lat: near.lat!, lng: near.lng! }, zoom: 15 }
      : coords
        ? { center: { lat: coords.lat, lng: coords.lng }, zoom: 13 }
        : null;
  const checking = resolve.isPending;
  const busy = submitting || checking;

  const submitControl = (
    <InputGroupButton
      type="submit"
      variant="default"
      size="icon-sm"
      aria-label={
        checking
          ? "Checking address…"
          : submitting
            ? "Creating report…"
            : outOfReports
              ? "No reports left: choose a plan or buy an extra report"
              : "Generate report"
      }
      aria-disabled={busy || outOfReports}
      className={cn(
        "size-11 shadow-lg transition-transform sm:size-12",
        busy
          ? "pointer-events-none"
          : outOfReports
            ? "opacity-40 shadow-none"
            : "hover:scale-105 active:scale-95",
      )}
    >
      {busy ? (
        <Spinner className="size-5" />
      ) : (
        <ArrowUpIcon className="size-5" />
      )}
    </InputGroupButton>
  );

  return (
    <div className={cn("w-full", className)}>
      <form
        ref={formRef}
        action={mode === "compare" ? "/compare/new" : "/reports/new"}
        method="get"
        role="search"
        aria-label="Generate a property report"
        aria-busy={busy}
        onSubmit={(e) => {
          // One report per submit: ignore repeats while it's being created.
          if (busy || !submitAddress) {
            e.preventDefault();
            return;
          }
          if (mode === "compare" && sameProperty) {
            e.preventDefault();
            setShowSame(true);
            return;
          }
          // Plan gates come first, before the (paid) address lookup.
          if (billing) {
            const next: Gate | null = billing.blocked
              ? "limit"
              : billing.usesCredit && !creditConfirmed.current
                ? "credit"
                : null;
            if (next) {
              e.preventDefault();
              setOpen(false);
              setGate(next);
              return;
            }
          }
          const unchecked =
            mode === "single" && !placeId && !pin && !skipCheck.current;
          skipCheck.current = false;
          if (unchecked) {
            e.preventDefault();
            setOpen(false);
            setResolution(null);
            resolve.mutate(
              { address: address.trim() },
              {
                onSuccess: (result) => {
                  if (result.outcome === "exact") {
                    const [match] = result.candidates;
                    submitWith({
                      placeId: match.placeId,
                      address: match.formattedAddress,
                    });
                  } else {
                    setResolution(result);
                  }
                },
                onError: (error) =>
                  setResolution({
                    outcome: "error",
                    message:
                      error instanceof TRPCClientError &&
                      error.data?.code === "TOO_MANY_REQUESTS"
                        ? error.message
                        : "We couldn't check this address right now.",
                  }),
              },
            );
            return;
          }
          setSubmitting(true);
          startNavigationProgress();
        }}
      >
        <ToggleGroup
          aria-label="Report mode"
          spacing={1}
          value={[mode]}
          onValueChange={(value) => {
            const next = value[0] as Mode | undefined;
            if (!next) return;
            // Carry a typed address over as the first property to compare.
            if (next === "compare" && !first.address.trim()) {
              setCompare(([, b]) => [
                {
                  address,
                  placeId,
                  sessionToken: placeId ? pickedSessionToken : "",
                },
                b,
              ]);
            }
            setResolution(null);
            setMode(next);
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

        <input type="hidden" name="mode" value={mode} />
        <input type="hidden" name="travelMode" value={travelMode} />

        <div
          ref={anchorRef}
          className="-mt-px bg-card p-2 shadow-[0_24px_60px_-20px_oklch(0.2_0_0/0.35)] sm:p-2.5"
        >
          {mode === "compare" ? (
            // Two equal address columns with the swap between them and the
            // submit button in its own column, so neither box loses width to
            // it. On phones A spans the row; B shares its row with the button.
            <div className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]">
              {/* A in the usual report fields, B in their compare twins. */}
              <CompareHiddenFields pick={first} prefix="" />
              <CompareHiddenFields pick={second} prefix="compare" />
              <CompareAddressField
                id={`${id}-compare-first`}
                className="col-span-2 sm:col-span-1"
                side="a"
                label="First property address"
                placeholder={active.placeholder}
                value={first.address}
                onPick={(pick) => {
                  setShowSame(false);
                  setCompare(([, b]) => [pick, b]);
                }}
                near={coords}
              />
              {/* No divider line: the fields are separate filled boxes. */}
              <div className="relative z-10 col-span-2 flex h-px shrink-0 items-center justify-center sm:col-span-1 sm:h-auto sm:px-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Swap addresses"
                  onClick={() => {
                    setCompare(([a, b]) => [b, a]);
                    setSwaps((n) => n + 1);
                  }}
                  // Solid in dark mode too (outline's dark background is
                  // translucent), so nothing behind it shows through.
                  className="relative rounded-full bg-card shadow-sm hover:bg-muted dark:bg-card dark:hover:bg-muted"
                >
                  <motion.span
                    animate={{ rotate: swaps * 180 }}
                    transition={{
                      type: "spring",
                      bounce: 0.2,
                      visualDuration: 0.35,
                    }}
                    className="grid place-items-center"
                  >
                    <ArrowLeftRightIcon className="rotate-90 sm:rotate-0" />
                  </motion.span>
                </Button>
              </div>
              <CompareAddressField
                id={`${id}-compare-second`}
                side="b"
                label="Second property address"
                placeholder="Second property address"
                value={second.address}
                onPick={(pick) => {
                  setShowSame(false);
                  setCompare(([a]) => [a, pick]);
                }}
                near={coords}
              />
              <div className="flex items-center pr-2 pl-3">{submitControl}</div>
            </div>
          ) : (
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
                // Editing the address drops any earlier check or pin.
                setResolution(null);
                setPin(null);
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
                {placeId && (
                  <input type="hidden" name="placeId" value={placeId} />
                )}
                {pin && (
                  <>
                    <input
                      type="hidden"
                      name="lat"
                      value={pin.lat.toFixed(6)}
                    />
                    <input
                      type="hidden"
                      name="lng"
                      value={pin.lng.toFixed(6)}
                    />
                  </>
                )}
                {placeId && pickedSessionToken && (
                  <input
                    type="hidden"
                    name="sessionToken"
                    value={pickedSessionToken}
                  />
                )}
                <InputGroupAddon align="inline-end" className="pr-2">
                  {submitControl}
                </InputGroupAddon>
              </InputGroup>

              <SuggestionsPopup
                anchorRef={anchorRef}
                suggestions={suggestions}
                status={status}
                nearby={Boolean(coords)}
              />
            </Autocomplete.Root>
          )}
        </div>
      </form>

      {mode === "compare" && showSame && sameProperty && (
        <p
          role="alert"
          className="mt-2 bg-card px-4 py-3 text-sm text-destructive"
        >
          These are the same property. Pick two different addresses to compare.
        </p>
      )}

      <ReportGateDialog
        gate={gate}
        status={billing}
        address={mode === "compare" ? "" : address.trim()}
        onClose={() => setGate(null)}
        onConfirmCredit={() => {
          creditConfirmed.current = true;
          setGate(null);
          formRef.current?.requestSubmit();
        }}
      />

      {resolution && (
        <AddressCheckPanel
          resolution={resolution}
          onPick={(c) =>
            submitWith({ placeId: c.placeId, address: c.formattedAddress })
          }
          onPin={openPin}
          onCreateAnyway={() => {
            skipCheck.current = true;
            submitWith({});
          }}
          onDismiss={() => setResolution(null)}
        />
      )}

      <PinDropDialog
        key={pinKey}
        open={pinOpen}
        onOpenChange={setPinOpen}
        address={address.trim()}
        start={pinStart}
        onConfirm={(p, label) => submitWith({ address: label, pin: p })}
      />

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

/** The address suggestions dropdown, shown under `anchorRef`. */
function SuggestionsPopup({
  anchorRef,
  suggestions,
  status,
  nearby,
}: {
  anchorRef: RefObject<HTMLDivElement | null>;
  suggestions: AddressSuggestion[];
  status: SuggestionStatus;
  nearby: boolean;
}) {
  const heading = {
    idle: `Type at least ${MIN_QUERY_LENGTH} characters to see suggestions`,
    loading: "Searching addresses…",
    limited: "Suggestions paused",
    error: "Suggestions unavailable",
    ready: nearby ? "Suggested addresses near you" : "Suggested addresses",
  }[status];

  const emptyMessage =
    status === "limited"
      ? "You've searched a lot in a short time. Suggestions will be back shortly; press Enter to search anyway."
      : status === "error"
        ? "We couldn't load suggestions. Press Enter to search for this address anyway."
        : status === "ready"
          ? "No suggestions. Press Enter and we'll look it up."
          : null;

  return (
    <Autocomplete.Portal>
      <Autocomplete.Positioner
        anchor={anchorRef}
        side="bottom"
        sideOffset={0}
        collisionAvoidance={{ side: "none" }}
        className="isolate z-50"
      >
        <Autocomplete.Popup className="flex max-h-[calc(var(--available-height)-0.75rem)] w-(--anchor-width) max-w-(--available-width) flex-col overflow-hidden bg-card text-card-foreground transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0">
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
  );
}

type ComparePick = { address: string; placeId: string; sessionToken: string };
const EMPTY_PICK: ComparePick = { address: "", placeId: "", sessionToken: "" };

/**
 * One property's hidden form fields in compare mode: `address`, `placeId`
 * and `sessionToken`, or with `prefix="compare"` their compare twins.
 */
function CompareHiddenFields({
  pick,
  prefix,
}: {
  pick: ComparePick;
  prefix: "" | "compare";
}) {
  const name = (field: "address" | "placeId" | "sessionToken") =>
    prefix ? `${prefix}${field[0].toUpperCase()}${field.slice(1)}` : field;
  return (
    <>
      <input type="hidden" name={name("address")} value={pick.address.trim()} />
      {pick.placeId && (
        <input type="hidden" name={name("placeId")} value={pick.placeId} />
      )}
      {pick.placeId && pick.sessionToken && (
        <input
          type="hidden"
          name={name("sessionToken")}
          value={pick.sessionToken}
        />
      )}
    </>
  );
}

/** One of the two address boxes in compare mode, with its own suggestions. */
function CompareAddressField({
  id,
  className,
  side,
  label,
  placeholder,
  value,
  onPick,
  near,
}: {
  id: string;
  className?: string;
  side: Side;
  label: string;
  placeholder: string;
  value: string;
  /** The typed address, plus the suggestion's place when one was picked. */
  onPick: (pick: ComparePick) => void;
  near: Coords | null;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [sessionToken, setSessionToken] = useState<string>();
  const { suggestions, status } = useAddressSuggestions(value, {
    near,
    sessionToken,
    enabled: open,
  });

  return (
    <div ref={anchorRef} className={cn("min-w-0", className)}>
      <Autocomplete.Root<AddressSuggestion>
        items={suggestions}
        filter={null}
        value={value}
        onValueChange={(next, details) => {
          if (details.reason === "item-press") {
            const picked = suggestions.find((s) => suggestionLabel(s) === next);
            // Place Details reuses the token to close the billing session;
            // a pick ends it, and typing again starts a new one.
            onPick({
              address: next,
              placeId: picked?.id ?? "",
              sessionToken: picked ? (sessionToken ?? "") : "",
            });
            setSessionToken(undefined);
          } else {
            onPick({ address: next, placeId: "", sessionToken: "" });
          }
        }}
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setSessionToken((t) => t ?? crypto.randomUUID());
        }}
        itemToStringValue={suggestionLabel}
        openOnInputClick
      >
        <Label htmlFor={id} className="sr-only">
          {label}
        </Label>
        <InputGroup className="h-auto border-0 bg-card has-[[data-slot=input-group-control]:focus-visible]:ring-0">
          {/* Same inset on both sides: each field is its own filled box. */}
          <InputGroupAddon className="pl-4 sm:pl-5">
            <SideChip side={side} className="size-6 text-xs" />
          </InputGroupAddon>
          <Autocomplete.Input
            id={id}
            required
            autoComplete="off"
            placeholder={placeholder}
            render={
              <InputGroupInput
                className="h-14 text-base placeholder:text-foreground/50 sm:h-16 md:text-base"
              />
            }
          />
        </InputGroup>
        <SuggestionsPopup
          anchorRef={anchorRef}
          suggestions={suggestions}
          status={status}
          nearby={Boolean(near)}
        />
      </Autocomplete.Root>
    </div>
  );
}

const CHECK_COPY = {
  choose: {
    title: "Did you mean one of these?",
    body: "Pick the property to create its report.",
  },
  imprecise: {
    title: "Add a street number",
    body: "We found the area but not a specific property. Add the street number, or drop a pin for a lot without one.",
  },
  outside: {
    title: "This address is outside Canada",
    body: "Reports cover Canadian properties only.",
  },
  none: {
    title: "We couldn't find this address",
    body: "Check the spelling and the town. For a new build or rural lot, drop a pin on the map instead.",
  },
} as const;

/**
 * Shown under the search box when a typed address isn't one clear match:
 * a "Did you mean…?" list, or a short reason with a way forward (a pin).
 */
function AddressCheckPanel({
  resolution,
  onPick,
  onPin,
  onCreateAnyway,
  onDismiss,
}: {
  resolution: AddressResolution | { outcome: "error"; message: string };
  onPick: (candidate: AddressCandidate) => void;
  onPin: () => void;
  onCreateAnyway: () => void;
  onDismiss: () => void;
}) {
  const { outcome } = resolution;
  const copy =
    outcome === "error"
      ? {
          title: resolution.message,
          body: "You can create the report anyway; we'll look the address up as it's built.",
        }
      : outcome === "exact"
        ? CHECK_COPY.choose
        : CHECK_COPY[outcome];
  const list =
    outcome === "choose" || outcome === "exact" ? resolution.candidates : [];
  const area =
    outcome === "imprecise" || outcome === "outside"
      ? resolution.candidates[0]
      : undefined;

  return (
    <section
      aria-live="polite"
      aria-label="Address check"
      className="mt-2 animate-in bg-card p-2 text-card-foreground shadow-[0_24px_60px_-20px_oklch(0.2_0_0/0.35)] duration-200 fade-in-0 slide-in-from-top-1 sm:p-2.5"
    >
      <div className="flex items-start gap-3 px-3 pt-2 pb-1">
        {list.length === 0 && (
          <AlertCircleIcon
            aria-hidden
            className={cn(
              "mt-0.5 size-4 shrink-0",
              outcome === "outside" ? "text-destructive" : "text-primary",
            )}
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{copy.title}</p>
          <p className="mt-0.5 text-sm text-foreground/65">
            {copy.body}
            {area && (
              <>
                {" "}
                Closest match:{" "}
                <span className="font-medium text-foreground">
                  {area.formattedAddress}
                </span>
                .
              </>
            )}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="-mt-1 -mr-2 shrink-0 text-foreground/60"
        >
          <XIcon />
        </Button>
      </div>

      {list.length > 0 && (
        <ItemGroup className="gap-0 p-1">
          {list.map((c) => (
            <Item
              key={c.placeId}
              size="sm"
              render={<button type="button" onClick={() => onPick(c)} />}
              className="cursor-pointer text-left hover:bg-muted focus-visible:bg-muted"
            >
              <ItemMedia className="size-8 bg-muted text-foreground/70">
                <MapPinIcon aria-hidden className="size-4" />
              </ItemMedia>
              <ItemContent className="min-w-0 gap-0">
                <ItemTitle className="text-sm sm:text-base">
                  {c.primary}
                </ItemTitle>
                <ItemDescription className="line-clamp-1 text-xs sm:text-sm">
                  {c.secondary}
                </ItemDescription>
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
      )}

      {outcome !== "outside" && (
        <div className="flex flex-wrap items-center justify-end gap-2 px-3 pt-2 pb-1.5">
          {outcome === "error" && (
            <Button variant="outline" size="sm" onClick={onCreateAnyway}>
              Create anyway
            </Button>
          )}
          <Button
            variant={outcome === "choose" ? "ghost" : "outline"}
            size="sm"
            onClick={onPin}
          >
            <MapPinnedIcon data-icon="inline-start" />
            {outcome === "choose"
              ? "Not listed? Drop a pin"
              : "Drop a pin on the map"}
          </Button>
        </div>
      )}
    </section>
  );
}

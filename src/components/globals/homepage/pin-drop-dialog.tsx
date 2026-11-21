"use client";

import { MapPinnedIcon, MousePointerClickIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { LatLng } from "./pin-map";

/** MapLibre needs WebGL: load the map only when the dialog opens. */
const PinMap = dynamic(() => import("./pin-map").then((m) => m.PinMap), {
  ssr: false,
  loading: () => <Skeleton className="size-full" />,
});

/** All of southern Canada, when there's nothing closer to start from. */
const CANADA_START = { center: { lat: 50.5, lng: -96 }, zoom: 3 };

const formatPin = ({ lat, lng }: LatLng) =>
  `${lat.toFixed(5)}° N, ${Math.abs(lng).toFixed(5)}° W`;

/**
 * For addresses Google can't place (new builds, rural lots, unregistered
 * streets): the agent clicks the property on a map and names it.
 */
export function PinDropDialog({
  open,
  onOpenChange,
  address,
  start,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What the agent typed; the report's title unless they change it. */
  address: string;
  /** Where to open the map: a nearby match, or the agent's location. */
  start?: { center: LatLng; zoom: number } | null;
  onConfirm: (pin: LatLng, label: string) => void;
}) {
  const [pin, setPin] = useState<LatLng | null>(null);
  const [label, setLabel] = useState(address);
  const view = start ?? CANADA_START;

  return (
    // The parent remounts this (new key) each time it opens, so the pin and
    // name start fresh from the latest typed address.
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-4 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPinnedIcon aria-hidden className="size-4 text-primary" />
            Drop a pin on the property
          </DialogTitle>
          <DialogDescription>
            For new builds, rural lots and addresses maps don&apos;t know yet.
            Click where the property is, then drag the pin to fine-tune.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          {open && (
            <PinMap
              center={view.center}
              zoom={view.zoom}
              pin={pin}
              onPinChange={setPin}
              className="h-[min(26rem,55vh)] w-full"
            />
          )}
          {!pin && (
            <span className="pointer-events-none absolute top-3 left-3 flex items-center gap-1.5 bg-card/95 px-2.5 py-1.5 text-xs font-medium shadow-sm backdrop-blur-sm">
              <MousePointerClickIcon aria-hidden className="size-3.5" />
              Click the map to place the pin
            </span>
          )}
        </div>

        <Field>
          <FieldLabel htmlFor="pin-label">Name for this property</FieldLabel>
          <Input
            id="pin-label"
            value={label}
            maxLength={500}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Lot 12, Concession 4, Township of King"
          />
          <FieldDescription>
            Shown as the report&apos;s address.{" "}
            {pin ? (
              <span className="tabular-nums">Pin: {formatPin(pin)}</span>
            ) : null}
          </FieldDescription>
        </Field>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!pin || label.trim().length < 3}
            onClick={() => pin && onConfirm(pin, label.trim())}
          >
            Create report here
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

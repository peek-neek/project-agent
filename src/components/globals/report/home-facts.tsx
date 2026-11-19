"use client";

import {
  BathIcon,
  BedDoubleIcon,
  DoorOpenIcon,
  HomeIcon,
  type LucideIcon,
  PencilIcon,
  PlusIcon,
  TagIcon,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { type ListingData } from "@/lib/report-sections";
import { EditListingDialog } from "./edit-listing-dialog";
import { formatPrice, type ReportData } from "./report-format";

function Fact({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li
      title={label}
      className="flex h-9 items-center gap-1.5 border bg-card px-2.5 text-sm font-medium tabular-nums"
    >
      <Icon aria-hidden className="size-4 text-foreground/50" />
      <span className="sr-only">{label}: </span>
      {children}
    </li>
  );
}

/** The agent's details about the home, as compact chips, with an editor. */
export function HomeFacts({
  report,
  listing,
  onSaved,
}: {
  report: ReportData;
  listing: ListingData | null;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const unit = report.property?.unitNumber;
  const facts = [
    listing?.propertyType && {
      icon: HomeIcon,
      label: "Type",
      value: listing.propertyType,
    },
    listing?.listPrice != null && {
      icon: TagIcon,
      label: "List price",
      value: formatPrice(listing.listPrice),
    },
    listing?.bedrooms != null && {
      icon: BedDoubleIcon,
      label: "Bedrooms",
      value: `${listing.bedrooms} bd`,
    },
    listing?.bathrooms != null && {
      icon: BathIcon,
      label: "Bathrooms",
      value: `${listing.bathrooms} ba`,
    },
    unit && { icon: DoorOpenIcon, label: "Unit", value: `Unit ${unit}` },
  ].filter(Boolean) as { icon: LucideIcon; label: string; value: string }[];

  return (
    <>
      {facts.length > 0 ? (
        <ul
          aria-label="Home details"
          className="flex flex-wrap items-center gap-1.5"
        >
          {facts.map((f) => (
            <Fact key={f.label} icon={f.icon} label={f.label}>
              {f.value}
            </Fact>
          ))}
          <li>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditing(true)}
                    aria-label="Edit home details"
                    className="size-9"
                  />
                }
              >
                <PencilIcon />
              </TooltipTrigger>
              <TooltipContent>
                {listing?.features
                  ? `Edit details · ${listing.features}`
                  : "Edit details"}
              </TooltipContent>
            </Tooltip>
          </li>
        </ul>
      ) : (
        <Button
          variant="outline"
          onClick={() => setEditing(true)}
          className="h-9 bg-card"
        >
          <PlusIcon data-icon="inline-start" />
          Add home details
        </Button>
      )}
      <EditListingDialog
        key={editing ? "open" : "closed"}
        reportId={report.id}
        unitNumber={unit ?? null}
        listing={listing}
        open={editing}
        onOpenChange={setEditing}
        onSaved={onSaved}
      />
    </>
  );
}

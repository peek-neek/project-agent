"use client";

import {
  BathIcon,
  BedDoubleIcon,
  DoorOpenIcon,
  HouseIcon,
  MapPinIcon,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
  TagIcon,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listingSchema, SECTION_KEYS } from "@/lib/report-sections";
import { EditListingDialog } from "./edit-listing-dialog";
import {
  formatCoordinates,
  formatPrice,
  type IdentitySources,
  type ReportData,
} from "./report-format";
import { getSection } from "./report-hooks";
import { FieldRow } from "./report-layout";

export function PropertySection({
  report,
  loading,
  onDetailsSaved,
}: {
  report: ReportData;
  loading: boolean;
  onDetailsSaved?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const property = report.property;
  const sources = (property?.sources ?? {}) as IdentitySources;
  const listing = getSection(report, SECTION_KEYS.listing, listingSchema);

  const missing = (
    <div className="flex items-center gap-3">
      <span className="text-sm text-foreground/45 italic">Not provided</span>
      <Button
        variant="ghost"
        size="xs"
        onClick={() => setEditing(true)}
        className="text-primary hover:bg-primary/10 hover:text-primary print:hidden"
      >
        <PlusIcon data-icon="inline-start" />
        Add
      </Button>
    </div>
  );

  return (
    <>
      <div className="mb-2 flex justify-end print:hidden">
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <PencilIcon data-icon="inline-start" />
          Edit details
        </Button>
      </div>
      <dl>
        <FieldRow
          label="Address"
          icon={MapPinIcon}
          provenance={sources.formattedAddress}
          empty={
            loading ? <Skeleton className="h-5 w-2/3" /> : report.inputAddress
          }
        >
          {property?.formattedAddress && (
            <>
              {property.formattedAddress}
              {property.latitude != null && property.longitude != null && (
                <span className="mt-0.5 block text-xs font-normal text-foreground/50 tabular-nums">
                  {formatCoordinates(property.latitude, property.longitude)}
                </span>
              )}
            </>
          )}
        </FieldRow>
        <FieldRow
          label="Unit"
          icon={DoorOpenIcon}
          provenance={sources.unitNumber}
          empty={loading ? <Skeleton className="h-5 w-24" /> : missing}
        >
          {property?.unitNumber}
        </FieldRow>
        <FieldRow label="Property type" icon={HouseIcon} empty={missing}>
          {listing?.propertyType}
        </FieldRow>
        <FieldRow label="Bedrooms" icon={BedDoubleIcon} empty={missing}>
          {listing?.bedrooms != null && listing.bedrooms}
        </FieldRow>
        <FieldRow label="Bathrooms" icon={BathIcon} empty={missing}>
          {listing?.bathrooms != null && listing.bathrooms}
        </FieldRow>
        <FieldRow label="List price" icon={TagIcon} empty={missing}>
          {listing?.listPrice != null && formatPrice(listing.listPrice)}
        </FieldRow>
        <FieldRow label="Standout features" icon={SparklesIcon} empty={missing}>
          {listing?.features && (
            <span className="whitespace-pre-line">{listing.features}</span>
          )}
        </FieldRow>
      </dl>

      {editing && (
        <EditListingDialog
          reportId={report.id}
          unitNumber={property?.unitNumber ?? null}
          listing={listing}
          open={editing}
          onOpenChange={setEditing}
          onSaved={onDetailsSaved}
        />
      )}
    </>
  );
}

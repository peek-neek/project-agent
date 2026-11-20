"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { cn } from "cn";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  type ListingData,
  listingInputSchema,
  PROPERTY_TYPES,
} from "@/lib/report-sections";
import { useTRPC } from "@/trpc/client";

type Values = {
  unitNumber: string;
  propertyType: string;
  bedrooms: string;
  bathrooms: string;
  listPrice: string;
  features: string;
};
type FieldName = keyof Values;

/** Matches listingInputSchema's limit. */
const FEATURES_MAX = 600;

export function EditListingDialog({
  reportId,
  unitNumber,
  listing,
  open,
  onOpenChange,
  onSaved,
}: {
  reportId: string;
  unitNumber: string | null;
  listing: ListingData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Values>({
    unitNumber: unitNumber ?? "",
    propertyType: listing?.propertyType ?? "",
    bedrooms: listing?.bedrooms?.toString() ?? "",
    bathrooms: listing?.bathrooms?.toString() ?? "",
    listPrice: listing?.listPrice?.toString() ?? "",
    features: listing?.features ?? "",
  });
  const [errors, setErrors] = useState<Partial<Record<FieldName, string[]>>>(
    {},
  );

  const toInput = (v: Values) => ({
    unitNumber: v.unitNumber,
    propertyType: (v.propertyType || null) as
      (typeof PROPERTY_TYPES)[number] | null,
    bedrooms: v.bedrooms,
    bathrooms: v.bathrooms,
    listPrice: v.listPrice.replace(/[$,\s]/g, ""),
    features: v.features,
  });

  const mutation = useMutation(
    trpc.report.updateListing.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.report.byId.queryKey({ id: reportId }),
        });
        onOpenChange(false);
        onSaved?.();
      },
    }),
  );

  const set = (name: FieldName) => (value: string) => {
    setValues((v) => ({ ...v, [name]: value }));
    setErrors((e) => ({ ...e, [name]: undefined }));
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const input = toInput(values);
    const parsed = listingInputSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(z.flattenError(parsed.error).fieldErrors as typeof errors);
      return;
    }
    mutation.mutate({ id: reportId, ...input });
  };

  const error = (name: FieldName) =>
    errors[name]?.length ? (
      <FieldError className="text-destructive-foreground">
        {errors[name]![0]}
      </FieldError>
    ) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>Property details</DialogTitle>
            <DialogDescription className="text-foreground/65">
              A few quick details make the AI copy specific to this listing. All
              fields are optional.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="my-6 gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="propertyType">Property type</FieldLabel>
                <NativeSelect
                  id="propertyType"
                  className="w-full"
                  value={values.propertyType}
                  onChange={(e) => set("propertyType")(e.target.value)}
                >
                  <NativeSelectOption value="">
                    Not specified
                  </NativeSelectOption>
                  {PROPERTY_TYPES.map((type) => (
                    <NativeSelectOption key={type} value={type}>
                      {type}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="unitNumber">Unit number</FieldLabel>
                <Input
                  id="unitNumber"
                  value={values.unitNumber}
                  onChange={(e) => set("unitNumber")(e.target.value)}
                  placeholder="e.g. 1203"
                  aria-invalid={Boolean(errors.unitNumber)}
                />
                {error("unitNumber")}
              </Field>
              <Field>
                <FieldLabel htmlFor="bedrooms">Bedrooms</FieldLabel>
                <Input
                  id="bedrooms"
                  inputMode="decimal"
                  value={values.bedrooms}
                  onChange={(e) => set("bedrooms")(e.target.value)}
                  placeholder="e.g. 3"
                  aria-invalid={Boolean(errors.bedrooms)}
                />
                {error("bedrooms")}
              </Field>
              <Field>
                <FieldLabel htmlFor="bathrooms">Bathrooms</FieldLabel>
                <Input
                  id="bathrooms"
                  inputMode="decimal"
                  value={values.bathrooms}
                  onChange={(e) => set("bathrooms")(e.target.value)}
                  placeholder="e.g. 2.5"
                  aria-invalid={Boolean(errors.bathrooms)}
                />
                {error("bathrooms")}
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="listPrice">List price</FieldLabel>
              <Input
                id="listPrice"
                inputMode="numeric"
                value={values.listPrice}
                onChange={(e) => set("listPrice")(e.target.value)}
                placeholder="e.g. 1,299,000"
                aria-invalid={Boolean(errors.listPrice)}
              />
              {error("listPrice")}
            </Field>
            <Field>
              <FieldLabel htmlFor="features">Standout features</FieldLabel>
              <Textarea
                id="features"
                rows={4}
                maxLength={FEATURES_MAX}
                value={values.features}
                onChange={(e) => set("features")(e.target.value)}
                placeholder="e.g. Renovated kitchen, south-facing backyard, finished basement with separate entrance"
                aria-invalid={Boolean(errors.features)}
                aria-describedby="features-count"
                // Fixed height: long text scrolls inside instead of growing
                // the dialog past the screen.
                className="field-sizing-fixed h-24 resize-none overflow-y-auto"
              />
              <div className="flex items-start justify-between gap-3">
                <FieldDescription>
                  Used only to make the marketing copy specific.
                </FieldDescription>
                <span
                  id="features-count"
                  aria-live="polite"
                  className={cn(
                    "shrink-0 text-xs text-muted-foreground tabular-nums",
                    values.features.length >= FEATURES_MAX &&
                      "text-destructive-foreground",
                  )}
                >
                  {values.features.length}/{FEATURES_MAX}
                </span>
              </div>
              {error("features")}
            </Field>
          </FieldGroup>

          {mutation.isError && (
            <p className="mb-4 text-sm text-destructive-foreground">
              Couldn&apos;t save. Check the values and try again.
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Spinner data-icon="inline-start" />}
              Save details
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { keepPreviousData, skipToken, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { Coords } from "@/components/globals/location/location-provider";
import { useTRPC } from "@/trpc/client";

export type AddressSuggestion = {
  id: string;
  primary: string;
  secondary: string;
  distanceMeters: number | null;
};

export const MIN_QUERY_LENGTH = 3;

export const suggestionLabel = (s: AddressSuggestion) =>
  s.secondary ? `${s.primary}, ${s.secondary}` : s.primary;

export function formatDistance(meters: number) {
  return meters < 1000
    ? `${Math.round(meters / 10) * 10} m`
    : `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`;
}

function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// ~100 m precision: enough to rank nearby addresses, and keeps cache keys stable.
const round = (n: number) => Math.round(n * 1000) / 1000;

type SuggestionOptions = {
  /** User's position, used to rank nearby addresses first. */
  near?: Coords | null;
  /** Google Places session token; reuse it until the user picks a result. */
  sessionToken?: string;
  enabled?: boolean;
};

export type SuggestionStatus =
  "idle" | "loading" | "limited" | "error" | "ready";

export function useAddressSuggestions(
  query: string,
  { near, sessionToken, enabled = true }: SuggestionOptions = {},
) {
  const trpc = useTRPC();
  const input = useDebouncedValue(query.trim(), 250);
  const ready = enabled && input.length >= MIN_QUERY_LENGTH;

  const lat = near ? round(near.lat) : null;
  const lng = near ? round(near.lng) : null;
  const nearRounded = useMemo(
    () => (lat !== null && lng !== null ? { lat, lng } : null),
    [lat, lng],
  );

  const result = useQuery(
    trpc.places.autocomplete.queryOptions(
      ready ? { input, near: nearRounded, sessionToken } : skipToken,
      {
        placeholderData: keepPreviousData,
        staleTime: 5 * 60 * 1000,
        retry: false,
      },
    ),
  );

  const suggestions = useMemo<AddressSuggestion[]>(
    () =>
      ready
        ? (result.data ?? []).map((p) => ({
            id: p.placeId,
            primary: p.primary,
            secondary: p.secondary,
            distanceMeters: p.distanceMeters,
          }))
        : [],
    [ready, result.data],
  );

  const status: SuggestionStatus = !ready
    ? "idle"
    : result.isError
      ? result.error.data?.code === "TOO_MANY_REQUESTS"
        ? "limited"
        : "error"
      : result.isPending
        ? "loading"
        : "ready";

  return { suggestions, status, isFetching: ready && result.isFetching };
}

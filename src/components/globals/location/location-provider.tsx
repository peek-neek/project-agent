"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type LocationStatus =
  "checking" | "prompt" | "granted" | "denied" | "unsupported";

export type Coords = { lat: number; lng: number };

type LocationContextValue = {
  status: LocationStatus;
  coords: Coords | null;
  requestLocation: () => void;
  bannerVisible: boolean;
  dismissBanner: () => void;
};

const PROMPTED_KEY = "areaview.location.prompted";
const DISMISSED_KEY = "areaview.location.banner-dismissed";

const read = (storage: () => Storage, key: string) => {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
};

const write = (storage: () => Storage, key: string, value: string) => {
  try {
    storage().setItem(key, value);
  } catch {}
};

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<LocationStatus>(() =>
    typeof navigator !== "undefined" && !("geolocation" in navigator)
      ? "unsupported"
      : "checking",
  );
  const [coords, setCoords] = useState<Coords | null>(null);
  const [dismissed, setDismissed] = useState(
    () =>
      typeof window !== "undefined" &&
      read(() => sessionStorage, DISMISSED_KEY) === "1",
  );

  const requestLocation = useCallback(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setStatus("granted");
      },
      (error) => {
        // Closing the browser prompt also reports PERMISSION_DENIED, but the
        // permission is still "prompt", so check the real state when we can.
        const fallback =
          error.code === error.PERMISSION_DENIED ? "denied" : "prompt";
        if (!navigator.permissions) {
          setStatus(fallback);
          return;
        }
        navigator.permissions
          .query({ name: "geolocation" })
          .then((p) => setStatus(p.state === "denied" ? "denied" : "prompt"))
          .catch(() => setStatus(fallback));
      },
      {
        enableHighAccuracy: false,
        maximumAge: 10 * 60 * 1000,
        timeout: 10_000,
      },
    );
  }, []);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    const firstVisit = read(() => localStorage, PROMPTED_KEY) !== "1";
    let permission: PermissionStatus | undefined;

    const apply = (state: PermissionState) => {
      if (state === "granted") requestLocation();
      else setStatus(state);
    };
    const onChange = () => permission && apply(permission.state);

    const init = async () => {
      let state: PermissionState = "prompt";
      try {
        permission = await navigator.permissions.query({ name: "geolocation" });
        state = permission.state;
        permission.addEventListener("change", onChange);
      } catch {}

      apply(state);
      if (firstVisit && state === "prompt") {
        write(() => localStorage, PROMPTED_KEY, "1");
        requestLocation();
      }
    };
    void init();

    return () => permission?.removeEventListener("change", onChange);
  }, [requestLocation]);

  const dismissBanner = useCallback(() => {
    setDismissed(true);
    write(() => sessionStorage, DISMISSED_KEY, "1");
  }, []);

  const value = useMemo<LocationContextValue>(
    () => ({
      status,
      coords,
      requestLocation,
      bannerVisible: (status === "prompt" || status === "denied") && !dismissed,
      dismissBanner,
    }),
    [status, coords, requestLocation, dismissed, dismissBanner],
  );

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
}

export function useUserLocation() {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error("useUserLocation must be used inside <LocationProvider>");
  }
  return context;
}

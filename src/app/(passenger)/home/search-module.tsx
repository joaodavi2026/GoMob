"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown, Flag, LocateFixed, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboOption } from "@/components/ui/dropdown";
import { useToast } from "@/components/ui/toast";
import { KNOWN_PLACES, routesHref, toPoint, type PickedPoint } from "./places";

const OPTIONS: ComboOption[] = KNOWN_PLACES.map((p) => ({ value: p.id, label: p.label, hint: p.area }));

export function SearchModule() {
  const router = useRouter();
  const toast = useToast();
  const [origin, setOrigin] = useState<PickedPoint | null>(null);
  const [dest, setDest] = useState<PickedPoint | null>(null);
  const [oq, setOq] = useState("");
  const [dq, setDq] = useState("");
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick(id: string): PickedPoint | null {
    const p = KNOWN_PLACES.find((k) => k.id === id);
    return p ? toPoint(p) : null;
  }

  function swap() {
    setOrigin(dest);
    setDest(origin);
    setOq(dq);
    setDq(oq);
    setError(null);
  }

  const autoTried = useRef(false);
  useEffect(() => {
    if (autoTried.current) return;
    autoTried.current = true;
    try {
      const prefs = JSON.parse(localStorage.getItem("gomob.prefs.v1") ?? "{}") as { autoLocate?: boolean };
      if (prefs.autoLocate) locate();
    } catch {
      /* ignore unreadable preferences */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function locate() {
    if (!("geolocation" in navigator)) {
      toast.error("Location is not supported on this device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const p: PickedPoint = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, label: "My location" };
        setOrigin(p);
        setOq(p.label);
        setError(null);
      },
      (err) => {
        setLocating(false);
        toast.error(err.code === err.PERMISSION_DENIED ? "Location permission denied. Pick a starting point from the list." : "Could not get your location. Pick a place from the list.");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!origin || !dest) {
      setError("Choose both an origin and a destination from the suggestions.");
      return;
    }
    if (Math.abs(origin.latitude - dest.latitude) < 1e-5 && Math.abs(origin.longitude - dest.longitude) < 1e-5) {
      setError("Origin and destination are the same place.");
      return;
    }
    router.push(routesHref(origin, dest));
  }

  const row = "relative flex items-center gap-3 rounded-3xl bg-canvas px-4 py-3";
  return (
    <form onSubmit={submit} noValidate className="relative mt-6 rounded-[28px] bg-white p-2 shadow-soft">
      <div className="relative space-y-2">
        <div className={row}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-soft">
            <MapPin className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 pr-12">
            <p className="text-[11px] font-medium text-muted">From</p>
            <Combobox
              bare
              label="Origin"
              placeholder="Where are you starting?"
              options={OPTIONS}
              query={oq}
              onQueryChange={(q) => {
                setOq(q);
                if (origin && q !== origin.label) setOrigin(null);
              }}
              onSelect={(o) => {
                setOrigin(pick(o.value));
                setOq(o.label);
                setError(null);
              }}
              emptyText="No known place matches. Try another name."
            />
          </div>
        </div>
        <div className={row}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-night text-white">
            <Flag className="h-[17px] w-[17px]" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 pr-12">
            <p className="text-[11px] font-medium text-muted">To</p>
            <Combobox
              bare
              label="Destination"
              placeholder="Where to?"
              options={OPTIONS}
              query={dq}
              onQueryChange={(q) => {
                setDq(q);
                if (dest && q !== dest.label) setDest(null);
              }}
              onSelect={(o) => {
                setDest(pick(o.value));
                setDq(o.label);
                setError(null);
              }}
              emptyText="No known place matches. Try another name."
            />
          </div>
        </div>
        <button
          type="button"
          onClick={swap}
          aria-label="Swap origin and destination"
          className="tap absolute right-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink shadow-soft ring-1 ring-border"
        >
          <ArrowUpDown className="h-[18px] w-[18px]" aria-hidden />
        </button>
      </div>

      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto px-2 pb-1">
        <button
          type="button"
          onClick={locate}
          disabled={locating}
          className="tap flex shrink-0 items-center gap-1.5 rounded-full bg-primary-light px-3 py-2 text-xs font-semibold text-primary-pressed disabled:opacity-60"
        >
          <LocateFixed className="h-3.5 w-3.5" aria-hidden />
          {locating ? "Locating..." : "My location"}
        </button>
        {KNOWN_PLACES.slice(0, 8).map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              // Fill origin first, then destination.
              if (!origin) {
                setOrigin(toPoint(p));
                setOq(p.label);
              } else {
                setDest(toPoint(p));
                setDq(p.label);
              }
              setError(null);
            }}
            className="tap shrink-0 rounded-full bg-canvas px-3 py-2 text-xs font-medium text-ink"
          >
            {p.label}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mx-2 mt-2 text-sm text-risk-high">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" className="mt-2 w-full rounded-[22px]">
        <Search className="h-5 w-5" aria-hidden />
        Search routes
      </Button>
    </form>
  );
}

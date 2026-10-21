"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown, Flag, LocateFixed, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboOption } from "@/components/ui/dropdown";
import { Card } from "@/components/ui/primitives";
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

  return (
    <Card className="p-4 sm:p-5">
      <form onSubmit={submit} noValidate>
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr] lg:items-start">
          <div>
            <p className="mb-1.5 text-sm font-medium">Origin</p>
            <Combobox
              label="Origin"
              placeholder="Where are you starting?"
              leading={<MapPin className="h-4 w-4 text-primary" aria-hidden />}
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
            <button
              type="button"
              onClick={locate}
              disabled={locating}
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary-pressed hover:underline disabled:opacity-60"
            >
              <LocateFixed className="h-4 w-4" aria-hidden />
              {locating ? "Locating..." : "Use current location"}
            </button>
          </div>

          <div className="flex justify-center lg:pt-7">
            <Button type="button" variant="secondary" size="icon" onClick={swap} aria-label="Swap origin and destination" className="rounded-full">
              <ArrowUpDown className="h-4 w-4 lg:rotate-90" aria-hidden />
            </Button>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium">Destination</p>
            <Combobox
              label="Destination"
              placeholder="Where to?"
              leading={<Flag className="h-4 w-4 text-primary" aria-hidden />}
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

        <div className="mt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Quick picks</p>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
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
                className="shrink-0 rounded-full border border-border bg-white px-3 py-1.5 text-sm text-ink transition-colors hover:border-primary/50 hover:bg-primary-light"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm text-risk-high">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="mt-4 w-full">
          <Search className="h-5 w-5" aria-hidden />
          Find my route
        </Button>
      </form>
    </Card>
  );
}

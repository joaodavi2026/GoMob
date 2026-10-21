"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

export type TabItem = { value: string; label: string; icon?: React.ReactNode; count?: number };

/** Controlled tab list with arrow-key navigation. Render the active panel yourself. */
export function Tabs({
  items,
  value,
  onChange,
  className,
  label = "Sections",
}: {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  label?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  function onKeyDown(e: React.KeyboardEvent, i: number) {
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % items.length;
    if (e.key === "ArrowLeft") next = (i - 1 + items.length) % items.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = items.length - 1;
    if (next >= 0) {
      e.preventDefault();
      onChange(items[next].value);
      refs.current[next]?.focus();
    }
  }
  return (
    <div role="tablist" aria-label={label} className={cn("flex gap-1 overflow-x-auto rounded-xl bg-canvas p-1", className)}>
      {items.map((t, i) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors",
              active ? "bg-white text-primary-pressed shadow-soft" : "text-muted hover:text-ink",
            )}
          >
            {t.icon}
            {t.label}
            {typeof t.count === "number" && <span className="rounded-full bg-primary-light px-1.5 text-xs text-primary-pressed">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

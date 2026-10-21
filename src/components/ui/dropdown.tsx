"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type DropdownItem = {
  key: string;
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
};

/** Click-outside + Escape handling shared by Dropdown and Combobox. */
function useDismiss(open: boolean, close: () => void, ref: React.RefObject<HTMLElement | null>) {
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) closeRef.current();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeRef.current();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, ref]);
}

/** Action menu. `trigger` receives props to spread on its button. */
export function Dropdown({
  items,
  trigger,
  align = "right",
  header,
}: {
  items: DropdownItem[];
  trigger: (props: { onClick: () => void; "aria-haspopup": "menu"; "aria-expanded": boolean }) => React.ReactNode;
  align?: "left" | "right";
  header?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useDismiss(open, () => setOpen(false), ref);
  useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus();
  }, [open]);

  function onKeyDown(e: React.KeyboardEvent) {
    const els = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []);
    if (els.length === 0) return;
    const i = els.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      els[(i + 1) % els.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      els[(i - 1 + els.length) % els.length]?.focus();
    }
  }

  return (
    <div ref={ref} className="relative inline-block">
      {trigger({ onClick: () => setOpen((o) => !o), "aria-haspopup": "menu", "aria-expanded": open })}
      {open && (
        <div
          ref={menuRef}
          role="menu"
          onKeyDown={onKeyDown}
          className={cn("absolute z-50 mt-2 min-w-52 rounded-xl border border-border bg-white p-1 shadow-soft", align === "right" ? "right-0" : "left-0")}
        >
          {header && <div className="border-b border-border px-3 py-2">{header}</div>}
          {items.map((it) => (
            <button
              key={it.key}
              role="menuitem"
              type="button"
              disabled={it.disabled}
              onClick={() => {
                setOpen(false);
                it.onSelect();
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-canvas focus:bg-canvas disabled:opacity-50",
                it.danger ? "text-risk-high" : "text-ink",
              )}
            >
              {it.icon}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export type ComboOption = { value: string; label: string; hint?: string; icon?: React.ReactNode };

/**
 * Accessible combobox / autocomplete (ARIA 1.2 pattern).
 * Filters `options` locally by default; pass `filter={false}` when options are already filtered remotely.
 */
export function Combobox({
  label,
  options,
  query,
  onQueryChange,
  onSelect,
  placeholder,
  leading,
  filter = true,
  emptyText = "No results found.",
  loading,
  className,
}: {
  label: string;
  options: ComboOption[];
  query: string;
  onQueryChange: (q: string) => void;
  onSelect: (o: ComboOption) => void;
  placeholder?: string;
  leading?: React.ReactNode;
  filter?: boolean;
  emptyText?: string;
  loading?: boolean;
  className?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(open, () => setOpen(false), ref);

  const q = query.trim().toLowerCase();
  const shown = filter && q ? options.filter((o) => o.label.toLowerCase().includes(q) || o.hint?.toLowerCase().includes(q)) : options;

  function choose(o: ComboOption) {
    onSelect(o);
    setOpen(false);
  }
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, shown.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && open && shown[active]) {
      e.preventDefault();
      choose(shown[active]);
    }
  }

  return (
    <div ref={ref} className={cn("relative w-full", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="flex h-12 items-center gap-2 rounded-xl border border-border bg-white px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
        {leading && <span className="shrink-0 text-muted">{leading}</span>}
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={open && shown[active] ? `${id}-opt-${active}` : undefined}
          autoComplete="off"
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            onQueryChange(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/70"
        />
        <ChevronDown className="h-4 w-4 shrink-0 text-muted" aria-hidden />
      </div>
      {open && (
        <ul id={`${id}-list`} role="listbox" aria-label={label} className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-white p-1 shadow-soft">
          {loading && <li className="px-3 py-2 text-sm text-muted">Searching...</li>}
          {!loading && shown.length === 0 && <li className="px-3 py-2 text-sm text-muted">{emptyText}</li>}
          {shown.map((o, i) => (
            <li
              key={o.value}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(o)}
              className={cn("flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm", i === active ? "bg-primary-light text-primary-pressed" : "text-ink")}
            >
              {o.icon}
              <span className="min-w-0 flex-1 truncate">{o.label}</span>
              {o.hint && <span className="shrink-0 text-xs text-muted">{o.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

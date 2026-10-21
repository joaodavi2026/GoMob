"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

type OverlayBase = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  /** Hide the visual title (still announced to screen readers). */
  hideTitle?: boolean;
};

const FOCUSABLE = 'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])';

/** Escape to close, body scroll lock, focus trap and focus restore. */
function useOverlayBehavior(open: boolean, onClose: () => void, ref: React.RefObject<HTMLElement | null>) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const node = ref.current;
    const first = node?.querySelector<HTMLElement>("[data-autofocus]") ?? node?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node)?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
      } else if (e.key === "Tab" && node) {
        const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (items.length === 0) return;
        const a = items[0];
        const b = items[items.length - 1];
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          b.focus();
        } else if (!e.shiftKey && document.activeElement === b) {
          e.preventDefault();
          a.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previous?.focus?.();
    };
  }, [open, ref]);
}

function Panel({ placement, ...p }: OverlayBase & { placement: "center" | "right" | "bottom" }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  useOverlayBehavior(p.open, p.onClose, ref);
  if (!p.open || typeof document === "undefined") return null;

  const placementClass = {
    center: "items-end justify-center p-0 sm:items-center sm:p-4",
    right: "items-stretch justify-end",
    bottom: "items-end justify-center",
  }[placement];
  const panelClass = {
    center: "w-full max-h-[90dvh] rounded-t-3xl sm:max-w-md sm:rounded-2xl",
    right: "h-full w-full max-w-sm rounded-l-2xl",
    bottom: "safe-bottom max-h-[85dvh] w-full max-w-2xl rounded-t-3xl",
  }[placement];

  return createPortal(
    <div className={cn("fixed inset-0 z-[90] flex", placementClass)}>
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={p.onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={p.description ? descId : undefined}
        tabIndex={-1}
        className={cn("relative flex flex-col overflow-hidden bg-white shadow-soft outline-none", panelClass, p.className)}
      >
        {placement === "bottom" && <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-border" aria-hidden />}
        <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-4">
          <div className="min-w-0">
            <h2 id={titleId} className={cn("text-lg font-semibold text-ink", p.hideTitle && "sr-only")}>
              {p.title}
            </h2>
            {p.description && (
              <p id={descId} className="mt-0.5 text-sm text-muted">
                {p.description}
              </p>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={p.onClose} aria-label="Close" className="-mr-2 -mt-1 shrink-0">
            <X className="h-5 w-5" aria-hidden />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{p.children}</div>
        {p.footer && <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3">{p.footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Centered dialog (bottom-anchored on phones). */
export function Modal(props: OverlayBase) {
  return <Panel placement="center" {...props} />;
}
/** Side panel anchored to the right. */
export function Drawer(props: OverlayBase) {
  return <Panel placement="right" {...props} />;
}
/** Mobile-first sheet anchored to the bottom. */
export function BottomSheet(props: OverlayBase) {
  return <Panel placement="bottom" {...props} />;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} data-autofocus>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}

/** Hover/focus tooltip. Wrap a single focusable element. */
export function Tooltip({ label, children, side = "top" }: { label: string; children: React.ReactNode; side?: "top" | "bottom" }) {
  const id = useId();
  return (
    <span className="group relative inline-flex" aria-describedby={id}>
      {children}
      <span
        id={id}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-xs text-white opacity-0 shadow-soft transition-opacity group-focus-within:opacity-100 group-hover:opacity-100",
          side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5",
        )}
      >
        {label}
      </span>
    </span>
  );
}

"use client";

import { forwardRef } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type SearchInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  value: string;
  onValueChange: (value: string) => void;
  "aria-label": string;
};

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { value, onValueChange, className, placeholder = "Search", ...props },
  ref,
) {
  return (
    <div
      className={cn(
        "flex h-11 w-full items-center gap-2 rounded-xl border border-border bg-white px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
        className,
      )}
    >
      <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden />
      <input
        ref={ref}
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onValueChange(e.target.value)}
        className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/70 [&::-webkit-search-cancel-button]:hidden"
        {...props}
      />
      {value && (
        <button type="button" onClick={() => onValueChange("")} aria-label="Clear search" className="rounded-md p-1 text-muted hover:text-ink">
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
});

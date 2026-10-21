import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, leading, trailing, className, id, ...props },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-ink">
          {label}
        </label>
      )}
      <div
        className={cn(
          "flex h-11 items-center gap-2 rounded-xl border bg-white px-3 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
          error ? "border-risk-high" : "border-border",
        )}
      >
        {leading && <span className="text-muted">{leading}</span>}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-err` : undefined}
          className={cn("h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/70", className)}
          {...props}
        />
        {trailing}
      </div>
      {error && (
        <p id={`${inputId}-err`} role="alert" className="mt-1 text-xs text-risk-high">
          {error}
        </p>
      )}
    </div>
  );
});

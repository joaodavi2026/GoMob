import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, Skeleton } from "./primitives";

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
  /** Hide on small screens to avoid horizontal scrolling. */
  hideOnMobile?: boolean;
};

/** Generic table with loading / empty / error states. Scrolls inside its own container if too wide. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  onRetry,
  emptyTitle = "Nothing to show",
  emptyDescription,
  caption,
}: {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  caption?: string;
}) {
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (!loading && (!rows || rows.length === 0)) return <EmptyState title={emptyTitle} description={emptyDescription} />;
  const hide = (c: Column<T>) => (c.hideOnMobile ? "hidden md:table-cell" : "");
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-white shadow-soft">
      <table className="w-full text-left text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="bg-canvas text-xs uppercase tracking-wide text-muted">
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={cn("px-4 py-3 font-medium", hide(c), c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  {columns.map((c) => (
                    <td key={c.key} className={cn("px-4 py-3", hide(c))}>
                      <Skeleton className="h-4 w-full max-w-32" />
                    </td>
                  ))}
                </tr>
              ))
            : rows!.map((r) => (
                <tr key={rowKey(r)} className="hover:bg-canvas/60">
                  {columns.map((c) => (
                    <td key={c.key} className={cn("px-4 py-3 align-middle", hide(c), c.className)}>
                      {c.cell(r)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}

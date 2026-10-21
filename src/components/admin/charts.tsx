import { cn } from "@/lib/utils";

export type Slice = { label: string; value: number; color: string };

/** Donut em SVG puro. Sem dados => círculo neutro com "No data". */
export function Donut({ slices, size = 140, centerLabel }: { slices: Slice[]; size?: number; centerLabel?: string }) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  const r = 52;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg viewBox="0 0 140 140" width={size} height={size} role="img" aria-label={slices.map((s) => `${s.label}: ${s.value}`).join(", ") || "No data"}>
      <circle cx="70" cy="70" r={r} fill="none" stroke="var(--color-border)" strokeWidth="18" />
      {total > 0 &&
        slices
          .filter((s) => s.value > 0)
          .map((s) => {
            const len = (s.value / total) * c;
            const el = (
              <circle
                key={s.label}
                cx="70"
                cy="70"
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth="18"
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 70 70)"
              />
            );
            offset += len;
            return el;
          })}
      <text x="70" y="68" textAnchor="middle" className="fill-ink text-[22px] font-bold">
        {total}
      </text>
      <text x="70" y="86" textAnchor="middle" className="fill-muted text-[10px]">
        {total === 0 ? "No data" : (centerLabel ?? "total")}
      </text>
    </svg>
  );
}

export function Legend({ slices }: { slices: Slice[] }) {
  return (
    <ul className="space-y-1.5 text-sm">
      {slices.map((s) => (
        <li key={s.label} className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} aria-hidden />
          <span className="text-muted">{s.label}</span>
          <span className="ml-auto font-semibold tabular-nums">{s.value}</span>
        </li>
      ))}
    </ul>
  );
}

/** Colunas em SVG para séries curtas. */
export function Columns({ data, color = "var(--color-primary)", height = 140 }: { data: { label: string; count: number }[]; color?: string; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const w = 300;
  const gap = 10;
  const bw = (w - gap * (data.length + 1)) / Math.max(1, data.length);
  const base = height - 22;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" role="img" aria-label={data.map((d) => `${d.label}: ${d.count}`).join(", ")}>
      <line x1="0" x2={w} y1={base} y2={base} stroke="var(--color-border)" />
      {data.map((d, i) => {
        const h = (d.count / max) * (base - 16);
        const x = gap + i * (bw + gap);
        return (
          <g key={d.label}>
            <rect x={x} y={base - h} width={bw} height={Math.max(h, d.count > 0 ? 2 : 0)} rx="4" fill={color} opacity={d.count ? 1 : 0.25} />
            <text x={x + bw / 2} y={base - h - 4} textAnchor="middle" className="fill-ink text-[10px] font-semibold">
              {d.count > 0 ? d.count : ""}
            </text>
            <text x={x + bw / 2} y={height - 6} textAnchor="middle" className="fill-muted text-[10px]">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Barras horizontais empilhadas (CSS) para proporções. */
export function StackedBar({ slices, className }: { slices: Slice[]; className?: string }) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  return (
    <div className={cn("flex h-3 w-full overflow-hidden rounded-full bg-border", className)} role="img" aria-label={slices.map((s) => `${s.label}: ${s.value}`).join(", ")}>
      {total > 0 && slices.map((s) => <div key={s.label} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />)}
    </div>
  );
}

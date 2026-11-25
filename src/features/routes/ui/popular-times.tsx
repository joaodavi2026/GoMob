"use client";

import { useId, useState } from "react";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { crowdingLabel, crowdingNow, type RouteCrowding } from "../crowding";

const DAYS = ["Domingos", "Segundas", "Terças", "Quartas", "Quintas", "Sextas", "Sábados"];
/** O dia da operação começa às 4h, como a maior parte das linhas. */
const HOURS = Array.from({ length: 24 }, (_, i) => (i + 4) % 24);
const TICKS = new Set([6, 9, 12, 15, 18, 21, 0, 3]);
const hh = (h: number) => `${h}h`;

/** Horários de pico da rota: barras por hora, com a hora atual em destaque (dados aproximados). */
export function PopularTimes({ crowding: c }: { crowding: RouteCrowding }) {
  const [day, setDay] = useState(c.weekday);
  const [picked, setPicked] = useState<number | null>(null);
  const titleId = useId();
  const values = c.week[day];
  const today = day === c.weekday;
  const now = crowdingNow(c);
  const closed = values.every((v) => v === null);
  const open = HOURS.filter((h) => values[h] !== null);
  const peak = open.reduce<number | null>((b, h) => (b === null || values[h]! > values[b]! ? h : b), null);
  const calm = open.filter((h) => h >= 5 && h <= 22).reduce<number | null>((b, h) => (b === null || values[h]! < values[b]! ? h : b), null);
  const go = (n: number) => {
    setDay((d) => (d + n + 7) % 7);
    setPicked(null);
  };
  const summary = closed ? `${DAYS[day]}: a rota não opera.` : `${DAYS[day]}: mais cheia às ${hh(peak!)}${calm !== null ? `, mais vazia às ${hh(calm)}` : ""}.`;
  const detail = picked === null ? summary : `${hh(picked)}: ${values[picked] === null ? "não opera neste horário" : `costuma estar ${crowdingLabel(values[picked]).toLowerCase()} (${values[picked]} em 100)`}.`;

  return (
    <section aria-labelledby={titleId} className="mt-2 rounded-2xl border border-border bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={titleId} className="flex items-center gap-1.5 text-sm font-extrabold text-ink">
          <Users className="h-4 w-4 text-primary" aria-hidden /> Horários de pico
        </h3>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => go(-1)} aria-label="Dia anterior" className="tap flex h-11 w-9 items-center justify-center rounded-full text-ink">
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <select
            value={day}
            onChange={(e) => {
              setDay(Number(e.target.value));
              setPicked(null);
            }}
            aria-label="Dia da semana"
            className="h-11 rounded-xl bg-canvas px-2 text-sm font-semibold text-ink"
          >
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <option key={d} value={d}>
                {DAYS[d]}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => go(1)} aria-label="Próximo dia" className="tap flex h-11 w-9 items-center justify-center rounded-full text-ink">
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>

      <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
        <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-extrabold uppercase text-white", c.live !== null ? "bg-risk-high" : "bg-night")}>{c.live !== null ? "Ao vivo" : "Agora"}</span>
        <span className="font-semibold text-ink">
          {crowdingLabel(now)}
          {now !== null && <span className="font-normal text-muted"> · {now} em 100</span>}
        </span>
        {c.line && <span className="text-xs text-muted">linha mais cheia: {c.line}</span>}
      </p>

      {/* barras: toque ou passe o mouse em uma hora para ver o valor */}
      <div className="mt-3 flex h-24 items-end gap-[2px] border-b border-border" onMouseLeave={() => setPicked(null)} role="img" aria-label={summary}>
        {HOURS.map((h) => {
          const v = values[h];
          const isNow = today && h === c.hour;
          const live = isNow ? c.live : null;
          const extra = live !== null && v !== null && live > v ? live - v : 0;
          return (
            <div
              key={h}
              aria-hidden
              onMouseEnter={() => setPicked(h)}
              onClick={() => setPicked(h)}
              className={cn("flex h-full min-w-0 flex-1 flex-col justify-end", picked === h && "bg-canvas")}
            >
              {v !== null && (
                <>
                  {extra > 0 && <span className="block w-full rounded-t-[4px] bg-primary" style={{ height: `${extra}%` }} />}
                  <span
                    className={cn("block w-full", extra > 0 ? "" : "rounded-t-[4px]", isNow ? "bg-primary-pressed" : "bg-[#7c8596]")}
                    style={{ height: `${Math.max(2, live !== null && live < v ? live : v)}%` }}
                  />
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex gap-[2px]" aria-hidden>
        {HOURS.map((h) => (
          <span key={h} className="relative h-5 min-w-0 flex-1">
            {TICKS.has(h) && <span className="absolute left-1/2 top-1 -translate-x-1/2 whitespace-nowrap text-[10px] text-muted">{hh(h)}</span>}
          </span>
        ))}
      </div>

      <p className="mt-1 min-h-5 text-xs font-semibold text-ink">{detail}</p>
      <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
        <li className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#7c8596]" aria-hidden /> Costuma ser
        </li>
        {today && values[c.hour] !== null && (
          <li className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-primary-pressed" aria-hidden /> Hora atual
          </li>
        )}
        {today && c.live !== null && c.typical !== null && c.live > c.typical && (
          <li className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-primary" aria-hidden /> Acima do normal agora
          </li>
        )}
      </ul>
      <p className="mt-1 text-[11px] text-muted">
        Dados aproximados, não é contagem de passageiros.{" "}
        {c.basis === "SCHEDULE" ? "Estimativa pela procura típica do horário e pelos intervalos da SPTrans" : "Estimativa pela procura típica do horário"}
        {c.live !== null ? ", ajustada pela posição dos ônibus agora." : "."}
      </p>

      {/* mesma informação em tabela, para leitor de tela */}
      <div className="sr-only">
      <table>
        <caption>Lotação aproximada por hora, {DAYS[day].toLowerCase()}</caption>
        <thead>
          <tr>
            <th scope="col">Hora</th>
            <th scope="col">Lotação</th>
          </tr>
        </thead>
        <tbody>
          {HOURS.map((h) => (
            <tr key={h}>
              <th scope="row">{hh(h)}</th>
              <td>{values[h] === null ? "não opera" : `${crowdingLabel(values[h])}, ${values[h]} em 100`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </section>
  );
}

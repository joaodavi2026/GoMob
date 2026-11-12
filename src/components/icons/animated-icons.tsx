/**
 * Ícones animados das quatro ações grandes da Home (SVG + CSS, sem bibliotecas).
 * As animações ficam em globals.css (prefixo .ai-) e param com "Reduzir animações"
 * ou com a preferência de movimento reduzido do celular.
 */

type P = { className?: string };
const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ROUTE = "M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15";

/** Planejar viagem: a rota se desenha e um ponto percorre o trajeto. */
export function RouteIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={`ai-anim ${className ?? ""}`} aria-hidden {...base}>
      <path d={ROUTE} opacity={0.28} />
      <path d={ROUTE} pathLength={1} className="ai-draw" />
      <circle cx="6" cy="19" r="3" className="ai-pop ai-pop-start" />
      <circle cx="18" cy="5" r="3" className="ai-pop ai-pop-end" />
      <circle r="2.1" fill="currentColor" stroke="none" className="ai-dot">
        <animateMotion dur="3.2s" repeatCount="indefinite" keyPoints="0;1;1" keyTimes="0;0.45;1" calcMode="linear" path={ROUTE} />
      </circle>
    </svg>
  );
}

/** Próximos ônibus: o ônibus anda, as rodas giram e passam linhas de velocidade. */
export function BusIcon({ className }: P) {
  return (
    <svg viewBox="-6 0 30 24" className={`ai-anim ${className ?? ""}`} aria-hidden {...base}>
      <g className="ai-speedlines">
        <path d="M-5 9h3" className="ai-speed" />
        <path d="M-6 13h4" className="ai-speed ai-speed-2" />
        <path d="M-4 16h2" className="ai-speed ai-speed-3" />
      </g>
      <g className="ai-drive">
      <g className="ai-bus">
        <path d="M8 6v6" />
        <path d="M15 6v6" />
        <path d="M2 12h19.6" />
        <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3" />
        <path d="M9 18h5" />
      </g>
      {[7, 16].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="18" r="2" />
          <path d={`M${cx - 1.2} 18h2.4`} className="ai-wheel" strokeWidth={1.4} />
        </g>
      ))}
      </g>
    </svg>
  );
}

/** Terminais e pontos: o terminal se monta (colunas sobem, telhado desce) com bandeira. */
export function TerminalIcon({ className }: P) {
  return (
    <svg viewBox="0 -3 24 27" className={`ai-anim ${className ?? ""}`} aria-hidden {...base}>
      {/* sombra do terminal montado: o ícone nunca fica vazio enquanto se reconstrói */}
      <g opacity={0.22}>
        <path d="M6 18v-7M10 18v-7M14 18v-7M18 18v-7" />
        <path d="M12 2 20 7H4z" />
      </g>
      <path d="M3 22h18" />
      {[6, 10, 14, 18].map((x, i) => (
        <path key={x} d={`M${x} 18v-7`} className={`ai-col ai-col-${i + 1}`} />
      ))}
      <g className="ai-roof">
        <path d="M12 2 20 7H4z" />
        <path d="M12 2v-3.5" strokeWidth={1.5} />
        <path d="M12 -1.5 15.2 -0.6 12 0.4z" fill="currentColor" strokeWidth={1} className="ai-flag" />
      </g>
    </svg>
  );
}

/** Pedir ajuda: a mão se ergue e soltam-se corações. */
export function HelpIcon({ className }: P) {
  const heart = "M0 1.2C-.5.2-2 .3-2 1.5c0 1.1 2 2.3 2 2.3s2-1.2 2-2.3C2 .3.5.2 0 1.2z";
  return (
    <svg viewBox="0 -7 24 31" className={`ai-anim ${className ?? ""}`} aria-hidden {...base}>
      <g className="ai-hand">
        <path d="M11 12h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 14" />
        <path d="m7 18 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9" />
        <path d="m2 13 6 6" />
      </g>
      <g transform="translate(14 0) scale(1.5)">
        <path d={heart} fill="currentColor" stroke="none" className="ai-heart" />
      </g>
      <g transform="translate(20 3) scale(1.2)">
        <path d={heart} fill="currentColor" stroke="none" className="ai-heart ai-heart-2" />
      </g>
    </svg>
  );
}

/** Metrô: o trem balança nos trilhos e os faróis piscam alternados. */
export function MetroIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={`ai-anim ${className ?? ""}`} aria-hidden {...base}>
      <g className="ai-sway">
        <rect x="4" y="3" width="16" height="16" rx="2" />
        <path d="M4 11h16" />
        <path d="M12 3v8" />
        <circle cx="8" cy="15" r="1.3" fill="currentColor" stroke="none" className="ai-blink" />
        <circle cx="16" cy="15" r="1.3" fill="currentColor" stroke="none" className="ai-blink ai-blink-2" />
      </g>
      <path d="m8 19-2 3" />
      <path d="m18 22-2-3" />
    </svg>
  );
}

/** Trem: vem chegando (cresce e volta) com os faróis acesos. */
export function TrainIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={`ai-anim ${className ?? ""}`} aria-hidden {...base}>
      <g className="ai-approach">
        <path d="M8 3.1V7a4 4 0 0 0 8 0V3.1" />
        <path d="M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z" />
        <circle cx="9" cy="14.5" r="1.2" fill="currentColor" stroke="none" className="ai-glow" />
        <circle cx="15" cy="14.5" r="1.2" fill="currentColor" stroke="none" className="ai-glow" />
      </g>
      <path d="m8 19-2 3" />
      <path d="m16 22-2-3" />
    </svg>
  );
}

/** Ao vivo: ondas de sinal pulsando para fora. */
export function LiveIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={`ai-anim ${className ?? ""}`} aria-hidden {...base}>
      <circle cx="12" cy="12" r="2" fill="currentColor" className="ai-core" />
      <g className="ai-ring">
        <path d="M16.2 7.8a6 6 0 0 1 0 8.4" />
        <path d="M7.8 16.2a6 6 0 0 1 0-8.4" />
      </g>
      <g className="ai-ring ai-ring-2">
        <path d="M19.1 4.9a10 10 0 0 1 0 14.2" />
        <path d="M4.9 19.1a10 10 0 0 1 0-14.2" />
      </g>
    </svg>
  );
}

/** Início: a casa dá um pulinho e sai fumaça da chaminé. */
export function HomeIcon({ className }: P) {
  return (
    <svg viewBox="0 -4 24 28" className={`ai-anim ${className ?? ""}`} aria-hidden {...base}>
      <g className="ai-hop">
        <path d="M17 6.5V3.5h2.2v4.8" />
        <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      </g>
      <circle cx="18.1" cy="1.5" r="1.1" fill="currentColor" stroke="none" className="ai-smoke" />
      <circle cx="18.1" cy="1.5" r="0.8" fill="currentColor" stroke="none" className="ai-smoke ai-smoke-2" />
    </svg>
  );
}

/** Explorar: a agulha da bússola procura o norte. */
export function CompassIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={`ai-anim ${className ?? ""}`} aria-hidden {...base}>
      <circle cx="12" cy="12" r="10" />
      <path
        d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"
        className="ai-needle"
      />
    </svg>
  );
}

/** Salvos: o coração bate. */
export function HeartIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={`ai-anim ${className ?? ""}`} aria-hidden {...base}>
      <path
        d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
        className="ai-beat"
      />
    </svg>
  );
}

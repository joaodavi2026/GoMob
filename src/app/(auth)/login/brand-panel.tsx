import { Logo } from "@/components/ui/logo";

/** Original vector composition: city routes, stops, location pins and a bus. Decorative only. */
export function RouteArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 520" className={className} fill="none" aria-hidden focusable="false">
      <style>{`
        .gm-dash { stroke-dasharray: 6 12; animation: gm-dash 14s linear infinite; }
        .gm-float { animation: gm-float 5s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        @keyframes gm-dash { to { stroke-dashoffset: -180; } }
        @keyframes gm-float { 50% { transform: translateY(-6px); } }
        @media (prefers-reduced-motion: reduce) { .gm-dash, .gm-float { animation: none; } }
      `}</style>
      {/* city grid */}
      <g stroke="#fff" strokeOpacity="0.10" strokeWidth="1">
        {Array.from({ length: 9 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={40 + i * 60} x2="600" y2={40 + i * 60} />
        ))}
        {Array.from({ length: 11 }).map((_, i) => (
          <line key={`v${i}`} x1={20 + i * 56} y1="0" x2={20 + i * 56} y2="520" />
        ))}
      </g>
      {/* secondary routes */}
      <path d="M-10 380 C 120 380 160 300 260 300 S 420 400 610 330" stroke="#fff" strokeOpacity="0.28" strokeWidth="6" strokeLinecap="round" />
      <path d="M80 -10 C 90 100 200 120 240 190 S 330 330 320 530" stroke="#fff" strokeOpacity="0.22" strokeWidth="6" strokeLinecap="round" />
      {/* main route */}
      <path d="M60 440 C 160 440 150 250 260 230 S 400 250 440 140 S 520 70 560 60" stroke="#fff" strokeWidth="10" strokeLinecap="round" />
      <path className="gm-dash" d="M60 440 C 160 440 150 250 260 230 S 400 250 440 140 S 520 70 560 60" stroke="#FF6B00" strokeWidth="3" strokeLinecap="round" />
      {/* stops */}
      {[
        [150, 372],
        [262, 230],
        [392, 235],
        [446, 138],
      ].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="11" fill="#fff" />
          <circle cx={x} cy={y} r="5" fill="#FF6B00" />
        </g>
      ))}
      {/* origin */}
      <circle cx="60" cy="440" r="16" fill="#fff" fillOpacity="0.3" />
      <circle cx="60" cy="440" r="9" fill="#fff" />
      {/* destination pin */}
      <g className="gm-float">
        <path d="M560 20c-18 0-32 14-32 32 0 24 32 56 32 56s32-32 32-56c0-18-14-32-32-32Z" fill="#fff" />
        <circle cx="560" cy="52" r="12" fill="#FF6B00" />
      </g>
      {/* bus */}
      <g transform="translate(228 168)">
        <rect x="0" y="0" width="64" height="40" rx="10" fill="#fff" />
        <rect x="7" y="8" width="20" height="13" rx="3" fill="#FF6B00" fillOpacity="0.85" />
        <rect x="31" y="8" width="26" height="13" rx="3" fill="#FF6B00" fillOpacity="0.85" />
        <rect x="7" y="26" width="50" height="4" rx="2" fill="#FF6B00" fillOpacity="0.35" />
        <circle cx="16" cy="42" r="6" fill="#17212B" />
        <circle cx="48" cy="42" r="6" fill="#17212B" />
      </g>
      {/* ambient bubbles */}
      <circle cx="520" cy="430" r="70" fill="#fff" fillOpacity="0.06" />
      <circle cx="90" cy="110" r="44" fill="#fff" fillOpacity="0.07" />
    </svg>
  );
}

/** Left/top branded area of the login screen (white logo over orange). */
export function BrandPanel() {
  return (
    <section className="relative hidden overflow-hidden bg-primary text-white lg:flex lg:flex-col lg:justify-between lg:p-12" aria-label="GoMob">
      <RouteArt className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-90" />
      <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/10 to-primary-pressed/60" aria-hidden />
      <div className="relative">
        <Logo priority tone="white" className="h-40 w-40" />
      </div>
      <div className="relative max-w-md">
        <h2 className="text-5xl font-extrabold leading-[1.05] tracking-tight">Move smarter. Live better.</h2>
        <p className="mt-4 text-lg text-white/90">Smart routes. Live buses. Better journeys.</p>
      </div>
    </section>
  );
}

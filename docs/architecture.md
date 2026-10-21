# GoMob — Arquitetura e contratos

Next.js 16 (App Router, **leia `node_modules/next/dist/docs/` antes de usar APIs: ex. middleware agora é `proxy.ts`, `cookies()`/`params` são async**), TypeScript strict, Tailwind v4 (tokens em `src/app/globals.css`), Prisma 6 + Neon, sessão JWT própria (jose) em cookie HttpOnly, TanStack Query, MapLibre.

## Convenções
- Respostas de API: `ok(data)` / `fail(...)` / `handle(fn)` de `src/lib/api.ts` → `{ ok: true, data }` ou `{ ok: false, error }`. Cliente: `apiFetch<T>(url)`.
- Auth no servidor: `getSession()`, `requireUser()`, `requireAdmin()` (`src/server/auth`). Nunca confiar só no frontend.
- Banco: `import { db } from "@/server/db"`. **Não há banco acessível durante o desenvolvimento** (sem DATABASE_URL): código de domínio deve ser testável sem DB (funções puras, DB injetado/mockado). Qualquer leitura de DB que falhe deve degradar de forma segura em rotas públicas de transporte (usar o provedor DEMO).
- UI kit: `src/components/ui/*` (Button, Input, Card, Badge, Skeleton, EmptyState, ErrorState, DemoBadge, RiskBadge, Logo, useToast). Cores via tokens Tailwind: `primary`, `primary-light`, `canvas`, `ink`, `muted`, `border`, `risk-low|moderate|high|unknown`. Textos de UI em inglês (conforme spec).
- Tipos de domínio compartilhados: `src/types/transit.ts`.
- Dados demo: sempre identificados (`source: "DEMO"` + `DemoBadge`). Nunca inventar dados como se fossem oficiais.
- Logo oficial: `public/branding/gomob-logo.png` (completo), `gomob-mark.png` (símbolo), componente `<Logo />`.

## Cenário demo (compartilhado)
`src/server/demo/scenario.ts`: `getScenario()` / `setScenario()` — persiste em `AppSetting` (key `demo.scenario`). Cenários: `A_NORMAL`, `B_HIGH_RISK`, `C_UNAVAILABLE`, `D_RECOVERY`. Provedor demo de veículos e o motor de risco devem respeitá-lo.

## Contratos de serviço (implementação: agente Transit)
`src/server/transit/service.ts` exporta:
```ts
getLines(opts?: { search?: string }): Promise<{ lines: (TransitLine & { active: boolean })[]; source: DataSourceKind; state: IntegrationState }>
getLine(id: string): Promise<TransitLine | null>
getVehicles(lineId: string): Promise<{ vehicles: TransitVehicle[]; state: IntegrationState; fetchedAt: string; source: DataSourceKind }>
getStops(lineId: string): Promise<{ stops: TransitStop[]; source: DataSourceKind }>
getSystemStatus(): Promise<SystemStatus>   // ver abaixo
```
`SystemStatus = { mode: "LIVE" | "DEMO"; scenario: DemoScenario | null; integrations: { key: string; label: string; configured: boolean; state: IntegrationState; lastQueryAt: string | null; lastFailureAt: string | null }[] }`

## Endpoints (shapes `data`)
- `GET /api/lines?search=` → `{ lines, source, state }`
- `GET /api/lines/[id]` → `{ line }` ; `/vehicles` → como `getVehicles`; `/stops` → como `getStops`
- `GET /api/vehicles?lineIds=a,b` → `{ vehicles, state }`; `GET /api/vehicles/[id]`
- `GET /api/intelligence/risk?lineId=` → `{ risk: RiskResult }`
- `GET /api/predict?lineId=&date=&time=` → `{ prediction: { risk: RiskResult, dataQuality, historicalSource, limitations: string[], isDemo: boolean } }`
- `POST /api/routes/search` body `{ origin: GeoPoint, destination: GeoPoint, sort? }` → `{ routes: BusRouteOption[] (com risk), recommendations: { fastest?, fewerTransfers?, lowerRisk?, balanced? : string /*route id*/ + reasons }, provider }`
- `GET /api/alerts` → `{ alerts: { id, lineId, type, title, description, createdAt, isDemo }[] }`
- `GET|POST /api/favorites`, `PATCH|DELETE /api/favorites/[id]` → `{ favorites }` / `{ favorite }`
- `GET /api/system/status` → `SystemStatus`
- `POST /api/auth/login|logout`, `GET /api/auth/me`
- `/api/admin/*` (requireAdmin): overview, lines (PATCH active), settings (pesos do risco), demo (GET/POST scenario, POST reset)

## Limitações conhecidas (ver docs/limitations.md)
Sem ingestão contínua; polling sob demanda; Neon/SPTrans dependem de credenciais externas.

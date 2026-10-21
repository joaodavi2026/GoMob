# Progresso

Atualizado em 2026-10-21.

| Fase | Estado | Observações |
|---|---|---|
| 01 Fundação | feita | Next.js 16, TS strict, Tailwind v4, Prisma 6 |
| 02 Design system | feita | UI kit em `src/components/ui`, logo oficial em `public/branding` (`docs/design-system.md`) |
| 03 Banco e auth | feita (sem Neon) | Schema, seed idempotente, sessão JWT HttpOnly, proxy. **Migrations e seed não foram executados contra um banco real** |
| 04 Telas base | feita | Login, Home, Perfil, Favoritos, Admin |
| 05 Mapas | feita | MapLibre, marcadores, bottom sheet, geolocalização |
| 06 SPTrans | feita (sem token) | Adaptador com cache/retry/reauth, testado com fetch simulado. Live não verificado |
| 07 Smart Routes | feita | Provedor demo validado, filtro só-ônibus, Google opcional (desativado) |
| 08 Intelligence | feita | Motor de risco com política de dados insuficientes |
| 09 Predict | feita | Só prevê com histórico horário suficiente; senão cenário demo rotulado |
| 10 Recomendação/Alertas | feita | `AlertsList` ainda não montado na Home |
| 11 Demo Control | feita | `/admin/demo`; sincronização por polling. Teste com dois navegadores pendente (exige Neon) |
| 12 Finalização | parcial | Typecheck, 194 testes e build executados; Playwright e2e não escritos; deploy depende de credenciais |

## Verificado
`npx tsc --noEmit` limpo · `npx vitest run` 194 testes · `npm run build` ok.

## Pendências
- Neon (`DATABASE_URL`, `DIRECT_URL`): `npx prisma db push` e `npm run db:seed`.
- `SPTRANS_API_TOKEN` para modo LIVE.
- Testes Playwright de responsividade e fluxo admin→usuário.
- Montar `AlertsList` na Home e na página da linha.

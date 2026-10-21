# GoMob

**Go smarter. Ride better.** — Mobilidade urbana inteligente para São Paulo (projeto acadêmico, infraestrutura R$ 0).

Aplicação Full Stack em um único repositório Next.js: rastreamento de ônibus (SPTrans Olho Vivo), rotas só de ônibus, estimativa de risco de superlotação, previsões e painel administrativo com cenários de demonstração.

## Rodar localmente

```bash
npm install
cp .env.example .env.local   # preencha DATABASE_URL, DIRECT_URL e SESSION_SECRET
npx prisma db push           # cria as tabelas no Neon
npm run db:seed              # contas demo (senhas com hash)
npm run dev
```

Sem banco, `npm run dev` ainda permite entrar com as contas de `prisma/demo-users.ts` (fallback só em desenvolvimento). Sem `SPTRANS_API_TOKEN` o app roda em DEMO MODE, sempre identificado.

Contas demo: ver `prisma/demo-users.ts` (públicas; não reutilize as senhas).

## Scripts
`npm run dev` · `npm run build` · `npm run typecheck` · `npm test` · `npm run db:push` · `npm run db:seed`

## Deploy (Vercel Hobby + Neon free)
1. Crie um projeto no Neon; copie a connection string *pooled* para `DATABASE_URL` e a direta para `DIRECT_URL`.
2. Importe o repositório na Vercel e defina: `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET` (≥ 32 caracteres aleatórios), opcionalmente `SPTRANS_API_TOKEN` (token em olhovivo da SPTrans; só servidor) e `NEXT_PUBLIC_MAP_STYLE_URL`.
3. Localmente, rode `npx prisma db push` e `npm run db:seed` apontando para o Neon.
4. Faça o deploy. Não habilite faturamento nem o Google Routes (`GOOGLE_ROUTES_ENABLED` fica `false`).

## Documentação
- [Especificação mestre](docs/GOMOB-MASTER-SPEC.md)
- [Arquitetura e contratos](docs/architecture.md)
- [Design system](docs/design-system.md)
- [Progresso](docs/progress.md) · [Limitações](docs/limitations.md)
- [Google Maps e custos](docs/google-maps-custos.md)

## Roteiro acadêmico
Login USER → Home → Smart Routes (só ônibus) → Mapa ao vivo → Intelligence (explicação do risco) → Predict → ADMIN em outra sessão → Demo Control (cenário B) → voltar ao USER e ver a mudança → Favoritos persistidos → limitações.

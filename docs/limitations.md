# Limitações conhecidas

- **Sem ingestão contínua.** A Vercel Hobby não mantém processos permanentes. Os dados são consultados sob demanda (polling leve de 30–60 s enquanto a tela está aberta) e mantidos em cache de curta duração. Nada é coletado quando ninguém usa o GoMob.
- **SPTrans Olho Vivo depende de `SPTRANS_API_TOKEN`.** Sem token, o app opera em DEMO MODE, sempre identificado. A API não é um roteador ponto-a-ponto; as rotas do MVP vêm de um provedor demonstrativo validado (ou, opcionalmente, do Google Routes).
- **Google Routes é opcional e desativado por padrão.** Exige chave e faturamento habilitado; não é ativado sem autorização explícita.
- **Risco de superlotação é uma estimativa, não ocupação observada.** Pesos (0,35 / 0,30 / 0,20 / 0,15) são hipóteses acadêmicas, não calibradas. Dado histórico agregado por dia não sustenta padrões por hora.
- **Credenciais demo públicas** em `prisma/demo-users.ts` (exceção deliberada, só para seed; senhas gravadas com hash no banco).
- **Rate limit de login em memória:** em ambiente serverless cada instância tem seu contador; é uma proteção best-effort.
- **Tiles do mapa:** o estilo padrão (demo tiles do MapLibre) tem cobertura limitada; para uso real escolha um provedor com plano gratuito compatível e respeite a atribuição.
- **Neon free tier:** armazenamento e computação limitados; o banco pode "dormir" e a primeira consulta ser lenta.

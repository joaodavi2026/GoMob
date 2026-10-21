# GOMOB — MASTER DEVELOPMENT SPECIFICATION
## Intelligent Urban Mobility | Full Stack | Premium Experience

**MISSÃO:** Construir integralmente o GoMob, uma aplicação web Full Stack profissional de mobilidade urbana para São Paulo, com rastreamento operacional de ônibus, planejamento de trajetos, estimativas inteligentes de risco de superlotação, previsões e administração de dados.

Este documento é uma especificação executável para o Claude Code. Não é apenas uma referência de design.

O objetivo é implementar código funcional, persistência real, autenticação, integrações públicas, testes e preparação para deploy.

---

# PARTE 1 — REGRAS ABSOLUTAS

## 1.1. Instrução principal

Você é uma equipe composta por:

- Principal Software Architect
- Senior Full Stack Engineer
- Senior UI/UX Designer
- Senior Frontend Engineer
- Database Engineer
- Transit Data Engineer
- Quality Assurance Engineer
- DevOps Engineer

Trabalhe com o nível de atenção, consistência e refinamento de uma equipe sênior construindo um produto real.

**Não entregue apenas uma landing page. Não entregue telas estáticas. Não substitua funcionalidades reais por alertas genéricos.**

Cada tela precisa ter comportamento definido, estados de carregamento, persistência e tratamento de erros.

## 1.2. Restrições do projeto

- Orçamento obrigatório de infraestrutura: R$ 0.
- Projeto estritamente acadêmico, de demonstração.
- Não utilizar Supabase.
- Não depender de Firebase.
- Não exigir serviços pagos.
- Não habilitar faturamento automaticamente.
- Não contratar hospedagem de workers.
- Não exigir servidores próprios.
- Não criar microsserviços.
- Não criar repositórios separados.
- Não exigir Docker para executar.
- Não criar um aplicativo nativo separado.

O projeto deverá utilizar um único repositório Next.js, contendo frontend, backend, serviços de dados, autenticação e processamento.

O PostgreSQL do Neon será o banco externo gerenciado.

Se algum recurso não puder ser implementado gratuitamente, implementar uma alternativa funcional e documentar a limitação.

## 1.3. Tecnologias

Utilizar preferencialmente:

- Next.js com App Router
- React
- TypeScript em modo strict
- Tailwind CSS
- shadcn/ui
- Lucide Icons
- Motion, apenas quando contribuir para UX
- Neon PostgreSQL
- Prisma ORM
- Auth.js ou autenticação própria baseada em sessão segura
- Zod
- TanStack Query para dados remotos e sincronização
- MapLibre GL JS
- Vitest
- Playwright para testes essenciais
- Vercel Hobby
- GitHub

Consultar as versões estáveis compatíveis antes de instalar.

Evitar bibliotecas desnecessárias.

## 1.4. Modo real e modo demonstração

Criar dois modos claramente identificáveis.

**LIVE MODE**

Utilizar integrações reais disponíveis, como a API SPTrans Olho Vivo.

**DEMO MODE**

Utilizar dados determinísticos demonstrativos, com cenários reproduzíveis para apresentação acadêmica.

A aplicação deve funcionar mesmo quando a API oficial não estiver disponível.

Não misturar dados de demonstração com dados reais sem identificação.

Não inventar posições reais, ocupação observada ou horários oficiais.

---

# PARTE 2 — IDENTIDADE VISUAL PREMIUM

## 2.1. Conceito visual

Marca: GoMob

Slogan: **Go smarter. Ride better.**

Personalidade:

- Inteligente
- Moderna
- Urbana
- Confiável
- Tecnológica
- Minimalista
- Sofisticada

A experiência precisa parecer desenvolvida por uma equipe profissional de produto.

Referências conceituais de qualidade:

- Clareza visual do Apple Maps
- Facilidade de localização do Google Maps
- Fluidez do Uber
- Organização de dashboards SaaS modernos

Não copiar layouts, ilustrações ou identidades visuais existentes.

Criar uma linguagem própria para o GoMob.

## 2.2. Paleta oficial

| Token | Cor | Aplicação |
|---|---|---|
| Primary | #FF6B00 | Ações principais |
| Primary Hover | #E85D00 | Hover |
| Primary Pressed | #CC5200 | Pressed |
| Primary Light | #FFF1E6 | Fundos suaves |
| White | #FFFFFF | Fundo principal |
| Canvas | #F8F9FB | Fundo secundário |
| Ink | #17212B | Títulos |
| Muted | #687482 | Textos auxiliares |
| Border | #E6EAF0 | Divisórias |
| Green | #16A34A | Baixo risco |
| Amber | #D97706 | Risco moderado |
| Red | #DC2626 | Alto risco |
| Gray | #94A3B8 | Dados insuficientes |

Laranja e branco devem dominar a identidade.

Evitar usar o laranja em absolutamente tudo.

Utilizar cores de risco somente para comunicar estados operacionais.

## 2.3. Tipografia

Fonte principal: Inter ou Geist Sans.

Definir escala:

- Display: 40–52px desktop
- Heading 1: 32px
- Heading 2: 24px
- Heading 3: 20px
- Body: 14–16px
- Caption: 12–13px

Adaptar as escalas aos dispositivos.

Manter altura de linha adequada e excelente contraste.

## 2.4. Componentes

Criar um design system com:

- Primary Button
- Secondary Button
- Ghost Button
- Icon Button
- Text Input
- Search Input
- Autocomplete
- Combobox
- Dropdown
- Tabs
- Badge
- Modal
- Drawer
- Bottom Sheet
- Skeleton
- Tooltip
- Toast
- Empty State
- Error State
- Confirmation Dialog
- Route Card
- Bus Card
- Risk Indicator
- ETA Indicator
- Live Status
- Map Marker
- Metric Card
- Admin Data Table

Documentar variantes e estados.

Utilizar bordas suaves, sombras discretas, ícones consistentes e microinterações responsivas.

## 2.5. Logotipo

Criar um símbolo vetorial original inspirado em:

- Movimento
- Letra G
- Ponto de localização
- Caminho ou trajeto

Utilizar SVG.

Entregar versões para:

- Logo horizontal
- Logo reduzido
- Favicon
- Ícone de PWA
- Loading screen

---

# PARTE 3 — ARQUITETURA FULL STACK

## 3.1. Organização do projeto

Criar estrutura semelhante a:

```text
gomob/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── public/
│   ├── branding/
│   └── icons/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   ├── (passenger)/
│   │   ├── admin/
│   │   └── api/
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── maps/
│   │   ├── transit/
│   │   └── admin/
│   ├── features/
│   │   ├── auth/
│   │   ├── routes/
│   │   ├── tracking/
│   │   ├── intelligence/
│   │   ├── predict/
│   │   └── favorites/
│   ├── server/
│   │   ├── db/
│   │   ├── auth/
│   │   ├── sptrans/
│   │   └── transit/
│   ├── lib/
│   ├── hooks/
│   ├── types/
│   └── config/
├── tests/
├── .env.example
├── README.md
└── package.json
```

Ajustar conforme versões atuais do framework.

Regras:

- Frontend e backend permanecem no mesmo projeto.
- Nunca expor tokens da SPTrans no navegador.
- Acesso ao Neon exclusivamente pelo servidor.
- Validar entradas com Zod.
- Centralizar lógica de negócio fora dos componentes React.
- Utilizar módulos compartilháveis e tipados.
- Separar implementação de provedores externos para permitir substituição.

## 3.2. Fluxo de dados

Fluxo principal:

1. Usuário acessa o GoMob.
2. Next.js verifica a sessão.
3. Usuário pesquisa linha ou trajeto.
4. Backend consulta provedores autorizados.
5. Backend normaliza os resultados.
6. Serviço de inteligência processa os dados disponíveis.
7. Backend retorna dados estruturados.
8. Frontend renderiza mapa, rotas e indicadores.
9. TanStack Query controla cache e atualização.
10. O banco registra favoritos, configurações e dados persistidos autorizados.

Implementar atualização sob demanda enquanto houver usuários ativos, com intervalos configuráveis, cache e controle de concorrência.

Não criar processo contínuo em memória esperando permanecer ativo na Vercel.

---

# PARTE 4 — AUTENTICAÇÃO E BANCO NEON

## 4.1. Contas demonstrativas

Criar apenas dois usuários:

**PASSENGER**
- Conta de passageiro
- Acesso às funcionalidades públicas autenticadas

**ADMIN**
- Conta administrativa
- Acesso ao painel de gerenciamento

Não criar cadastro público.

Não criar fluxo de confirmação por e-mail.

Não integrar serviços de envio de e-mail.

## 4.2. Credenciais definidas no código

Por ser uma aplicação acadêmica, criar arquivo:

`prisma/demo-users.ts`

O arquivo poderá conter as credenciais iniciais demonstrativas em texto simples, exclusivamente para a operação de seed.

Exemplo:

```ts
export const demoUsers = [
  {
    name: "GoMob Passenger",
    email: "usuario@gomob.demo",
    password: "GoMobUser2026!",
    role: "USER"
  },
  {
    name: "GoMob Administrator",
    email: "admin@gomob.demo",
    password: "GoMobAdmin2026!",
    role: "ADMIN"
  }
] as const;
```

Essas credenciais não dão acesso a serviços externos.

O seed deverá aplicar hashing nas senhas antes de gravá-las no Neon.

**Não armazenar senhas em texto simples nas tabelas do PostgreSQL.**

O arquivo demonstrativo pode permanecer no código acadêmico, mas deve ser tratado como público.

Não reutilizar essas senhas em outros serviços.

O fluxo de autenticação deverá funcionar com essas credenciais após executar o seed.

## 4.3. Tela de login — `/login`

Esta tela precisa ser visualmente extraordinária.

### Layout desktop

Dividir em duas áreas.

**Área esquerda — Branding**

Fundo laranja #FF6B00.

Logotipo branco GoMob.

Headline:

"Move smarter. Live better."

Descrição:

"Smart routes. Live buses. Better journeys."

Criar composição vetorial original de trajetos, marcadores, ônibus e linhas urbanas.

Adicionar efeitos gráficos discretos, sem comprometer a performance.

**Área direita — Autenticação**

Fundo branco.

Título:

"Welcome to GoMob"

Descrição:

"Sign in to continue your journey."

Campos:

- Email
- Password

Botão:

"Sign in"

Ação secundária:

Mostrar/ocultar senha.

Rodapé:

"GoMob — Intelligent Urban Mobility"

### Comportamento

1. Usuário digita e-mail.
2. Usuário digita senha.
3. Formulário valida os campos.
4. Botão apresenta loading.
5. Backend verifica credenciais.
6. Backend verifica papel do usuário.
7. Cria sessão segura.
8. Redireciona segundo a permissão.

USER → `/home`

ADMIN → `/admin`

### Estados obrigatórios

- Campos vazios
- E-mail inválido
- Senha incorreta
- Credenciais não encontradas
- Carregando
- Falha de conexão
- Login bem-sucedido

Não revelar se uma conta específica existe.

### Layout mobile

- Logo centralizada
- Título de boas-vindas
- Formulário vertical
- Botão em largura total
- Ilustração reduzida
- Sem rolagem horizontal

## 4.4. Sessões e autorização

Implementar cookies HttpOnly, Secure em produção e SameSite apropriado.

O backend precisa impedir que USER acesse rotas administrativas mesmo digitando a URL diretamente.

Não confiar em checagens apenas no frontend.

Criar logout real, encerrando a sessão.

---

# PARTE 5 — MODELO DE DADOS

## 5.1. Entidades

Criar modelos Prisma para:

### User

- id
- name
- email único
- passwordHash
- role
- createdAt
- updatedAt

### Favorite

- id
- userId
- originLabel
- destinationLabel
- originLatitude
- originLongitude
- destinationLatitude
- destinationLongitude
- nickname
- createdAt

### BusLine

- id
- externalCode
- displayCode
- name
- direction
- active
- source
- lastSyncedAt

### BusStop

- id
- externalCode
- name
- latitude
- longitude
- source

### BusLineStop

Relacionamento entre linhas e paradas, com sequência quando conhecida.

### BusVehicle

- id
- externalIdentifier
- lineId
- latitude
- longitude
- observedAt
- source
- isDemo

### PositionSnapshot

- id
- vehicleId
- latitude
- longitude
- observedAt

### HistoricalDemand

- id
- lineId
- referenceDate
- passengerCount
- granularity
- source

### RiskEstimate

- id
- lineId
- vehicleId opcional
- riskScore
- riskLevel
- confidence
- calculatedAt
- expiresAt
- modelVersion
- sourceType

### Alert

- id
- lineId
- type
- title
- description
- createdAt
- expiresAt
- isDemo

### AppSetting

- key
- value
- updatedAt

### AuditLog

- id
- actorId
- action
- entityType
- entityId
- createdAt

Adicionar índices adequados.

Usar chaves estrangeiras.

Criar migrations e seed idempotente.

## 5.2. Estratégia de persistência

No Neon armazenar:

- Usuários
- Senhas com hash
- Favoritos
- Configurações
- Linhas monitoradas
- Histórico limitado necessário à demonstração
- Resultados calculados quando justificados
- Eventos administrativos

Não armazenar indiscriminadamente todas as posições de todos os ônibus da cidade.

Aplicar retenção de dados e evitar crescimento infinito.

Preferir dados oficiais recentes em cache de curta duração quando não for necessário persistir.

---

# PARTE 6 — HOME DO PASSAGEIRO

## 6.1. Rota `/home`

A Home deve comunicar qualidade imediatamente.

### Cabeçalho

Logotipo GoMob à esquerda.

À direita:

- Indicador discreto de fonte dos dados
- Avatar
- Menu de perfil

### Hero principal

Título:

**"Where are we going today?"**

Subtítulo:

"Find smarter bus routes across São Paulo."

### Pesquisa

Criar módulo com:

**Origin**
- Campo com ícone de localização
- Autocomplete quando houver fonte apropriada
- Seleção no mapa
- Localização atual mediante permissão

**Destination**
- Campo com ícone de destino
- Busca textual
- Seleção no mapa

Botão para inverter origem e destino.

CTA laranja:

**"Find my route"**

### Conteúdo inferior

Seções:

"Your favorite journeys"

"Explore bus lines"

"Live bus updates"

"GoMob Intelligence"

Cada componente deve possuir comportamento real.

### Responsividade

No desktop, a Home terá distribuição equilibrada entre pesquisa, mapa e informações.

No mobile, utilizar layout vertical e CTA de fácil acesso.

---

# PARTE 7 — GOMOB MAPS

## 7.1. Objetivo

Exibir um mapa funcional da cidade de São Paulo, com linhas, paradas e ônibus disponíveis.

## 7.2. Tecnologia

Utilizar MapLibre GL JS como base.

Selecionar fonte cartográfica com condições gratuitas de utilização compatíveis com o protótipo.

Respeitar atribuições e limites do provedor de tiles.

Não presumir que servidores públicos do OpenStreetMap ofereçam capacidade ilimitada.

Não utilizar Google Maps obrigatoriamente.

## 7.3. Interações

Implementar:

- Zoom
- Pan
- Seleção de marcador
- Centralização
- Localização atual com autorização
- Abertura de detalhes
- Destaque de trajetos
- Filtro de linhas
- Botão para retornar à visualização principal

## 7.4. Marcadores

Criar marcador próprio para ônibus.

Visual:

Ícone minimalista de veículo dentro de uma superfície branca com destaque laranja.

Quando selecionado:

- Aumentar discretamente o marcador
- Destacar a linha correspondente
- Abrir painel de detalhes

Não utilizar dezenas de animações simultâneas.

## 7.5. Painel de detalhes do ônibus

Exibir:

- Linha
- Sentido
- Identificação
- Horário da posição
- Status da informação
- Risco estimado, quando disponível
- Link para detalhes da linha

Caso o dado esteja desatualizado, não exibir como posição atual confirmada.

---

# PARTE 8 — INTEGRAÇÃO SPTRANS OLHO VIVO

## 8.1. Provedor oficial

Documentação:

https://www.sptrans.com.br/desenvolvedores/api-do-olho-vivo-guia-de-referencia/documentacao-api/

Antes da implementação, verificar a documentação atual, a versão da API, os requisitos de acesso e as condições de utilização.

Criar adaptador de integração server-side.

## 8.2. Autenticação

A API usa token e autenticação de sessão.

Implementar fluxo conforme documentação oficial:

1. Ler token de variável de ambiente.
2. Efetuar autenticação.
3. Preservar cookies de sessão, quando necessários.
4. Executar consultas autenticadas.
5. Tratar falhas e expiração.
6. Renovar sessão conforme necessidade.

Variável:

`SPTRANS_API_TOKEN`

Nunca enviar o token ao navegador.

## 8.3. Operações

Implementar, conforme disponibilidade e documentação:

- Busca de linhas
- Consulta de paradas
- Consulta de paradas por linha
- Consulta de posições por linha
- Previsão de chegada
- Metadados operacionais

Não inventar endpoints.

Se alguma operação não estiver disponível, documentar e utilizar alternativa demonstrativa.

## 8.4. Normalização

Criar modelo interno padronizado para todas as respostas.

Exemplo conceitual:

```ts
type TransitVehicle = {
  id: string;
  lineId: string;
  latitude: number;
  longitude: number;
  observedAt: string;
  source: "SPTRANS" | "DEMO";
};
```

Adaptar formatos reais, incluindo datas, fusos horários e identificadores.

Não inferir localização atual quando houver apenas observação antiga.

## 8.5. Atualização

Criar um serviço de consulta com:

- Cache
- Intervalo mínimo configurável
- Timeout
- Retries limitados
- Tratamento de rate limit
- Evitar chamadas concorrentes redundantes
- Cancelamento de requisições
- Indicador de última atualização

Utilizar polling sob demanda no frontend, enquanto a tela relevante estiver ativa.

Intervalo demonstrativo inicial: aproximadamente 30–60 segundos, ajustável segundo limites efetivos da API e hospedagem.

Não prometer atualização a cada segundo.

Não consultar toda a frota indiscriminadamente.

Para o MVP, começar com três a cinco linhas reais.

## 8.6. Estados da integração

- Connected
- Updating
- Temporarily unavailable
- Stale data
- Demo mode

Mostrar origem dos dados.

Se a API falhar, manter uma experiência compreensível, com opção demonstrativa explicitamente identificada.

---

# PARTE 9 — SMART ROUTES

## 9.1. Página `/routes`

Objetivo: permitir encontrar e comparar trajetos exclusivamente de ônibus.

Não incluir metrô, trem ou VLT.

Trechos a pé são permitidos para chegar aos pontos e realizar transferências.

## 9.2. Planejamento de rotas

Criar uma interface:

```ts
interface RouteProvider {
  searchRoutes(
    origin: GeoPoint,
    destination: GeoPoint
  ): Promise<BusRouteOption[]>;
}
```

Implementar inicialmente um provedor demonstrativo funcional com trajetos geograficamente coerentes e identificados.

Preparar suporte a GTFS estático, se houver um conjunto de dados utilizável e autorizado.

A SPTrans Olho Vivo não deve ser tratada automaticamente como uma API completa de roteamento entre dois endereços.

Não afirmar que encontrar ônibus próximos equivale a calcular um trajeto válido.

Para roteamento baseado em GTFS, validar sequências de pontos, sentidos, conexões e horários disponíveis.

Se essas condições não estiverem presentes, restringir a demonstração a trajetos previamente validados.

## 9.3. Google Routes — integração opcional

Preparar adaptador opcional, desativado por padrão.

Somente implementar chamadas reais quando o usuário disponibilizar uma chave válida e autorizar o uso de um serviço que exige faturamento habilitado.

Quando habilitado, solicitar modo TRANSIT com preferência BUS, conforme a documentação vigente.

Validar cada etapa retornada.

Rejeitar rotas contendo qualquer transporte coletivo diferente de ônibus.

Aceitar etapas de caminhada.

Não utilizar esse serviço como dependência obrigatória.

## 9.4. Interface dos resultados

Cada Route Card mostrará:

- Linha ou combinação de linhas
- Origem e destino
- Duração, quando conhecida
- Caminhada estimada
- Número de transferências
- Risco estimado
- Horário dos dados
- Fonte
- Botão "View route"

Criar diferenças visuais claras entre opções.

## 9.5. Ordenação

Permitir:

- Fastest
- Fewer transfers
- Less walking
- Lower estimated crowding risk

Não atribuir uma classificação de menor risco quando os dados disponíveis forem insuficientes.

## 9.6. Detalhamento

Quando uma rota for selecionada:

1. Destacar o percurso no mapa.
2. Abrir painel com etapas.
3. Mostrar pontos de embarque.
4. Mostrar pontos de desembarque.
5. Apresentar transferências.
6. Mostrar estimativa de risco por linha, quando existir.
7. Permitir salvar nos favoritos.

Criar estados distintos para rota selecionada, indisponível e não encontrada.

---

# PARTE 10 — GOMOB INTELLIGENCE

## 10.1. Objetivo

Desenvolver o mecanismo de estimativa de risco de superlotação.

A aplicação não dispõe necessariamente de sensores de ocupação.

Portanto, o sistema NÃO deve afirmar quantos passageiros existem dentro do ônibus.

O GoMob Intelligence estimará o risco a partir de sinais operacionais e dados históricos disponíveis.

## 10.2. Variáveis

Criar quatro indicadores normalizados entre 0 e 100.

**D — Historical Demand**

Indicador de demanda histórica.

Usar somente a granularidade realmente disponível.

Dados agregados por dia não demonstram diretamente picos por hora.

**I — Headway Irregularity**

Irregularidade de intervalos entre ônibus.

Comparar os intervalos observados com os esperados, quando houver referência confiável.

**A — Delay Indicator**

Indicador de atraso operacional.

Calcular apenas quando existirem referências temporais válidas.

**O — Operational Irregularity**

Indicador de distribuição irregular de veículos.

Utilizar espaçamento, agrupamentos ou sinais operacionais quando os dados permitirem.

## 10.3. Fórmula inicial

Implementar:

```ts
riskScore =
  0.35 * demand +
  0.30 * headwayIrregularity +
  0.20 * delay +
  0.15 * operationalIrregularity;
```

Os pesos são hipóteses de demonstração acadêmica, não parâmetros cientificamente validados.

## 10.4. Tratamento de dados ausentes

Não converter automaticamente ausência de dados em zero.

Não transformar "sem dados" em "baixo risco".

Criar resultado discriminado:

```ts
type RiskResult = {
  score: number | null;
  level:
    | "LOW"
    | "MODERATE"
    | "HIGH"
    | "INSUFFICIENT_DATA";
  confidence: number | null;
  factors: {
    demand: number | null;
    headway: number | null;
    delay: number | null;
    operations: number | null;
  };
  source: "OFFICIAL" | "DERIVED" | "DEMO";
  calculatedAt: string;
  explanation: string;
};
```

Definir uma política explícita para pontuação incompleta.

No MVP, preferir "Dados insuficientes" quando fatores essenciais estiverem ausentes.

Não fabricar valores apenas para completar a fórmula.

## 10.5. Classificação

- 0–34: Low risk
- 35–69: Moderate risk
- 70–100: High risk
- Informação insuficiente: Unknown

A pontuação não é porcentagem de ocupação.

A pontuação não é probabilidade de superlotação cientificamente calibrada.

## 10.6. Confiança

Criar indicador de qualidade baseado em:

- Disponibilidade dos fatores
- Atualidade
- Consistência temporal
- Origem dos dados
- Granularidade disponível

A confiança não deve ser apresentada como precisão estatística comprovada.

## 10.7. Explicabilidade

O usuário poderá abrir "Why this risk?"

Exibir uma explicação amigável.

Exemplo:

"Higher risk estimated due to irregular bus intervals and operational delays."

Mostrar os fatores efetivamente calculados.

Não citar fatores indisponíveis como se tivessem sido observados.

---

# PARTE 11 — GOMOB PREDICT

## 11.1. Página `/predict`

Criar interface premium para consultas futuras.

Headline:

**"Plan ahead. Travel smarter."**

Descrição:

"Explore estimated crowding risks before your next bus journey."

## 11.2. Entradas

- Linha de ônibus
- Dia da semana ou data
- Horário desejado
- Sentido, quando necessário

CTA:

"Predict risk"

## 11.3. Resultado

Exibir:

- Linha selecionada
- Horário
- Classificação estimada
- Explicação
- Qualidade dos dados
- Fonte histórica
- Limitações

## 11.4. Regras

O sistema só pode produzir previsões baseadas em padrões quando esses padrões puderem ser sustentados pelos dados disponíveis.

Não extrair padrões horários de arquivos agregados exclusivamente por dia.

Implementar DEMO MODE com cenários de previsão explícitos, quando necessário.

Não chamar um resultado ilustrativo de previsão validada.

---

# PARTE 12 — SMART RECOMMENDATION

Implementar sistema de recomendação entre alternativas válidas.

Critérios:

- Tempo da viagem
- Transferências
- Caminhada
- Risco estimado
- Disponibilidade de informações

Não recomendar uma rota inexistente.

Não inventar conexão entre duas linhas sem evidência de que a transferência é possível.

Separar:

**Fastest Route**

Alternativa de menor duração conhecida.

**Fewer Transfers**

Alternativa com menos baldeações.

**Lower Estimated Risk**

Alternativa de menor risco quando houver dados comparáveis.

**Balanced Route**

Alternativa calculada por critérios ponderados.

As regras devem ser transparentes.

Evitar transformar ausência de dados em vantagem competitiva de uma rota.

---

# PARTE 13 — LIVE ALERTS

## 13.1. Alertas

Criar sistema contextual de alertas:

- Dados desatualizados
- Falha temporária da API
- Intervalos elevados observados
- Atrasos inferidos com referência válida
- Mudanças relevantes na estimativa de risco

Não inventar incidentes oficiais, desvios de linha ou acidentes.

## 13.2. Interface

Exibir alertas em:

- Home
- Página da linha
- Detalhamento da rota
- Central de alertas

Criar notificações visuais discretas.

Não exigir push notifications de navegador.

## 13.3. Persistência

Permitir salvar preferências simples por usuário.

Implementar atualização por polling somente quando necessário.

---

# PARTE 14 — FAVORITOS

## 14.1. Página `/favorites`

O usuário poderá salvar trajetos.

Cada favorito exibirá:

- Nome personalizado
- Origem
- Destino
- Botão para pesquisar novamente
- Botão para editar
- Botão para remover

## 14.2. Comportamento

Ao clicar em "Save route":

1. Verificar sessão.
2. Validar dados.
3. Persistir no Neon.
4. Exibir confirmação.
5. Atualizar interface.

Ao remover:

1. Exibir confirmação quando apropriado.
2. Excluir do banco.
3. Atualizar lista.
4. Exibir feedback.

Não armazenar favoritos apenas no localStorage.

---

# PARTE 15 — PERFIL

## 15.1. Página `/profile`

Criar interface com:

- Avatar
- Nome
- E-mail
- Papel do usuário
- Data de criação
- Preferências
- Favoritos
- Sobre o GoMob
- Logout

Permitir editar nome de exibição.

Não permitir editar papel do usuário.

Não incluir troca pública de senha no MVP acadêmico.

Exibir informações institucionais do projeto.

---

# PARTE 16 — PAINEL ADMINISTRATIVO

## 16.1. Layout geral

Rota principal: `/admin`

Criar dashboard SaaS premium, inteiramente responsivo.

Desktop:

- Sidebar lateral branca
- Logo GoMob
- Navegação organizada
- Indicador do modo operacional
- Header com título e avatar
- Área principal em fundo cinza muito claro

Mobile:

- Menu lateral em drawer
- Navegação confortável
- Cards adaptados
- Tabelas com visualização compacta

## 16.2. Sidebar

Navegação:

- Overview
- Bus Lines
- Live Vehicles
- Intelligence
- Predictions
- Data Sources
- System Settings

## 16.3. Overview

Criar indicadores:

**Monitored Lines**

Total de linhas configuradas.

**Tracked Vehicles**

Veículos com observações recentes.

**Available Estimates**

Estimativas válidas.

**API Status**

Estado das integrações.

Criar gráficos:

- Risk Distribution
- Latest Observations
- Monitored Lines
- Data Freshness

Não fabricar métricas como se fossem resultados oficiais.

Identificar modo de demonstração.

## 16.4. Bus Lines

Criar tabela com:

- Código
- Nome
- Sentido
- Fonte
- Status
- Última sincronização

Funcionalidades:

- Pesquisar
- Filtrar
- Visualizar
- Ativar monitoramento
- Desativar monitoramento

Não permitir que a edição local altere dados na SPTrans.

O administrador controla somente a configuração interna do GoMob.

## 16.5. Live Vehicles

Exibir tabela com:

- ID do veículo
- Linha
- Última posição
- Horário
- Fonte
- Estado da atualização

Adicionar filtros por linha.

Ao selecionar veículo, abrir detalhes e localizar no mapa.

## 16.6. Intelligence

Criar painel com:

- Pesos do algoritmo
- Definição dos fatores
- Resultados calculados
- Qualidade dos dados
- Horário de cálculo
- Explicações

O administrador poderá ajustar os pesos em DEMO MODE.

Validar soma dos pesos igual a 1.

Registrar mudanças relevantes.

Não afirmar que um ajuste de pesos representa treinamento de inteligência artificial.

## 16.7. Data Sources

Exibir:

- SPTrans API
- Historical Data
- Route Provider
- Map Provider
- Demo Provider

Cada integração deve mostrar:

- Configurada
- Disponível
- Última consulta
- Última falha
- Estado atual

Não exibir tokens secretos.

## 16.8. Demo Control Center

Esta tela é fundamental para a apresentação.

Criar `/admin/demo`.

Permitir controlar cenários demonstrativos:

**Scenario A — Normal operation**

Veículos com intervalos regulares e baixo risco hipotético.

**Scenario B — High crowding risk**

Intervalos irregulares, atrasos e aumento do risco hipotético.

**Scenario C — Data unavailable**

Dados insuficientes ou desatualizados.

**Scenario D — Recovery**

Retorno gradual a um cenário de operação normal.

Ao executar um cenário:

1. Persistir estado demonstrativo no Neon.
2. Registrar horário e responsável.
3. Atualizar o estado do sistema.
4. Refletir alterações nas telas abertas mediante polling.
5. Exibir claramente que são dados demonstrativos.

Criar botão "Reset demo".

Não alterar registros operacionais reais recebidos da SPTrans.

---

# PARTE 17 — ENDPOINTS

Criar endpoints REST internos apropriados.

Estrutura sugerida:

```text
/api/auth/*
/api/lines
/api/lines/[id]
/api/lines/[id]/vehicles
/api/lines/[id]/stops
/api/vehicles
/api/vehicles/[id]
/api/routes/search
/api/intelligence/risk
/api/predict
/api/favorites
/api/favorites/[id]
/api/alerts
/api/system/status
/api/admin/overview
/api/admin/lines
/api/admin/settings
/api/admin/demo
```

Definir operações HTTP adequadas.

Aplicar:

- Validação Zod
- Autorização
- Respostas padronizadas
- Erros consistentes
- Cache quando aplicável
- Paginação em listas
- Limites de requisição quando possível

Documentar formatos básicos de request e response.

---

# PARTE 18 — EXPERIÊNCIA MOBILE

O principal formato de uso será smartphone.

## 18.1. Navegação inferior

Criar bottom navigation com:

- Home
- Routes
- Map
- Favorites
- Profile

Utilizar ícones Lucide consistentes.

Destacar aba ativa em laranja.

## 18.2. Mapas

No mobile:

- Mapa ocupa a área principal.
- Painéis abrem por bottom sheet.
- Resultados de rota podem ser expandidos.
- Controles respeitam safe areas.
- Nenhum elemento obstrui ações críticas.

## 18.3. Transições

Criar transições suaves entre:

- Home e pesquisa
- Pesquisa e resultados
- Resultados e detalhes
- Mapa e veículo
- Login e dashboard

Evitar animações lentas.

## 18.4. PWA

Preparar Web App Manifest, ícones e metadados para instalação.

Não exigir uso offline completo.

Se implementar service worker, evitar cache de dados de localização em tempo real de forma enganosa.

---

# PARTE 19 — ESTADOS E DETALHES DE UX

Implementar estados reais em todos os módulos:

**Loading**

Skeletons bem desenhados, alinhados ao conteúdo.

**Empty**

Mensagens claras com ações úteis.

**Error**

Explicar o problema sem apresentar mensagens técnicas internas.

**Success**

Toast discreto ou confirmação contextual.

**Disconnected**

Informar indisponibilidade.

**Stale**

Informar a antiguidade da observação.

**Demo**

Identificar fonte demonstrativa de forma visível.

Exemplos de mensagens:

"No bus routes found."

"Live data is temporarily unavailable."

"Last updated 2 minutes ago."

"Academic demonstration data."

"Insufficient data to estimate crowding risk."

Não usar botões sem implementação.

---

# PARTE 20 — QUALIDADE, SEGURANÇA E PERFORMANCE

## 20.1. Qualidade

- TypeScript strict
- Componentização
- Código limpo
- Funções testáveis
- Nomes consistentes
- Sem any desnecessário
- Sem código morto
- Sem erros de hidratação
- Sem warnings evitáveis
- Tratamento de erros assíncronos

## 20.2. Segurança

- Hash de senhas persistidas
- Sessões seguras
- Verificação de permissões no servidor
- SQL parametrizado por ORM
- Validação de entradas
- Sem tokens de API no cliente
- Sem DATABASE_URL exposta
- Proteção de endpoints administrativos
- Cookies adequados
- Rate limiting viável
- Sem segredos em logs

As credenciais demonstrativas hardcoded no seed são uma exceção deliberada e documentada.

Não confundir essa decisão com autorização para expor tokens reais da SPTrans ou senhas de produção.

## 20.3. Performance

Priorizar:

- Renderização eficiente
- Carregamento dinâmico do mapa
- Cache de resultados
- Consultas SQL eficientes
- Paginação
- Evitar re-renderizações desnecessárias
- Deduplicação de chamadas
- Redução do consumo de APIs externas
- Controle de atualização em abas inativas

---

# PARTE 21 — TESTES

Criar testes automatizados para:

**Autenticação**
- Login válido
- Login inválido
- Logout
- Expiração de sessão
- Permissão USER
- Permissão ADMIN

**Banco**
- Seed idempotente
- Criação de favoritos
- Exclusão de favoritos
- Persistência
- Integridade de dados

**Transporte**
- Normalização da SPTrans
- Erro de autenticação externa
- Resposta vazia
- Dados antigos
- Identificadores inválidos

**Intelligence**
- Cálculo correto
- Normalização
- Classificação
- Tratamento de fatores ausentes
- Limites de valores

**Smart Routes**
- Pesquisa válida
- Nenhuma rota
- Rotas exclusivamente de ônibus
- Rejeição de trem e metrô
- Ordenação
- Seleção

**Admin**
- Acesso autorizado
- Acesso negado ao USER
- Mudança de cenário demonstrativo
- Atualização no frontend

**Responsividade**
- Mobile
- Tablet
- Desktop

Executar typecheck, lint, testes e build de produção.

Não declarar testes aprovados sem executá-los.

---

# PARTE 22 — HOSPEDAGEM ZERO CUSTO

## 22.1. Vercel

Preparar publicação no plano Hobby, respeitando os termos atuais de uso, os limites e as condições de elegibilidade do projeto acadêmico.

Não pressupor capacidade de processamento ilimitada.

Não hospedar processo permanente dentro de funções serverless.

Não depender de Cron Jobs de alta frequência no plano gratuito.

## 22.2. Neon

Utilizar Neon PostgreSQL no plano gratuito enquanto o uso e as condições forem compatíveis.

Preparar:

- DATABASE_URL
- Migrações
- Seed
- Conexão otimizada para ambiente serverless
- Instruções de configuração

Não assumir armazenamento ou computação ilimitados.

## 22.3. Dados em tempo real

Utilizar consultas sob demanda, cache e polling leve.

O frontend consulta o próprio backend.

O backend consulta a SPTrans e reutiliza resultados quando apropriado.

Esse modelo não garante ingestão contínua de dados quando ninguém está utilizando o GoMob.

Documentar essa limitação.

## 22.4. Sem surpresas financeiras

Antes de adicionar qualquer serviço, verificar:

1. Existe plano gratuito?
2. Exige cartão?
3. Exige faturamento habilitado?
4. Quais são os limites?
5. Existe risco de cobrança automática?
6. Há alternativa aberta ou demonstrativa?

Se exigir faturamento obrigatório, não habilitar sem autorização explícita.

---

# PARTE 23 — ORDEM EXATA DE IMPLEMENTAÇÃO

**ATENÇÃO: Execute o trabalho de maneira incremental, não apenas descreva as etapas.**

## FASE 01 — Fundação

1. Inspecionar diretório.
2. Criar projeto Next.js.
3. Instalar dependências essenciais.
4. Configurar Tailwind.
5. Configurar TypeScript.
6. Criar pastas.
7. Criar variáveis de ambiente de exemplo.
8. Criar README inicial.
9. Executar build.

Entregável: aplicação base executando.

## FASE 02 — Design System

1. Implementar tokens de cores.
2. Configurar tipografia.
3. Criar componentes fundamentais.
4. Criar logotipo SVG.
5. Criar layouts desktop e mobile.
6. Configurar navegação.
7. Refinar estados de interação.

Entregável: sistema visual consistente.

## FASE 03 — Banco e autenticação

1. Configurar Neon.
2. Criar schema Prisma.
3. Criar migrações.
4. Implementar seed.
5. Criar contas USER e ADMIN.
6. Implementar autenticação.
7. Proteger rotas.
8. Criar logout.
9. Executar testes.

Entregável: acesso real com permissões.

## FASE 04 — Telas base

1. Criar login premium.
2. Criar Home.
3. Criar Perfil.
4. Criar Favoritos.
5. Criar dashboard administrativo.
6. Validar responsividade.

Entregável: navegação completa.

## FASE 05 — Mapas

1. Integrar MapLibre.
2. Configurar fonte cartográfica.
3. Criar marcadores.
4. Criar painel de detalhes.
5. Implementar geolocalização opcional.
6. Implementar seleção de pontos.
7. Testar mobile.

Entregável: mapa funcional.

## FASE 06 — SPTrans

1. Verificar documentação oficial.
2. Configurar token.
3. Implementar autenticação da API.
4. Buscar linhas.
5. Buscar paradas.
6. Consultar posições.
7. Consultar previsões disponíveis.
8. Normalizar respostas.
9. Implementar cache.
10. Implementar fallback de demonstração.

Entregável: dados operacionais reais quando disponíveis.

## FASE 07 — Smart Routes

1. Criar interface de busca.
2. Implementar provedor demonstrativo validado.
3. Preparar integração com fonte de roteamento real.
4. Implementar filtro exclusivo BUS.
5. Criar listagem de alternativas.
6. Criar detalhes.
7. Implementar ordenação.
8. Integrar favoritos.
9. Validar rotas.

Entregável: planejamento de trajetos demonstráveis.

## FASE 08 — Intelligence

1. Criar modelos de dados.
2. Implementar fatores.
3. Criar fórmula.
4. Criar classificação.
5. Tratar dados ausentes.
6. Implementar explicações.
7. Exibir risco nos cards e mapa.
8. Executar testes matemáticos.

Entregável: mecanismo de estimativa transparente.

## FASE 09 — Predict

1. Criar tela.
2. Implementar seleção de linha e horário.
3. Integrar dados históricos utilizáveis.
4. Criar lógica de previsão limitada à evidência.
5. Criar cenários demonstrativos.
6. Exibir resultado e limitações.

Entregável: módulo de previsão demonstrável.

## FASE 10 — Smart Recommendation e Alerts

1. Comparar rotas válidas.
2. Implementar critérios.
3. Exibir recomendações explicáveis.
4. Criar alertas de dados desatualizados.
5. Criar alertas operacionais justificáveis.
6. Integrar tudo às telas.

Entregável: funcionalidades inteligentes integradas.

## FASE 11 — Admin Demo Control

1. Criar tela de cenários.
2. Criar persistência.
3. Implementar mudança de estado.
4. Sincronizar com sessão USER.
5. Criar reset.
6. Validar permissões.
7. Testar em dois navegadores.

Entregável: demonstração interativa entre admin e passageiro.

## FASE 12 — Finalização e deploy

1. Revisar UX.
2. Corrigir inconsistências.
3. Executar testes.
4. Executar build.
5. Revisar segurança.
6. Configurar variáveis.
7. Documentar Neon.
8. Documentar SPTrans.
9. Documentar Vercel.
10. Criar roteiro acadêmico de apresentação.

Entregável: aplicação pronta para publicação e demonstração.

---

# PARTE 24 — PROTOCOLO DE EXECUÇÃO DO CLAUDE CODE

O trabalho deverá seguir estas regras:

1. Inspecione primeiro o ambiente e os arquivos existentes.
2. Preserve código funcional já implementado.
3. Não substitua código por pseudocódigo.
4. Não deixe botões sem comportamento.
5. Não invente resultados de APIs.
6. Não invente testes aprovados.
7. Não instale serviços pagos.
8. Execute cada fase até atingir seu critério de aceitação.
9. Registre decisões técnicas em `docs/architecture.md`.
10. Registre progresso em `docs/progress.md`.
11. Registre limitações em `docs/limitations.md`.
12. Atualize a documentação ao concluir etapas.
13. Se faltar token ou acesso externo, implemente a interface do adaptador e o modo demonstrativo.
14. Nunca bloqueie todo o projeto por causa de uma única API indisponível.
15. Evite refatorações completas desnecessárias.
16. Ao retomar após interrupção, leia os arquivos de progresso e continue da última etapa validada.

Ao concluir cada fase, apresente:

- O que foi implementado.
- Arquivos principais criados.
- Como testar.
- Testes efetivamente executados.
- Problemas encontrados.
- Dependências externas pendentes.
- Próxima fase.

Não solicite aprovação a cada alteração trivial.

Solicite confirmação somente para operações destrutivas, decisões irreversíveis, ativação de faturamento ou configurações externas que dependam de autorização.

---

# PARTE 25 — ROTEIRO DE DEMONSTRAÇÃO ACADÊMICA

A aplicação deverá permitir apresentar o seguinte fluxo:

**Cena 1 — Login**

Abrir GoMob.

Demonstrar identidade visual.

Entrar como USER.

**Cena 2 — Home**

Apresentar busca de origem e destino.

Pesquisar um percurso em São Paulo.

**Cena 3 — Smart Routes**

Exibir opções exclusivamente de ônibus.

Comparar duração, transferências e risco estimado.

**Cena 4 — Live Map**

Selecionar uma linha real monitorada.

Exibir posições fornecidas pela SPTrans, se disponíveis.

Mostrar horário e fonte das observações.

**Cena 5 — Intelligence**

Exibir classificação de risco.

Abrir explicação dos fatores utilizados.

Explicar a diferença entre risco estimado e ocupação observada.

**Cena 6 — Predict**

Selecionar uma linha e horário futuro.

Apresentar previsão fundamentada ou cenário demonstrativo identificado.

**Cena 7 — Administração**

Abrir outra sessão como ADMIN.

Mostrar dashboard.

Entrar no Demo Control Center.

Selecionar cenário de alto risco.

**Cena 8 — Atualização**

Retornar à sessão USER.

Aguardar sincronização.

Demonstrar a mudança na estimativa demonstrativa.

**Cena 9 — Favoritos**

Salvar trajeto.

Atualizar página.

Comprovar persistência no Neon.

**Cena 10 — Encerramento**

Mostrar funcionalidades, integrações, arquitetura e limitações.

---

# PARTE 26 — CRITÉRIOS FINAIS DE ACEITAÇÃO

A aplicação deverá satisfazer:

- [ ] Login funcional com duas contas.
- [ ] Sessões seguras.
- [ ] Controle de acesso por papel.
- [ ] Senhas armazenadas com hash no Neon.
- [ ] Design premium laranja e branco.
- [ ] Interface mobile-first.
- [ ] Navegação desktop funcional.
- [ ] Mapa interativo.
- [ ] Consulta de linhas.
- [ ] Integração SPTrans quando configurada e disponível.
- [ ] Modo demonstrativo independente.
- [ ] Identificação correta das fontes.
- [ ] Pesquisa de trajetos demonstrativa.
- [ ] Exclusividade de ônibus.
- [ ] Detalhamento de rotas.
- [ ] Cálculo de risco implementado.
- [ ] Tratamento de dados insuficientes.
- [ ] Módulo Predict.
- [ ] Recomendações transparentes.
- [ ] Alertas contextuais.
- [ ] Favoritos persistentes.
- [ ] Dashboard ADMIN.
- [ ] Controle de cenários demonstrativos.
- [ ] Sincronização entre duas sessões.
- [ ] Testes automatizados essenciais.
- [ ] Build de produção concluído.
- [ ] Documentação de deploy.
- [ ] Sem Supabase.
- [ ] Sem dependências obrigatórias pagas.
- [ ] Sem exposição de tokens externos.
- [ ] Sem apresentação enganosa de dados simulados.

## INSTRUÇÃO FINAL

Você não está construindo um template ou uma apresentação visual.

Você está construindo o **GoMob**, uma aplicação acadêmica Full Stack profissional de mobilidade urbana, com arquitetura coerente, interface premium, integrações operacionais reais quando disponíveis e inteligência estatística transparente.

Priorize qualidade de implementação, usabilidade, refinamento visual, integridade dos dados e clareza acadêmica.

Comece pela FASE 01.

Implemente, execute, teste, corrija e avance de maneira incremental.

**GO MOB. GO SMARTER. RIDE BETTER.**

# Dashboard Sankya — Context

> Ultima atualizacao: 2026-03-25

## Visao Geral

Dashboard de gestao comercial da **ASX Comercio** (distribuicao/revenda), integrado com **Sankhya Cloud ERP** via API REST.

## Stack Tecnica

| Camada | Tecnologia | Versao |
|--------|-----------|--------|
| Frontend | React + Vite + TailwindCSS | 19.2 / 7.3 / 4.2 |
| State/Data | TanStack React Query + React Table | 5 / 8 |
| Charts | Recharts | 3.7 |
| Backend | Express (Node.js) | 5.2 |
| HTTP Client | Axios | 1.13 |
| Security | Helmet + express-rate-limit | 8 / 8 |
| Deploy | Railway (monolith) | — |
| Database | Supabase (PostgreSQL) | — |
| Dados | Sankhya Cloud API (Oracle DB) | — |

## Estrutura do Projeto

```
Dashboard Sankya/
├── server.js              # Express server (API + serve frontend/dist)
├── sankhyaService.js      # Integracao Sankhya Cloud (classe principal)
├── dashboardService.js    # Logica de negocio do dashboard
├── dashboardRoutes.js     # Rotas /api/dashboard/*
├── cache.js               # Cache in-memory com TTL
├── prospeccaoStore.js     # CRUD Supabase para prospeccao
├── supabaseClient.js      # Cliente Supabase
├── importStore.js         # CRUD JSON para importacoes
├── data/                  # Dados JSON locais
├── frontend/
│   ├── src/
│   │   ├── pages/         # 7 paginas JSX
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── SalesPage.jsx
│   │   │   ├── FaturamentoPage.jsx
│   │   │   ├── ComprasPage.jsx
│   │   │   ├── SugestaoCompraPage.jsx
│   │   │   ├── ImportacaoPage.jsx
│   │   │   └── ProspeccaoPage.jsx
│   │   └── components/
│   │       ├── RefreshButton.jsx
│   │       ├── dashboard/
│   │       └── layout/
│   └── dist/              # Build de producao (servido pelo Express)
├── package.json           # Backend deps
├── Dockerfile
└── .env                   # Credenciais Sankhya (gitignored)
```

## Paginas

| Pagina | Funcao |
|--------|--------|
| Dashboard | KPIs gerais, vendas por vendedor, top produtos |
| Sales | Ranking vendedores, breakdown mensal por periodo |
| Faturamento | Pedidos nao faturados vs faturados |
| Compras | Estoque vs media vendas 6m, sugestao reposicao ASX/ABSOLUX |
| Sugestao Compra | Filtro critico/atencao/repor |
| Importacao | Produtos em transito, CRUD local JSON |
| Prospeccao | Leads por vendedor, status, edicao inline (Supabase) |

## Fluxo de Dados

```
[React SPA] → /api/* → [Express] → [Sankhya Cloud API] → [Oracle DB]
                                  → [Supabase PostgreSQL] (prospeccao, importacoes)
```

- **Dev:** React (5173) → Vite proxy → Express (3000)
- **Prod:** Express serve frontend/dist + API na mesma porta

## Cache Strategy

| Dados | TTL Backend | Warm-up |
|-------|-------------|---------|
| Products | 10 min | — |
| Sales / Top Products / Billing | 5 min | — |
| Purchase Management | 24h | A cada 3h |

Frontend usa React Query com `refetchInterval` variavel + botao Atualizar em todas as paginas.

## Seguranca

- Helmet (optional, graceful degradation)
- CORS: localhost + Railway subdomains + FRONTEND_URL
- Rate limiting: 120 req/min por IP (optional)
- API key auth: DASHBOARD_API_KEY (opcional)
- SQL injection: sanitizeLike, validateNumericList, validateDate
- .env removido do git tracking (credenciais Sankhya)

## Deploy

- **Plataforma:** Railway
- **Modo:** Monolith (Express serve frontend build + API)
- **Build:** `cd frontend && npm install && npm run build`
- **Start:** `node server.js`

## Regras de Negocio

- Produtos ASX: grupos 9901*, 70*
- Produtos ABSOLUX: grupo 9902*
- Vendedores identificados por apelido
- API Sankhya: paginacao 50 registros, max 3 requests concorrentes
- Faturamento pendente: formula Vlr Total Bruto dos itens (exclui impostos/frete)
- Vendas: exclui impostos/frete, cotacoes nao contam como pendente

## Vendedores (Prospeccao)

| Vendedor | Equipe | Leads |
|----------|--------|-------|
| Mara | Estrategia | 8 (AC, AM, AP) |
| Fernanda | FP | 8 (RN) |
| Daniela | Atitude | 12 (PE, BA) |
| Andre | Norte | — |
| Mazza | — | — |
| Pablo | — | — |
| Adriano | — | — |

## Historico Recente

| Data | Commit | Descricao |
|------|--------|-----------|
| 2026-03-25 | e4eb7d8 | Campos editaveis inline na prospeccao |
| 2026-03-24 | 073ea31 | Migracao dados JSON → Supabase PostgreSQL |
| 2026-03-24 | e8e31f6 | Campo cidade/estado + leads do Andre |
| 2026-03-23 | 69e4016 | Helmet/rate-limit optional + CORS Railway |
| 2026-03-23 | 7d00cf8 | Security hardening + data freshness + refresh buttons |
| 2026-03-23 | 2a65582 | Excluir impostos/frete de vendas, cotacoes de pendente |
| 2026-03-23 | e91d80f | Faturamento pendente formula bruto + blacklist |
| 2026-03-23 | 3c62e7f | Formula Vlr Total Bruto 100% para vendas |
| 2026-03-22 | 6ae9112 | Pagina Sugestao de Compra |
| 2026-03-22 | 029d620 | Pagina Faturamento Pendente |

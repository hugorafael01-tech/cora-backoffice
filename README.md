# Cora Backoffice

Painel administrativo da Cora. Roda em `admin.acora.com.br`. Stack: Vite + React + TypeScript + Tailwind + Supabase (auth + banco). Sem ORM no front — `@supabase/supabase-js` direto.

Compartilha o mesmo projeto Supabase do Portal (`cora-portal`). Schema é gerenciado **só por este repo** — Portal não cria mais migrations.

## Setup local

1. Clone e instale:

   ```bash
   npm install
   ```

2. Crie `.env.local` a partir de `.env.example`:

   ```bash
   cp .env.example .env.local
   ```

   Preencha com os valores reais do Supabase Dashboard → Project Settings → API.

   - `VITE_SUPABASE_URL` — URL do projeto (mesma do Portal).
   - `VITE_SUPABASE_ANON_KEY` — anon key pública (não a service role).

3. Rode o dev server:

   ```bash
   npm run dev
   ```

## Banco de dados

Migrations em `supabase/migrations/`. Aplicação via Supabase CLI.

```bash
# Autenticar (1x por máquina)
npx supabase login

# Linkar ao projeto (1x por checkout)
npx supabase link --project-ref <project-ref>

# Marcar 0001 como já aplicada (foi feita pelo Portal)
npx supabase migration repair --status applied 0001

# Aplicar migrations novas
npm run db:push

# Regerar tipos TS (após qualquer migration)
npm run db:types
```

Nunca rodar `supabase db reset` — a base é compartilhada com o Portal e seria destrutivo. Por isso `npm run db:reset` está bloqueado por padrão.

## Auth

Magic link via Supabase Auth. Acesso é gated por `admin_users` (tabela + RLS). Só emails listados em `admin_users` conseguem passar de `RequireAuth`.

### Configuração no Supabase Dashboard

Authentication → URL Configuration:

- **Site URL:** `https://admin.acora.com.br`
- **Redirect URLs:** `https://admin.acora.com.br/auth/callback` e `http://localhost:5173/auth/callback`

## Deploy

Vercel, domínio `admin.acora.com.br`. Framework preset: **Vite**. Env vars (Production + Preview): `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

## Estrutura

```
supabase/migrations/         SQL puro, ordem importa
src/lib/supabase.ts          client init
src/lib/database.types.ts    gerado via `npm run db:types`
src/components/RequireAuth   gate de admin
src/pages/                   Login, AuthCallback, Home (healthcheck)
Docs/                        briefings e wireframes
```

## O que NÃO fazer

- Mexer em `subscriptions`, `coverage_waitlist`, `coverage_whitelist` (são do Portal).
- Rodar `supabase db reset` (destrói dados do Portal).
- Adicionar Drizzle, Prisma ou qualquer ORM Node (cliente é Supabase JS direto).
- Criar API routes / Edge Functions (Backoffice é client-side puro).

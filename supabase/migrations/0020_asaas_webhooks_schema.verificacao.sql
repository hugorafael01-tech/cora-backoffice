-- ============================================================
-- Verificacao da Migration 0020 (asaas_webhooks_schema) — rodar no SQL Editor do Supabase
-- ============================================================
-- IMPORTANTE: o SQL Editor so mostra o output do ULTIMO SELECT quando se cola varias queries.
-- Rode UMA query por vez (cada bloco numerado) pra ver todos os resultados.
-- Aplicar a migration: colar o conteudo de 0020_asaas_webhooks_schema.sql no SQL Editor e
-- rodar (NAO usar supabase db push — historico local nao sincronizado com a CLI).
-- ============================================================


-- ============================================================
-- PRE (rodar ANTES de aplicar — esperado: tudo vazio/ausente)
-- ============================================================

-- PRE.1 — enum payment_status_enum NAO deve existir ainda (esperado: 0 linhas)
SELECT t.typname
FROM pg_type t
WHERE t.typname = 'payment_status_enum';

-- PRE.2 — colunas novas NAO devem existir ainda em subscriptions (esperado: 0 linhas)
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'subscriptions'
  AND column_name IN ('payment_status', 'last_payment_at', 'last_payment_event');

-- PRE.3 — tabela asaas_webhook_events NAO deve existir ainda (esperado: 0 linhas)
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'asaas_webhook_events';


-- ============================================================
-- POS (rodar DEPOIS de aplicar — uma query por vez)
-- ============================================================

-- POS.1 — enum existe com EXATAMENTE os 3 valores na ordem certa
--   esperado: em_dia(1), pendente(2), vencido(3)
SELECT e.enumlabel, e.enumsortorder
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
WHERE t.typname = 'payment_status_enum'
ORDER BY e.enumsortorder;

-- POS.2 — subscriptions tem as 3 colunas novas, todas NULLABLE
--   esperado: 3 linhas, is_nullable = YES em todas;
--   payment_status com udt_name = payment_status_enum; demais conforme tipo
SELECT column_name, data_type, udt_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'subscriptions'
  AND column_name IN ('payment_status', 'last_payment_at', 'last_payment_event')
ORDER BY column_name;

-- POS.3 — tabela asaas_webhook_events existe com todas as colunas e tipos esperados
SELECT column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'asaas_webhook_events'
ORDER BY ordinal_position;

-- POS.4 — constraints: PK, UNIQUE em asaas_event_id, FK pra subscriptions
--   esperado: PRIMARY KEY (id), UNIQUE (asaas_event_id), FOREIGN KEY (subscription_id -> subscriptions.id)
SELECT
  con.conname,
  con.contype,                          -- p=PK, u=UNIQUE, f=FK
  pg_get_constraintdef(con.oid) AS definicao
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace ns ON ns.oid = rel.relnamespace
WHERE ns.nspname = 'public' AND rel.relname = 'asaas_webhook_events'
ORDER BY con.contype;

-- POS.5 — indices (esperado: PK, unique de asaas_event_id, subscription_id, event_type)
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'asaas_webhook_events'
ORDER BY indexname;

-- POS.6 — RLS habilitada na tabela (esperado: relrowsecurity = true)
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'asaas_webhook_events' AND relnamespace = 'public'::regnamespace;

-- POS.7 — policy de SELECT pro authenticated com is_admin()
--   esperado: 1 policy, cmd = SELECT, roles = {authenticated}, qual contendo is_admin()
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'asaas_webhook_events';

-- POS.8 — grants por role (a prova dos grants)
--   esperado:
--     authenticated -> SELECT (e SO SELECT; sem INSERT/UPDATE/DELETE)
--     anon          -> NENHUMA linha
--     service_role  -> tem INSERT/UPDATE/DELETE/SELECT (bypass + grants default)
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'asaas_webhook_events'
  AND grantee IN ('authenticated', 'anon', 'service_role')
ORDER BY grantee, privilege_type;

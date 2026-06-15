-- ============================================================
-- Verificacao da Migration 0027 (faturas) - rodar no SQL Editor
-- ============================================================
-- IMPORTANTE: o SQL Editor so mostra o output do ULTIMO SELECT quando se cola varias
-- queries. Rode UMA query por vez (cada bloco numerado) pra ver todos os resultados.
-- Aplicar a migration: colar o conteudo de 0027_faturas.sql no SQL Editor e rodar
-- (NAO usar supabase db push - historico local pode estar dessincronizado).
-- ============================================================


-- ============================================================
-- PRE (rodar ANTES de aplicar - esperado: tudo ausente)
-- ============================================================

-- PRE.1 - enum fatura_status_enum NAO deve existir ainda (esperado: 0 linhas)
SELECT typname
FROM pg_type
WHERE typname = 'fatura_status_enum';

-- PRE.2 - tabela faturas NAO deve existir ainda (esperado: 0 linhas)
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'faturas';


-- ============================================================
-- POS (rodar DEPOIS de aplicar - uma query por vez)
-- ============================================================

-- POS.1 - colunas da tabela (esperado: 13 linhas)
--   NOT NULL (is_nullable = NO): id, subscription_id, periodo_referencia,
--   qty_paes, valor_paes, valor_frete, valor_total, status, created_at, updated_at.
--   Nullable: paid_at, asaas_payment_id, asaas_invoice_url.
--   status: udt_name = fatura_status_enum, default = 'pendente'::fatura_status_enum.
SELECT column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'faturas'
ORDER BY ordinal_position;

-- POS.2 - enum existe com exatamente 4 valores na ordem certa
--   esperado: pendente(1), paga(2), falha(3), cancelada(4)
SELECT e.enumlabel, e.enumsortorder
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
WHERE t.typname = 'fatura_status_enum'
ORDER BY e.enumsortorder;

-- POS.3 - constraints: PK, FK, e os dois UNIQUEs
--   esperado: PK (id), FK (subscription_id -> subscriptions.id),
--   UNIQUE (subscription_id, periodo_referencia), UNIQUE (asaas_payment_id)
SELECT conname, contype, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'faturas'::regclass
ORDER BY contype, conname;

-- POS.4 - indices (esperado: 5 no total)
--   faturas_pkey, faturas_asaas_payment_id_key (implicit do UNIQUE),
--   faturas_subscription_id_idx, faturas_status_idx,
--   faturas_paid_at_idx (parcial WHERE status = 'paga')
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'faturas'
ORDER BY indexname;

-- POS.5 - RLS habilitada (esperado: relrowsecurity = true)
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'faturas' AND relnamespace = 'public'::regnamespace;

-- POS.6 - policy admin_read_faturas (esperado: 1 linha, cmd = SELECT, roles = {authenticated})
SELECT policyname, cmd, roles, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'faturas';

-- POS.7 - trigger trg_faturas_updated_at (esperado: 1 linha)
SELECT tgname
FROM pg_trigger
WHERE tgrelid = 'faturas'::regclass AND NOT tgisinternal;

-- POS.8 - grants por role (a prova dos revokes)
--   esperado: authenticated -> SELECT (e SO SELECT); anon -> 0 linhas; service_role -> tudo
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'faturas'
  AND grantee IN ('authenticated', 'anon', 'service_role')
ORDER BY grantee, privilege_type;

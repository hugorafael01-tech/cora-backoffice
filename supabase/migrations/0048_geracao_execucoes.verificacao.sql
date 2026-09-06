-- ============================================================
-- Verificacao da Migration 0048 (tabela geracao_execucoes)
-- — rodar no SQL Editor
-- ============================================================
-- IMPORTANTE: rode UMA query por vez (o SQL Editor so mostra o ultimo SELECT).
-- ============================================================


-- ============================================================
-- PRE (rodar ANTES de aplicar)
-- ============================================================

-- PRE.1 — a tabela ainda NAO deve existir (esperado: 0 linhas)
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'geracao_execucoes';


-- ============================================================
-- POS (rodar DEPOIS de aplicar)
-- ============================================================

-- POS.1 — as 7 colunas, com os tipos e a nulidade certos (esperado: 7 linhas)
--   id                 uuid        NO   gen_random_uuid()
--   periodo_referencia text        NO
--   por                text        NO
--   iniciada_em        timestamptz NO   now()
--   terminada_em       timestamptz YES
--   ok                 boolean     YES
--   erro               text        YES
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'geracao_execucoes'
ORDER BY ordinal_position;

-- POS.2 — a PK existe (esperado: 1 linha, PRIMARY KEY (id))
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'public.geracao_execucoes'::regclass AND contype = 'p';

-- POS.3 — tabela vazia (esperado: 0)
SELECT count(*) AS linhas FROM geracao_execucoes;

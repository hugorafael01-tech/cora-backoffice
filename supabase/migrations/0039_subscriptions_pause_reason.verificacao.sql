-- ============================================================
-- Verificacao da Migration 0039 (subscriptions.pause_reason) — SQL Editor
-- ============================================================
-- IMPORTANTE: rode UMA query por vez (o SQL Editor so mostra o ultimo SELECT).
-- Pre-requisito: a 0038 (pause_reason_enum) ja aplicada.
-- ============================================================


-- ============================================================
-- PRE (rodar ANTES de aplicar)
-- ============================================================

-- PRE.1 — a coluna ainda NAO deve existir (esperado: 0 linhas)
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'subscriptions'
  AND column_name = 'pause_reason';

-- PRE.2 — o tipo da 0038 PRECISA existir antes (esperado: 1 linha)
SELECT t.typname
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace AND n.nspname = 'public'
WHERE t.typname = 'pause_reason_enum';


-- ============================================================
-- POS (rodar DEPOIS de aplicar)
-- ============================================================

-- POS.1 — coluna criada: udt_name = 'pause_reason_enum', nullable YES, sem
--   default (esperado: 1 linha)
SELECT data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'subscriptions'
  AND column_name = 'pause_reason';

-- POS.2 — nenhuma linha foi tocada: todas as assinaturas com pause_reason null
--   (esperado: total = nulos)
SELECT count(*) AS total,
       count(*) FILTER (WHERE pause_reason IS NULL) AS nulos
FROM subscriptions;

-- POS.3 — grant herdado, sem GRANT novo: authenticated com SELECT na coluna
--   nova e anon SEM nada (esperado: 1 linha, grantee = 'authenticated')
SELECT grantee, privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public'
  AND table_name = 'subscriptions'
  AND column_name = 'pause_reason'
  AND grantee IN ('anon', 'authenticated');

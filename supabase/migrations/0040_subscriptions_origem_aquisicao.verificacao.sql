-- ============================================================
-- Verificacao da Migration 0040 (subscriptions.origem_aquisicao) — SQL Editor
-- ============================================================
-- IMPORTANTE: rode UMA query por vez (o SQL Editor so mostra o ultimo SELECT).
-- ============================================================


-- ============================================================
-- PRE (rodar ANTES de aplicar)
-- ============================================================

-- PRE.1 — a coluna ainda NAO deve existir (esperado: 0 linhas)
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'subscriptions'
  AND column_name = 'origem_aquisicao';


-- ============================================================
-- POS (rodar DEPOIS de aplicar)
-- ============================================================

-- POS.1 — coluna criada: text, nullable YES, sem default (esperado: 1 linha)
SELECT data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'subscriptions'
  AND column_name = 'origem_aquisicao';

-- POS.2 — nenhuma linha tocada: todas null (esperado: total = nulos)
SELECT count(*) AS total,
       count(*) FILTER (WHERE origem_aquisicao IS NULL) AS nulos
FROM subscriptions;

-- ============================================================
-- Verificacao da Migration 0038 (pause_reason_enum) — rodar no SQL Editor
-- ============================================================
-- IMPORTANTE: o SQL Editor so mostra o output do ULTIMO SELECT quando se cola
-- varias queries. Rode UMA query por vez (cada bloco numerado) pra ver tudo.
-- Aplicar a migration: colar o conteudo de 0038_pause_reason_enum.sql no SQL
-- Editor e rodar (NAO usar supabase db push — historico local dessincronizado).
-- ============================================================


-- ============================================================
-- PRE (rodar ANTES de aplicar)
-- ============================================================

-- PRE.1 — o tipo ainda NAO deve existir (esperado: 0 linhas)
SELECT t.typname
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace AND n.nspname = 'public'
WHERE t.typname = 'pause_reason_enum';


-- ============================================================
-- POS (rodar DEPOIS de aplicar)
-- ============================================================

-- POS.1 — tipo criado com os 2 valores, nesta ordem (esperado: 1 linha,
--   vals = 'voluntaria,inadimplencia')
SELECT t.typname,
       string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) AS vals
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
JOIN pg_namespace n ON n.oid = t.typnamespace AND n.nspname = 'public'
WHERE t.typname = 'pause_reason_enum'
GROUP BY t.typname;

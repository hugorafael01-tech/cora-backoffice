-- ============================================================
-- Verificacao da Migration 0024 (contextos_dia_indice_relativo) — rodar no SQL Editor
-- ============================================================
-- IMPORTANTE: o SQL Editor so mostra o output do ULTIMO SELECT quando se cola varias
-- queries. Rode UMA query por vez (cada bloco numerado) pra ver todos os resultados.
-- Aplicar a migration: colar o conteudo de 0024_contextos_dia_indice_relativo.sql no
-- SQL Editor e rodar (NAO usar supabase db push — historico local dessincronizado).
-- ============================================================


-- ============================================================
-- PRE (rodar ANTES de aplicar)
-- ============================================================

-- PRE.1 — contextos_dia.dia deve ser 'text' ainda (esperado: text)
SELECT data_type
FROM information_schema.columns
WHERE table_name = 'contextos_dia' AND column_name = 'dia';

-- PRE.2 — CHECK atual deve ser o IN (...) de dia-da-semana
--   (esperado: CHECK ((dia = ANY (ARRAY['terca'::text, 'quarta'::text, 'quinta'::text]))))
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'contextos_dia'::regclass AND contype = 'c';

-- PRE.3 — UNIQUE (semana_id, dia) deve existir (esperado: UNIQUE (semana_id, dia))
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'contextos_dia'::regclass AND contype = 'u';

-- PRE.4 — colunas de temp ainda presentes em contextos_producao (esperado: 2 linhas)
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'contextos_producao'
  AND column_name IN ('temp_agua_autolise_c', 'temp_massa_pos_batimento_c');


-- ============================================================
-- POS (rodar DEPOIS de aplicar)
-- ============================================================

-- POS.1 — contextos_dia.dia agora INT (esperado: integer)
SELECT data_type
FROM information_schema.columns
WHERE table_name = 'contextos_dia' AND column_name = 'dia';

-- POS.2 — CHECK agora e dia >= 0 (esperado: CHECK ((dia >= 0)))
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'contextos_dia'::regclass AND contype = 'c';

-- POS.3 — UNIQUE (semana_id, dia) sobreviveu (esperado: UNIQUE (semana_id, dia))
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'contextos_dia'::regclass AND contype = 'u';

-- POS.4 — colunas de temp removidas (esperado: 0 linhas)
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'contextos_producao'
  AND column_name IN ('temp_agua_autolise_c', 'temp_massa_pos_batimento_c');

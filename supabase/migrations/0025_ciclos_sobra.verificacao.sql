-- ============================================================
-- Verificacao da Migration 0025 (ciclos_sobra) — rodar no SQL Editor
-- ============================================================
-- IMPORTANTE: o SQL Editor so mostra o output do ULTIMO SELECT quando se cola varias
-- queries. Rode UMA query por vez (cada bloco numerado) pra ver todos os resultados.
-- Aplicar a migration: colar o conteudo de 0025_ciclos_sobra.sql no SQL Editor e
-- rodar (NAO usar supabase db push — historico local dessincronizado).
-- ============================================================


-- ============================================================
-- PRE (rodar ANTES de aplicar)
-- ============================================================

-- PRE.1 — UNIQUE (numero, ano) atual. CONFIRMAR o nome da constraint: o DROP da
--   migration usa 'semanas_numero_ano_key'. Se o conname abaixo for outro, ajustar
--   o arquivo 0025_ciclos_sobra.sql antes de aplicar.
--   (esperado: 1 linha, def = UNIQUE (numero, ano))
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'semanas'::regclass AND contype = 'u';

-- PRE.2 — coluna sobra_levain_g ainda NAO deve existir (esperado: 0 linhas)
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'semanas' AND column_name = 'sobra_levain_g';


-- ============================================================
-- POS (rodar DEPOIS de aplicar)
-- ============================================================

-- POS.1 — UNIQUE (numero, ano) removida (esperado: 0 linhas)
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'semanas'::regclass AND contype = 'u'
  AND pg_get_constraintdef(oid) ILIKE '%(numero, ano)%';

-- POS.2 — coluna sobra_levain_g criada: numeric, NOT NULL, default 400
--   (esperado: numeric / NO / 400)
SELECT data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'semanas' AND column_name = 'sobra_levain_g';

-- POS.3 — CHECK (sobra_levain_g >= 0) presente (esperado: CHECK ((sobra_levain_g >= 0)))
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'semanas'::regclass AND contype = 'c'
  AND pg_get_constraintdef(oid) ILIKE '%sobra_levain_g%';

-- POS.4 — semanas existentes herdaram o default 400 (esperado: nenhuma linha com NULL)
SELECT count(*) AS semanas_sem_sobra
FROM semanas
WHERE sobra_levain_g IS NULL;

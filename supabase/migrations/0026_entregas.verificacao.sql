-- ============================================================
-- Verificacao da Migration 0026 (entregas) — rodar no SQL Editor
-- ============================================================
-- IMPORTANTE: o SQL Editor so mostra o output do ULTIMO SELECT quando se cola varias
-- queries. Rode UMA query por vez (cada bloco numerado) pra ver todos os resultados.
-- Aplicar a migration: colar o conteudo de 0026_entregas.sql no SQL Editor e rodar
-- (NAO usar supabase db push — historico local dessincronizado).
-- ============================================================


-- ============================================================
-- PRE (rodar ANTES de aplicar)
-- ============================================================

-- PRE.1 — tabela entregas ainda NAO deve existir (esperado: 0 linhas)
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'entregas';


-- ============================================================
-- POS (rodar DEPOIS de aplicar)
-- ============================================================

-- POS.1 — colunas da tabela (esperado: 21 linhas = 19 de negocio + created_at/updated_at;
--   conferir tipos e NOT NULL).
--   NOT NULL (is_nullable = NO): semana_id, origem, nome, rua, bairro, cidade,
--   regiao, itens, status, id, created_at, updated_at.
--   nullable: weekly_order_id, pedido_pontual_id, whatsapp, cep, numero,
--   complemento, observacao, em_rota_at, entregue_at.
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'entregas'
ORDER BY ordinal_position;

-- POS.2 — CHECKs presentes (esperado: 4 — origem IN, regiao IN, status IN,
--   entregas_origem_exatamente_um com a soma = 1)
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'entregas'::regclass AND contype = 'c'
ORDER BY conname;

-- POS.3 — UNIQUEs presentes (esperado: 2 — (semana_id, weekly_order_id) e
--   (semana_id, pedido_pontual_id))
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'entregas'::regclass AND contype = 'u'
ORDER BY conname;

-- POS.4 — FK unica = semana_id -> semanas (esperado: 1 linha; weekly_order_id e
--   pedido_pontual_id NAO devem aparecer, sao refs logicas sem FK)
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'entregas'::regclass AND contype = 'f'
ORDER BY conname;

-- POS.5 — RLS ligada + policy admin_all (esperado: rls_on = t, polname = admin_all_entregas)
SELECT c.relrowsecurity AS rls_on, p.polname
FROM pg_class c
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE c.relname = 'entregas';

-- POS.6 — trigger de updated_at (esperado: trg_entregas_updated_at)
SELECT tgname
FROM pg_trigger
WHERE tgrelid = 'entregas'::regclass AND NOT tgisinternal;

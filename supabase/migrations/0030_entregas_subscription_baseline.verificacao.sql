-- ============================================================
-- Verificacao da Migration 0030 (entregas_subscription_baseline) — rodar no
-- SQL Editor
-- ============================================================
-- IMPORTANTE: o SQL Editor so mostra o output do ULTIMO SELECT quando se cola
-- varias queries. Rode UMA query por vez (cada bloco numerado) pra ver tudo.
-- Aplicar a migration: colar o conteudo de
-- 0030_entregas_subscription_baseline.sql no SQL Editor e rodar (NAO usar
-- supabase db push — historico local dessincronizado).
-- ============================================================


-- ============================================================
-- PRE (rodar ANTES de aplicar)
-- ============================================================

-- PRE.1 — coluna subscription_id ainda NAO deve existir (esperado: 0 linhas)
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'entregas' AND column_name = 'subscription_id';

-- PRE.2 — CHECK atual (esperado: entregas_origem_exatamente_um com
--   weekly_order_id/pedido_pontual_id)
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'entregas'::regclass AND contype = 'c';

-- PRE.3 — quantas linhas origem='assinatura' existem hoje (baseline pra
--   conferir o backfill no POS — esperado: mesmo numero em POS.4 com
--   subscription_id preenchido)
SELECT count(*) AS total_assinatura
FROM entregas
WHERE origem = 'assinatura';


-- ============================================================
-- POS (rodar DEPOIS de aplicar)
-- ============================================================

-- POS.1 — coluna subscription_id criada: uuid, nullable
SELECT data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'entregas' AND column_name = 'subscription_id';

-- POS.2 — FK nova pra subscriptions (esperado: 2 linhas — semana_id->semanas
--   ja existia, subscription_id->subscriptions e nova; weekly_order_id e
--   pedido_pontual_id continuam SEM FK, refs logicas)
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'entregas'::regclass AND contype = 'f'
ORDER BY conname;

-- POS.3 — CHECK novo (esperado: 1 linha, entregas_origem_exatamente_um com
--   subscription_id + pedido_pontual_id somando 1; weekly_order_id fora)
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'entregas'::regclass AND contype = 'c'
  AND conname = 'entregas_origem_exatamente_um';

-- POS.4 — backfill completo: nenhuma linha origem='assinatura' deve ter
--   subscription_id NULL (esperado: 0)
SELECT count(*) AS assinatura_sem_subscription
FROM entregas
WHERE origem = 'assinatura' AND subscription_id IS NULL;

-- POS.5 — backfill correto: subscription_id bate com o weekly_order que a
--   linha ainda referencia (esperado: 0 linhas divergentes)
SELECT e.id, e.subscription_id, wo.subscription_id AS wo_subscription_id
FROM entregas e
JOIN weekly_orders wo ON wo.id = e.weekly_order_id
WHERE e.origem = 'assinatura' AND e.subscription_id IS DISTINCT FROM wo.subscription_id;

-- POS.6 — UNIQUEs presentes (esperado: 3 — (semana_id, weekly_order_id) da
--   0026, (semana_id, pedido_pontual_id) da 0026, e a nova
--   entregas_semana_subscription_key (semana_id, subscription_id))
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'entregas'::regclass AND contype = 'u'
ORDER BY conname;

-- POS.7 — pedidos_pontuais/avulsos nao foram tocados: continuam com
--   subscription_id NULL e pedido_pontual_id preenchido (esperado: total de
--   avulsos = quantas linhas com subscription_id NULL)
SELECT
  (SELECT count(*) FROM entregas WHERE origem = 'avulso') AS total_avulso,
  (SELECT count(*) FROM entregas WHERE origem = 'avulso' AND subscription_id IS NULL AND pedido_pontual_id IS NOT NULL) AS avulso_ok;

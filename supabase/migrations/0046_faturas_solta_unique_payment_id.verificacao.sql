-- ============================================================
-- Verificacao da Migration 0046 (solta o UNIQUE de asaas_payment_id)
-- — rodar no SQL Editor
-- ============================================================
-- IMPORTANTE: rode UMA query por vez (o SQL Editor so mostra o ultimo SELECT).
-- Aplicar 0046 e DEPOIS 0047 — o DROP leva o indice junto e a 0047 o recria.
-- ============================================================


-- ============================================================
-- PRE (rodar ANTES de aplicar)
-- ============================================================

-- PRE.1 — o UNIQUE ainda existe (esperado: 1 linha,
--   faturas_asaas_payment_id_key / UNIQUE (asaas_payment_id))
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'public.faturas'::regclass AND contype = 'u'
ORDER BY conname;

-- PRE.2 — a tabela esta vazia (esperado: 0). E o que torna isto gratuito: com
--   linhas, soltar o UNIQUE exigiria conferir duplicata antes.
SELECT count(*) AS linhas FROM faturas;


-- ============================================================
-- POS (rodar DEPOIS de aplicar as DUAS)
-- ============================================================

-- POS.1 — sobrou UM unique, e e o da idempotencia (esperado: 1 linha,
--   faturas_subscription_id_periodo_referencia_key). Se este sumir, PARE: e
--   ele que impede cobrar duas vezes o mesmo assinante no mesmo periodo.
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'public.faturas'::regclass AND contype = 'u'
ORDER BY conname;

-- POS.2 — o indice nao-unico da 0047 existe (esperado: 1 linha,
--   faturas_asaas_payment_id_idx, com indisunique = false)
SELECT i.relname AS indice, ix.indisunique AS unico
FROM pg_class t
JOIN pg_index ix ON ix.indrelid = t.oid
JOIN pg_class i ON i.oid = ix.indexrelid
WHERE t.relname = 'faturas' AND i.relname LIKE '%asaas_payment_id%';

-- POS.3 — prova de que o id repetido passa a ser aceito. Roda a insercao de
--   duas linhas com o MESMO asaas_payment_id dentro de uma transacao e desfaz:
--   nao deixa residuo. Esperado: 2 linhas no SELECT, e nada no banco depois.
BEGIN;
  INSERT INTO faturas (subscription_id, periodo_referencia, qty_paes, valor_paes,
                       valor_frete, valor_total, status, asaas_payment_id)
  SELECT s.id, '2099-01', 1, 99, 15, 114, 'pendente', 'pay_teste_0046'
  FROM subscriptions s
  WHERE s.status = 'active'
  ORDER BY s.id
  LIMIT 2;

  SELECT count(*) AS linhas_com_o_mesmo_pagamento
  FROM faturas WHERE asaas_payment_id = 'pay_teste_0046';
ROLLBACK;

-- POS.4 — confirma que o ROLLBACK levou tudo (esperado: 0)
SELECT count(*) AS residuo FROM faturas;

-- ============================================================
-- Verificacao da Migration 0045 (subscriptions.pagador_subscription_id)
-- — rodar no SQL Editor
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
  AND column_name = 'pagador_subscription_id';

-- PRE.2 — os 4 nomes dos 2 pares existem e estao ativos (esperado: 4 linhas —
--   Sabina, Maria Helena, Aldina, Fernanda). Se algum nao aparecer, PARE: o
--   preenchimento do POS nao tem em que se apoiar.
SELECT id, nome, forma_pagamento::text AS forma, valor_mensal, asaas_customer_id
FROM subscriptions
WHERE status = 'active'
  AND (nome ILIKE '%sabina%' OR nome ILIKE '%maria helena%'
    OR nome ILIKE '%aldina%' OR nome ILIKE '%fernanda%')
ORDER BY nome;


-- ============================================================
-- POS (rodar DEPOIS de aplicar)
-- ============================================================

-- POS.1 — coluna criada: uuid, nullable YES, sem default (esperado: 1 linha)
SELECT data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'subscriptions'
  AND column_name = 'pagador_subscription_id';

-- POS.2 — a FK self-reference existe (esperado: 1 linha, FOREIGN KEY
--   (pagador_subscription_id) REFERENCES subscriptions(id))
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'public.subscriptions'::regclass
  AND contype = 'f'
  AND conname LIKE '%pagador%';

-- POS.3 — nenhuma linha tocada: todas null (esperado: total = nulos)
SELECT count(*) AS total,
       count(*) FILTER (WHERE pagador_subscription_id IS NULL) AS nulos
FROM subscriptions;


-- ============================================================
-- PREENCHIMENTO MANUAL (2 linhas, depois de aplicar)
-- ============================================================
-- Regra: a coluna vai na assinatura de QUEM E PAGA, apontando pra assinatura
-- de QUEM PAGA. Quem paga a propria fica null — nao aponte a linha pra si
-- mesma.
--   Maria Helena -> Sabina
--   Fernanda     -> Aldina
--
-- Pegue os ids em PRE.2 e rode um UPDATE por vez.

-- UPDATE subscriptions
--    SET pagador_subscription_id = '<id da SABINA>'
--  WHERE id = '<id da MARIA HELENA>';

-- UPDATE subscriptions
--    SET pagador_subscription_id = '<id da ALDINA>'
--  WHERE id = '<id da FERNANDA>';

-- POS.4 — rodar ao fim do preenchimento (esperado: 2 linhas, cada uma com
--   quem_paga preenchido e diferente de quem_e_paga)
SELECT paga.nome AS quem_e_paga,
       pagador.nome AS quem_paga,
       paga.forma_pagamento::text AS forma,
       paga.valor_mensal
FROM subscriptions paga
JOIN subscriptions pagador ON pagador.id = paga.pagador_subscription_id
ORDER BY pagador.nome, paga.nome;

-- POS.5 — ninguem apontando pra si mesmo (esperado: 0 linhas). Se aparecer
--   alguem aqui, o preenchimento usou a representacao errada: quem paga a
--   propria fica NULL.
SELECT id, nome
FROM subscriptions
WHERE pagador_subscription_id = id;

-- POS.6 — nenhum ciclo de 2 niveis, ou seja, ninguem paga por quem paga por
--   ele (esperado: 0 linhas). Nao ha CHECK no banco pra isso; a previa trata
--   pagador como UM nivel so.
SELECT a.nome AS a, b.nome AS b
FROM subscriptions a
JOIN subscriptions b ON b.id = a.pagador_subscription_id
WHERE b.pagador_subscription_id IS NOT NULL;

-- ============================================================
-- Verificacao da Migration 0051 (subscriptions.envio_manual)
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
  AND column_name = 'envio_manual';

-- PRE.2 — quem hoje esta com e-mail de fachada da casa (esperado: 2 linhas,
--   Aldina e Fernanda, ambas com hugo+<nome>@acora.com.br). Esta query e o
--   PONTO DE PARTIDA do preenchimento, nao a regra: a regra passa a ser a
--   coluna. Se aparecer alguem novo aqui, decida caso a caso antes do POS.
SELECT id, nome, email, forma_pagamento::text AS forma,
       pagador_subscription_id IS NOT NULL AS paga_outro
FROM subscriptions
WHERE status IN ('active', 'pending_payment')
  AND forma_pagamento IS DISTINCT FROM 'cartao'
  AND email ILIKE '%@acora.com.br'
ORDER BY nome;


-- ============================================================
-- POS (rodar DEPOIS de aplicar)
-- ============================================================

-- POS.1 — coluna criada: boolean, NOT NULL, default false (esperado: 1 linha)
SELECT data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'subscriptions'
  AND column_name = 'envio_manual';

-- POS.2 — o default pegou em todas: ninguem marcado ainda (esperado:
--   total = falsos, marcados = 0)
SELECT count(*) AS total,
       count(*) FILTER (WHERE envio_manual = false) AS falsos,
       count(*) FILTER (WHERE envio_manual) AS marcados
FROM subscriptions;


-- ============================================================
-- PREENCHIMENTO MANUAL (1 linha, depois de aplicar)
-- ============================================================
-- SO A ALDINA. A cobranca vai para o cliente Asaas do PAGADOR, entao ha uma
-- coisa a enviar a mao, nao duas — a Fernanda e paga pela Aldina e nao tem
-- envio proprio. Marcar as duas faria a tela mostrar dois envios onde ha um.
--
-- Pegue o id em PRE.2.

-- UPDATE subscriptions
--    SET envio_manual = true
--  WHERE id = '<id da ALDINA>';

-- POS.3 — rodar ao fim do preenchimento (esperado: 1 linha, a Aldina, com
--   paga_outro = false, ou seja, ela e o pagador do grupo)
SELECT nome, email, envio_manual,
       pagador_subscription_id IS NOT NULL AS paga_outro
FROM subscriptions
WHERE envio_manual
ORDER BY nome;

-- POS.4 — ninguem marcado que seja PAGO POR OUTRO (esperado: 0 linhas).
--   Se aparecer alguem, o preenchimento marcou uma cesta em vez de um pagador:
--   quem e pago por outro nao recebe cobranca propria, entao nao ha o que
--   enviar a mao.
SELECT nome, email
FROM subscriptions
WHERE envio_manual AND pagador_subscription_id IS NOT NULL;

-- ============================================================
-- Verificacao da Migration 0043 (subscriptions.forma_pagamento) — SQL Editor
-- ============================================================
-- IMPORTANTE: rode UMA query por vez (o SQL Editor so mostra o ultimo SELECT).
-- Pre-requisito: a 0042 (forma_pagamento_enum) ja aplicada.
-- ============================================================


-- ============================================================
-- PRE (rodar ANTES de aplicar)
-- ============================================================

-- PRE.1 — a coluna ainda NAO deve existir (esperado: 0 linhas)
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'subscriptions'
  AND column_name = 'forma_pagamento';

-- PRE.2 — o tipo da 0042 PRECISA existir antes (esperado: 1 linha)
SELECT t.typname
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace AND n.nspname = 'public'
WHERE t.typname = 'forma_pagamento_enum';


-- ============================================================
-- POS (rodar DEPOIS de aplicar)
-- ============================================================

-- POS.1 — coluna criada: udt_name = 'forma_pagamento_enum', nullable YES, sem
--   default (esperado: 1 linha)
SELECT data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'subscriptions'
  AND column_name = 'forma_pagamento';

-- POS.2 — ponto de partida do preenchimento: todas null (esperado: em 04/09,
--   ativas_sem_dev = 40 e a_preencher = 40)
SELECT count(*) FILTER (WHERE status = 'active' AND nome NOT ILIKE '%dev%')
         AS ativas_sem_dev,
       count(*) FILTER (WHERE status = 'active' AND nome NOT ILIKE '%dev%'
                          AND forma_pagamento IS NULL) AS a_preencher
FROM subscriptions;


-- ============================================================
-- APOIO AO PREENCHIMENTO MANUAL (nao e probe — nao precisa "passar")
-- ============================================================
-- LEIA ANTES DE USAR: a inferencia abaixo NAO fecha com a realidade e nao deve
-- ser aplicada em bloco. Em 04/09 ela devolveu 15 cartao, 22 boleto/Pix e 3 sem
-- evento nenhum — contra os 26 de boleto/Pix contados no briefing. O painel do
-- Asaas e a fonte da verdade; isto aqui e so pra voce ter a lista na tela do
-- lado, com um chute inicial, em vez de comecar do zero.
--
-- Repare tambem que 'UNDEFINED' e a cobranca que aceita boleto E Pix, entao
-- para essas o evento NAO diz qual das duas o assinante usa — a coluna quer a
-- forma do assinante, e so o painel responde.

-- APOIO.1 — lista pra conferir uma a uma no painel
WITH tipos AS (
  SELECT payload->'payment'->>'customer' AS cust,
         bool_or(payload->'payment'->>'billingType' = 'CREDIT_CARD') AS tem_cartao,
         string_agg(DISTINCT payload->'payment'->>'billingType', ',') AS tipos_vistos
  FROM asaas_webhook_events
  WHERE payload->'payment'->>'customer' IS NOT NULL
  GROUP BY 1
)
SELECT s.id,
       s.nome,
       s.asaas_customer_id,
       t.tipos_vistos,
       CASE
         WHEN t.cust IS NULL      THEN 'SEM EVENTO — so o painel responde'
         WHEN t.tem_cartao        THEN 'chute: cartao'
         ELSE                          'chute: boleto ou pix (conferir qual)'
       END AS pista,
       s.forma_pagamento AS valor_atual
FROM subscriptions s
LEFT JOIN tipos t ON t.cust = s.asaas_customer_id
WHERE s.status = 'active' AND s.nome NOT ILIKE '%dev%'
ORDER BY pista, s.nome;

-- APOIO.2 — molde do UPDATE, uma assinatura por vez (trocar o id e o valor).
--   Valores validos: 'cartao', 'boleto', 'pix'.
-- UPDATE subscriptions
--    SET forma_pagamento = 'boleto'
--  WHERE id = '00000000-0000-0000-0000-000000000000';

-- APOIO.3 — rodar ao fim do preenchimento: quantas faltam e quantas de cada
--   forma (esperado no fim: faltam = 0, e a soma boleto+pix batendo com o que
--   voce conferiu no painel)
SELECT count(*) FILTER (WHERE forma_pagamento IS NULL) AS faltam,
       count(*) FILTER (WHERE forma_pagamento = 'cartao') AS cartao,
       count(*) FILTER (WHERE forma_pagamento = 'boleto') AS boleto,
       count(*) FILTER (WHERE forma_pagamento = 'pix')    AS pix
FROM subscriptions
WHERE status = 'active' AND nome NOT ILIKE '%dev%';

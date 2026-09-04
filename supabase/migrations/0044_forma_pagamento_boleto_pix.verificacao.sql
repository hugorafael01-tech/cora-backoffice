-- ============================================================
-- Verificacao da Migration 0044 (forma_pagamento_enum + 'boleto_pix')
-- — rodar no SQL Editor
-- ============================================================
-- IMPORTANTE: rode UMA query por vez (o SQL Editor so mostra o ultimo SELECT).
--
-- LEIA ANTES: esta migration JA ESTA APLICADA (rodada direto no banco em
-- 04/09/2026, antes de o arquivo existir). Entao:
--   - o bloco PRE NAO vai mais dar o resultado que descreve. Fica como
--     registro do que se esperava ver antes, nao como passo a executar.
--   - rode so o bloco POS, pra confirmar que o estado do banco e o que este
--     arquivo diz que e.
--   - NAO rode o .sql da migration. `ADD VALUE` sem `IF NOT EXISTS` da erro
--     com o valor ja presente.
-- ============================================================


-- ============================================================
-- PRE (registro historico — nao executar esperando este resultado)
-- ============================================================

-- PRE.1 — antes de 04/09 o enum tinha 3 valores e o esperado aqui era
--   'cartao,boleto,pix'. Hoje ja devolve os 4.
SELECT string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) AS vals
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
JOIN pg_namespace n ON n.oid = t.typnamespace AND n.nspname = 'public'
WHERE t.typname = 'forma_pagamento_enum';


-- ============================================================
-- POS (rodar — confirma o estado atual)
-- ============================================================

-- POS.1 — enum com os 4 valores, 'boleto_pix' por ultimo (esperado: 1 linha,
--   vals = 'cartao,boleto,pix,boleto_pix')
SELECT string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) AS vals
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
JOIN pg_namespace n ON n.oid = t.typnamespace AND n.nspname = 'public'
WHERE t.typname = 'forma_pagamento_enum';

-- POS.2 — a base preenchida, que e o que da sentido ao valor novo
--   (esperado em 04/09: boleto_pix 25, cartao 13, boleto 2, e NENHUM null)
SELECT COALESCE(forma_pagamento::text, '(null)') AS forma, count(*) AS qtde
FROM subscriptions
WHERE status = 'active' AND nome NOT ILIKE '%dev%'
GROUP BY 1
ORDER BY 2 DESC;

-- POS.3 — o filtro que a previa da Fase 2 vai usar, e a prova de que o outro
--   filtro estaria errado (esperado: entram_certo = 27, entram_errado = 2 —
--   se alguem escrever IN ('boleto','pix'), 25 assinantes somem em silencio)
SELECT count(*) FILTER (WHERE forma_pagamento <> 'cartao') AS entram_certo,
       count(*) FILTER (WHERE forma_pagamento IN ('boleto', 'pix')) AS entram_errado,
       count(*) FILTER (WHERE forma_pagamento IS NULL) AS sem_forma_alertar
FROM subscriptions
WHERE status = 'active' AND nome NOT ILIKE '%dev%';

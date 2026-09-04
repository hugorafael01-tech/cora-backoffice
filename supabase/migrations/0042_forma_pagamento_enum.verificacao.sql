-- ============================================================
-- Verificacao da Migration 0042 (forma_pagamento_enum) — SQL Editor
-- ============================================================
-- IMPORTANTE: rode UMA query por vez (o SQL Editor so mostra o ultimo SELECT).
-- ============================================================


-- ============================================================
-- PRE (rodar ANTES de aplicar)
-- ============================================================

-- PRE.1 — o tipo ainda NAO deve existir (esperado: 0 linhas)
SELECT t.typname
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace AND n.nspname = 'public'
WHERE t.typname = 'forma_pagamento_enum';


-- ============================================================
-- POS (rodar DEPOIS de aplicar)
-- ============================================================

-- POS.1 — tipo criado com os 3 valores, nesta ordem (esperado: 1 linha,
--   vals = 'cartao,boleto,pix')
SELECT t.typname,
       string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) AS vals
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
JOIN pg_namespace n ON n.oid = t.typnamespace AND n.nspname = 'public'
WHERE t.typname = 'forma_pagamento_enum'
GROUP BY t.typname;

-- POS.2 — o enum vizinho continua intocado (esperado: 1 linha,
--   metodo_pagamento_enum = 'pix,transferencia,boleto,asaas'). Confere que nao
--   houve confusao entre os dois tipos.
SELECT t.typname,
       string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) AS vals
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
JOIN pg_namespace n ON n.oid = t.typnamespace AND n.nspname = 'public'
WHERE t.typname = 'metodo_pagamento_enum'
GROUP BY t.typname;

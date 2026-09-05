-- ============================================================
-- Verificacao da Migration 0047 (indice nao-unico em asaas_payment_id)
-- — rodar no SQL Editor
-- ============================================================
-- IMPORTANTE: rode UMA query por vez. Aplicar DEPOIS da 0046.
-- ============================================================


-- ============================================================
-- PRE (rodar ANTES de aplicar, e DEPOIS da 0046)
-- ============================================================

-- PRE.1 — o indice do UNIQUE ja saiu junto com o DROP da 0046 e o novo ainda
--   nao existe (esperado: 0 linhas). Se ainda aparecer
--   `faturas_asaas_payment_id_key`, a 0046 nao foi aplicada — pare.
SELECT i.relname AS indice
FROM pg_class t
JOIN pg_index ix ON ix.indrelid = t.oid
JOIN pg_class i ON i.oid = ix.indexrelid
WHERE t.relname = 'faturas' AND i.relname LIKE '%asaas_payment_id%';


-- ============================================================
-- POS (rodar DEPOIS de aplicar)
-- ============================================================

-- POS.1 — indice criado e NAO-unico (esperado: 1 linha,
--   faturas_asaas_payment_id_idx / unico = false)
SELECT i.relname AS indice, ix.indisunique AS unico
FROM pg_class t
JOIN pg_index ix ON ix.indrelid = t.oid
JOIN pg_class i ON i.oid = ix.indexrelid
WHERE t.relname = 'faturas' AND i.relname LIKE '%asaas_payment_id%';

-- POS.2 — panorama final dos indices da faturas (esperado: o pkey, os dois de
--   subscription/status/paid_at da 0027, o unique da idempotencia, e este novo)
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'faturas'
ORDER BY indexname;

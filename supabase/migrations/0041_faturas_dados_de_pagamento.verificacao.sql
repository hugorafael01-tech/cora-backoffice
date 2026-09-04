-- ============================================================
-- Verificacao da Migration 0041 (faturas: linha_digitavel + pix_payload)
-- — rodar no SQL Editor
-- ============================================================
-- IMPORTANTE: rode UMA query por vez (o SQL Editor so mostra o ultimo SELECT).
-- ============================================================


-- ============================================================
-- PRE (rodar ANTES de aplicar)
-- ============================================================

-- PRE.1 — as duas colunas ainda NAO devem existir (esperado: 0 linhas)
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'faturas'
  AND column_name IN ('linha_digitavel', 'pix_payload');

-- PRE.2 — a coluna que vamos REUSAR ja existe (esperado: 1 linha,
--   'asaas_invoice_url'). Se esta vier vazia, PARE: o pressuposto da migration
--   caiu e a geracao nao tem onde gravar o link da fatura.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'faturas'
  AND column_name = 'asaas_invoice_url';


-- ============================================================
-- POS (rodar DEPOIS de aplicar)
-- ============================================================

-- POS.1 — as duas colunas criadas: text, nullable YES, sem default
--   (esperado: 2 linhas)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'faturas'
  AND column_name IN ('linha_digitavel', 'pix_payload')
ORDER BY column_name;

-- POS.2 — a constraint de idempotencia continua de pe e sobre
--   periodo_referencia (esperado: 1 linha,
--   'faturas_subscription_id_periodo_referencia_key' / UNIQUE (subscription_id,
--   periodo_referencia)). E o que a Fase 3 usa; conferir que o ALTER nao mexeu.
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'public.faturas'::regclass
  AND contype = 'u'
ORDER BY conname;

-- POS.3 — RLS intocada: continua UMA policy, SELECT pra admin
--   (esperado: 1 linha, admin_read_faturas / SELECT / is_admin())
SELECT policyname, cmd, roles::text, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'faturas';

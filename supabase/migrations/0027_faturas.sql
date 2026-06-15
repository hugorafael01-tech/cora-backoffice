-- ============================================================
-- Cora Backoffice - Migration 0027: tabela faturas
-- ============================================================
-- Materializacao local do historico de cobrancas pagas.
-- Fonte da verdade continua sendo o Asaas; esta tabela e copia local pra leitura rapida.
-- Fase 1: pago-only, dirigido por webhook (fatura nasce ja 'paga').
-- Expand-only (tabela nova). Sem UI, sem codigo de aplicacao, sem backfill.
--
-- RLS: espelha asaas_webhook_events (0020). SELECT pra admin via is_admin();
-- escrita somente service_role (webhook do Portal usa bypass de RLS); anon nada.
-- Sem policy SELECT-own pro assinante (fase 1: Portal le via endpoint server).
--
-- Aplicar via SQL Editor do Supabase (historico local pode estar dessincronizado
-- com a CLI desde a 0018/0019). Probes em 0027_faturas.verificacao.sql.
--
-- Data: 2026-06-15
-- ============================================================

-- ------------------------------------------------------------
-- 1. Enum: fatura_status_enum
--    Fase 1 so usa 'paga'; os outros estados ficam pro futuro (expand).
-- ------------------------------------------------------------
CREATE TYPE fatura_status_enum AS ENUM ('pendente', 'paga', 'falha', 'cancelada');

-- ------------------------------------------------------------
-- 2. Tabela: faturas
-- ------------------------------------------------------------
CREATE TABLE faturas (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id    UUID NOT NULL REFERENCES subscriptions(id),

  periodo_referencia TEXT NOT NULL CHECK (periodo_referencia ~ '^\d{4}-(0[1-9]|1[0-2])$'),  -- 'YYYY-MM', mes validado

  -- Snapshot da base no momento da materializacao (deterministico do plano)
  qty_paes           INTEGER NOT NULL CHECK (qty_paes >= 0),
  valor_paes         NUMERIC(10,2) NOT NULL CHECK (valor_paes >= 0),   -- 99 x qty_paes (congela o preco vigente)
  valor_frete        NUMERIC(10,2) NOT NULL CHECK (valor_frete >= 0),  -- 15

  -- Total real cobrado (Asaas). extras = valor_total - valor_paes - valor_frete (derivado na leitura)
  valor_total        NUMERIC(10,2) NOT NULL CHECK (valor_total >= 0),

  status             fatura_status_enum NOT NULL DEFAULT 'pendente',
  paid_at            TIMESTAMPTZ,

  asaas_payment_id   TEXT UNIQUE,   -- idempotencia do webhook + reconciliacao; NULL convive (varios sem id)
  asaas_invoice_url  TEXT,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (subscription_id, periodo_referencia)
);

-- ------------------------------------------------------------
-- 3. Indices
-- ------------------------------------------------------------
CREATE INDEX faturas_subscription_id_idx ON faturas(subscription_id);
CREATE INDEX faturas_status_idx          ON faturas(status);
CREATE INDEX faturas_paid_at_idx         ON faturas(paid_at) WHERE status = 'paga';

-- ------------------------------------------------------------
-- 4. Trigger updated_at (set_updated_at() existe desde 0012)
-- ------------------------------------------------------------
CREATE TRIGGER trg_faturas_updated_at
  BEFORE UPDATE ON faturas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- 5. RLS e grants (espelha asaas_webhook_events - 0020)
--    Leitura: painel do backoffice via client autenticado + is_admin().
--    Escrita: SOMENTE service_role (bypass de RLS; o client nunca escreve, postura pos-0019).
-- ------------------------------------------------------------
ALTER TABLE faturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_faturas"
  ON faturas FOR SELECT TO authenticated
  USING (is_admin());

-- Defensivo (licao 0019): Supabase concede GRANT default em tabela nova de public.
-- Revoga toda escrita de authenticated/anon e a leitura de anon. service_role intocado.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON faturas FROM authenticated, anon;

REVOKE SELECT ON faturas FROM anon;

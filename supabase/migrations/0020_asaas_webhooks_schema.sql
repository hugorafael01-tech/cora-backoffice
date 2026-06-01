-- ============================================================
-- Cora Backoffice — Migration 0020: schema de webhooks do Asaas (Perna 1)
-- ============================================================
-- Task ancora: 86e1mk8c0 (Financeiro: webhooks Asaas). Esta perna e SO schema (DDL);
-- o endpoint (cora-portal) e o painel (cora-backoffice) sao pernas seguintes.
--
-- Integracao de webhooks do Asaas pra refletir status de pagamento sem acompanhamento
-- manual. Fase 1: cobranca criada manualmente no painel do Asaas; casamento evento->
-- assinante via externalReference = id da subscription da Cora. Eventos relevantes:
-- PAYMENT_CONFIRMED, PAYMENT_RECEIVED, PAYMENT_OVERDUE. Asaas reenvia eventos (retry) ->
-- idempotencia por evt id.
--
-- Expand-only (padrao expand-contract da Frente D): so adiciona. NAO altera/dropa nada.
-- NAO mexe no enum subscription_status nem na coluna subscriptions.status (eixo da
-- assinatura, separado do eixo de pagamento). Colunas novas ficam null ate o endpoint
-- comecar a refletir.
--
-- PONTOS DE PARADA (ver Docs/CORA_Briefing_Asaas_Perna1_Schema.md):
--   - NAO aplicar via db push. Hugo aplica via SQL Editor (historico local nao sincronizado
--     com a CLI; db push reaplica tudo e quebra. Mesma licao da 0018/0019).
--   - Escrita em asaas_webhook_events e SO service_role (bypass de RLS). Nunca
--     authenticated/anon (mesma licao da 0019).
--   - Leitura: painel do backoffice le via client autenticado + is_admin() (padrao 0007/0008,
--     confirmado no codigo: src/lib/supabase.ts usa anon key; nao existe service_role no app).
--
-- Data: 2026-06-01
-- ============================================================

-- ------------------------------------------------------------
-- 1. Enum novo: payment_status_enum (eixo de pagamento, separado de subscription_status).
--    Convencao do repo: enums com sufixo _enum, snake_case.
-- ------------------------------------------------------------
CREATE TYPE payment_status_enum AS ENUM ('em_dia', 'pendente', 'vencido');

-- ------------------------------------------------------------
-- 2. subscriptions — 3 colunas novas, todas nullable (expand-only).
--    Eixo de pagamento, SEPARADO do `status` da assinatura: uma subscription pode estar
--    active e com payment_status vencido. Nao populadas agora (null ate o endpoint refletir).
-- ------------------------------------------------------------
ALTER TABLE subscriptions
  ADD COLUMN payment_status     payment_status_enum NULL,
  ADD COLUMN last_payment_at    TIMESTAMPTZ NULL,
  ADD COLUMN last_payment_event TEXT NULL;

COMMENT ON COLUMN subscriptions.payment_status     IS 'Eixo de pagamento (em_dia/pendente/vencido), separado de status. Refletido pelo endpoint de webhooks Asaas.';
COMMENT ON COLUMN subscriptions.last_payment_at    IS 'Quando o ultimo pagamento foi confirmado/recebido (Asaas).';
COMMENT ON COLUMN subscriptions.last_payment_event IS 'Ultimo event_type do Asaas que tocou esta subscription (ex PAYMENT_RECEIVED).';

-- ------------------------------------------------------------
-- 3. Tabela nova: asaas_webhook_events (a "caixa-preta").
--    Guarda TODO evento cru do Asaas, pra idempotencia e auditoria. O reflexo no
--    payment_status da subscription (perna do endpoint) e derivado desta tabela; um bug no
--    reflexo nunca derruba a fila do Asaas porque o endpoint so precisa gravar aqui e
--    responder 200.
-- ------------------------------------------------------------
CREATE TABLE asaas_webhook_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asaas_event_id     TEXT NOT NULL UNIQUE,                                  -- "evt_..."; UNIQUE = guarda de idempotencia
  event_type         TEXT NOT NULL,                                         -- ex "PAYMENT_RECEIVED"
  asaas_payment_id   TEXT NULL,                                             -- "pay_..."
  asaas_customer_id  TEXT NULL,                                             -- "cus_..."
  external_reference TEXT NULL,                                             -- externalReference do payload (= id da subscription da Cora)
  subscription_id    UUID NULL REFERENCES subscriptions(id),               -- subscription casada, se resolvida (nullable: evento pode nao casar)
  payment_status     TEXT NULL,                                            -- status do pagamento no payload do Asaas (ex "RECEIVED")
  payload            JSONB NOT NULL,                                       -- corpo inteiro do webhook, cru (robustez: campos novos nao quebram nada)
  received_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),                   -- quando a Cora recebeu
  processed_at       TIMESTAMPTZ NULL                                     -- quando o reflexo foi aplicado (null = nao processado; permite reprocessar/auditar)
);

-- Indices: o UNIQUE em asaas_event_id ja cria indice. Estes ajudam o painel.
CREATE INDEX idx_asaas_webhook_events_subscription_id ON asaas_webhook_events(subscription_id);
CREATE INDEX idx_asaas_webhook_events_event_type      ON asaas_webhook_events(event_type);

COMMENT ON TABLE asaas_webhook_events IS 'Eventos crus de webhook do Asaas (idempotencia + auditoria). Escrita so service_role; leitura admin via is_admin().';

-- ------------------------------------------------------------
-- 4. RLS e grants (CRITICO — padrao pos-revoke 0019).
--    Leitura: painel do backoffice via client autenticado + is_admin() (padrao 0007).
--    Escrita: SOMENTE service_role (o endpoint usa service_role e faz bypass de RLS).
-- ------------------------------------------------------------
ALTER TABLE asaas_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_asaas_webhook_events"
  ON asaas_webhook_events FOR SELECT TO authenticated
  USING (is_admin());

-- Defensivo (licao 0019): Supabase concede GRANT default em tabela nova de public.
-- Revoga toda escrita de authenticated/anon e a leitura de anon. service_role intocado.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON asaas_webhook_events FROM authenticated, anon;

REVOKE SELECT ON asaas_webhook_events FROM anon;

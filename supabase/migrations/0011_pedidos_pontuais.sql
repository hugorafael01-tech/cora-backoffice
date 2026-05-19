-- ============================================================
-- Cora Backoffice — Migration 0011: pedidos_pontuais + metodo_pagamento_enum
-- ============================================================

CREATE TYPE metodo_pagamento_enum AS ENUM (
  'pix',
  'transferencia',
  'boleto',
  'asaas'
);

CREATE TABLE pedidos_pontuais (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semana_id             UUID NOT NULL REFERENCES semanas(id) ON DELETE RESTRICT,

  -- Classificação
  motivo                TEXT NOT NULL
                        CHECK (motivo IN ('presente', 'institucional', 'outros')),
  status                TEXT NOT NULL DEFAULT 'rascunho'
                        CHECK (status IN ('rascunho', 'confirmado', 'entregue', 'cancelado')),

  -- Pagador
  pagador_nome          TEXT NOT NULL,
  pagador_email         TEXT,
  pagador_whatsapp      TEXT,
  pagador_cpf_cnpj      TEXT,

  -- Destinatário (nullable se igual ao pagador)
  destinatario_nome     TEXT,
  destinatario_whatsapp TEXT,

  -- Endereço de entrega
  endereco_cep          TEXT NOT NULL,
  endereco_rua          TEXT NOT NULL,
  endereco_numero       TEXT NOT NULL,
  endereco_complemento  TEXT,
  endereco_bairro       TEXT NOT NULL,
  endereco_cidade       TEXT NOT NULL,
  endereco_estado       TEXT NOT NULL,

  -- Composição (mesmo formato de weekly_orders.composition: { slug: qty })
  composicao            JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Pagamento
  metodo_pagamento      metodo_pagamento_enum,
  referencia_externa    TEXT,
  valor_total           NUMERIC,

  observacoes           TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmado_at         TIMESTAMPTZ,
  entregue_at           TIMESTAMPTZ
);

CREATE INDEX idx_pedidos_pontuais_semana ON pedidos_pontuais(semana_id);
CREATE INDEX idx_pedidos_pontuais_status ON pedidos_pontuais(status);

ALTER TABLE pedidos_pontuais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_pedidos_pontuais"
  ON pedidos_pontuais FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE TRIGGER trg_pedidos_pontuais_updated_at
  BEFORE UPDATE ON pedidos_pontuais
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

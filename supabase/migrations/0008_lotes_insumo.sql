-- ============================================================
-- Cora Backoffice — Migration 0008: lotes_insumo + estoque em ingredientes
-- ============================================================

-- Estoque em ingredientes (idempotente)
ALTER TABLE ingredientes
  ADD COLUMN IF NOT EXISTS quantidade_atual_g  NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantidade_minima_g NUMERIC NOT NULL DEFAULT 0;

-- Tabela de lotes (minimalista — sem quantidade_restante por lote)
CREATE TABLE lotes_insumo (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingrediente_id          UUID NOT NULL REFERENCES ingredientes(id) ON DELETE RESTRICT,
  fornecedor_id           UUID REFERENCES fornecedores(id) ON DELETE SET NULL,
  identificador           TEXT NOT NULL,                  -- ex: "#2604-A"
  quantidade_recebida_g   NUMERIC NOT NULL CHECK (quantidade_recebida_g > 0),
  data_recebimento        DATE NOT NULL,
  validade                DATE,
  notas                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lotes_insumo_ingrediente ON lotes_insumo(ingrediente_id);
CREATE INDEX idx_lotes_insumo_validade ON lotes_insumo(validade) WHERE validade IS NOT NULL;

ALTER TABLE lotes_insumo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_lotes_insumo"
  ON lotes_insumo FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE TRIGGER trg_lotes_insumo_updated_at
  BEFORE UPDATE ON lotes_insumo
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Trigger: lote recebido soma em ingredientes.quantidade_atual_g.
-- updated_at de ingredientes é coberto pelo trigger ingredientes_set_updated_at,
-- então não duplico aqui.
CREATE OR REPLACE FUNCTION fn_lote_recebido_soma_estoque()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ingredientes
  SET quantidade_atual_g = quantidade_atual_g + NEW.quantidade_recebida_g
  WHERE id = NEW.ingrediente_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lote_recebido_soma_estoque
  AFTER INSERT ON lotes_insumo
  FOR EACH ROW EXECUTE FUNCTION fn_lote_recebido_soma_estoque();

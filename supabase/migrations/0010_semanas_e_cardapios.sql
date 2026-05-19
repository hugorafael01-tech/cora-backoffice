-- ============================================================
-- Cora Backoffice — Migration 0010: semanas + cardapios + popular_cardapio_padrao
-- ============================================================

CREATE TABLE semanas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero        INT NOT NULL,
  ano           INT NOT NULL,
  data_inicio   DATE NOT NULL,
  data_fim      DATE NOT NULL,
  data_entrega  DATE NOT NULL,
  data_corte    TIMESTAMPTZ NOT NULL,
  status        TEXT NOT NULL DEFAULT 'rascunho'
                CHECK (status IN ('rascunho', 'aberta', 'congelada', 'concluida')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (numero, ano)
);

CREATE INDEX idx_semanas_data_entrega ON semanas(data_entrega);
CREATE INDEX idx_semanas_status ON semanas(status);

ALTER TABLE semanas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_semanas"
  ON semanas FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE TRIGGER trg_semanas_updated_at
  BEFORE UPDATE ON semanas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Snapshot do cardápio da semana
CREATE TABLE cardapios (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semana_id     UUID NOT NULL REFERENCES semanas(id) ON DELETE CASCADE,
  produto_id    UUID NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  tipo          tipo_cardapio_enum NOT NULL,    -- snapshot do tipo no momento da publicação
  preco_avulso  NUMERIC NOT NULL,               -- snapshot do preço
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (semana_id, produto_id)
);

CREATE INDEX idx_cardapios_semana ON cardapios(semana_id);

ALTER TABLE cardapios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_cardapios"
  ON cardapios FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- Função: popula cardápio padrão (base + fixo) ao abrir semana.
-- Chamada explícita pelo frontend; sem trigger silencioso.
CREATE OR REPLACE FUNCTION popular_cardapio_padrao(p_semana_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO cardapios (semana_id, produto_id, tipo, preco_avulso)
  SELECT p_semana_id, p.id, p.tipo_cardapio, p.preco_avulso
  FROM produtos p
  WHERE p.tipo_cardapio IN ('base', 'fixo')
    AND p.ativo = TRUE
    AND p.preco_avulso IS NOT NULL
  ON CONFLICT (semana_id, produto_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

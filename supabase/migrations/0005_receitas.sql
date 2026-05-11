-- ============================================================
-- Cora Backoffice — Migration 0005: receitas
-- ============================================================

CREATE TYPE versao_receita_status AS ENUM ('rascunho', 'teste', 'ativa', 'arquivada');

-- ============ RECEITAS ============

CREATE TABLE receitas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id          UUID NOT NULL UNIQUE REFERENCES produtos(id) ON DELETE CASCADE,
  versao_ativa_id     UUID,  -- FK adicionada após criar versoes_receita
  grupo_sugerido      SMALLINT NOT NULL DEFAULT 2
                      CHECK (grupo_sugerido BETWEEN 1 AND 3),
  formato             produto_formato NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX receitas_produto_idx ON receitas(produto_id);

CREATE TRIGGER receitas_set_updated_at
  BEFORE UPDATE ON receitas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE receitas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "receitas admin all" ON receitas
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============ VERSOES_RECEITA ============

CREATE TABLE versoes_receita (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receita_id          UUID NOT NULL REFERENCES receitas(id) ON DELETE CASCADE,
  numero_versao       INT NOT NULL,
  status              versao_receita_status NOT NULL DEFAULT 'rascunho',
  hidratacao_alvo     NUMERIC(5,2),
  peso_massa_g        INT,
  perda_coccao        NUMERIC(4,3),
  notas               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at         TIMESTAMPTZ,

  UNIQUE (receita_id, numero_versao)
);

CREATE INDEX versoes_receita_receita_idx ON versoes_receita(receita_id);
CREATE INDEX versoes_receita_status_idx ON versoes_receita(status);

ALTER TABLE versoes_receita ENABLE ROW LEVEL SECURITY;
CREATE POLICY "versoes_receita admin all" ON versoes_receita
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- FK circular: receitas.versao_ativa_id → versoes_receita.id
ALTER TABLE receitas
  ADD CONSTRAINT receitas_versao_ativa_fk
  FOREIGN KEY (versao_ativa_id) REFERENCES versoes_receita(id);

-- ============ INGREDIENTES_RECEITA ============

CREATE TABLE ingredientes_receita (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  versao_receita_id   UUID NOT NULL REFERENCES versoes_receita(id) ON DELETE CASCADE,
  ingrediente_id      UUID NOT NULL REFERENCES ingredientes(id),
  percentual_baker    NUMERIC(6,4) NOT NULL,
  ordem               INT NOT NULL DEFAULT 0,
  notas               TEXT,

  UNIQUE (versao_receita_id, ingrediente_id)
);

CREATE INDEX ingredientes_receita_versao_idx ON ingredientes_receita(versao_receita_id);
CREATE INDEX ingredientes_receita_ingrediente_idx ON ingredientes_receita(ingrediente_id);

ALTER TABLE ingredientes_receita ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ingredientes_receita admin all" ON ingredientes_receita
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============ ETAPAS_RECEITA ============

CREATE TABLE etapas_receita (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  versao_receita_id   UUID NOT NULL REFERENCES versoes_receita(id) ON DELETE CASCADE,
  ordem               INT NOT NULL,
  nome                TEXT NOT NULL,
  duracao_min         INT,
  notas               TEXT,

  UNIQUE (versao_receita_id, ordem)
);

CREATE INDEX etapas_receita_versao_idx ON etapas_receita(versao_receita_id);

ALTER TABLE etapas_receita ENABLE ROW LEVEL SECURITY;
CREATE POLICY "etapas_receita admin all" ON etapas_receita
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============ FUNÇÕES HELPER ============

-- Clona uma versão de receita como nova versão (status default = teste).
-- Copia ingredientes e etapas. Retorna o ID da nova versão.
CREATE OR REPLACE FUNCTION fork_versao_receita(
  p_versao_origem_id UUID,
  p_status versao_receita_status DEFAULT 'teste'
) RETURNS UUID AS $$
DECLARE
  v_nova_versao_id UUID;
  v_receita_id UUID;
  v_proximo_numero INT;
BEGIN
  SELECT receita_id INTO v_receita_id
  FROM versoes_receita WHERE id = p_versao_origem_id;

  IF v_receita_id IS NULL THEN
    RAISE EXCEPTION 'Versão de origem % não encontrada', p_versao_origem_id;
  END IF;

  SELECT COALESCE(MAX(numero_versao), 0) + 1 INTO v_proximo_numero
  FROM versoes_receita WHERE receita_id = v_receita_id;

  INSERT INTO versoes_receita (
    receita_id, numero_versao, status,
    hidratacao_alvo, peso_massa_g, perda_coccao, notas
  )
  SELECT
    receita_id, v_proximo_numero, p_status,
    hidratacao_alvo, peso_massa_g, perda_coccao, notas
  FROM versoes_receita WHERE id = p_versao_origem_id
  RETURNING id INTO v_nova_versao_id;

  INSERT INTO ingredientes_receita
    (versao_receita_id, ingrediente_id, percentual_baker, ordem, notas)
  SELECT v_nova_versao_id, ingrediente_id, percentual_baker, ordem, notas
  FROM ingredientes_receita WHERE versao_receita_id = p_versao_origem_id;

  INSERT INTO etapas_receita
    (versao_receita_id, ordem, nome, duracao_min, notas)
  SELECT v_nova_versao_id, ordem, nome, duracao_min, notas
  FROM etapas_receita WHERE versao_receita_id = p_versao_origem_id;

  RETURN v_nova_versao_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ativa uma versão de receita. Arquiva a versão anteriormente ativa.
-- Atualiza receitas.versao_ativa_id.
CREATE OR REPLACE FUNCTION ativar_versao_receita(p_versao_id UUID)
RETURNS VOID AS $$
DECLARE
  v_receita_id UUID;
  v_versao_anterior_id UUID;
BEGIN
  SELECT v.receita_id, r.versao_ativa_id
  INTO v_receita_id, v_versao_anterior_id
  FROM versoes_receita v
  JOIN receitas r ON v.receita_id = r.id
  WHERE v.id = p_versao_id;

  IF v_receita_id IS NULL THEN
    RAISE EXCEPTION 'Versão % não encontrada', p_versao_id;
  END IF;

  UPDATE versoes_receita SET status = 'ativa' WHERE id = p_versao_id;

  IF v_versao_anterior_id IS NOT NULL AND v_versao_anterior_id != p_versao_id THEN
    UPDATE versoes_receita
    SET status = 'arquivada', archived_at = NOW()
    WHERE id = v_versao_anterior_id;
  END IF;

  UPDATE receitas SET versao_ativa_id = p_versao_id WHERE id = v_receita_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

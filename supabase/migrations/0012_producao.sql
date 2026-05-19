-- ============================================================
-- Cora Backoffice — Migration 0012: produção
-- ============================================================

-- ============ ENUMS ============

CREATE TYPE etapa_status_enum AS ENUM (
  'aguardando',
  'em_curso',
  'concluida',
  'pulada'
);

CREATE TYPE etapa_tipo_enum AS ENUM (
  'autolise_mistura',
  'batimento',
  'falsa_dobra',
  'dobra',
  'pre_shape',
  'shape',
  'descanso',
  'fermentacao_final',
  'coccao'
);

CREATE TYPE producao_status_enum AS ENUM (
  'planejada',
  'em_curso',
  'concluida',
  'cancelada'
);

-- ============ ALTER etapas_receita ============

-- Adiciona tipo enum em etapas_receita pra popular_etapas_producao() copiar
-- direto sem parsing de nome.
ALTER TABLE etapas_receita
  ADD COLUMN IF NOT EXISTS tipo etapa_tipo_enum;

-- Seed do tipo (nomes confirmados via SELECT DISTINCT nome em 18/mai/2026).
UPDATE etapas_receita SET tipo = 'autolise_mistura'  WHERE nome = 'Autólise';
UPDATE etapas_receita SET tipo = 'batimento'         WHERE nome = 'Batimento';
UPDATE etapas_receita SET tipo = 'falsa_dobra'       WHERE nome = 'Falsa dobra';
UPDATE etapas_receita SET tipo = 'dobra'             WHERE nome = 'Dobras';
UPDATE etapas_receita SET tipo = 'pre_shape'         WHERE nome = 'Descanso e divisão';
UPDATE etapas_receita SET tipo = 'shape'             WHERE nome = 'Shape';
UPDATE etapas_receita SET tipo = 'fermentacao_final' WHERE nome = '2ª fermentação';
-- Cocção não vive em etapas_receita — adicionada por popular_etapas_producao().

-- ============ PRODUCOES ============

CREATE TABLE producoes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semana_id           UUID NOT NULL REFERENCES semanas(id) ON DELETE RESTRICT,
  versao_receita_id   UUID NOT NULL REFERENCES versoes_receita(id) ON DELETE RESTRICT,

  multiplicador       NUMERIC NOT NULL DEFAULT 1.0,    -- 1× = receita-base na masseira

  -- Previsto
  qty_paes_prevista   INT,
  massa_prevista_kg   NUMERIC,
  levain_previsto_kg  NUMERIC,

  -- Realizado (input pós-produção)
  qty_paes_realizada  INT,
  massa_realizada_kg  NUMERIC,
  levain_consumido_kg NUMERIC,

  status              producao_status_enum NOT NULL DEFAULT 'planejada',

  iniciada_at         TIMESTAMPTZ,
  concluida_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (semana_id, versao_receita_id)
);

CREATE INDEX idx_producoes_semana ON producoes(semana_id);
CREATE INDEX idx_producoes_status ON producoes(status);

ALTER TABLE producoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_producoes"
  ON producoes FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE TRIGGER trg_producoes_updated_at
  BEFORE UPDATE ON producoes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============ CONTEXTOS_DIA ============

CREATE TABLE contextos_dia (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semana_id                  UUID NOT NULL REFERENCES semanas(id) ON DELETE CASCADE,
  dia                        TEXT NOT NULL CHECK (dia IN ('terca', 'quarta', 'quinta')),

  lote_farinha_principal_id  UUID REFERENCES lotes_insumo(id),
  ultimo_refresh_levain_at   TIMESTAMPTZ,
  temp_ambiente_max_c        NUMERIC,

  notas                      TEXT,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (semana_id, dia)
);

ALTER TABLE contextos_dia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_contextos_dia"
  ON contextos_dia FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE TRIGGER trg_contextos_dia_updated_at
  BEFORE UPDATE ON contextos_dia
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============ CONTEXTOS_PRODUCAO ============

CREATE TABLE contextos_producao (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producao_id                 UUID NOT NULL UNIQUE REFERENCES producoes(id) ON DELETE CASCADE,

  hidratacao_ajustada_pct     NUMERIC,
  temp_agua_autolise_c        NUMERIC,
  temp_massa_pos_batimento_c  NUMERIC,

  notas                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE contextos_producao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_contextos_producao"
  ON contextos_producao FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE TRIGGER trg_contextos_producao_updated_at
  BEFORE UPDATE ON contextos_producao
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============ ETAPAS_PRODUCAO ============

-- Espelha etapas_receita mas com timestamps. Cocção entra como tipo='coccao'
-- (sem tabela fornadas separada).
CREATE TABLE etapas_producao (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producao_id       UUID NOT NULL REFERENCES producoes(id) ON DELETE CASCADE,
  etapa_receita_id  UUID REFERENCES etapas_receita(id) ON DELETE SET NULL,
                    -- ponteiro de origem nullable (etapas ad-hoc como cocção entram sem)
  ordem             INT NOT NULL,
  tipo              etapa_tipo_enum NOT NULL,
  status            etapa_status_enum NOT NULL DEFAULT 'aguardando',

  prevista_at       TIMESTAMPTZ,
  iniciada_at       TIMESTAMPTZ,
  concluida_at      TIMESTAMPTZ,

  dobra_numero      INT,        -- pra tipo='dobra'
  temp_c            NUMERIC,    -- T° água autólise / T° massa batimento

  -- detalhes JSONB catch-all:
  -- coccao: { qty_paes, base_c, teto_c, duracao_min, fornada_num, fornada_total }
  -- shape:  { peso_medio_g, recipiente: 'banneton'|'couche'|'tabuleiro' }
  detalhes          JSONB DEFAULT '{}'::jsonb,

  notas             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (producao_id, ordem)
);

CREATE INDEX idx_etapas_producao_producao ON etapas_producao(producao_id, ordem);
CREATE INDEX idx_etapas_status_ativas
  ON etapas_producao(status)
  WHERE status IN ('aguardando', 'em_curso');

ALTER TABLE etapas_producao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_etapas_producao"
  ON etapas_producao FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE TRIGGER trg_etapas_producao_updated_at
  BEFORE UPDATE ON etapas_producao
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============ FUNÇÕES ============

-- Popula etapas de uma produção a partir do template (etapas_receita) +
-- adiciona cocção ao final (não vive em etapas_receita).
CREATE OR REPLACE FUNCTION popular_etapas_producao(p_producao_id UUID)
RETURNS VOID AS $$
DECLARE
  v_max_ordem INT;
BEGIN
  -- 1. Copia etapas do template
  INSERT INTO etapas_producao (producao_id, etapa_receita_id, ordem, tipo, notas)
  SELECT
    p_producao_id,
    er.id,
    er.ordem,
    COALESCE(er.tipo, 'autolise_mistura'),    -- fallback defensivo
    er.notas
  FROM etapas_receita er
  JOIN producoes p ON p.versao_receita_id = er.versao_receita_id
  WHERE p.id = p_producao_id
  ORDER BY er.ordem
  ON CONFLICT (producao_id, ordem) DO NOTHING;

  -- 2. Adiciona cocção ao final
  SELECT COALESCE(MAX(ordem), 0) + 1 INTO v_max_ordem
  FROM etapas_producao WHERE producao_id = p_producao_id;

  INSERT INTO etapas_producao (producao_id, ordem, tipo)
  VALUES (p_producao_id, v_max_ordem, 'coccao')
  ON CONFLICT (producao_id, ordem) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Peso de farinha por pão a partir da soma dos baker percentages.
-- Convenção: percentual_baker é decimal (0.85 = 85%). Soma dos baker
-- decimais = total relativo à farinha (farinha = 1.0).
-- peso_farinha = peso_massa / soma_baker.
CREATE OR REPLACE FUNCTION peso_farinha_por_pao(p_versao_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_peso_massa NUMERIC;
  v_soma_baker NUMERIC;
BEGIN
  SELECT peso_massa_g INTO v_peso_massa
  FROM versoes_receita WHERE id = p_versao_id;

  SELECT COALESCE(SUM(percentual_baker), 0) INTO v_soma_baker
  FROM ingredientes_receita WHERE versao_receita_id = p_versao_id;

  IF v_soma_baker = 0 OR v_peso_massa IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN v_peso_massa / v_soma_baker;
END;
$$ LANGUAGE plpgsql;

-- Mise en place agregado por ingrediente (qty total em g) pra uma semana.
-- Retorna por ingrediente_id e por receita (pra breakdown do wireframe).
-- Convenção decimal: peso_ingrediente = peso_farinha × percentual_baker.
CREATE OR REPLACE FUNCTION mise_en_place_semana(p_semana_id UUID)
RETURNS TABLE (
  ingrediente_id   UUID,
  ingrediente_nome TEXT,
  produto_id       UUID,
  produto_nome     TEXT,
  qty_g            NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.nome,
    pr.id,
    pr.nome,
    SUM(
      peso_farinha_por_pao(p.versao_receita_id) * ir.percentual_baker
      * p.qty_paes_prevista
    ) AS qty_g
  FROM producoes p
  JOIN versoes_receita vr ON vr.id = p.versao_receita_id
  JOIN ingredientes_receita ir ON ir.versao_receita_id = vr.id
  JOIN ingredientes i ON i.id = ir.ingrediente_id
  JOIN receitas r ON r.id = vr.receita_id
  JOIN produtos pr ON pr.id = r.produto_id
  WHERE p.semana_id = p_semana_id
    AND p.qty_paes_prevista IS NOT NULL
  GROUP BY i.id, i.nome, pr.id, pr.nome;
END;
$$ LANGUAGE plpgsql;

-- 0021_producao_fatia1_levain_origem.sql
-- Producao fatia 1 (Definir volume / Estado A). Expand-only.
--
-- 1) LEVAIN COMO INGREDIENTE. Corrige peso_farinha_por_pao() e mise_en_place_semana(),
--    que hoje devolvem farinha ERRADA (superestimada ~12%) porque a seed omitiu o
--    levain do Sigma baker. Ex. Original: peso_massa 820 / 1,72 = 477 (errado);
--    com levain 0,20 no Sigma: 820 / 1,92 = 427 (correto). Percentuais validados do Alex.
-- 2) producoes.origem (ponte de dados + higiene de dados de teste).
-- 3) Trigger que preenche massa_prevista_kg e levain_previsto_kg (fonte unica da verdade).
--
-- RLS de producoes ja e admin_all (0012). Aplicar pela sequencia padrao do STATUS
-- (db push, ou SQL Editor se o historico local estiver dessincronizado).

-- ============ 1. LEVAIN COMO INGREDIENTE ============

INSERT INTO ingredientes (slug, nome, unidade, preco_por_kg, notas) VALUES
  ('levain', 'Levain (liquido)', 'g', NULL,
   'Prefermento liquido, build 1:2:2 (isca:farinha:agua). percentual_baker = prefermento sobre a farinha. Custo derivado da farinha/agua, fora de escopo da fatia 1.')
ON CONFLICT (slug) DO NOTHING;

-- Linha de levain por versao 1, com o % validado do Alex (Excel Receitas_e_conversoes).
-- ordem = 0: preferment listado primeiro. Cosmetico; o modulo Receitas pode reordenar.
INSERT INTO ingredientes_receita (versao_receita_id, ingrediente_id, percentual_baker, ordem, notas)
SELECT vr.id, i.id, dados.pct, 0, 'Prefermento. Build 1:2:2.'
FROM (VALUES
  ('original',   0.20),
  ('integral',   0.20),
  ('multigraos', 0.40),
  ('ciabatta',   0.25),
  ('focaccia',   0.30),
  ('brioche',    0.10)
) AS dados(slug, pct)
JOIN produtos p         ON p.slug = dados.slug
JOIN receitas r         ON r.produto_id = p.id
JOIN versoes_receita vr ON vr.receita_id = r.id AND vr.numero_versao = 1
JOIN ingredientes i     ON i.slug = 'levain'
ON CONFLICT (versao_receita_id, ingrediente_id) DO UPDATE
  SET percentual_baker = EXCLUDED.percentual_baker;

-- ============ 2. PRODUCOES.ORIGEM ============

DO $$ BEGIN
  CREATE TYPE producao_origem_enum AS ENUM ('pedido', 'manual', 'teste');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE producoes
  ADD COLUMN IF NOT EXISTS origem producao_origem_enum NOT NULL DEFAULT 'teste';
-- Periodo de teste: producoes nascem 'teste' (purgaveis antes do Alpha).
-- Bridge futura: 'pedido' (do assinante) / 'manual' (acao de mkt mantida).

-- ============ 3. TRIGGER: massa/levain previstos (fonte unica) ============

CREATE OR REPLACE FUNCTION producoes_set_prevista() RETURNS TRIGGER AS $$
DECLARE
  v_peso_massa NUMERIC;
  v_flour_pao  NUMERIC;
  v_levain_pct NUMERIC;
BEGIN
  IF NEW.qty_paes_prevista IS NULL THEN
    NEW.massa_prevista_kg  := NULL;
    NEW.levain_previsto_kg := NULL;
    RETURN NEW;
  END IF;

  SELECT peso_massa_g INTO v_peso_massa
  FROM versoes_receita WHERE id = NEW.versao_receita_id;

  -- correto agora que o levain entra no Sigma baker:
  v_flour_pao := peso_farinha_por_pao(NEW.versao_receita_id);

  SELECT ir.percentual_baker INTO v_levain_pct
  FROM ingredientes_receita ir
  JOIN ingredientes i ON i.id = ir.ingrediente_id
  WHERE ir.versao_receita_id = NEW.versao_receita_id AND i.slug = 'levain';

  NEW.massa_prevista_kg := CASE
    WHEN v_peso_massa IS NULL THEN NULL
    ELSE ROUND(NEW.qty_paes_prevista * v_peso_massa / 1000.0, 3) END;

  NEW.levain_previsto_kg := CASE
    WHEN v_flour_pao IS NULL OR v_levain_pct IS NULL THEN NULL
    ELSE ROUND(NEW.qty_paes_prevista * v_flour_pao * v_levain_pct / 1000.0, 3) END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_producoes_set_prevista ON producoes;
CREATE TRIGGER trg_producoes_set_prevista
  BEFORE INSERT OR UPDATE OF qty_paes_prevista, versao_receita_id ON producoes
  FOR EACH ROW EXECUTE FUNCTION producoes_set_prevista();

-- ============ VERIFICACAO (SQL Editor, uma query por vez) ============
-- a) levain no catalogo:
--    SELECT slug, nome FROM ingredientes WHERE slug = 'levain';
-- b) 6 linhas de levain, % certo (orig/integ 0.20, multi 0.40, ciab 0.25, foca 0.30, brio 0.10):
--    SELECT p.slug, ir.percentual_baker
--    FROM ingredientes_receita ir
--    JOIN ingredientes i ON i.id = ir.ingrediente_id AND i.slug='levain'
--    JOIN versoes_receita vr ON vr.id = ir.versao_receita_id
--    JOIN receitas r ON r.id = vr.receita_id
--    JOIN produtos p ON p.id = r.produto_id
--    ORDER BY p.slug;
-- c) farinha por pao agora ~427 (nao ~477) no Original:
--    SELECT ROUND(peso_farinha_por_pao(vr.id)) FROM versoes_receita vr
--    JOIN receitas r ON r.id=vr.receita_id JOIN produtos p ON p.id=r.produto_id
--    WHERE p.slug='original' AND vr.numero_versao=1;
-- d) coluna origem + default 'teste':
--    SELECT column_default FROM information_schema.columns
--    WHERE table_name='producoes' AND column_name='origem';
-- e) trigger: criar 1 producao de teste, conferir massa/levain preenchidos, e APAGAR depois.

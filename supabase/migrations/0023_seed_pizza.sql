-- 0023_seed_pizza.sql
-- Pizza Classica (Levain) como receita real. Formulacao validada do Alex (Excel).
-- DEPENDE de 0021 (ingrediente 'levain') e 0022 (formato 'disco'/'bola').
--
-- Modelagem: 1 receita = a massa (bola ~283g/un). Produto formato 'disco' (pizza assada
-- classica). 'bola' (massa crua congelada) fica no enum p/ virar SKU proprio quando voce
-- decidir vender/precificar — producao e identica, e so o formato de venda que muda.
--
-- Etapas: NAO seedadas aqui (nao vou inventar tempos). Ate o modulo Receitas autorar o
-- processo, popular_etapas_producao gera so a coccao pra Pizza. Da pra copiar o esqueleto
-- do Original (tipos/ordem, sem duracao) se voce quiser Pizza rastreavel ja na fatia 2.

-- Lemady (melhorador)
INSERT INTO ingredientes (slug, nome, unidade, preco_por_kg, notas) VALUES
  ('lemady', 'Lemady (melhorador)', 'g', NULL,
   'Melhorador enzimatico/malte. ~5g/kg de farinha (0,3% baker). Usado na pizza.')
ON CONFLICT (slug) DO NOTHING;

-- Produto
INSERT INTO produtos (slug, nome, tipo, unidade, formato, peso_alvo_g, preco_avulso) VALUES
  ('pizza', 'Pizza Classica', 'fabricado', 'un', 'disco', 260, NULL)  -- preco: placeholder (definir; ref. Nema)
ON CONFLICT (slug) DO NOTHING;

-- Receita
INSERT INTO receitas (produto_id, formato, grupo_sugerido)
SELECT id, 'disco', 2 FROM produtos WHERE slug = 'pizza'
ON CONFLICT (produto_id) DO NOTHING;

-- Versao 1
INSERT INTO versoes_receita (receita_id, numero_versao, status, hidratacao_alvo, peso_massa_g, perda_coccao, notas)
SELECT r.id, 1, 'rascunho', 66.50, 283, 0.08,
  'Pizza Classica (Levain). Receita base do Alex = 4 un (~283g massa/un). Agua H2O1 85% / H2O2 15%. Lemady 0,3%. Perda placeholder. Venda: disco (assada) e bola (massa crua congelada).'
FROM receitas r JOIN produtos p ON p.id = r.produto_id
WHERE p.slug = 'pizza'
ON CONFLICT (receita_id, numero_versao) DO NOTHING;

-- Versao ativa
UPDATE receitas SET versao_ativa_id = vr.id
FROM versoes_receita vr
JOIN receitas r2 ON r2.id = vr.receita_id
JOIN produtos p ON p.id = r2.produto_id
WHERE receitas.id = r2.id AND p.slug = 'pizza' AND vr.numero_versao = 1;

-- Ingredientes (levain como ingrediente; Sigma baker = 1,888 -> farinha/un ~150g, levain/un ~30g)
INSERT INTO ingredientes_receita (versao_receita_id, ingrediente_id, percentual_baker, ordem, notas)
SELECT vr.id, i.id, dados.pct, dados.ord, dados.nota
FROM (VALUES
  ('levain',              0.20,  0, 'Prefermento. Build 1:2:2.'),
  ('farinha-superiore',   0.85,  1, NULL),
  ('farinha-fv-integral', 0.15,  2, NULL),
  ('agua-mineral',        0.665, 3, 'H2O1 85% / H2O2 15%'),
  ('sal-marinho',         0.02,  4, NULL),
  ('lemady',              0.003, 5, '5g/kg de farinha')
) AS dados(slug, pct, ord, nota)
JOIN ingredientes i     ON i.slug = dados.slug
JOIN produtos p         ON p.slug = 'pizza'
JOIN receitas r         ON r.produto_id = p.id
JOIN versoes_receita vr ON vr.receita_id = r.id AND vr.numero_versao = 1
ON CONFLICT (versao_receita_id, ingrediente_id) DO UPDATE
  SET percentual_baker = EXCLUDED.percentual_baker;

-- Verificacao (uma por vez):
-- a) SELECT slug, nome, formato, peso_alvo_g FROM produtos WHERE slug='pizza';
-- b) farinha/un ~150: SELECT ROUND(peso_farinha_por_pao(vr.id)) FROM versoes_receita vr
--    JOIN receitas r ON r.id=vr.receita_id JOIN produtos p ON p.id=r.produto_id
--    WHERE p.slug='pizza' AND vr.numero_versao=1;
-- c) versao ativa setada: SELECT versao_ativa_id IS NOT NULL FROM receitas r
--    JOIN produtos p ON p.id=r.produto_id WHERE p.slug='pizza';

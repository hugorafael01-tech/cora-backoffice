-- ============================================================
-- Cora Backoffice — Migration 0006: seed inicial
-- ============================================================
-- Fonte: CORA_Fichas_Producao_v5.xlsx (10/mai/2026)
-- Decisão: receitas entram com status = 'ativa' (não 'teste').
-- Pesos canônicos: Original e Integral 700g (não 705g da planilha).

BEGIN;

-- ============ FORNECEDORES ============

INSERT INTO fornecedores (nome, prazo_entrega_dias, notas) VALUES
  ('CCN (Le 5 Stagioni)', 3, 'Farinhas italianas importadas. Saco 10kg. Min. R$400.'),
  ('Fazenda Vargem', 15, 'Moinho a pedra. Saco 10kg, val. 3 meses.');

-- ============ INGREDIENTES (25) ============

WITH ccn AS (SELECT id FROM fornecedores WHERE nome = 'CCN (Le 5 Stagioni)'),
     fv  AS (SELECT id FROM fornecedores WHERE nome = 'Fazenda Vargem')
INSERT INTO ingredientes (slug, nome, preco_por_kg, fornecedor_id, notas) VALUES
  -- Farinhas (5)
  ('farinha-superiore',   'Farinha Superiore (Le 5 Stagioni)',  12.26, (SELECT id FROM ccn), 'W330. Saco 10kg = R$122,60.'),
  ('farinha-mora',        'Farinha Mora (Le 5 Stagioni)',       23.41, (SELECT id FROM ccn), 'Integral italiana. Saco 10kg = R$234,12. Val. 8 meses.'),
  ('farinha-fv-integral', 'Farinha FV Integral',                 7.90, (SELECT id FROM fv),  'Moída a pedra. Saco 10kg. Val. 3 meses.'),
  ('farinha-slow',        'Farinha Slow (FV)',                   9.95, (SELECT id FROM fv),  'Semi-integral. Saco 10kg. Val. 3 meses.'),
  ('semola-rimacinata',   'Sêmola Rimacinata (Le 5 Stagioni)',  22.19, (SELECT id FROM ccn), 'Saco 10kg = R$221,92.'),
  -- Gorduras (2)
  ('azeite-luglio',       'Azeite Luglio',                      98.00, (SELECT id FROM ccn), 'Bombona 5L = R$489,99.'),
  ('manteiga-sem-sal',    'Manteiga sem sal',                   73.45, NULL, NULL),
  -- Sal e açúcar (3)
  ('sal-marinho',         'Sal marinho',                        14.69, NULL, NULL),
  ('sal-grosso',          'Sal grosso',                          8.00, NULL, NULL),
  ('acucar',              'Açúcar',                              7.96, NULL, NULL),
  -- Outros líquidos (3)
  ('leite-integral',      'Leite integral',                      7.99, NULL, NULL),
  ('mel',                 'Mel',                                38.00, NULL, NULL),
  ('agua-mineral',        'Água mineral',                        0.75, NULL, 'Levain e massa.'),
  -- Fermentação (1)
  ('fermento-seco',       'Fermento seco',                      80.00, NULL, 'Instantâneo. Usado no brioche.'),
  -- Ovos (1)
  ('ovos',                'Ovos',                               39.93, NULL, 'Preço por kg. Brioche.'),
  -- Sementes (6)
  ('gergelim-branco',     'Gergelim branco',                     4.29, NULL, NULL),
  ('gergelim-preto',      'Gergelim preto',                      9.18, NULL, NULL),
  ('quinoa-mista',        'Quinoa mista',                       49.90, NULL, 'Mais cara das sementes.'),
  ('linhaca-dourada',     'Linhaça dourada',                     2.79, NULL, NULL),
  ('semente-girassol',    'Semente girassol',                    4.95, NULL, NULL),
  ('semente-abobora',     'Semente abóbora',                     9.25, NULL, NULL),
  -- Crostas (2)
  ('aveia-fina',          'Aveia fina',                          8.00, NULL, 'Crosta multigrãos.'),
  ('farelo-trigo',        'Farelo de trigo',                     5.00, NULL, 'Crosta integral.'),
  -- Cobertura focaccia (2)
  ('cebola-roxa',         'Cebola roxa',                        12.00, NULL, 'Cobertura focaccia.'),
  ('alecrim-fresco',      'Alecrim fresco',                     60.00, NULL, 'Cobertura focaccia.');

-- ============ PRODUTOS (6) ============

INSERT INTO produtos (slug, nome, tipo, unidade, formato, peso_alvo_g, preco_avulso) VALUES
  ('original',    'Pão Original',         'fabricado', 'un', 'banneton',  700, 27.00),
  ('integral',    'Pão Integral',         'fabricado', 'un', 'banneton',  700, 29.00),
  ('multigraos',  'Pão Multigrãos',       'fabricado', 'un', 'banneton',  615, 32.00),
  ('focaccia',    'Focaccia Genovesa',    'fabricado', 'un', 'tabuleiro', 258, 22.00),
  ('brioche',     'Brioche',              'fabricado', 'un', 'forma',     256, 32.00),
  ('ciabatta',    'Ciabatta Rústica',     'fabricado', 'un', 'couche',    533, 25.00);

-- ============ PLANO + PLAN_PRODUTOS ============

INSERT INTO planos (slug, nome, preco_por_pao, preco_frete) VALUES
  ('base', 'Plano Base', 99.00, 15.00);

INSERT INTO plan_produtos (plano_id, produto_id, papel)
SELECT
  (SELECT id FROM planos WHERE slug = 'base'),
  p.id,
  CASE
    WHEN p.slug IN ('original', 'integral') THEN 'base'::plan_produto_papel
    ELSE 'rotativa'::plan_produto_papel
  END
FROM produtos p;

-- ============ RECEITAS (estrutura, sem versão ainda) ============

INSERT INTO receitas (produto_id, grupo_sugerido, formato)
SELECT id,
       CASE slug
         WHEN 'original' THEN 1
         WHEN 'integral' THEN 2
         WHEN 'multigraos' THEN 2
         WHEN 'focaccia' THEN 3
         WHEN 'brioche' THEN 3
         WHEN 'ciabatta' THEN 2
       END,
       formato
FROM produtos;

-- ============ VERSOES_RECEITA v1 (rascunho — vira ativa via função) ============

-- Original
WITH r AS (SELECT id FROM receitas WHERE produto_id = (SELECT id FROM produtos WHERE slug = 'original'))
INSERT INTO versoes_receita (receita_id, numero_versao, status, hidratacao_alvo, peso_massa_g, perda_coccao, notas)
SELECT r.id, 1, 'rascunho', 70.00, 820, 0.140,
       'Receita base. Poucos ingredientes, depende da técnica. 4 dobras pra alvéolos regulares. Água: H2O1 (autólise) = 85% / H2O2 (batimento) = 15%. Cocção: lastro 230° / teto 250° · 38min · vapor inicial.'
FROM r;

-- Integral
WITH r AS (SELECT id FROM receitas WHERE produto_id = (SELECT id FROM produtos WHERE slug = 'integral'))
INSERT INTO versoes_receita (receita_id, numero_versao, status, hidratacao_alvo, peso_massa_g, perda_coccao, notas)
SELECT r.id, 1, 'rascunho', 75.00, 820, 0.140,
       '90% FV Integral + 10% Slow. Azeite por último no batimento (pode ser gelado). 3 dobras (não 4). Crosta: farelo de trigo. Água: H2O1 (autólise) = 85% / H2O2 = 15%. Cocção: lastro 230° / teto 250° · 38min · vapor inicial.'
FROM r;

-- Multigrãos
WITH r AS (SELECT id FROM receitas WHERE produto_id = (SELECT id FROM produtos WHERE slug = 'multigraos'))
INSERT INTO versoes_receita (receita_id, numero_versao, status, hidratacao_alvo, peso_massa_g, perda_coccao, notas)
SELECT r.id, 1, 'rascunho', 112.00, 750, 0.180,
       'Processo 2 dias: terça escaldar+levain, quarta produzir. Hidratação 112% (autólise 58% + escaldar 54%). 6 sementes na massa + aveia na crosta (7ª). 4 dobras padrão (pode reduzir pra 2-3 se massa já tiver estrutura). Cocção: lastro 230° / teto 250° · 38min · vapor inicial.'
FROM r;

-- Focaccia
WITH r AS (SELECT id FROM receitas WHERE produto_id = (SELECT id FROM produtos WHERE slug = 'focaccia'))
INSERT INTO versoes_receita (receita_id, numero_versao, status, hidratacao_alvo, peso_massa_g, perda_coccao, notas)
SELECT r.id, 1, 'rascunho', 75.00, 315, 0.180,
       '1 tabuleiro 60×40 = 9 porções = 1 unidade de venda. Farinha 100% Superiore. Dimples com os dedos antes de assar. Azeite generoso. Água: H2O1 = 75% / H2O2 = 25%. Cocção: lastro 250° / teto 260° · 15-20min · sem vapor.'
FROM r;

-- Brioche
WITH r AS (SELECT id FROM receitas WHERE produto_id = (SELECT id FROM produtos WHERE slug = 'brioche'))
INSERT INTO versoes_receita (receita_id, numero_versao, status, hidratacao_alvo, peso_massa_g, perda_coccao, notas)
SELECT r.id, 1, 'rascunho', NULL, 312, 0.180,
       'Fermentação MISTA: levain (sabor) + fermento seco (leveza). 1 forma 6 bolinhas = 1 unidade. Egg wash antes de assar. Cocção: 180°C · 30-35min · sem vapor (temp baixa, açúcar carameliza). 3 dobras (massa enriquecida = menos manipulação).'
FROM r;

-- Ciabatta
WITH r AS (SELECT id FROM receitas WHERE produto_id = (SELECT id FROM produtos WHERE slug = 'ciabatta'))
INSERT INTO versoes_receita (receita_id, numero_versao, status, hidratacao_alvo, peso_massa_g, perda_coccao, notas)
SELECT r.id, 1, 'rascunho', 76.00, 650, 0.180,
       '2ª fermentação em COUCHE (não banneton). Sem corte/pestana. NÃO modelar demais. NÃO desgasificar. Divisão retangular ~650g. Água: H2O1 = 84% / H2O2 = 16%. Cocção: lastro 230° / teto 250° · 25-30min · vapor.'
FROM r;

-- ============ INGREDIENTES_RECEITA ============

-- Original v1
WITH v AS (
  SELECT vr.id FROM versoes_receita vr
  JOIN receitas r ON vr.receita_id = r.id
  JOIN produtos p ON r.produto_id = p.id
  WHERE p.slug = 'original' AND vr.numero_versao = 1
)
INSERT INTO ingredientes_receita (versao_receita_id, ingrediente_id, percentual_baker, ordem, notas)
SELECT v.id, i.id, perc, ord, nota
FROM v, (VALUES
  ('farinha-superiore',   0.85,   1, NULL),
  ('farinha-fv-integral', 0.15,   2, NULL),
  ('agua-mineral',        0.70,   3, 'Total. H2O1 (autólise) = 85% / H2O2 (batimento) = 15%'),
  ('sal-marinho',         0.02,   4, NULL)
) AS dados(slug, perc, ord, nota)
JOIN ingredientes i ON i.slug = dados.slug;

-- Integral v1
WITH v AS (
  SELECT vr.id FROM versoes_receita vr
  JOIN receitas r ON vr.receita_id = r.id
  JOIN produtos p ON r.produto_id = p.id
  WHERE p.slug = 'integral' AND vr.numero_versao = 1
)
INSERT INTO ingredientes_receita (versao_receita_id, ingrediente_id, percentual_baker, ordem, notas)
SELECT v.id, i.id, perc, ord, nota
FROM v, (VALUES
  ('farinha-fv-integral', 0.90,   1, NULL),
  ('farinha-slow',        0.10,   2, NULL),
  ('agua-mineral',        0.75,   3, 'Total. H2O1 = 85% / H2O2 = 15%'),
  ('azeite-luglio',       0.06,   4, 'Por último no batimento'),
  ('sal-marinho',         0.024,  5, NULL),
  ('gergelim-branco',     0.0135, 6, 'Gergelim mix (50/50 com preto), crosta'),
  ('gergelim-preto',      0.0135, 7, 'Gergelim mix (50/50 com branco), crosta'),
  ('farelo-trigo',        0.030,  8, 'Crosta — polvilhar antes do banneton')
) AS dados(slug, perc, ord, nota)
JOIN ingredientes i ON i.slug = dados.slug;

-- Multigrãos v1
-- Nota: água e sal são deduplicados (mesmo ingrediente em momentos diferentes).
-- Momentos de uso ficam em `notas`. Etapas detalham o quando.
WITH v AS (
  SELECT vr.id FROM versoes_receita vr
  JOIN receitas r ON vr.receita_id = r.id
  JOIN produtos p ON r.produto_id = p.id
  WHERE p.slug = 'multigraos' AND vr.numero_versao = 1
)
INSERT INTO ingredientes_receita (versao_receita_id, ingrediente_id, percentual_baker, ordem, notas)
SELECT v.id, i.id, perc, ord, nota
FROM v, (VALUES
  ('farinha-superiore',   0.70,    1, NULL),
  ('farinha-fv-integral', 0.20,    2, NULL),
  ('farinha-slow',        0.10,    3, NULL),
  ('agua-mineral',        1.12,    4, 'Autólise 58% + escaldar 54% = 112% total'),
  ('sal-marinho',         0.032,   5, 'Massa 2% + escaldar 1.2% = 3.2% total'),
  ('gergelim-branco',     0.0768,  6, NULL),
  ('gergelim-preto',      0.0768,  7, NULL),
  ('quinoa-mista',        0.0768,  8, NULL),
  ('linhaca-dourada',     0.0768,  9, NULL),
  ('semente-girassol',    0.0768, 10, NULL),
  ('semente-abobora',     0.0768, 11, NULL),
  ('aveia-fina',          0.06,   12, 'Crosta — polvilhar antes do banneton')
) AS dados(slug, perc, ord, nota)
JOIN ingredientes i ON i.slug = dados.slug;

-- Focaccia v1
-- Nota: azeite é deduplicado (massa 3% + cobertura 5% = 8% total).
WITH v AS (
  SELECT vr.id FROM versoes_receita vr
  JOIN receitas r ON vr.receita_id = r.id
  JOIN produtos p ON r.produto_id = p.id
  WHERE p.slug = 'focaccia' AND vr.numero_versao = 1
)
INSERT INTO ingredientes_receita (versao_receita_id, ingrediente_id, percentual_baker, ordem, notas)
SELECT v.id, i.id, perc, ord, nota
FROM v, (VALUES
  ('farinha-superiore',   1.00,   1, NULL),
  ('agua-mineral',        0.75,   2, 'H2O1 75% / H2O2 25%'),
  ('azeite-luglio',       0.08,   3, 'Massa 3% + cobertura 5%'),
  ('sal-marinho',         0.024,  4, 'Massa'),
  ('cebola-roxa',         0.15,   5, 'Cobertura'),
  ('alecrim-fresco',      0.02,   6, 'Cobertura'),
  ('sal-grosso',          0.01,   7, 'Cobertura')
) AS dados(slug, perc, ord, nota)
JOIN ingredientes i ON i.slug = dados.slug;

-- Brioche v1
WITH v AS (
  SELECT vr.id FROM versoes_receita vr
  JOIN receitas r ON vr.receita_id = r.id
  JOIN produtos p ON r.produto_id = p.id
  WHERE p.slug = 'brioche' AND vr.numero_versao = 1
)
INSERT INTO ingredientes_receita (versao_receita_id, ingrediente_id, percentual_baker, ordem, notas)
SELECT v.id, i.id, perc, ord, nota
FROM v, (VALUES
  ('farinha-superiore',   0.75,    1, NULL),
  ('semola-rimacinata',   0.25,    2, NULL),
  ('fermento-seco',       0.015,   3, 'Fermentação mista'),
  ('manteiga-sem-sal',    0.30,    4, NULL),
  ('ovos',                0.40,    5, NULL),
  ('acucar',              0.10,    6, NULL),
  ('mel',                 0.05,    7, NULL),
  ('leite-integral',      0.23,    8, NULL),
  ('sal-marinho',         0.02,    9, NULL)
) AS dados(slug, perc, ord, nota)
JOIN ingredientes i ON i.slug = dados.slug;

-- Ciabatta v1
WITH v AS (
  SELECT vr.id FROM versoes_receita vr
  JOIN receitas r ON vr.receita_id = r.id
  JOIN produtos p ON r.produto_id = p.id
  WHERE p.slug = 'ciabatta' AND vr.numero_versao = 1
)
INSERT INTO ingredientes_receita (versao_receita_id, ingrediente_id, percentual_baker, ordem, notas)
SELECT v.id, i.id, perc, ord, nota
FROM v, (VALUES
  ('farinha-superiore',   0.90,   1, NULL),
  ('farinha-fv-integral', 0.10,   2, NULL),
  ('agua-mineral',        0.76,   3, 'H2O1 = 84% / H2O2 = 16%'),
  ('azeite-luglio',       0.016,  4, NULL),
  ('sal-marinho',         0.022,  5, NULL)
) AS dados(slug, perc, ord, nota)
JOIN ingredientes i ON i.slug = dados.slug;

-- ============ ETAPAS_RECEITA ============

-- Etapas padrão para todas as receitas (7 etapas conforme decisão Backoffice).
-- Variações específicas (Brioche sem autólise formal, Ciabatta sem corte)
-- ficam no campo `notas`.

DO $$
DECLARE
  v RECORD;
BEGIN
  FOR v IN
    SELECT vr.id, p.slug
    FROM versoes_receita vr
    JOIN receitas r ON vr.receita_id = r.id
    JOIN produtos p ON r.produto_id = p.id
    WHERE vr.numero_versao = 1
  LOOP
    INSERT INTO etapas_receita (versao_receita_id, ordem, nome, duracao_min, notas) VALUES
      (v.id, 1, 'Autólise',         40,  CASE v.slug WHEN 'ciabatta' THEN 'Sem autólise formal — mistura direta' WHEN 'brioche' THEN 'Sem autólise — massa enriquecida' ELSE NULL END),
      (v.id, 2, 'Batimento',         8,  'Massa desejada 26°C. T° água 12-13°C.'),
      (v.id, 3, 'Falsa dobra',       0,  '8 min após batimento'),
      (v.id, 4, 'Dobras',          120,  CASE v.slug WHEN 'integral' THEN '3 dobras de 30 em 30 min' WHEN 'brioche' THEN '3 dobras (massa enriquecida)' ELSE '4 dobras de 30 em 30 min' END),
      (v.id, 5, 'Descanso e divisão', 120, 'Bulk 2h + divisão'),
      (v.id, 6, 'Shape',             10,  CASE v.slug WHEN 'ciabatta' THEN 'Divisão retangular, NÃO modelar' WHEN 'focaccia' THEN 'Esticar na assadeira 60×40' ELSE NULL END),
      (v.id, 7, '2ª fermentação',  720,  CASE v.slug WHEN 'ciabatta' THEN 'Couche, overnight geladeira' WHEN 'focaccia' THEN 'Assadeira untada com azeite' ELSE 'Banneton com farinha de arroz, overnight geladeira' END);
  END LOOP;
END $$;

-- ============ ATIVAR VERSÕES (rascunho → ativa) ============

DO $$
DECLARE
  v_id UUID;
BEGIN
  FOR v_id IN
    SELECT vr.id FROM versoes_receita vr WHERE vr.numero_versao = 1
  LOOP
    PERFORM ativar_versao_receita(v_id);
  END LOOP;
END $$;

COMMIT;

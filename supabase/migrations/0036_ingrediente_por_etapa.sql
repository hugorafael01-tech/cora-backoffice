-- 0036_ingrediente_por_etapa.sql
-- Um ingrediente pode entrar em MAIS DE UMA ETAPA da mesma receita
-- (briefing de produção 22/08/2026).
--
-- O modelo tinha UNIQUE (versao_receita_id, ingrediente_id), o que forcava um
-- ingrediente a existir uma vez so por versao. Isso contradiz a panificacao da
-- casa: em toda receita de fermentacao natural a agua entra em DUAS etapas
-- (h2o1 na autolise, h2o2 no batimento), no Multigraos o sal se divide porque
-- parte vai no escaldo, e no Brioche o tangzhong reserva parte da farinha e do
-- leite.
--
-- A prova de que o limite ja tinha sido encontrado e que o contorno virou
-- TEXTO dentro da linha unica, em dois lugares:
--   pizza      -> notas da agua = 'H2O1 85% / H2O2 15%'
--   multigraos -> notas do sal  = 'Massa 2% + escaldar 1.2% = 3.2% total'
-- Alguem escreveu a mao o que o modelo deveria representar. Esta migration
-- passa isso pro schema.
--
-- A restricao antiga existia pra impedir duplicata acidental, e essa protecao
-- CONTINUA: a chave so ganha `etapa`. O que ela nao pode fazer e impedir o
-- mesmo ingrediente em etapas diferentes, que e a regra do oficio, nao a
-- excecao.
--
-- ------------------------------------------------------------------
-- REGRA DE CALCULO (a parte que nao pode ser errada)
-- ------------------------------------------------------------------
-- `percentual_baker` continua sendo matematica do padeiro: SEMPRE sobre a
-- farinha total da receita, e continua gravado em DECIMAL (0.70 = 70%,
-- convencao das 0012/0021).
--
-- Mas a divisao ENTRE etapas e proporcao do proprio ingrediente, e a razao e
-- aritmetica: h2o1 + h2o2 tem que somar exatamente a agua total. Se a divisao
-- fosse expressa sobre a farinha, a soma nao fecharia.
--   "Original 85/15" = 85% e 15% DA AGUA, que sobre a farinha viram
--   0.5950 e 0.1050 e somam os 0.70 de sempre.
--
-- Por que isso importa alem da ficha: `peso_farinha_por_pao()` (0012) divide o
-- peso da massa pela SOMA dos baker da versao. Enquanto a soma das etapas for
-- igual ao total anterior, dividir uma linha em duas NAO muda o peso de
-- farinha por pao nem o mise en place. Toda divisao aqui fecha exatamente —
-- menos a Ciabatta, que e correcao de valor pedida no briefing e esta
-- isolada no bloco 6, com o efeito declarado.
--
-- ------------------------------------------------------------------
-- VOCABULARIO DE ETAPA (decisao do Hugo, 22/08)
-- ------------------------------------------------------------------
-- Sem enum e sem tabela de dominio: as etapas mudam conforme novos processos
-- entram (mesmo criterio das zonas na 0032, que evitou enum de proposito).
-- E TEXT com DEFAULT 'batimento'.
--
-- Os valores REUSAM o vocabulario que `etapas_receita.tipo` ja usa pro
-- processo, em vez de criar um paralelo:
--   autolise_mistura, batimento, falsa_dobra, dobra, pre_shape, shape,
--   fermentacao_final
-- Por isso a etapa da autolise e `autolise_mistura`, e nao `autolise` como no
-- texto do briefing: com o nome alinhado, a ficha de producao junta
-- ingrediente e etapa de processo por igualdade direta, sem tabela de-para.
-- `escaldo` e `tangzhong` sao valores novos — nao existem em
-- `etapas_receita.tipo` porque nenhuma receita cadastrou essas etapas ainda.
--
-- O unico CHECK e de FORMA, nao de conteudo: minusculo e nao-vazio. Ele impede
-- que 'Autolise' e 'autolise' virem duas etapas distintas por baixo do UNIQUE
-- — mesma preocupacao do indice normalizado da 0032 — sem congelar a lista.
--
-- Aplicar pelo SQL Editor do Supabase (padrao 0019+: historico local
-- dessincronizado da CLI, db push nao enxerga migrations novas como pendentes).
-- Probes PRE/POS em 0036_ingrediente_por_etapa.verificacao.sql.
--
-- INDEPENDENTE da 0035 (cardapio): tabelas diferentes, pode ser aplicada antes
-- ou depois. O numero 0036 so evita colidir com a 0034/0035, que estao em voo
-- na branch do cardapio.


-- ============================================================
-- 1) coluna `etapa`
-- ============================================================
-- DEFAULT 'batimento' faz o backfill de todas as linhas existentes: quem nao
-- se divide entra na massa no batimento, que e o caso da maioria esmagadora.
ALTER TABLE ingredientes_receita
  ADD COLUMN etapa TEXT NOT NULL DEFAULT 'batimento';

ALTER TABLE ingredientes_receita
  ADD CONSTRAINT ingredientes_receita_etapa_normalizada
  CHECK (etapa = lower(btrim(etapa)) AND etapa <> '');


-- ============================================================
-- 2) trocar a chave unica
-- ============================================================
ALTER TABLE ingredientes_receita
  DROP CONSTRAINT ingredientes_receita_versao_receita_id_ingrediente_id_key;

ALTER TABLE ingredientes_receita
  ADD CONSTRAINT ingredientes_receita_versao_ingrediente_etapa_key
  UNIQUE (versao_receita_id, ingrediente_id, etapa);


-- ============================================================
-- 3) fork_versao_receita passa a carregar a etapa
-- ============================================================
-- OBRIGATORIO, nao e melhoria: a funcao copiava
-- (versao, ingrediente, percentual, ordem, notas) e deixava a etapa cair no
-- DEFAULT. Com a chave nova, as duas linhas de agua de uma receita dividida
-- virariam duas linhas 'batimento' iguais e o INSERT falharia por violacao de
-- unicidade. Sem esta troca, "criar variacao" (Producao) quebra em TODA
-- receita dividida por esta migration.
-- Corpo identico ao da 0005 fora a coluna `etapa` nos dois lados do INSERT.
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
    (versao_receita_id, ingrediente_id, percentual_baker, ordem, etapa, notas)
  SELECT v_nova_versao_id, ingrediente_id, percentual_baker, ordem, etapa, notas
  FROM ingredientes_receita WHERE versao_receita_id = p_versao_origem_id;

  INSERT INTO etapas_receita
    (versao_receita_id, ordem, nome, duracao_min, notas)
  SELECT v_nova_versao_id, ordem, nome, duracao_min, notas
  FROM etapas_receita WHERE versao_receita_id = p_versao_origem_id;

  RETURN v_nova_versao_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 4) as divisoes (fonte: Hugo, 22/08/2026)
-- ============================================================
-- SO a versao ATIVA de cada receita e tocada (r.versao_ativa_id). Rascunhos e
-- versoes arquivadas ficam como estao, todos em 'batimento' pelo DEFAULT do
-- bloco 1 — o briefing pede a alteracao na versao ativa e proibe tocar em
-- receita arquivada.
--
-- A PIZZA NAO ENTRA. Ela e a que tem a nota 'H2O1 85% / H2O2 15%' escrita a
-- mao, mas os valores dela nao foram confirmados pelo Hugo. A nota fica onde
-- esta, a agua segue em linha unica, e isso e follow-up declarado no PR.
--
--   receita     ingrediente        etapa_1            pct_1   etapa_2      pct_2   total
--   ---------------------------------------------------------------------------------
--   original    agua-mineral       autolise_mistura   0.5950  batimento    0.1050  0.7000
--   integral    agua-mineral       autolise_mistura   0.6375  batimento    0.1125  0.7500
--   focaccia    agua-mineral       autolise_mistura   0.5250  batimento    0.2250  0.7500
--   ciabatta    agua-mineral       autolise_mistura   0.6000  batimento    0.2000  0.8000 <- total corrigido, bloco 6
--   multigraos  agua-mineral       autolise_mistura   0.5800  escaldo      0.5400  1.1200
--   multigraos  sal-marinho        batimento          0.0200  escaldo      0.0120  0.0320
--   brioche     farinha-superiore  tangzhong          0.0500  batimento    0.8100  0.8600
--   brioche     leite-integral     tangzhong          0.1500  batimento    0.1000  0.2500
--
-- Multigraos: a h2o2 NAO e agua do batimento — e a agua do escaldo das
-- sementes, que dorme na geladeira e entra no lugar da agua. Por isso
-- `escaldo`, nao `batimento`. O sal segue o mesmo caminho: parte vai no
-- escaldo. Nas demais receitas o sal continua em linha unica, 'batimento'.
--
-- Brioche nao tem autolise: a divisao dele e por tangzhong, farinha e leite
-- cozidos na vespera (feito na terca, junto do mise; vale ate 3 dias). Os
-- totais nao mudam — Superiore segue 0.86, leite segue 0.25.

-- 4.1 — a linha que ja existe vira a etapa_1, com o percentual da etapa_1.
UPDATE ingredientes_receita ir
SET etapa            = v.etapa_1,
    percentual_baker = v.pct_1
FROM (VALUES
  ('original',   'agua-mineral',      'autolise_mistura', 0.5950),
  ('integral',   'agua-mineral',      'autolise_mistura', 0.6375),
  ('focaccia',   'agua-mineral',      'autolise_mistura', 0.5250),
  ('ciabatta',   'agua-mineral',      'autolise_mistura', 0.6000),
  ('multigraos', 'agua-mineral',      'autolise_mistura', 0.5800),
  ('multigraos', 'sal-marinho',       'batimento',        0.0200),
  ('brioche',    'farinha-superiore', 'tangzhong',        0.0500),
  ('brioche',    'leite-integral',    'tangzhong',        0.1500)
) AS v(produto_slug, ing_slug, etapa_1, pct_1)
JOIN produtos     p ON p.slug = v.produto_slug
JOIN receitas     r ON r.produto_id = p.id
JOIN ingredientes i ON i.slug = v.ing_slug
WHERE ir.versao_receita_id = r.versao_ativa_id
  AND ir.ingrediente_id    = i.id;

-- 4.2 — a etapa_2 entra como linha NOVA, herdando a `ordem` da linha de
-- origem. O bloco 5 desempata as duas pela ordem do processo.
-- `notas` NULL de proposito: a nota da linha original descrevia o ingrediente
-- inteiro, nao a fatia.
INSERT INTO ingredientes_receita
  (versao_receita_id, ingrediente_id, percentual_baker, ordem, etapa, notas)
SELECT ir.versao_receita_id, ir.ingrediente_id, v.pct_2, ir.ordem, v.etapa_2, NULL
FROM (VALUES
  ('original',   'agua-mineral',      'batimento', 0.1050),
  ('integral',   'agua-mineral',      'batimento', 0.1125),
  ('focaccia',   'agua-mineral',      'batimento', 0.2250),
  ('ciabatta',   'agua-mineral',      'batimento', 0.2000),
  ('multigraos', 'agua-mineral',      'escaldo',   0.5400),
  ('multigraos', 'sal-marinho',       'escaldo',   0.0120),
  ('brioche',    'farinha-superiore', 'batimento', 0.8100),
  ('brioche',    'leite-integral',    'batimento', 0.1000)
) AS v(produto_slug, ing_slug, etapa_2, pct_2)
JOIN produtos            p  ON p.slug = v.produto_slug
JOIN receitas            r  ON r.produto_id = p.id
JOIN ingredientes        i  ON i.slug = v.ing_slug
JOIN ingredientes_receita ir ON ir.versao_receita_id = r.versao_ativa_id
                            AND ir.ingrediente_id    = i.id;

-- 4.3 — a nota do sal do Multigraos era o contorno por texto do limite que
-- esta migration remove. Mantida, ela mentiria: passa a descrever 3.2% em cima
-- de uma linha que agora vale 2.0%. O dado que ela carregava virou schema.
UPDATE ingredientes_receita ir
SET notas = NULL
FROM produtos p
JOIN receitas r ON r.produto_id = p.id
JOIN ingredientes i ON i.slug = 'sal-marinho'
WHERE p.slug = 'multigraos'
  AND ir.versao_receita_id = r.versao_ativa_id
  AND ir.ingrediente_id    = i.id;


-- ============================================================
-- 5) renumerar `ordem` das versoes tocadas
-- ============================================================
-- `ordem` nao tem UNIQUE, entao a linha nova do bloco 4.2 ficaria EMPATADA com
-- a de origem, e as telas ordenam por `ordem` (usePreparacao / FichaReceita).
-- Empate = ordem indefinida entre as duas fatias do mesmo ingrediente, que na
-- ficha impressa e exatamente o tipo de ambiguidade que nao pode existir.
--
-- Criterio: posicao original do INGREDIENTE primeiro (preserva a ordem de
-- leitura de hoje), etapa como desempate, na ordem do PROCESSO — o que se
-- prepara antes vem antes:
--   tangzhong -> escaldo -> autolise_mistura -> batimento -> finalizacao
-- Continua 0-based e contiguo, como as linhas de hoje. Nenhuma versao fora das
-- 6 divididas e tocada (a pizza inclusive).
WITH ordenado AS (
  SELECT ir.id,
         row_number() OVER (
           PARTITION BY ir.versao_receita_id
           ORDER BY ir.ordem,
                    CASE ir.etapa
                      WHEN 'tangzhong'        THEN 1
                      WHEN 'escaldo'          THEN 2
                      WHEN 'autolise_mistura' THEN 3
                      WHEN 'batimento'        THEN 4
                      WHEN 'finalizacao'      THEN 5
                      ELSE 9
                    END,
                    ir.id
         ) - 1 AS nova_ordem
  FROM ingredientes_receita ir
  WHERE ir.versao_receita_id IN (
    SELECT r.versao_ativa_id FROM receitas r
    JOIN produtos p ON p.id = r.produto_id
    WHERE p.slug IN ('original', 'integral', 'focaccia', 'ciabatta', 'multigraos', 'brioche')
  )
)
UPDATE ingredientes_receita ir
SET ordem = o.nova_ordem
FROM ordenado o
WHERE o.id = ir.id
  AND ir.ordem IS DISTINCT FROM o.nova_ordem;


-- ============================================================
-- 6) Ciabatta: o total de agua estava errado (76% -> 80%)
-- ============================================================
-- UNICO lugar em que a soma das etapas NAO bate o total anterior, e de
-- proposito: o briefing diz que o valor certo e 80% e manda corrigir o total
-- junto da divisao. 0.6000 + 0.2000 = 0.8000 contra os 0.7600 de antes.
--
-- EFEITO DECLARADO, porque nao e neutro: a soma dos baker da Ciabatta vai de
-- 2.0480 pra 2.0880, entao `peso_farinha_por_pao()` cai de 317.4 g pra 311.3 g
-- por peca (-1.9%) e o mise en place da Ciabatta muda junto. Isso e a correcao
-- da receita, nao efeito colateral — mas quem conferir o mise da semana vai
-- ver o numero mudar.
--
-- `hidratacao_alvo` vive em `versoes_receita`, que o briefing lista como fora
-- de escopo. Entra assim mesmo por decisao do Hugo (22/08): nas 7 receitas o
-- campo espelha a linha de agua, e deixar 76 aqui faria a ficha exibir 76%
-- ao lado de ingredientes somando 80%. E a mesma correcao, nao uma nova.
UPDATE versoes_receita vr
SET hidratacao_alvo = 80.00
FROM receitas r
JOIN produtos p ON p.id = r.produto_id
WHERE vr.id = r.versao_ativa_id
  AND p.slug = 'ciabatta';

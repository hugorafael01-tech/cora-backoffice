-- 0034_cardapio_publico.sql
-- Cardapio da semana sai do banco (task 86e2fqk33, Escopo A).
--
-- Hoje o cardapio tem duas fontes de verdade: a tabela `cardapios`, que o
-- backoffice alimenta, e `src/config/menu.js` no portal, um mapa fixo por data
-- de entrega. Elas divergem, e desde o PR #79 do portal a divergencia quebra
-- funcionalidade em vez de so enfeiar a tela: o servidor valida o preco do
-- extra contra `cardapios`, entao item anunciado pelo mapa e ausente do banco
-- aparece na vitrine e devolve 400 no "Adicionar a cesta".
--
-- Caso vivo: a semana 36 (entrega 03/09) tem so Original e Integral em
-- `cardapios` e o mapa anuncia ciabatta. Terca 25/08 ao meio-dia o cutoff vira
-- a semana e a ciabatta vira botao quebrado.
--
-- Esta migration entrega as duas pecas de banco que faltam pro portal ler
-- daqui: qual item e o DESTAQUE da semana, e uma superficie de LEITURA PUBLICA
-- do cardapio. O conteudo editorial (desc, sobre, ingredientes, img) continua
-- no catalogo em codigo, indexado por slug — decisao explicita do Escopo A.
--
-- NAO toca em `produtos`, nem em preco cadastrado, nem no cutoff.
--
-- Aplicar pelo SQL Editor do Supabase (padrao 0019+).
-- Probes PRE/POS em 0034_cardapio_publico.verificacao.sql.


-- ============================================================
-- 1) destaque da semana
-- ============================================================
-- O modelo da Cora e 2 paes fixos + rotativos, e um dos rotativos e a estreia
-- que vira o "Novidade Hero" da Home e do Cardapio. Ate agora quem sabia disso
-- era o `especial` do mapa em codigo; passa a ser uma coluna.
ALTER TABLE cardapios ADD COLUMN destaque BOOLEAN NOT NULL DEFAULT false;

-- No maximo UM destaque por semana — e ZERO e permitido.
--
-- Indice unico PARCIAL (`WHERE destaque`) e nao UNIQUE (semana_id, destaque):
-- o UNIQUE comum tambem impediria duas linhas com destaque = false na mesma
-- semana, que e o caso normal.
--
-- Por que zero e permitido: pelo posicionamento da Cora praticamente toda
-- semana tem uma novidade em destaque, mas o Hugo quer poder ter uma semana sem
-- estreia — so o catalogo, sem hero. O banco nao obriga; quem avisa e a tela do
-- backoffice, na hora de congelar (confirmacao explicita, nao bloqueio).
-- Semana em rascunho tambem passa por aqui: ainda nao tem destaque escolhido.
CREATE UNIQUE INDEX ux_cardapios_destaque_por_semana
  ON cardapios (semana_id) WHERE destaque;


-- ============================================================
-- 2) backfill do destaque, conforme o menu.js vigente
-- ============================================================
-- Fonte: `MENU_POR_SEMANA` em cora-portal/src/config/menu.js no commit do PR
-- #78 — o mapa que esta em producao hoje. Depois deste PR aquele arquivo morre,
-- entao este bloco e a unica travessia entre as duas fontes.
--
-- So da pra marcar item que EXISTE em `cardapios`. Duas semanas do mapa ficam
-- de fora por isso, e as duas sao exatamente a divergencia que a task veio
-- resolver — o banco ganha, o mapa perde:
--
--   2026-08-13 (sem 33) — o mapa anuncia focaccia; `cardapios` tem so Original
--                         e Integral. Entrega ja passada, fica sem destaque.
--   2026-09-03 (sem 36) — o mapa anuncia ciabatta; `cardapios` tem so Original
--                         e Integral. E a semana com prazo: a partir de terca
--                         25/08 ao meio-dia o portal passa a mostrar os dois
--                         fixos e nenhum hero, em vez de um botao que da 400.
--                         Se o Hugo quiser a ciabatta ali, e cadastro na tela
--                         de Cardapio — nao e codigo, que era o ponto.
--
-- Semanas anteriores a 06/08 nao tem entrada no mapa (caiam no MENU_FALLBACK,
-- sem especial), entao continuam sem destaque mesmo quando tem rotativo
-- cadastrado. Sao entregas passadas; o portal so le a semana corrente.
--
-- O indice do bloco 1 ja esta de pe: se este UPDATE tentasse marcar dois na
-- mesma semana, falharia aqui em vez de passar batido.
UPDATE cardapios c
SET destaque = true
FROM semanas s, produtos p
WHERE c.semana_id = s.id
  AND c.produto_id = p.id
  AND (s.data_entrega, p.slug) IN (
    (DATE '2026-08-06', 'focaccia'),    -- sem 32, congelada
    (DATE '2026-08-20', 'multigraos'),  -- sem 34, aberta
    (DATE '2026-08-27', 'brioche')      -- sem 35, congelada — a semana em voo
  );


-- ============================================================
-- 3) leitura publica do cardapio
-- ============================================================
-- O portal precisa de tres coisas por data de entrega: quais itens, com que
-- preco, e qual e o destaque. Hoje nada disso e legivel fora do backoffice:
-- `cardapios` e `semanas` so tem politica de admin autenticado.
--
-- Abrir as duas tabelas pro anon foi descartado, por dois motivos:
--
--   (a) `semanas` tem `sobra_levain_g`, dado de producao que nao tem por que
--       ser publico, e RLS e row-level — nao esconde coluna. Pior: qualquer
--       coluna futura de `semanas` entraria publica de graca.
--   (b) `produtos` — de onde vem o slug — tem politica de leitura SO pra
--       `anon` ("produtos public read ativos", migration 0004). Assinante
--       LOGADO no portal e `authenticated`, e a unica policy de `authenticated`
--       em produtos exige `is_admin()`. Ou seja: uma leitura por tabelas
--       funcionaria deslogado e devolveria vazio pra quem paga. A view resolve
--       isso de uma vez, porque a checagem acontece no dono dela.
--
-- Entao: UMA view com a projecao exata, e as tabelas continuam fechadas.
--
-- security_invoker = false e DELIBERADO e escrito na mao — e o mecanismo que
-- faz a view enxergar as tabelas por baixo da RLS. Escrito explicito porque o
-- Supabase Advisor sinaliza view sem `security_invoker=true` como achado de
-- seguranca, e aqui o achado e a intencao: o cardapio da semana E a vitrine,
-- o dado nasce pra ser publico. O que segura a exposicao e a projecao (5
-- colunas escolhidas) somada ao REVOKE/GRANT logo abaixo.
CREATE VIEW cardapio_publico
WITH (security_invoker = false) AS
SELECT
  s.data_entrega,
  p.slug,
  c.tipo,
  c.preco_avulso,
  c.destaque
FROM cardapios c
-- `semanas.data_entrega` NAO tem UNIQUE (conferido em 21/08/2026, ver
-- api/_lib/extras-precos.js no portal). Os dados estao limpos, mas se um dia
-- duplicar, um JOIN direto misturaria os itens de duas semanas na mesma data.
-- O DISTINCT ON escolhe a mais recente por `created_at` — o MESMO criterio que
-- o servidor ja usa pra validar preco, entao vitrine e cobranca nao divergem
-- nem no caso torto.
JOIN (
  SELECT DISTINCT ON (data_entrega) id, data_entrega
  FROM semanas
  ORDER BY data_entrega, created_at DESC
) s ON s.id = c.semana_id
JOIN produtos p ON p.id = c.produto_id
-- Produto desativado sai da vitrine mesmo em semana ja congelada. Divergencia
-- consciente com `extras-precos.js`, que le `cardapios` cru e nao filtra: aqui
-- ela cai pro lado seguro (a vitrine esconde, o servidor no maximo aceitaria
-- algo que ninguem consegue pedir). Desativar produto e como o Hugo tira algo
-- que nao vai ser assado, e "errar pra menos e o unico erro aceitavel aqui" —
-- o oposto e vender o que nao sai do forno.
WHERE p.ativo;

COMMENT ON VIEW cardapio_publico IS
  'Vitrine do cardapio por data de entrega, lida pelo portal (anon e authenticated). '
  'Projecao publica de cardapios + semanas + produtos; as tabelas seguem fechadas. '
  'Conteudo editorial (desc/sobre/ingredientes/img) NAO mora aqui — fica no catalogo em codigo, casado por slug.';

-- Licao da 0019/0020/0027: o Supabase concede GRANT default amplo pra
-- anon/authenticated em TODA relacao nova de `public`, view inclusive. Sem este
-- REVOKE a view nasceria com INSERT/UPDATE/DELETE concedidos.
REVOKE ALL ON cardapio_publico FROM anon, authenticated;
GRANT SELECT ON cardapio_publico TO anon, authenticated;
-- `authenticated` junto com `anon` de proposito: o Cardapio do portal e a
-- mesma tela antes e depois do login (ver motivo (b) acima).

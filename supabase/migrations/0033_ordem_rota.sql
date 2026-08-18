-- 0033_ordem_rota.sql
-- Ordem de rota dentro da zona (briefing de logistica 17/08/2026, pos primeiro
-- uso da 0032).
--
-- A 0032 ordenava os bairros DENTRO da zona alfabeticamente, o que inverte a
-- rota real: em N3 o motoboy sai de Icarai e TERMINA em Boa Viagem, que e o
-- ponto mais proximo da ponte — alfabeticamente Boa Viagem vinha primeiro e ele
-- atravessava Icarai duas vezes. Duas colunas novas resolvem, em dois niveis:
--
--   bairro_zona_default.ordem  -> ordem dos BAIRROS dentro da zona
--   subscriptions.ordem_rota   -> ordem do ASSINANTE, desempate de borda de
--   pedidos_pontuais.ordem_rota   bairro (mora entre dois bairros)
--
-- Por que `ordem_rota` vive no CADASTRO e nao so na tela: a tela ja deixa
-- ajustar a sequencia a mao e nao desfaz o ajuste, mas o ajuste morre quando as
-- entregas do ciclo seguinte sao geradas. O campo e o que faz o ajuste
-- sobreviver a semana. Os dois convivem: o campo define o padrao, a tela cobre
-- a excecao do dia.
--
-- Chave de ordenacao final (src/lib/zonas.ts, comparaCanonico):
--   onda -> zonas_entrega.ordem -> bairro_zona_default.ordem -> ordem_rota
--        -> bairro -> logradouro -> numero -> nome
-- `ordem_rota` NULL ordena por ULTIMO dentro do grupo: quem nao tem ordem
-- definida nao muda de lugar em relacao a hoje.
--
-- NAO altera `zonas_entrega`, nem as zonas, nem a que zona cada bairro pertence.
-- Em `entregas` entra SO a coluna de snapshot, pelo mesmo criterio da 0026/0032.
--
-- Aplicar pelo SQL Editor do Supabase (padrao 0019+).
-- Probes PRE/POS em 0033_ordem_rota.verificacao.sql.


-- ============================================================
-- 1) ordem dos bairros dentro da zona
-- ============================================================
-- NOT NULL com default 1 e depois os valores reais: a tabela ja tem 15 linhas
-- em producao e um ALTER NOT NULL sem default falharia nelas.
ALTER TABLE bairro_zona_default ADD COLUMN ordem INTEGER NOT NULL DEFAULT 1;

-- Ordem de rota (fonte: Hugo, 17/08/2026).
--   Niteroi: N1 -> N2 -> N3, terminando em Boa Viagem (mais proximo da ponte);
--            a travessia acontece depois.
--   Rio:     R1 -> R2 -> R3, Urca primeiro em R3 aproveitando a volta de
--            Botafogo em direcao ao tunel.
UPDATE bairro_zona_default SET ordem = v.ordem
FROM (VALUES
  ('Niterói',        'Fonseca',       1),
  ('Niterói',        'Vital Brazil',  2),
  ('Niterói',        'Charitas',      1),
  ('Niterói',        'São Francisco', 2),
  ('Niterói',        'Icaraí',        1),
  ('Niterói',        'Boa Viagem',    2),
  ('Rio de Janeiro', 'Cosme Velho',   1),
  ('Rio de Janeiro', 'Lagoa',         2),
  ('Rio de Janeiro', 'Humaitá',       3),
  ('Rio de Janeiro', 'Botafogo',      1),
  ('Rio de Janeiro', 'Flamengo',      2),
  ('Rio de Janeiro', 'Glória',        3),
  ('Rio de Janeiro', 'Urca',          1),
  ('Rio de Janeiro', 'Copacabana',    2),
  -- Gavea e 4, nao 3: o 3 fica RESERVADO pra Lagoa lado Jardim Botanico, que
  -- nao tem linha propria aqui (a Lagoa ja esta cadastrada como R1 e o
  -- UNIQUE (cidade, bairro) da 0032 mantem a SUGESTAO nao-ambigua). Quem cai
  -- naquele trecho e posicionado por `ordem_rota` — ver bloco 4.
  ('Rio de Janeiro', 'Gávea',         4)
) AS v(cidade, bairro, ordem)
WHERE normaliza_texto(bairro_zona_default.cidade) = normaliza_texto(v.cidade)
  AND normaliza_texto(bairro_zona_default.bairro) = normaliza_texto(v.bairro);

-- Sem default a partir daqui: bairro novo tem que declarar onde entra na rota,
-- em vez de silenciosamente virar o primeiro da zona.
ALTER TABLE bairro_zona_default ALTER COLUMN ordem DROP DEFAULT;

-- Duas linhas com a mesma ordem na mesma zona = empate decidido pelo criterio
-- estavel, o que e o mesmo que nao ter ordem. Melhor falhar no cadastro.
ALTER TABLE bairro_zona_default
  ADD CONSTRAINT bairro_zona_default_zona_ordem_key UNIQUE (zona, ordem);


-- ============================================================
-- 2) ordem do assinante (borda de bairro)
-- ============================================================
ALTER TABLE subscriptions ADD COLUMN ordem_rota INTEGER
  CONSTRAINT subscriptions_ordem_rota_positiva CHECK (ordem_rota IS NULL OR ordem_rota > 0);

ALTER TABLE pedidos_pontuais ADD COLUMN ordem_rota INTEGER
  CONSTRAINT pedidos_pontuais_ordem_rota_positiva CHECK (ordem_rota IS NULL OR ordem_rota > 0);


-- ============================================================
-- 3) snapshot em entregas
-- ============================================================
-- Ref logica sem FK, igual a `zona` da 0032: a entrega congela o que valia na
-- geracao. Nada mais em `entregas` e tocado.
ALTER TABLE entregas ADD COLUMN ordem_rota INTEGER
  CONSTRAINT entregas_ordem_rota_positiva CHECK (ordem_rota IS NULL OR ordem_rota > 0);


-- ============================================================
-- 4) BACKFILL DE ordem_rota — NAO RODAR SEM CONFIRMAR COM O HUGO
-- ============================================================
-- Os dois casos do briefing, com os numeros que REALMENTE produzem o resultado
-- pedido. Confira antes de descomentar: a regra "NULL ordena por ultimo" faz o
-- caso (a) precisar de mais linhas do que parece.
--
-- (a) MARIA TEREZA — ultima parada de Icarai, imediatamente antes de Boa Viagem.
--     Como NULL ordena por ULTIMO dentro do grupo, dar ordem so pra ela a
--     colocaria em PRIMEIRO (qualquer numero < NULL). Pra ela ficar por ultimo,
--     os outros quatro de Icarai precisam de ordem explicita.
--     Ordem de hoje em Icarai (por logradouro), com Maria Tereza jogada pro fim:
--
-- UPDATE subscriptions SET ordem_rota = 1 WHERE nome = 'Isabel Considera';      -- Rua Belisario Augusto, 79
-- UPDATE subscriptions SET ordem_rota = 2 WHERE nome = 'Dani Considera';        -- Rua Mariz e Barros, 121
-- UPDATE subscriptions SET ordem_rota = 3 WHERE nome = 'Maria Helena Paixão';   -- Rua Otávio Carneiro, 129
-- UPDATE subscriptions SET ordem_rota = 4 WHERE nome = 'Marcelo';               -- Rua Professor Miguel Couto, 389
-- UPDATE subscriptions SET ordem_rota = 5 WHERE nome = 'Maria Tereza';          -- Av. Jornalista Alberto Francisco Torres, 59 (borda com Boa Viagem)
--
-- (b) SUZANA — Lagoa lado Jardim Botanico, zona R3.
--     NAO PRECISA de backfill: ela JA cai no lugar certo. O bairro Lagoa tem
--     ordem 2 (da linha de R1), e dentro de R3 isso a poe empatada com
--     Copacabana (2) e antes de Gavea (4); o empate e desfeito pelo nome do
--     bairro ("Copacabana" < "Lagoa"). Resultado: Copacabana -> Suzana -> Gavea,
--     que e exatamente o pedido.
--     ATENCAO: `ordem_rota` entra na chave DEPOIS da ordem do bairro, entao um
--     `ordem_rota = 3` nela NAO a moveria entre Copacabana e Gavea — moveria ela
--     pra ANTES de Copacabana (3 < NULL). Se a posicao dela tiver que ser
--     independente da ordem da Lagoa em R1, isso e mudanca na chave de
--     ordenacao, nao um UPDATE. Perguntar antes.


-- ============================================================
-- 5) backfill do snapshot das entregas ja geradas
-- ============================================================
-- Only-if-null, igual a 0032. No-op enquanto o bloco 4 estiver comentado.
UPDATE entregas e
SET ordem_rota = s.ordem_rota
FROM subscriptions s
WHERE e.subscription_id = s.id
  AND e.ordem_rota IS NULL
  AND s.ordem_rota IS NOT NULL;

UPDATE entregas e
SET ordem_rota = p.ordem_rota
FROM pedidos_pontuais p
WHERE e.pedido_pontual_id = p.id
  AND e.ordem_rota IS NULL
  AND p.ordem_rota IS NOT NULL;


-- ============================================================
-- 6) DEPOIS DE APLICAR
-- ============================================================
-- A sequencia ja atribuida NAO e recalculada sozinha (de proposito: o sistema
-- nao desfaz ajuste manual). Pra a nova ordem valer no ciclo em voo, usar
-- "Recalcular sequência" em cada onda na tela de Expedicao — e acao explicita,
-- com confirmacao.

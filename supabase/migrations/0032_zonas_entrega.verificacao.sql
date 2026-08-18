-- ============================================================
-- Verificacao da Migration 0032 (zonas_entrega) — rodar no SQL Editor
-- ============================================================
-- IMPORTANTE: o SQL Editor so mostra o output do ULTIMO SELECT quando se cola
-- varias queries. Rode UMA query por vez (cada bloco numerado) pra ver tudo.
-- Aplicar a migration: colar o conteudo de 0032_zonas_entrega.sql no SQL Editor
-- e rodar (NAO usar supabase db push — historico local dessincronizado).
--
-- ANTES DE APLICAR: preencher o bloco 8 da migration (overrides manuais de
-- zona H e da Lagoa lado Jardim Botanico). Ver POS.7/POS.8 aqui embaixo.
-- ============================================================


-- ============================================================
-- PRE (rodar ANTES de aplicar)
-- ============================================================

-- PRE.1 — as tabelas novas ainda NAO devem existir (esperado: 0 linhas)
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('zonas_entrega', 'bairro_zona_default');

-- PRE.2 — as colunas novas ainda NAO devem existir (esperado: 0 linhas)
SELECT table_name, column_name FROM information_schema.columns
WHERE table_schema = 'public'
  AND (   (table_name = 'subscriptions'     AND column_name = 'zona')
       OR (table_name = 'pedidos_pontuais'  AND column_name = 'zona')
       OR (table_name = 'entregas'          AND column_name IN ('zona', 'sequencia'))
       OR (table_name = 'app_settings'      AND column_name = 'capacidade_bag'));

-- PRE.3 — funcoes reutilizadas existem, normaliza_texto ainda nao (esperado:
--   is_admin e set_updated_at presentes, normaliza_texto ausente)
SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('is_admin', 'set_updated_at', 'normaliza_texto')
ORDER BY 1;

-- PRE.4 — baseline do backfill: quantos assinantes ativos por bairro
--   (esperado hoje: 30 ativos; Fonseca 2, Vital Brazil 1, Sao Francisco 1,
--    Charitas 1, Icarai 5, Boa Viagem 1, Cosme Velho 1, Lagoa 3, Humaita 1,
--    Botafogo 5, Flamengo 4, Gloria 1, Copacabana 1, Gavea 3)
SELECT cidade, bairro, count(*) AS ativos
FROM subscriptions WHERE status = 'active'
GROUP BY cidade, bairro ORDER BY cidade, bairro;

-- PRE.5 — CHECKs atuais de `entregas` (esperado: so
--   entregas_origem_exatamente_um + os CHECKs de origem/regiao/status da 0026).
--   Serve pra provar no POS que a 0032 NAO tocou em nenhum deles.
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint WHERE conrelid = 'entregas'::regclass AND contype = 'c'
ORDER BY conname;


-- ============================================================
-- POS (rodar DEPOIS de aplicar)
-- ============================================================

-- POS.1 — normaliza_texto criada e IMMUTABLE (esperado: 1 linha, provolatile='i')
SELECT p.proname, p.provolatile, normaliza_texto('Icaraí') AS ex1, normaliza_texto('NITERÓI ') AS ex2
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'normaliza_texto';
--   esperado: provolatile = 'i', ex1 = 'icarai', ex2 = 'niteroi'

-- POS.2 — 7 zonas seedadas, ordem e onda corretas (esperado: 7 linhas —
--   H(niteroi,0,entra=false), N1..N3(niteroi,1..3), R1..R3(rio,1..3))
SELECT codigo, nome, onda, ordem, cor_hex, forma, entra_na_onda, ativo
FROM zonas_entrega ORDER BY onda, ordem;

-- POS.3 — 15 defaults de bairro, sem Lagoa duplicada (esperado: 15 linhas,
--   Lagoa aparece UMA vez, como R1)
SELECT cidade, bairro, zona FROM bairro_zona_default ORDER BY zona, cidade, bairro;

-- POS.4 — indice normalizado de fato barra grafia alternativa (esperado: ERRO
--   'duplicate key value violates unique constraint
--    ux_bairro_zona_default_normalizado'). Rodar e conferir que FALHA; a
--   transacao do SQL Editor faz rollback sozinha.
INSERT INTO bairro_zona_default (cidade, bairro, zona) VALUES ('Niteroi', 'Icarai', 'N3');

-- POS.5 — colunas novas criadas com o tipo certo (esperado: 5 linhas, todas
--   nullable YES: subscriptions.zona, pedidos_pontuais.zona, entregas.zona,
--   entregas.sequencia, app_settings.capacidade_bag)
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (   (table_name = 'subscriptions'    AND column_name = 'zona')
       OR (table_name = 'pedidos_pontuais' AND column_name = 'zona')
       OR (table_name = 'entregas'         AND column_name IN ('zona', 'sequencia'))
       OR (table_name = 'app_settings'     AND column_name = 'capacidade_bag'))
ORDER BY table_name, column_name;

-- POS.6 — `entregas` NAO regrediu: CHECKs da 0026/0030 intactos e so o
--   entregas_sequencia_positiva a mais; nenhuma FK nova em entregas (zona e
--   snapshot, ref logica sem FK — mesmo criterio da 0026)
SELECT conname, contype, pg_get_constraintdef(oid) AS def
FROM pg_constraint WHERE conrelid = 'entregas'::regclass AND contype IN ('c', 'f', 'u')
ORDER BY contype, conname;
--   esperado: entregas_origem_exatamente_um inalterado (subscription_id +
--   pedido_pontual_id = 1), os 3 UNIQUEs da 0026/0030, FK so pra semanas e
--   subscriptions, e o CHECK novo entregas_sequencia_positiva.

-- POS.7 — BACKFILL: distribuicao dos 30 ativos por zona.
--   SEM os overrides do bloco 8: N1=3, N2=2, N3=6, R1=5, R2=10, R3=4.
--   COM  os overrides do bloco 8: H=1, N1=2, N2=2, N3=6, R1=4, R2=10, R3=5
--   (= exatamente a tabela "paradas hoje" do briefing).
SELECT coalesce(zona, '(sem zona)') AS zona, count(*) AS ativos
FROM subscriptions WHERE status = 'active' GROUP BY 1 ORDER BY 1;

-- POS.8 — quem ficou SEM zona (esperado: so o pedido pontual "David" /
--   Ipanema, do ciclo 27 (02/07, ja passado) — Ipanema nao esta em nenhuma zona
--   do briefing. Nenhuma subscription deve aparecer aqui.)
SELECT 'subscription' AS tipo, status::text, nome, cidade, bairro
FROM subscriptions WHERE zona IS NULL
UNION ALL
SELECT 'pedido_pontual', status::text, coalesce(destinatario_nome, pagador_nome),
       endereco_cidade, endereco_bairro
FROM pedidos_pontuais WHERE zona IS NULL;

-- POS.9 — snapshot das entregas ja geradas foi backfillado (esperado: as 30
--   entregas do ciclo 34 / entrega 2026-08-20 com zona preenchida e sequencia
--   ainda NULL — a sequencia vem do botao da tela, nao do SQL)
SELECT s.numero, s.data_entrega,
       count(*) AS entregas,
       count(e.zona) AS com_zona,
       count(e.sequencia) AS com_sequencia
FROM entregas e JOIN semanas s ON s.id = e.semana_id
GROUP BY s.numero, s.data_entrega ORDER BY s.data_entrega;

-- POS.10 — a FK de zona protege contra codigo inexistente (esperado: ERRO
--   'violates foreign key constraint'). Rodar e conferir que FALHA.
UPDATE subscriptions SET zona = 'ZZ' WHERE id = (SELECT id FROM subscriptions LIMIT 1);

-- POS.11 — renomear codigo de zona propaga pro cadastro (ON UPDATE CASCADE).
--   Roda o rename e desfaz na sequencia; conferir que a contagem bate nos dois
--   passos (esperado: mesma quantidade de linhas em 'N3' antes e depois).
--   Rodar as 3 queries em sequencia, uma por vez.
-- SELECT count(*) FROM subscriptions WHERE zona = 'N3';
-- UPDATE zonas_entrega SET codigo = 'N3X' WHERE codigo = 'N3';
-- SELECT count(*) FROM subscriptions WHERE zona = 'N3X';  -- deve bater
-- UPDATE zonas_entrega SET codigo = 'N3' WHERE codigo = 'N3X';  -- desfaz

-- POS.12 — capacidade da bag comeca NULL (esperado: NULL). Configurar depois:
--   UPDATE app_settings SET capacidade_bag = <n> WHERE id = 1;
SELECT id, max_subscriptions, capacidade_bag FROM app_settings;

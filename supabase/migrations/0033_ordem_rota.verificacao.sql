-- ============================================================
-- Verificacao da Migration 0033 (ordem_rota) — rodar no SQL Editor
-- ============================================================
-- Uma query por vez: o SQL Editor so mostra o output do ULTIMO SELECT.
-- O bloco 4 da migration (backfill de ordem_rota) fica COMENTADO ate o Hugo
-- confirmar — POS.5 mede o efeito de cada decisao.
-- ============================================================


-- ============================================================
-- PRE (rodar ANTES de aplicar)
-- ============================================================

-- PRE.1 — colunas novas ainda NAO existem (esperado: 0 linhas)
SELECT table_name, column_name FROM information_schema.columns
WHERE table_schema = 'public'
  AND (   (table_name = 'bairro_zona_default' AND column_name = 'ordem')
       OR (table_name IN ('subscriptions', 'pedidos_pontuais', 'entregas') AND column_name = 'ordem_rota'));

-- PRE.2 — a 0032 esta aplicada e o backfill bateu a tabela do briefing
--   (esperado: H=1, N1=2, N2=2, N3=6, R1=4, R2=10, R3=5)
SELECT zona, count(*) AS ativos FROM subscriptions WHERE status = 'active' GROUP BY zona ORDER BY zona;

-- PRE.3 — 15 defaults de bairro, um por bairro (esperado: 15)
SELECT count(*) FROM bairro_zona_default;

-- PRE.4 — ordem ATUAL de Icarai (alfabetica por logradouro). Serve de "antes"
--   pro POS.5: hoje Maria Tereza e a PRIMEIRA de Icarai (Avenida...), e o
--   briefing quer ela por ULTIMO.
SELECT nome, rua, numero FROM subscriptions
WHERE status = 'active' AND zona = 'N3' AND normaliza_texto(bairro) = 'icarai'
ORDER BY rua, numero;


-- ============================================================
-- POS (rodar DEPOIS de aplicar)
-- ============================================================

-- POS.1 — colunas criadas com o tipo certo (esperado: 4 linhas;
--   bairro_zona_default.ordem integer NOT NULL sem default, as 3 ordem_rota
--   integer nullable)
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (   (table_name = 'bairro_zona_default' AND column_name = 'ordem')
       OR (table_name IN ('subscriptions', 'pedidos_pontuais', 'entregas') AND column_name = 'ordem_rota'))
ORDER BY table_name, column_name;

-- POS.2 — a ordem de rota gravada bate com a tabela do briefing.
--   Esperado, nesta ordem exata:
--     niteroi N1 1 Fonseca / N1 2 Vital Brazil / N2 1 Charitas /
--             N2 2 São Francisco / N3 1 Icaraí / N3 2 Boa Viagem
--     rio     R1 1 Cosme Velho / R1 2 Lagoa / R1 3 Humaitá /
--             R2 1 Botafogo / R2 2 Flamengo / R2 3 Glória /
--             R3 1 Urca / R3 2 Copacabana / R3 4 Gávea   <- 3 reservado, ver migration
SELECT z.onda, d.zona, d.ordem, d.bairro
FROM bairro_zona_default d JOIN zonas_entrega z ON z.codigo = d.zona
ORDER BY z.onda, z.ordem, d.ordem;

-- POS.3 — nenhuma linha ficou com a ordem default 1 por engano (esperado: so
--   as 6 linhas que sao ordem 1 de verdade — Fonseca, Charitas, Icaraí,
--   Cosme Velho, Botafogo, Urca)
SELECT zona, bairro FROM bairro_zona_default WHERE ordem = 1 ORDER BY zona;

-- POS.4 — UNIQUE (zona, ordem) de pe (esperado: ERRO
--   'duplicate key value violates unique constraint
--    bairro_zona_default_zona_ordem_key'). Rodar e conferir que FALHA.
UPDATE bairro_zona_default SET ordem = 1 WHERE normaliza_texto(bairro) = 'boa viagem';

-- POS.5 — ORDEM RESULTANTE da onda Niteroi, com a mesma chave que o
--   sequenciador usa (zona -> bairro -> ordem_rota NULLS LAST -> bairro ->
--   logradouro -> numero -> nome).
--   SEM o bloco 4: Icarai sai por logradouro e Maria Tereza fica em PRIMEIRO.
--   COM o bloco 4: Maria Tereza vira a ULTIMA de Icarai, logo antes de Anouk
--                  (Boa Viagem). Boa Viagem sempre por ultimo na onda.
SELECT s.zona, d.ordem AS ordem_bairro, s.ordem_rota, s.bairro, s.nome, s.rua, s.numero
FROM subscriptions s
JOIN zonas_entrega z ON z.codigo = s.zona
LEFT JOIN bairro_zona_default d
  ON normaliza_texto(d.cidade) = normaliza_texto(s.cidade)
 AND normaliza_texto(d.bairro) = normaliza_texto(s.bairro)
WHERE s.status = 'active' AND z.onda = 'niteroi' AND z.entra_na_onda
ORDER BY z.ordem, d.ordem NULLS LAST, s.ordem_rota NULLS LAST, s.bairro, s.rua, s.numero, s.nome;

-- POS.6 — mesma coisa na onda Rio. Esperado em R3:
--   Copacabana (Chiara) -> Lagoa (Suzana) -> Gávea (3), mesmo SEM backfill:
--   Lagoa tem ordem 2 (da linha de R1), empata com Copacabana (2) e o empate cai
--   no nome do bairro. Ver a nota (b) do bloco 4 da migration.
SELECT s.zona, d.ordem AS ordem_bairro, s.ordem_rota, s.bairro, s.nome, s.rua, s.numero
FROM subscriptions s
JOIN zonas_entrega z ON z.codigo = s.zona
LEFT JOIN bairro_zona_default d
  ON normaliza_texto(d.cidade) = normaliza_texto(s.cidade)
 AND normaliza_texto(d.bairro) = normaliza_texto(s.bairro)
WHERE s.status = 'active' AND z.onda = 'rio' AND z.entra_na_onda
ORDER BY z.ordem, d.ordem NULLS LAST, s.ordem_rota NULLS LAST, s.bairro, s.rua, s.numero, s.nome;

-- POS.7 — CHECK de positividade de pe (esperado: ERRO
--   'violates check constraint "subscriptions_ordem_rota_positiva"')
UPDATE subscriptions SET ordem_rota = 0 WHERE id = (SELECT id FROM subscriptions LIMIT 1);

-- POS.8 — `entregas` nao regrediu: os CHECKs/UNIQUEs da 0026/0030/0032 intactos
--   e so o entregas_ordem_rota_positiva a mais
SELECT conname, contype, pg_get_constraintdef(oid) AS def
FROM pg_constraint WHERE conrelid = 'entregas'::regclass AND contype IN ('c', 'u', 'f')
ORDER BY contype, conname;

-- POS.9 — snapshot: enquanto o bloco 4 estiver comentado, nenhuma entrega tem
--   ordem_rota (esperado: 0). Depois do backfill + "Recalcular sequência",
--   volta aqui pra conferir que as entregas do ciclo em voo receberam o valor.
SELECT count(*) AS entregas_com_ordem_rota FROM entregas WHERE ordem_rota IS NOT NULL;

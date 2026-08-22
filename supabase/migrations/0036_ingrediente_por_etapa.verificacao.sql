-- ============================================================
-- Verificacao da Migration 0036 (ingrediente por etapa) — rodar no SQL Editor
-- ============================================================
-- IMPORTANTE: o SQL Editor so mostra o output do ULTIMO SELECT quando se cola
-- varias queries. Rode UMA query por vez (cada bloco numerado) pra ver tudo.
-- Aplicar a migration: colar o conteudo de 0036_ingrediente_por_etapa.sql no
-- SQL Editor e rodar (NAO usar supabase db push — historico local
-- dessincronizado, padrao 0019+).
--
-- Lembrete de leitura: `percentual_baker` e DECIMAL (0.70 = 70%), convencao
-- das 0012/0021. Os numeros abaixo estao todos nessa escala.
--
-- A migration foi ensaiada CONTRA PRODUCAO dentro de uma transacao abortada
-- (BEGIN / ... / RAISE) em 22/08 — os valores esperados do POS.3 e POS.4 sao o
-- resultado observado nesse ensaio, nao previsao.
-- ============================================================


-- ============================================================
-- PRE (rodar ANTES de aplicar)
-- ============================================================

-- PRE.1 — a coluna `etapa` ainda NAO existe (esperado: 0 linhas)
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'ingredientes_receita'
  AND column_name = 'etapa';

-- PRE.2 — a chave unica ANTIGA esta de pe (esperado: 1 linha,
--   ingredientes_receita_versao_receita_id_ingrediente_id_key
--   = UNIQUE (versao_receita_id, ingrediente_id))
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'ingredientes_receita'::regclass AND contype = 'u';

-- PRE.3 — BASELINE que a migration tem que preservar. Guardar este resultado:
--   e contra ele que o POS.4 e conferido.
--   esperado: brioche 2.2400 / 160.71g | ciabatta 2.0480 / 317.38g
--             focaccia 2.3340 / 134.96g | integral 2.0910 / 392.16g
--             multigraos 3.0728 / 244.08g | original 1.9200 / 427.08g
--             pizza 1.8880 / 149.89g
SELECT p.slug,
       ROUND(SUM(ir.percentual_baker), 4)                       AS soma_baker,
       ROUND(vr.peso_massa_g / SUM(ir.percentual_baker), 2)     AS farinha_por_pao_g,
       vr.hidratacao_alvo
FROM ingredientes_receita ir
JOIN versoes_receita vr ON vr.id = ir.versao_receita_id
JOIN receitas r ON r.versao_ativa_id = vr.id
JOIN produtos p ON p.id = r.produto_id
GROUP BY p.slug, vr.peso_massa_g, vr.hidratacao_alvo
ORDER BY p.slug;

-- PRE.4 — os totais dos ingredientes que VAO se dividir (esperado: 1 linha
--   cada, e a coluna `total` e o numero que o POS.3 tem que reproduzir)
--   agua:  original 0.7000 | integral 0.7500 | focaccia 0.7500
--          ciabatta 0.7600 (<- vira 0.8000, unica correcao de valor)
--          multigraos 1.1200
--   sal:   multigraos 0.0320
--   brioche: farinha-superiore 0.8600 | leite-integral 0.2500
SELECT p.slug AS receita, i.slug AS ingrediente,
       count(*) AS linhas, SUM(ir.percentual_baker) AS total, max(ir.notas) AS notas
FROM ingredientes_receita ir
JOIN ingredientes i ON i.id = ir.ingrediente_id
JOIN receitas r ON r.versao_ativa_id = ir.versao_receita_id
JOIN produtos p ON p.id = r.produto_id
WHERE (p.slug || '/' || i.slug) IN (
  'original/agua-mineral', 'integral/agua-mineral', 'focaccia/agua-mineral',
  'ciabatta/agua-mineral', 'multigraos/agua-mineral', 'multigraos/sal-marinho',
  'brioche/farinha-superiore', 'brioche/leite-integral', 'pizza/agua-mineral')
GROUP BY p.slug, i.slug ORDER BY p.slug, i.slug;


-- ============================================================
-- POS (rodar DEPOIS de aplicar)
-- ============================================================

-- POS.1 — coluna criada com o tipo/default certos (esperado: 1 linha,
--   text, NOT NULL, default 'batimento'::text)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'ingredientes_receita'
  AND column_name = 'etapa';

-- POS.2 — a chave unica NOVA substituiu a antiga (esperado: 1 UNIQUE,
--   ingredientes_receita_versao_ingrediente_etapa_key
--   = UNIQUE (versao_receita_id, ingrediente_id, etapa); a antiga sumiu)
--   + o CHECK de forma ingredientes_receita_etapa_normalizada
SELECT conname, contype, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'ingredientes_receita'::regclass AND contype IN ('u', 'c')
ORDER BY contype, conname;

-- POS.3 — *** A CONFERENCIA OBRIGATORIA DO BRIEFING ***
--   Pra cada ingrediente dividido, a soma das etapas TEM que ser igual ao
--   total anterior (PRE.4). Se alguma linha nao fechar, a migration esta
--   errada e nao deve ser entregue.
--   esperado (n = 2 linhas em todos, menos a pizza que fica em 1):
--     brioche    farinha-superiore  0.8600  [tangzhong 0.0500 + batimento 0.8100]
--     brioche    leite-integral     0.2500  [tangzhong 0.1500 + batimento 0.1000]
--     ciabatta   agua-mineral       0.8000  [autolise_mistura 0.6000 + batimento 0.2000]  <- 0.7600 antes, correcao
--     focaccia   agua-mineral       0.7500  [autolise_mistura 0.5250 + batimento 0.2250]
--     integral   agua-mineral       0.7500  [autolise_mistura 0.6375 + batimento 0.1125]
--     multigraos agua-mineral       1.1200  [escaldo 0.5400 + autolise_mistura 0.5800]
--     multigraos sal-marinho        0.0320  [escaldo 0.0120 + batimento 0.0200]
--     original   agua-mineral       0.7000  [autolise_mistura 0.5950 + batimento 0.1050]
--     pizza      agua-mineral       0.6650  [batimento 0.6650]  <- NAO dividida de proposito
SELECT p.slug AS receita, i.slug AS ingrediente,
       count(*) AS etapas,
       SUM(ir.percentual_baker) AS soma,
       string_agg(ir.etapa || '=' || ir.percentual_baker, ' + ' ORDER BY ir.ordem) AS detalhe
FROM ingredientes_receita ir
JOIN ingredientes i ON i.id = ir.ingrediente_id
JOIN receitas r ON r.versao_ativa_id = ir.versao_receita_id
JOIN produtos p ON p.id = r.produto_id
WHERE (p.slug || '/' || i.slug) IN (
  'original/agua-mineral', 'integral/agua-mineral', 'focaccia/agua-mineral',
  'ciabatta/agua-mineral', 'multigraos/agua-mineral', 'multigraos/sal-marinho',
  'brioche/farinha-superiore', 'brioche/leite-integral', 'pizza/agua-mineral')
GROUP BY p.slug, i.slug ORDER BY p.slug, i.slug;

-- POS.4 — o efeito no PESO DE FARINHA: comparar com o PRE.3.
--   SO a ciabatta pode mudar (2.0480 -> 2.0880, 317.38g -> 311.30g, -1.9%,
--   e hidratacao_alvo 76.00 -> 80.00). Qualquer outra linha diferente do
--   PRE.3 significa que alguma divisao nao fechou.
SELECT p.slug,
       ROUND(SUM(ir.percentual_baker), 4)                   AS soma_baker,
       ROUND(vr.peso_massa_g / SUM(ir.percentual_baker), 2) AS farinha_por_pao_g,
       vr.hidratacao_alvo
FROM ingredientes_receita ir
JOIN versoes_receita vr ON vr.id = ir.versao_receita_id
JOIN receitas r ON r.versao_ativa_id = vr.id
JOIN produtos p ON p.id = r.produto_id
GROUP BY p.slug, vr.peso_massa_g, vr.hidratacao_alvo
ORDER BY p.slug;

-- POS.5 — `ordem` continua 0-based, contigua e sem empate nas versoes ativas
--   (esperado: 0 linhas — nenhuma versao com buraco, repeticao ou inicio != 0)
SELECT versao_receita_id, count(*) AS linhas, min(ordem) AS menor,
       max(ordem) AS maior, count(DISTINCT ordem) AS ordens_distintas
FROM ingredientes_receita
WHERE versao_receita_id IN (SELECT versao_ativa_id FROM receitas WHERE versao_ativa_id IS NOT NULL)
GROUP BY versao_receita_id
HAVING min(ordem) <> 0 OR max(ordem) <> count(*) - 1 OR count(DISTINCT ordem) <> count(*);

-- POS.6 — a leitura da ficha do Multigraos e do Brioche, na ordem que a tela
--   usa. Esperado (o que se prepara antes vem antes, dentro do ingrediente):
--     multigraos: ... 4 agua/escaldo, 5 agua/autolise_mistura,
--                     6 sal/escaldo, 7 sal/batimento, 8+ sementes
--     brioche:    0 levain, 1 superiore/tangzhong, 2 superiore/batimento,
--                 3 semola, 4 leite/tangzhong, 5 leite/batimento, 6+ resto
SELECT p.slug, ir.ordem, i.slug AS ingrediente, ir.etapa, ir.percentual_baker, ir.notas
FROM ingredientes_receita ir
JOIN ingredientes i ON i.id = ir.ingrediente_id
JOIN receitas r ON r.versao_ativa_id = ir.versao_receita_id
JOIN produtos p ON p.id = r.produto_id
WHERE p.slug IN ('multigraos', 'brioche')
ORDER BY p.slug, ir.ordem;

-- POS.7 — a nota-contorno do sal do Multigraos saiu (esperado: 0 linhas).
--   Ela dizia 'Massa 2% + escaldar 1.2% = 3.2% total' e passaria a mentir em
--   cima de uma linha que agora vale 2.0%. O dado virou schema.
SELECT p.slug, i.slug, ir.etapa, ir.percentual_baker, ir.notas
FROM ingredientes_receita ir
JOIN ingredientes i ON i.id = ir.ingrediente_id
JOIN receitas r ON r.versao_ativa_id = ir.versao_receita_id
JOIN produtos p ON p.id = r.produto_id
WHERE p.slug = 'multigraos' AND i.slug = 'sal-marinho' AND ir.notas IS NOT NULL;

-- POS.8 — a PIZZA nao foi tocada (esperado: 1 linha, etapa 'batimento',
--   0.6650, notas 'H2O1 85% / H2O2 15%' intacta). Os valores dela nao foram
--   confirmados pelo Hugo — dividir a pizza e follow-up, nao esta migration.
SELECT ir.etapa, ir.percentual_baker, ir.ordem, ir.notas
FROM ingredientes_receita ir
JOIN ingredientes i ON i.id = ir.ingrediente_id
JOIN receitas r ON r.versao_ativa_id = ir.versao_receita_id
JOIN produtos p ON p.id = r.produto_id
WHERE p.slug = 'pizza' AND i.slug = 'agua-mineral';

-- POS.9 — rascunhos e arquivadas cairam todas em 'batimento' pelo DEFAULT
--   (esperado: 0 linhas — nenhuma versao NAO-ativa com etapa diferente)
SELECT ir.versao_receita_id, ir.etapa, count(*)
FROM ingredientes_receita ir
WHERE ir.versao_receita_id NOT IN (SELECT versao_ativa_id FROM receitas WHERE versao_ativa_id IS NOT NULL)
  AND ir.etapa <> 'batimento'
GROUP BY ir.versao_receita_id, ir.etapa;

-- POS.10 — a chave nova ainda impede duplicata de verdade: mesma etapa duas
--   vezes tem que FALHAR (esperado: ERRO 'duplicate key value violates unique
--   constraint "ingredientes_receita_versao_ingrediente_etapa_key"').
--   Rodar e conferir que FALHA; a transacao do SQL Editor faz rollback sozinha.
INSERT INTO ingredientes_receita (versao_receita_id, ingrediente_id, percentual_baker, ordem, etapa)
SELECT r.versao_ativa_id, i.id, 0.1, 99, 'batimento'
FROM receitas r JOIN produtos p ON p.id = r.produto_id
CROSS JOIN ingredientes i
WHERE p.slug = 'original' AND i.slug = 'agua-mineral';

-- POS.11 — a MESMA linha em etapa DIFERENTE passa (e a regra do oficio que a
--   migration veio liberar). Esperado: INSERT OK. Desfazer com o DELETE.
--   Rodar as duas em sequencia, uma por vez.
-- INSERT INTO ingredientes_receita (versao_receita_id, ingrediente_id, percentual_baker, ordem, etapa)
-- SELECT r.versao_ativa_id, i.id, 0.01, 99, 'finalizacao'
-- FROM receitas r JOIN produtos p ON p.id = r.produto_id
-- CROSS JOIN ingredientes i
-- WHERE p.slug = 'original' AND i.slug = 'agua-mineral';
-- DELETE FROM ingredientes_receita WHERE etapa = 'finalizacao' AND ordem = 99;

-- POS.12 — o CHECK de forma barra etapa com maiuscula/espaco, que por baixo do
--   UNIQUE viraria uma etapa distinta (esperado: ERRO 'violates check
--   constraint "ingredientes_receita_etapa_normalizada"'). Rodar e conferir
--   que FALHA. Note que ele NAO limita o vocabulario — etapa nova entra livre.
UPDATE ingredientes_receita SET etapa = 'Autolise_Mistura'
WHERE id = (SELECT id FROM ingredientes_receita LIMIT 1);

-- POS.13 — fork_versao_receita carrega a etapa. Sem a troca do bloco 3 esta
--   chamada FALHA por violacao de unicidade em toda receita dividida.
--   Esperado: 15 linhas, 3 etapas distintas (autolise_mistura/batimento/
--   escaldo), soma 3.0728 — identica a do Multigraos de origem.
--   Rodar as 3 em sequencia, uma por vez, e apagar a versao de teste no fim.
-- SELECT fork_versao_receita(
--   (SELECT r.versao_ativa_id FROM receitas r JOIN produtos p ON p.id = r.produto_id
--    WHERE p.slug = 'multigraos'), 'rascunho');
-- SELECT count(*) AS linhas, count(DISTINCT etapa) AS etapas,
--        SUM(percentual_baker) AS soma
--   FROM ingredientes_receita WHERE versao_receita_id = '<id devolvido acima>';
-- DELETE FROM versoes_receita WHERE id = '<id devolvido acima>';

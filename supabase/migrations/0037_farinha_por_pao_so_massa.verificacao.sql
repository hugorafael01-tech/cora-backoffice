-- ============================================================
-- Verificacao da Migration 0037 (farinha por pao so pela massa)
-- ============================================================
-- Uma query por vez: o SQL Editor so mostra o output do ULTIMO SELECT.
-- Aplicar colando 0037_farinha_por_pao_so_massa.sql no SQL Editor (padrao 0019+).
--
-- Os valores esperados vieram de um ENSAIO contra producao em transacao
-- abortada (23/08), nao de previsao.
-- ============================================================


-- ============================================================
-- PRE (rodar ANTES de aplicar)
-- ============================================================

-- PRE.1 — as 4 linhas de crosta ainda estao em `batimento` (esperado: 4 linhas
--   — gergelim-branco, gergelim-preto e farelo-trigo no Integral, aveia-fina no
--   Multigraos; todas com `notas` dizendo crosta)
SELECT p.slug, i.slug AS ingrediente, ir.etapa, ir.percentual_baker, ir.notas
FROM ingredientes_receita ir
JOIN ingredientes i ON i.id = ir.ingrediente_id
JOIN receitas r ON r.versao_ativa_id = ir.versao_receita_id
JOIN produtos p ON p.id = r.produto_id
WHERE ir.etapa = 'batimento'
  AND (ir.notas ILIKE '%crosta%' OR ir.notas ILIKE '%polvilhar%')
ORDER BY p.slug, ir.ordem;

-- PRE.2 — BASELINE da farinha por pao. Guardar: e contra ele que o POS.3 e
--   conferido. Esperado: brioche 160.71 | ciabatta 311.30 | focaccia 129.58 |
--   integral 392.16 | multigraos 244.08 | original 427.08 | pizza 149.89
SELECT p.slug, ROUND(peso_farinha_por_pao(vr.id), 2) AS farinha_por_pao_g
FROM versoes_receita vr
JOIN receitas r ON r.versao_ativa_id = vr.id
JOIN produtos p ON p.id = r.produto_id
ORDER BY p.slug;

-- PRE.3 — BASELINE do previsto em voo (esperado hoje: ciclo 35 com focaccia
--   levain 0.350 e integral 1.412; mais 11 linhas velhas dos ciclos 26 e 29)
SELECT s.numero AS ciclo, p.slug, pr.status, pr.qty_paes_prevista,
       pr.massa_prevista_kg, pr.levain_previsto_kg
FROM producoes pr
JOIN semanas s ON s.id = pr.semana_id
JOIN versoes_receita vr ON vr.id = pr.versao_receita_id
JOIN receitas r ON r.id = vr.receita_id
JOIN produtos p ON p.id = r.produto_id
WHERE pr.status IN ('planejada', 'em_curso')
ORDER BY s.numero, p.slug;


-- ============================================================
-- POS (rodar DEPOIS de aplicar)
-- ============================================================

-- POS.1 — as 4 linhas viraram `finalizacao` e NENHUM percentual mudou
--   (esperado: 4 linhas, etapa finalizacao, percentuais identicos ao PRE.1 —
--   0.0135, 0.0135, 0.0300 no Integral e 0.0600 no Multigraos)
SELECT p.slug, i.slug AS ingrediente, ir.etapa, ir.percentual_baker, ir.ordem
FROM ingredientes_receita ir
JOIN ingredientes i ON i.id = ir.ingrediente_id
JOIN receitas r ON r.versao_ativa_id = ir.versao_receita_id
JOIN produtos p ON p.id = r.produto_id
WHERE (p.slug || '/' || i.slug) IN (
  'integral/gergelim-branco', 'integral/gergelim-preto',
  'integral/farelo-trigo', 'multigraos/aveia-fina')
ORDER BY p.slug, ir.ordem;

-- POS.2 — nao sobrou linha de crosta marcada como massa (esperado: 0 linhas)
SELECT p.slug, i.slug, ir.etapa, ir.notas
FROM ingredientes_receita ir
JOIN ingredientes i ON i.id = ir.ingrediente_id
JOIN receitas r ON r.versao_ativa_id = ir.versao_receita_id
JOIN produtos p ON p.id = r.produto_id
WHERE ir.etapa IN ('autolise_mistura', 'batimento', 'escaldo', 'tangzhong')
  AND (ir.notas ILIKE '%crosta%' OR ir.notas ILIKE '%cobertura%' OR ir.notas ILIKE '%polvilhar%');

-- POS.3 — *** O EFEITO PRINCIPAL *** comparar com o PRE.2.
--   esperado: focaccia 129.58 -> 149.71 (+15,5%)
--             integral  392.16 -> 403.15 (+2,8%)
--             multigraos 244.08 -> 248.94 (+2,0%)
--             brioche / ciabatta / original / pizza INALTERADOS
--   A focaccia em 149.71 e a conferencia externa: bate com a planilha do Hugo
--   (2.756 g de massa / 1.310 g de farinha = 2,104 de denominador).
SELECT p.slug, ROUND(peso_farinha_por_pao(vr.id), 2) AS farinha_por_pao_g,
       ROUND(SUM(ir.percentual_baker) FILTER (
         WHERE ir.etapa IN ('autolise_mistura','batimento','escaldo','tangzhong')), 4) AS denominador,
       ROUND(SUM(ir.percentual_baker), 4) AS soma_de_tudo
FROM versoes_receita vr
JOIN receitas r ON r.versao_ativa_id = vr.id
JOIN produtos p ON p.id = r.produto_id
JOIN ingredientes_receita ir ON ir.versao_receita_id = vr.id
GROUP BY p.slug, vr.id ORDER BY p.slug;

-- POS.4 — o previsto em voo foi recalculado (comparar com PRE.3).
--   esperado no ciclo 35: focaccia levain 0.350 -> 0.404, integral 1.412 ->
--   1.451; brioche e original iguais. `massa_prevista_kg` igual em TODAS.
SELECT s.numero AS ciclo, p.slug, pr.status, pr.qty_paes_prevista,
       pr.massa_prevista_kg, pr.levain_previsto_kg
FROM producoes pr
JOIN semanas s ON s.id = pr.semana_id
JOIN versoes_receita vr ON vr.id = pr.versao_receita_id
JOIN receitas r ON r.id = vr.receita_id
JOIN produtos p ON p.id = r.produto_id
WHERE pr.status IN ('planejada', 'em_curso')
ORDER BY s.numero, p.slug;

-- POS.5 — historico NAO foi reescrito (esperado: as 19 linhas concluidas com os
--   mesmos valores de sempre — ciclo 33 focaccia 0.648, integral 0.941,
--   original 1.367)
SELECT s.numero AS ciclo, p.slug, pr.levain_previsto_kg
FROM producoes pr
JOIN semanas s ON s.id = pr.semana_id
JOIN versoes_receita vr ON vr.id = pr.versao_receita_id
JOIN receitas r ON r.id = vr.receita_id
JOIN produtos p ON p.id = r.produto_id
WHERE pr.status = 'concluida' ORDER BY s.numero, p.slug;

-- POS.6 — o mise en place acompanha sozinho (nao houve mudanca em
--   mise_en_place_semana): a farinha subiu, entao TODA a quantidade da Focaccia
--   sobe junto, cobertura inclusive — o baker de cada linha e relativo a
--   farinha. Conferir que a Focaccia do ciclo em voo subiu ~15,5%.
SELECT ingrediente_nome, produto_nome, ROUND(qty_g, 1) AS qty_g
FROM mise_en_place_semana(
  (SELECT id FROM semanas WHERE data_entrega = '2026-08-27'))
WHERE produto_nome ILIKE '%focaccia%' ORDER BY ingrediente_nome;

-- POS.7 — a lista de etapas de massa do SQL e a do TS nao podem divergir.
--   Conferir a olho contra ETAPAS_DE_MASSA em src/lib/producao.ts.
SELECT prosrc LIKE '%autolise_mistura%' AND prosrc LIKE '%batimento%'
   AND prosrc LIKE '%escaldo%' AND prosrc LIKE '%tangzhong%' AS lista_completa
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'peso_farinha_por_pao';

-- POS.8 — etapa desconhecida NAO infla o denominador. Cria uma linha numa
--   etapa inventada e confere que a farinha por pao nao muda.
--   Rodar as 3 em sequencia, uma por vez.
-- SELECT ROUND(peso_farinha_por_pao((SELECT versao_ativa_id FROM receitas r
--   JOIN produtos p ON p.id=r.produto_id WHERE p.slug='original')), 2);  -- 427.08
-- INSERT INTO ingredientes_receita (versao_receita_id, ingrediente_id, percentual_baker, ordem, etapa)
-- SELECT r.versao_ativa_id, i.id, 0.5, 98, 'etapa_inventada'
-- FROM receitas r JOIN produtos p ON p.id=r.produto_id CROSS JOIN ingredientes i
-- WHERE p.slug='original' AND i.slug='agua-mineral';
-- SELECT ROUND(peso_farinha_por_pao((SELECT versao_ativa_id FROM receitas r
--   JOIN produtos p ON p.id=r.produto_id WHERE p.slug='original')), 2);  -- 427.08 de novo
-- DELETE FROM ingredientes_receita WHERE etapa = 'etapa_inventada';

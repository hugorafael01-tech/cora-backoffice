-- 0037_farinha_por_pao_so_massa.sql
-- `peso_farinha_por_pao()` passa a dividir o peso da massa SO pelas etapas que
-- viram massa. Fecha o ciclo aberto pela 0036 (auditoria de 23/08/2026).
--
-- ------------------------------------------------------------------
-- O DEFEITO
-- ------------------------------------------------------------------
-- A funcao da 0012 divide `peso_massa_g` pela soma de TODOS os baker da versao:
--     peso_farinha = peso_massa / SUM(percentual_baker)
-- Mas `peso_massa_g` e o peso da MASSA, e a soma inclui o que nunca entra nela
-- — cobertura, crosta e preparo de superficie. Dividir peso de massa por uma
-- soma que inclui cobertura SUBESTIMA a farinha, e como o mise en place e o
-- levain previsto derivam desse numero, os dois saem curtos junto.
--
-- A prova de que `peso_massa_g` e peso de massa (e nao da peca pronta) esta no
-- proprio banco: em todo pao `peso_alvo_g` < `peso_massa_g`, porque a coccao
-- tira agua (Original 820 -> 710, Ciabatta 650 -> 550). A Focaccia e a UNICA
-- que inverte, 315 -> 385, e inverte justamente porque a cobertura entra depois
-- de a massa ser pesada.
--
-- Confirmado pela planilha do Hugo (23/08): a Focaccia sempre foi calculada com
-- o denominador filtrado — 2.756 g de massa / 1.310 g de farinha = 2,104, que e
-- exatamente o Sigma das etapas de massa aqui. A PRODUCAO NUNCA ESTEVE ERRADA;
-- o defeito e so do calculo do banco, que nunca bateu com a planilha.
--
-- ------------------------------------------------------------------
-- POR QUE SO AGORA
-- ------------------------------------------------------------------
-- O defeito e MUITO anterior a 0036 — a cobertura sempre esteve na soma, e o
-- azeite da Focaccia carregava 'Massa 3% + cobertura 5%' numa linha so, sem
-- como separar. O que faltava era justamente a coluna `etapa`: sem ela nao
-- havia criterio no schema pra dizer o que e massa. A 0036 criou o criterio, a
-- remodelagem da Focaccia usou, e so agora da pra filtrar.
--
-- Aplicar pelo SQL Editor do Supabase (padrao 0019+).
-- Probes PRE/POS em 0037_farinha_por_pao_so_massa.verificacao.sql.


-- ============================================================
-- 1) crosta deixa de ser `batimento`
-- ============================================================
-- Quatro linhas sao aplicadas no SHAPE, depois da divisao da massa, entao nunca
-- entraram no peso da massa — mas cairam em `batimento` porque a 0036 poe todo
-- ingrediente nao-dividido no DEFAULT. As `notas` de cada uma ja diziam
-- "crosta"; o dado estava no texto e agora vira etapa (decisao do Hugo, 23/08).
--
-- Vao pra `finalizacao`, a mesma etapa da flor de sal da Focaccia: o que e
-- aplicado por fora da massa, seja no shape ou na saida do forno.
--
-- NAO mexe em percentual nenhum. As quatro ja sao as ultimas da `ordem` de
-- cada receita (Integral 7-9, Multigraos 14), entao nao ha o que renumerar.
--
-- FORA DE ESCOPO, declarado: a ficha do Integral tem gergelim branco e farelo,
-- mas a producao de hoje usa so gergelim preto. Esta migration NAO resolve isso
-- — so reclassifica a etapa. A limpeza da ficha e conversa separada (Hugo,
-- 23/08); mexer nos percentuais aqui misturaria as duas coisas.
UPDATE ingredientes_receita ir
SET etapa = 'finalizacao'
FROM (VALUES
  ('integral',   'gergelim-branco'),
  ('integral',   'gergelim-preto'),
  ('integral',   'farelo-trigo'),
  ('multigraos', 'aveia-fina')
) AS v(produto_slug, ing_slug)
JOIN produtos     p ON p.slug = v.produto_slug
JOIN receitas     r ON r.produto_id = p.id
JOIN ingredientes i ON i.slug = v.ing_slug
WHERE ir.versao_receita_id = r.versao_ativa_id
  AND ir.ingrediente_id    = i.id
  AND ir.etapa = 'batimento';


-- ============================================================
-- 2) peso_farinha_por_pao filtra pelas etapas de massa
-- ============================================================
-- A lista espelha `ETAPAS_DE_MASSA` em src/lib/producao.ts, que carrega o
-- CRITERIO por extenso. Resumo dele: a etapa entra se o que ela prepara termina
-- DENTRO da massa que vai ao forno. Escaldo e tangzhong entram (dormem na
-- geladeira, mas voltam pra massa); maceracao, infusao, salamoia e finalizacao
-- nao entram (ficam por fora).
--
-- Se mudar aqui, mudar la — e vice-versa. Sao os dois unicos lugares.
--
-- Etapa NOVA fica de fora ate ser declarada nos dois lados. E o default seguro:
-- uma etapa desconhecida nao infla o denominador e nao encolhe a farinha.
CREATE OR REPLACE FUNCTION peso_farinha_por_pao(p_versao_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_peso_massa NUMERIC;
  v_soma_baker NUMERIC;
BEGIN
  SELECT peso_massa_g INTO v_peso_massa
  FROM versoes_receita WHERE id = p_versao_id;

  SELECT COALESCE(SUM(percentual_baker), 0) INTO v_soma_baker
  FROM ingredientes_receita
  WHERE versao_receita_id = p_versao_id
    AND etapa IN ('autolise_mistura', 'batimento', 'escaldo', 'tangzhong');

  IF v_soma_baker = 0 OR v_peso_massa IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN v_peso_massa / v_soma_baker;
END;
$$ LANGUAGE plpgsql;

-- `mise_en_place_semana()` NAO muda: ela ja multiplica
-- peso_farinha_por_pao() x percentual_baker de CADA linha, e o baker de
-- cobertura continua sendo relativo a farinha. Com a farinha certa, a
-- cobertura sai certa junto — sem tocar na funcao.


-- ============================================================
-- 3) recalcular o previsto dos ciclos que ainda nao fecharam
-- ============================================================
-- `producoes.levain_previsto_kg` e derivado de peso_farinha_por_pao() pelo
-- trigger da 0021, que so dispara em INSERT/UPDATE de qty_paes_prevista ou
-- versao_receita_id. Sem um toque, as linhas ja gravadas guardam o numero
-- velho — e o ciclo 35 (entrega 27/08) esta em voo, com o levain a construir.
--
-- Este UPDATE nao muda valor nenhum de entrada: reescreve qty_paes_prevista
-- com ela mesma so pra o trigger recalcular. `massa_prevista_kg` nao se mexe
-- (qty x peso_massa_g nao depende da farinha); quem muda e o levain previsto.
--
-- SO ciclo aberto. `concluida` e `cancelada` sao historico e nao se reescreve:
-- o previsto de um ciclo fechado registra o que foi planejado NAQUELE dia, com
-- a formula daquele dia — mesmo criterio de snapshot das 0026/0032. Sao 19
-- linhas concluidas hoje, nenhuma tocada.
--
-- O filtro e por STATUS, nao por data, de proposito: assim a migration faz a
-- mesma coisa hoje ou daqui a duas semanas. Se fosse `data_entrega >=
-- CURRENT_DATE`, aplicar com atraso pularia justamente o ciclo que precisava
-- ser corrigido.
--
-- EFEITO MEDIDO (ensaio de 23/08, 15 linhas): o que importa e o ciclo 35
-- (entrega 27/08, em voo) — focaccia levain 0,350 -> 0,404 kg e integral
-- 1,412 -> 1,451 kg. Brioche e Original do 35 nao mudam.
-- Junto vem 11 linhas velhas dos ciclos 26 e 29 que ficaram `planejada` e nunca
-- foram concluidas: sao planos abandonados, o recalculo nelas nao muda nada na
-- operacao, mas o `updated_at` delas vai mexer. Declarado pra nao surpreender.
--
-- `massa_prevista_kg` nao muda em NENHUMA linha (qty x peso_massa_g nao depende
-- da farinha); quem muda e so o levain previsto.
UPDATE producoes
SET qty_paes_prevista = qty_paes_prevista
WHERE status IN ('planejada', 'em_curso')
  AND qty_paes_prevista IS NOT NULL;

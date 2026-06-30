-- ============================================================
-- Migration 0028 - Receita Original v1: blend com Farinha Slow
-- ============================================================
-- Mudanca de DADOS (nao de schema). Atualiza o blend de farinha
-- da receita Original (versao 1) para incluir Farinha Slow.
--
-- Antes:  85% Superiore + 15% FV Integral (sem Slow)
-- Depois: 80% Superiore + 7% FV Integral + 13% Slow
--
-- Agua (70%), sal (2%), hidratacao, peso e perda NAO mudam.
-- Integral e Focaccia NAO sao tocados.
-- Fonte: ficha do Alex / bancada Hugo, jun/2026.
-- Re-executavel; nenhuma producao rodou em cima desta receita ainda.
-- ============================================================

DO $$
DECLARE
  v_versao_id UUID;
BEGIN
  SELECT vr.id INTO v_versao_id
  FROM versoes_receita vr
  JOIN receitas r ON vr.receita_id = r.id
  JOIN produtos p ON r.produto_id = p.id
  WHERE p.slug = 'original' AND vr.numero_versao = 1;

  IF v_versao_id IS NULL THEN
    RAISE EXCEPTION 'Versao 1 da receita Original nao encontrada';
  END IF;

  DELETE FROM ingredientes_receita WHERE versao_receita_id = v_versao_id;

  INSERT INTO ingredientes_receita
    (versao_receita_id, ingrediente_id, percentual_baker, ordem, notas)
  SELECT v_versao_id, i.id, d.perc, d.ord, d.nota
  FROM (VALUES
    ('farinha-superiore',   0.80, 1, NULL),
    ('farinha-fv-integral', 0.07, 2, NULL),
    ('farinha-slow',        0.13, 3, 'Blend com Slow - ajuste jun/2026'),
    ('agua-mineral',        0.70, 4, 'Total. H2O1 (autolise) = 85% / H2O2 (batimento) = 15%'),
    ('sal-marinho',         0.02, 5, NULL)
  ) AS d(slug, perc, ord, nota)
  JOIN ingredientes i ON i.slug = d.slug;
END $$;

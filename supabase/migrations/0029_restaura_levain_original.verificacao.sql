-- ============================================================
-- Verificacao da Migration 0029 - rodar no SQL Editor, UMA query por vez
-- ============================================================

-- PRE.1 (antes) - Original v1 hoje: esperado 5 linhas, SEM levain
--   superiore 0.80, fv-integral 0.07, slow 0.13, agua 0.70, sal 0.02
SELECT i.slug, ir.percentual_baker, ir.ordem
FROM ingredientes_receita ir
JOIN ingredientes i ON i.id = ir.ingrediente_id
JOIN versoes_receita vr ON vr.id = ir.versao_receita_id
JOIN receitas r ON r.id = vr.receita_id
JOIN produtos p ON p.id = r.produto_id
WHERE p.slug = 'original' AND vr.numero_versao = 1
ORDER BY ir.ordem;

-- POS.1 (depois) - esperado 6 linhas, com levain 0.20 (ordem 0)
SELECT i.slug, ir.percentual_baker, ir.ordem
FROM ingredientes_receita ir
JOIN ingredientes i ON i.id = ir.ingrediente_id
JOIN versoes_receita vr ON vr.id = ir.versao_receita_id
JOIN receitas r ON r.id = vr.receita_id
JOIN produtos p ON p.id = r.produto_id
WHERE p.slug = 'original' AND vr.numero_versao = 1
ORDER BY ir.ordem;

-- POS.2 - levain presente em 0.20 (esperado: 1 linha, 0.20)
SELECT ir.percentual_baker AS levain_pct
FROM ingredientes_receita ir
JOIN ingredientes i ON i.id = ir.ingrediente_id
JOIN versoes_receita vr ON vr.id = ir.versao_receita_id
JOIN receitas r ON r.id = vr.receita_id
JOIN produtos p ON p.id = r.produto_id
WHERE p.slug = 'original' AND vr.numero_versao = 1 AND i.slug = 'levain';

-- POS.3 - farinhas seguem somando 1.00 (sanity; nao deve ter mudado)
SELECT SUM(ir.percentual_baker) AS soma_farinhas
FROM ingredientes_receita ir
JOIN ingredientes i ON i.id = ir.ingrediente_id
JOIN versoes_receita vr ON vr.id = ir.versao_receita_id
JOIN receitas r ON r.id = vr.receita_id
JOIN produtos p ON p.id = r.produto_id
WHERE p.slug = 'original' AND vr.numero_versao = 1 AND i.slug LIKE 'farinha-%';

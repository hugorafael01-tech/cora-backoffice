-- ============================================================
-- Verificacao da Migration 0028 - rodar no SQL Editor, UMA query por vez
-- ============================================================

-- PRE.1 (antes de aplicar) - blend atual
--   esperado: superiore 0.85, fv-integral 0.15, agua 0.70, sal 0.02 ; SEM slow
SELECT i.slug, ir.percentual_baker, ir.ordem
FROM ingredientes_receita ir
JOIN ingredientes i ON i.id = ir.ingrediente_id
JOIN versoes_receita vr ON vr.id = ir.versao_receita_id
JOIN receitas r ON r.id = vr.receita_id
JOIN produtos p ON p.id = r.produto_id
WHERE p.slug = 'original' AND vr.numero_versao = 1
ORDER BY ir.ordem;

-- POS.1 (depois de aplicar) - blend novo (esperado: 5 linhas)
--   superiore 0.80, fv-integral 0.07, slow 0.13, agua 0.70, sal 0.02
SELECT i.slug, ir.percentual_baker, ir.ordem
FROM ingredientes_receita ir
JOIN ingredientes i ON i.id = ir.ingrediente_id
JOIN versoes_receita vr ON vr.id = ir.versao_receita_id
JOIN receitas r ON r.id = vr.receita_id
JOIN produtos p ON p.id = r.produto_id
WHERE p.slug = 'original' AND vr.numero_versao = 1
ORDER BY ir.ordem;

-- POS.2 - soma das farinhas (esperado: 1.00)
SELECT SUM(ir.percentual_baker) AS soma_farinhas
FROM ingredientes_receita ir
JOIN ingredientes i ON i.id = ir.ingrediente_id
JOIN versoes_receita vr ON vr.id = ir.versao_receita_id
JOIN receitas r ON r.id = vr.receita_id
JOIN produtos p ON p.id = r.produto_id
WHERE p.slug = 'original' AND vr.numero_versao = 1 AND i.slug LIKE 'farinha-%';

-- POS.3 - Integral e Focaccia intactos (sanity)
--   Integral: fv-integral 0.90 + slow 0.10 ; Focaccia: superiore 1.00
SELECT p.slug AS produto, i.slug AS ingrediente, ir.percentual_baker
FROM ingredientes_receita ir
JOIN ingredientes i ON i.id = ir.ingrediente_id
JOIN versoes_receita vr ON vr.id = ir.versao_receita_id
JOIN receitas r ON r.id = vr.receita_id
JOIN produtos p ON p.id = r.produto_id
WHERE p.slug IN ('integral','focaccia') AND vr.numero_versao = 1 AND i.slug LIKE 'farinha-%'
ORDER BY p.slug, ir.ordem;

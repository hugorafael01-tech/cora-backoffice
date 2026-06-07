# CORA_Briefing_Backoffice_Producao_Fatia1_DefinirVolume

**Status:** schema APLICADO e VERIFICADO (07/jun/2026). Proximo: frontend.
**Repo:** cora-backoffice. **Escopo:** fatia 1 do modulo Producao — "Definir volume da semana" (Estado A). Periodo de testes, sem assinante.

---

## Migrations (aplicadas via SQL Editor; verificadas por probe)

- **0021_producao_fatia1_levain_origem** — levain como ingrediente + producoes.origem + trigger de previstos.
- **0022_produto_formato_disco_bola** — adiciona 'disco' e 'bola' ao enum produto_formato.
- **0023_seed_pizza** — Pizza Classica (Levain) como receita real.

Aplicadas pelo SQL Editor (historico local dessincronizado desde 0018, igual licao 0019/0020).
Consequencia: `supabase migration list` mostra 0021-0023 com Remote em branco; o banco esta certo.
Pendente (repo): commitar os 3 arquivos em branch + PR draft + squash (main protegida).

Verificacao (07/jun): farinha Original = 427 (era 477 antes — prova do fix do levain), farinha Pizza = 150, 7 receitas com linha de levain, producoes.origem default 'teste', enum com disco+bola.

## Modelo (decisao chave)

**Levain e ingrediente, nao coluna.** O motor de baker% ja existia (ingredientes_receita +
peso_farinha_por_pao + mise_en_place_semana); a seed apenas omitia o levain, o que fazia a
funcao superestimar a farinha em ~12% (Original: 820/1,72=477 errado; com levain no Sigma:
820/1,92=427 correto). Correcao = adicionar 'levain' ao catalogo + linha por versao com o %
validado do Alex. Demanda de levain = peso_farinha_por_pao x baker%_do_levain x qty.

Prefermentos (Excel Alex): Original 20, Integral 20, Multigraos 40, Ciabatta 25, Focaccia 30, Brioche 10, Pizza 20 (% sobre a farinha).

**producoes.origem** enum {pedido, manual, teste}, default 'teste'. Periodo de teste = 'teste'
(purgavel antes do Alpha). Bridge futura: 'pedido' (assinante) / 'manual' (mkt mantida).

**Trigger producoes_set_prevista** (fonte unica): preenche massa_prevista_kg = qty x peso_massa_g
e levain_previsto_kg = qty x peso_farinha_por_pao x baker%_levain. O frontend nao calcula isso.

**peso_massa_g = massa crua.** massa = qty x peso_massa_g (sem aplicar perda). perda_coccao
relaciona massa->assado (rendimento), fora do caminho da fatia 1.

**Levain build:** perfil padrao liquido 1:2:2 (isca:farinha:agua) como constante. Tabela de
perfis (ex. levain solido, que muda razao E hidratacao) fica pro futuro.

## Pizza (0023) — notas

- 1 receita = a massa (bola ~283g/un). Produto formato 'disco' (assada classica).
- 'bola' (massa crua congelada) disponivel no enum; vira SKU proprio quando precificar. Producao identica.
- Etapas NAO seedadas (sem inventar tempos): ate Receitas autorar, popular_etapas gera so coccao. Da pra copiar o esqueleto do Original (tipos/ordem) se quiser rastreavel ja na fatia 2.
- preco_avulso = NULL (placeholder). Ref. Nema Icarai: combo 6 pizzas fermentacao natural refrigeradas R$125-144 (~R$21-24/un).
- lemady criado no catalogo (melhorador, 0,3%).

## Frontend (proximo) — fatia 1

- Tela "Definir volume" em Producao (Estado A), wireframe v1 aprovado (Claude Design), sobre o v5+3.
- Escrita direta do client como admin (RLS admin_all em producoes/etapas_producao) — sem endpoint/portal/CORS.
- Ao "Criar producoes da semana": para cada receita com qty>0, upsert producoes
  (semana_id, versao_receita_id, qty_paes_prevista, origem='teste', status='planejada')
  ON CONFLICT (semana_id, versao_receita_id) DO UPDATE; massa/levain via trigger;
  depois rpc popular_etapas_producao(producao_id).
- Receitas selecionaveis: cardapio da semana + adicionar qualquer receita ativa + nova receita de teste
  (variacao = nova versao rascunho; pao novo = novo produto+receita+versao; clonar ingredientes/etapas da versao ativa quando variacao).

## Fora do escopo / sinalizado

- 4o estado "pedidos N" no explorer (Claude Design): aprovado, trava a semantica contador-vs-total
  (contador = "voce adiciona", total = pedidos + manual). Estado futuro, fora do build da fatia 1.
- Ponte real (split de qty pedido vs manual numa mesma producao): fatia futura.
- Reconciliacao completa das receitas (hidratacao, splits de farinha, perda) Excel vs banco: passe do modulo Receitas.
- Etapas das receitas de teste e da Pizza: modulo Receitas.

## Para adicionar ao BACKOFFICE_STATUS.md (fim de sessao)

- Migrations table: 0021, 0022, 0023 (aplicadas via SQL Editor; verificadas por probe 07/jun).
- Nota: peso_farinha_por_pao/mise_en_place agora corretas (levain como ingrediente).

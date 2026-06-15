# Briefing — Backoffice / Modulo Financeiro (Asaas Perna 3 / Peca C) — IMPLEMENTACAO

**Repo:** `cora-backoffice`
**Task:** 86e1pfph9 (Perna 3 / Peca C)
**Tipo:** UI nova (tela do modulo Financeiro) + leitura de dados. NAO toca schema.
**Sessao de origem:** 03/jun/2026

O desenho ja existe (Claude Design entregou). Este briefing transforma o desenho em codigo
ligado ao banco real e ao endpoint de vinculo. O CC implementa seguindo o design entregue +
o design system da Cora + o padrao das telas existentes (Semana v4).

---

## Contexto

A integracao Asaas tem 3 pernas. P1 (schema) e P2 (webhook) no ar. P3/Peca A (endpoint de
vinculo POST /api/asaas/vincular no cora-portal) no ar e validada. Esta Peca C e a UI no
backoffice: o modulo Financeiro, painel de pagamentos.

Stack do backoffice (do BACKOFFICE_STATUS.md): Vite + React + TypeScript + Tailwind, SPA pura,
client unico com anon key (`src/lib/supabase.ts`), leitura via client autenticado filtrada por
RLS `is_admin()`. NAO ha service_role no backoffice (por isso a escrita do vinculo vai pro
endpoint do portal — ver secao da acao de vincular).

---

## O que a tela mostra (2 gestos)

Seguir o desenho do Claude Design. Resumo funcional pra ligar aos dados:

### Cards de resumo (topo)
Quatro contadores: **Em dia**, **Vencidas**, **Sem status ainda**, **Pra identificar**.
- Em dia / Vencidas / Sem status: contagem de `subscriptions` por `payment_status`
  (em_dia / vencido / null).
- Pra identificar: contagem de eventos orfaos (ver gesto 2).

### Gesto 1 — Panorama das assinaturas (tabela)
Lista de `subscriptions`. Colunas (do desenho): Assinante (nome), Pagamento
(em dia/vencido/sem status), Ultimo pagamento (last_payment_at), Vinculo Asaas
(vinculado + cus_...mascarado / nao vinculado).
- Ordenacao default: "por quem precisa de atencao" (vencidas e sem status primeiro, em dia
  depois).
- Filtros (abas do desenho): Todas / Vencidas / Sem status / Em dia.
- Busca por nome.
- Paginacao/"ver todas" (o desenho mostra "12 de 82"); no Alpha o volume e baixo, mas
  implementar a paginacao que o desenho preve (ou um limit + ver todas).

### Gesto 2 — Pagamentos pra identificar (orfaos)
Lista de eventos de `asaas_webhook_events` que NAO casaram com assinatura
(`subscription_id is null`). Pra cada um: tipo (pagamento recebido / vencido a partir de
`event_type`), codigo do cliente Asaas (`asaas_customer_id`), valor, data (`received_at`).
Acao por item: **"Vincular a um assinante"** (ver secao da acao).

---

## De onde vem cada dado (CRITICO — ler com atencao)

### subscriptions (panorama)
Campos: `nome`, `payment_status` (enum em_dia/vencido/null), `last_payment_at`,
`asaas_customer_id`. Leitura via client autenticado (is_admin). Ja e o padrao das telas
existentes.

### asaas_webhook_events (orfaos)
Filtrar `subscription_id is null`. Campos diretos: `event_type`, `asaas_customer_id`,
`received_at`.

**O VALOR do pagamento NAO e coluna.** Ele esta dentro do `payload` (jsonb cru do Asaas), em
`payload.payment.value`. O CC precisa extrair de la pra exibir (ex: `R$ 89,00`). Tratar com
seguranca: payload pode nao ter o campo (defensivo, mostra vazio/"—" se ausente, nunca quebra
a tela). Mesma logica vale pra qualquer outro dado que so exista no payload.

NOTA sobre orfaos repetidos: o mesmo `asaas_customer_id` pode ter MAIS DE UM evento orfao (ex:
PAYMENT_CREATED + PAYMENT_RECEIVED do mesmo pagamento, ou varios meses). Decidir na
implementacao como apresentar: idealmente agrupar por asaas_customer_id (mostrar o cliente uma
vez, com o evento mais relevante/recente), pra Hugo nao ver o mesmo cliente 3x na lista de
"pra identificar". Se agrupar for complexo, no minimo ordenar por asaas_customer_id +
received_at desc pra ficarem juntos. CC propoe a abordagem antes de implementar.

---

## AJUSTE de copy (decisao Hugo, 03/jun) — card "Sem status ainda"

O desenho diz "recem-entradas, ainda sem cobranca no Asaas". Isso PODE nao ser verdade:
`payment_status` null significa so "ainda sem pagamento refletido", e o sistema nao distingue
"recem-entrada" de "pagou mas ainda nao refletiu". Trocar a copy pra algo honesto com o que o
dado garante, ex: **"ainda sem pagamento registrado"** (em vez de afirmar que e recem-entrada).
Aplicar o mesmo cuidado em qualquer outro texto que infira causa que o dado nao garante.
(Skill cora-brand-voice; sem travessao, sem rule-of-three.)

---

## A acao de vincular (liga ao endpoint da Peca A)

Quando o Hugo confirma o vinculo de um orfao a um assinante, a UI chama
**`POST /api/asaas/vincular`** (no cora-portal, JA no ar e validado). NAO escreve em
subscriptions direto (o backoffice nao tem service_role; a 0019 revogou escrita do client).

Payload: `{ subscription_id, asaas_customer_id }`.
- `subscription_id`: o id da subscription que o Hugo escolheu.
- `asaas_customer_id`: o codigo do cliente do evento orfao.

Autenticacao da chamada: o endpoint exige `Authorization: Bearer <jwt do admin>`. O backoffice
JA tem a sessao do admin (e como ele le tudo). Pegar o access_token da sessao Supabase atual e
mandar no header. (O endpoint deriva o email do JWT e checa admin_users; o mesmo admin que usa
o backoffice passa.)

CORS / cross-origin: o backoffice (admin.acora.com.br) vai chamar um endpoint do portal
(app.acora.com.br). Dominios diferentes. PONTO DE ATENCAO: confirmar se o endpoint
/api/asaas/vincular responde a chamada cross-origin do admin.acora.com.br (CORS headers). Se
NAO responder, isso precisa ser resolvido (provavelmente um header CORS no endpoint do portal,
permitindo admin.acora.com.br). CC verifica isso CEDO — e o risco tecnico principal desta peca.
Se precisar de ajuste no portal, e uma mudanca pequena la, mas e outro repo: sinalizar antes de
seguir.

Respostas a tratar na UI (do contrato da Peca A):
- 200: vinculo feito. Atualizar a tela: o orfao sai da lista "pra identificar", a subscription
  passa a aparecer como vinculada. Idealmente refetch dos dados.
- 409 `customer_already_linked`: aquele cliente Asaas ja esta vinculado a OUTRO assinante.
  Avisar e NAO vincular (mensagem clara, tom Cora). Protege contra vincular ao errado.
- 404 `subscription_not_found`: subscription sumiu (raro). Mensagem amigavel.
- 400 (`invalid_subscription_id`, `missing_fields`, `invalid_customer_id`): erro de dados,
  mensagem amigavel.
- 401/403: sessao expirou / nao-admin. Pedir re-login.

O fluxo de escolha do assinante (modal de busca, selecao inline, etc.): seguir o desenho do
Claude Design. Se o desenho mostra "Vincular a um assinante" abrindo uma busca de assinante,
implementar essa busca lendo `subscriptions` (nome).

---

## Estados vazios (IMPORTANTE — sera o estado inicial real)

O desenho mostra dados mock (82 assinaturas). NA REALIDADE, hoje ha ~1 subscription (Hugo Dev)
e ZERO pagamentos. A tela vai nascer praticamente vazia. Implementar os estados vazios com o
mesmo cuidado do estado cheio:
- Sem orfaos: "Nenhum pagamento pra identificar." (ou no espirito dos vazios da tela Semana).
- Sem assinaturas / poucas: a tabela funciona com 1 linha sem parecer quebrada.
- Cards de resumo com zeros nao podem parecer erro (ex: "0 vencidas" e uma boa noticia, nao um
  vazio triste).
Seguir o tom dos vazios que a tela Semana ja usa ("Nenhum pedido confirmado ainda.").

---

## Pontos de parada obrigatorios (apos item 8 do template)

9. Verificar CEDO o CORS da chamada cross-origin admin.acora.com.br -> app.acora.com.br no
   endpoint /api/asaas/vincular. Se nao responder, PARAR e sinalizar (ajuste no portal, outro
   repo) antes de construir a UI da acao de vincular.
10. NAO escrever em subscriptions pelo backoffice. A escrita do vinculo e EXCLUSIVAMENTE via o
    endpoint do portal (respeita 0019).
11. Valor do pagamento vem de payload.payment.value (jsonb), nao de coluna. Extracao defensiva
    (ausencia nao quebra a tela).
12. Copy do "sem status" ajustada (nao afirmar "recem-entrada"; usar "ainda sem pagamento
    registrado"). cora-brand-voice, sem travessao/rule-of-three.
13. Orfaos: propor como agrupar/ordenar eventos do mesmo asaas_customer_id antes de implementar.
14. Estados vazios cuidados (a tela nasce vazia no Alpha).
15. NAO toca schema. Leitura via client autenticado + is_admin, padrao das telas existentes.
16. Ativa o item "Financeiro" do menu (hoje "EM BREVE"); seguir o padrao visual de Semana v4 +
    design do Claude Design.

---

## Validacao

Como a tela nasce vazia, a validacao tem duas camadas:
1. **Estado real (vazio):** a tela renderiza sem erro com ~1 subscription e zero orfaos; cards
   mostram os zeros corretamente; estados vazios aparecem.
2. **Com dado simulado:** pra exercitar os gestos, inserir TEMPORARIAMENTE no banco
   (compartilhado prod) alguns eventos orfaos de teste (asaas_event_id 'evt_test_*', como nas
   validacoes anteriores) e/ou setar payment_status na Hugo Dev, ver a tela refletir, e LIMPAR
   depois (delete dos evt_test_*, restaurar payment_status). CC entrega as queries de
   setup/limpeza. Banco compartilhado: sempre restaurar.
3. **Acao de vincular:** com um orfao de teste, clicar vincular -> escolher a Hugo Dev ->
   confirmar -> 200, orfao sai da lista, Hugo Dev aparece vinculada. Testar o 409 (vincular um
   customer ja vinculado a outra). Limpar (asaas_customer_id = null na Hugo Dev, delete dos
   eventos teste).

Branch propria, PR draft, sem push direto no main (protegido).

---

## Refs

- Desenho: Claude Design (Cora_Financeiro / Cora_Backoffice_Financeiro). Padrao Semana v4.
- Design system: CORA_Design_System_v1.md. Copy: skill cora-brand-voice.
- Dados: subscriptions (nome, payment_status, last_payment_at, asaas_customer_id);
  asaas_webhook_events (event_type, asaas_customer_id, received_at, payload jsonb com
  payment.value); filtrar orfaos por subscription_id is null.
- Endpoint da acao: POST /api/asaas/vincular (cora-portal), contrato no briefing
  CORA_Briefing_Asaas_Perna3_PecaA_EndpointVinculo.md. Bearer JWT do admin.
- Leitura: src/lib/supabase.ts (client anon + sessao admin, is_admin via RLS).
- BACKOFFICE_STATUS.md: estado do repo e convencoes.

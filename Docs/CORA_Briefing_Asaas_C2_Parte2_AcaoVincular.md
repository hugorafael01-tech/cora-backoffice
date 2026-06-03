# Briefing — Asaas Perna 3 / C2 (parte 2): acao de vincular no backoffice

**Repo:** `cora-backoffice`
**Task:** 86e1pwnhv (C2). Esta e a PARTE 2 (UI/acao de vincular). A parte 1 (CORS no portal)
ja esta no ar e validada — o endpoint /api/asaas/vincular agora aceita chamada cross-origin de
admin.acora.com.br.
**Tipo:** UI (ligar a acao de vincular) + chamada ao endpoint. NAO toca schema. NAO escreve em
subscriptions direto (a escrita e via o endpoint do portal).
**Sessao de origem:** 03/jun/2026

---

## Contexto

O modulo Financeiro (C1) ja esta no ar: mostra o panorama de assinaturas e a lista de
pagamentos "pra identificar" (orfaos). O botao "Vincular a um assinante" em cada orfao esta
DESABILITADO ("em breve") porque dependia do CORS. O CORS foi resolvido (parte 1, PR #41). Esta
parte LIGA esse botao: ao vincular, a UI chama POST /api/asaas/vincular (no portal), que grava
o asaas_customer_id na subscription escolhida. Dali pra frente os pagamentos daquele cliente
casam sozinhos (fallback do webhook).

O endpoint ja existe, foi validado (Peca A) e agora aceita CORS. Esta tarefa e SO o lado
backoffice: o gesto de escolher o assinante + a chamada + o tratamento das respostas.

---

## TAREFA 0 (antes de codar): conferir o desenho do fluxo de vincular

O Claude Design desenhou a tela com o botao "Vincular a um assinante" em cada orfao. CONFERIR
no codigo atual do C1 (ja mergeado) e no desenho como o passo de ESCOLHER o assinante foi
previsto:
- E um modal que abre com busca de assinante por nome?
- E uma selecao inline na propria linha do orfao?
- O desenho cobriu esse passo, ou so o botao inicial?

Se o desenho cobriu, seguir. Se NAO cobriu o passo de selecao, o CC propoe a abordagem mais
simples e coerente com o design system (provavelmente um modal com busca por nome lendo
subscriptions) e mostra antes de implementar. Mostrar o achado + o plano antes de codar.

---

## O fluxo da acao (o que precisa acontecer)

1. Hugo clica "Vincular a um assinante" num orfao (que tem um asaas_customer_id, ex
   cus_000482910).
2. Abre o gesto de escolha: Hugo busca/seleciona a assinatura correspondente (por nome). A
   lista de assinaturas vem de `subscriptions` (leitura que o backoffice ja faz).
3. Hugo confirma. A UI chama o endpoint (abaixo).
4. Conforme a resposta, a UI reage (abaixo).

## A chamada ao endpoint

`POST <PORTAL>/api/asaas/vincular`
- URL base do portal: https://app.acora.com.br (producao). Confirmar como o backoffice
  referencia a URL do portal (env var? constante?). Se nao houver, criar uma config clara (ex
  VITE_PORTAL_URL), nao hardcode espalhado.
- Headers:
  - `Authorization: Bearer <access_token do admin>` — pegar da sessao Supabase ATUAL do
    backoffice (o admin ja esta logado; e a mesma sessao que le os dados). Usar o supabase
    client pra pegar o access_token da sessao corrente, nao pedir login de novo.
  - `Content-Type: application/json`
- Body: `{ subscription_id, asaas_customer_id }`
  - subscription_id = id da assinatura que o Hugo escolheu.
  - asaas_customer_id = o cus_... do orfao.

## Tratamento das respostas (do contrato da Peca A, ja validado)

- **200**: vinculo feito. A UI atualiza: o orfao SAI da lista "pra identificar" (aquele
  customer agora casou), e a assinatura passa a aparecer como vinculada no panorama. Idealmente
  refetch dos dados (orfaos + panorama) pra refletir o novo estado. Feedback de sucesso no tom
  Cora (ex "Pronto, vinculado." discreto).
- **409 `customer_already_linked`**: aquele cliente Asaas ja esta vinculado a OUTRA assinatura.
  AVISAR claramente e NAO vincular. Mensagem no tom Cora, explicando que aquele cliente ja tem
  dono (algo como "Esse cliente do Asaas ja esta vinculado a outro assinante."). Protecao contra
  vincular ao errado.
- **404 `subscription_not_found`**: a assinatura escolhida sumiu (raro). Mensagem amigavel.
- **400** (`invalid_subscription_id` / `missing_fields` / `invalid_customer_id`): erro de
  dados; mensagem amigavel (nao deveria acontecer pelo fluxo normal da UI, mas tratar).
- **401 / 403**: sessao expirou ou perdeu admin. Pedir pra entrar de novo (re-login). Nao deixar
  a UI em estado quebrado.
- **erro de rede / inesperado**: mensagem amigavel, nao trava a tela, permite tentar de novo.

Todas as mensagens passam pela skill cora-brand-voice (sem travessao, sem rule-of-three, tom de
ferramenta interna mas humano).

---

## Pontos de parada obrigatorios (apos item 8 do template)

9. Tarefa 0: conferir como o desenho previu o passo de escolher o assinante; mostrar antes de
   codar.
10. NAO escrever em subscriptions direto pelo backoffice. A escrita e EXCLUSIVAMENTE via o
    endpoint do portal (respeita 0019). O backoffice so chama o endpoint.
11. Pegar o token da SESSAO atual do admin (supabase client), nao pedir login novo nem hardcode.
12. Tratar TODAS as respostas (200/409/404/400/401/403/rede), cada uma com feedback claro. O 409
    e o mais importante depois do 200 (protege contra vinculo errado).
13. Apos 200, atualizar a tela (orfao sai da lista, panorama reflete) — idealmente refetch.
14. URL do portal via config/env, nao hardcode espalhado.
15. NAO toca schema. NAO mexe na leitura do C1 que ja funciona (so liga a acao no botao que
    estava "em breve").

---

## Validacao (preview/prod — banco compartilhado)

A tela nasce sem orfaos reais. Pra exercitar, inserir orfao(s) de teste e testar o fluxo:

1. **Setup:** inserir um evento orfao de teste em asaas_webhook_events (asaas_event_id
   'evt_test_*', subscription_id null, um asaas_customer_id de teste tipo 'cus_test_vinculo',
   event_type PAYMENT_RECEIVED, um payload com payment.value). CC entrega o SQL de insert.
2. **Fluxo feliz:** na tela, o orfao aparece em "pra identificar". Clicar vincular, escolher a
   Hugo Dev, confirmar -> 200, o orfao some da lista, a Hugo Dev aparece vinculada
   (asaas_customer_id = cus_test_vinculo). Conferir no banco.
3. **Conflito (409):** com a Hugo Dev ja vinculada ao cus_test_vinculo, inserir OUTRO orfao com
   o MESMO cus_test_vinculo, tentar vincular a OUTRA assinatura (se houver) ou repetir -> a UI
   mostra o aviso de "ja vinculado", sem quebrar. (Como so existe 1 subscription, o 409 pode ser
   dificil de exercitar pela UI; no minimo confirmar que a UI trata a resposta 409 — pode ser
   testado forcando, ou aceito pela revisao de codigo como na Peca A.)
4. **Limpeza obrigatoria:** delete dos eventos evt_test_*, e update subscriptions set
   asaas_customer_id = null where id = Hugo Dev. Banco compartilhado — sempre restaurar.

Como a validacao mexe na tela com auth, e o preview tem o problema do magic link redirecionar
pra prod: pode validar direto em producao (admin.acora.com.br/financeiro) com cuidado de
limpar, OU adicionar a URL de preview nas Redirect URLs do Supabase temporariamente. Recomendo
validar em prod com os dados de teste e limpar (a acao e reversivel: e so setar
asaas_customer_id de volta a null).

Branch propria, PR draft, sem push direto no main (protegido).

---

## Refs

- Endpoint: POST /api/asaas/vincular (cora-portal), agora com CORS (PR #41). Contrato no
  briefing CORA_Briefing_Asaas_Perna3_PecaA_EndpointVinculo.md.
- C1 (modulo Financeiro read-only): ja no ar, PR #16. A acao liga o botao que esta "em breve".
- Desenho: Claude Design (Cora_Financeiro). Padrao Semana v4.
- Leitura de subscriptions e asaas_webhook_events: via supabase client autenticado (is_admin),
  como o C1 ja faz.
- cora-brand-voice pro copy das mensagens.
- Apos esta parte: a perna 3 e a integracao Asaas inteira fecham. Resta a tarefa OPERACIONAL do
  Hugo: criar o webhook em PRODUCAO do Asaas (hoje so Sandbox).

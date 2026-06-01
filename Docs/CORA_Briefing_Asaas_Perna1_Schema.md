# Briefing — Asaas Webhooks / Perna 1: SCHEMA (migration no cora-backoffice)

**Repo:** `cora-backoffice` (governanca de schema)
**Task ancora:** 86e1mk8c0 (Financeiro: webhooks Asaas)
**Esta perna:** so SCHEMA. O endpoint (cora-portal) e o painel (cora-backoffice) sao pernas
seguintes, NAO entram aqui.
**Sessao de origem:** 01/jun/2026

---

## Contexto (decisoes ja tomadas com o Hugo)

Integracao de webhooks do Asaas pra refletir status de pagamento sem acompanhamento manual.
Recorte da fase 1: cobranca criada MANUALMENTE no painel do Asaas (nao via API ainda). O
casamento evento->assinante e feito por `externalReference` = id da subscription da Cora, que
o Hugo seta ao criar a cobranca manual (opcao 1 escolhida). Forma de pagamento: Pix OU cartao
(o assinante escolhe).

Confirmado na doc do Asaas (01/jun):
- Eventos relevantes: PAYMENT_CONFIRMED (pago, saldo ainda nao disponivel),
  PAYMENT_RECEIVED (recebido de fato), PAYMENT_OVERDUE (vencido).
- Pix: PAYMENT_CREATED -> PAYMENT_RECEIVED (atrasado passa por OVERDUE).
- Cartao: PAYMENT_CREATED -> PAYMENT_CONFIRMED -> PAYMENT_RECEIVED (RECEIVED so 32 dias
  depois do CONFIRMED). Por isso "pago" do lado da Cora dispara com CONFIRMED OU RECEIVED.
- Asaas reenvia eventos (retry) -> precisa idempotencia por evt id.
- Asaas pausa a fila inteira se o endpoint falhar 15x seguidas -> endpoint tem que ser
  robusto. (Isso e da perna do endpoint, mas justifica a tabela de eventos crua aqui.)
- Payload traz: evt id (ex "evt_..."), event, payment.id ("pay_..."),
  payment.customer ("cus_..."), payment.subscription ("sub_...", so se for assinatura Asaas),
  payment.externalReference, payment.status, payment.value, payment.billingType, datas.

Schema atual da `subscriptions` (levantado por SQL em 01/jun) JA TEM: asaas_customer_id,
asaas_subscription_id (text, nullable), activated_at/paused_at/cancelled_at. NAO tem campo de
status de pagamento dedicado (o `status` atual e o estado da assinatura:
pending_payment/active/paused/cancelled, enum subscription_status). NAO existe tabela de
eventos do Asaas.

---

## O que esta migration faz (expand-only, NAO altera/dropa nada existente)

Seguir o padrao expand-contract da Frente D: so adiciona. Determinar o proximo numero de
migration no repo via git fetch + git log + listagem da pasta (a ultima foi 0019; confirmar,
nao assumir).

### 1. Enum novo: payment_status_enum
Valores (confirmados com o Hugo): `em_dia`, `pendente`, `vencido`.
(Seguir a convencao do repo: enums com sufixo _enum, snake_case.)

### 2. Colunas novas em subscriptions (todas nullable, expand-only)
- `payment_status` payment_status_enum NULL — eixo de pagamento, SEPARADO do `status` da
  assinatura. Uma assinatura pode estar active e com payment_status vencido.
- `last_payment_at` timestamptz NULL — quando o ultimo pagamento foi confirmado/recebido.
- `last_payment_event` text NULL — o ultimo event_type do Asaas que tocou esta subscription
  (rastreio rapido, ex "PAYMENT_RECEIVED"). Opcional, mas barato e util pro painel.

NAO mexer no `status` existente nem no enum subscription_status. NAO popular as colunas novas
agora (ficam null ate o endpoint comecar a refletir).

### 3. Tabela nova: asaas_webhook_events (a "caixa-preta")
Guarda TODO evento cru que o Asaas mandar, pra idempotencia e auditoria. O reflexo no status
da subscription (perna do endpoint) e derivado desta tabela; um bug no reflexo nunca derruba a
fila do Asaas porque o endpoint so precisa gravar aqui e responder 200.

Colunas (ajustar tipos/nomes a convencao do repo; pt-BR snake_case pra dominio, _at em ingles
pra timestamps, conforme regra do backoffice):
- `id` uuid PK default gen_random_uuid()
- `asaas_event_id` text UNIQUE NOT NULL — o "evt_..." do Asaas. UNIQUE = a guarda de
  idempotencia (segundo POST do mesmo evento viola a unique e e ignorado/no-op).
- `event_type` text NOT NULL — ex "PAYMENT_RECEIVED".
- `asaas_payment_id` text NULL — o "pay_...".
- `asaas_customer_id` text NULL — o "cus_...".
- `external_reference` text NULL — o externalReference do payload (= id da subscription da
  Cora, quando o Hugo setou ao criar a cobranca).
- `subscription_id` uuid NULL REFERENCES subscriptions(id) — a subscription da Cora casada, se
  resolvida. Nullable porque pode chegar evento que nao casa (registra mesmo assim).
- `payment_status` text NULL — o status do pagamento no payload do Asaas (ex "RECEIVED").
- `payload` jsonb NOT NULL — o corpo inteiro do webhook, cru. (Robustez: campos novos do Asaas
  nao quebram nada, ficam no jsonb.)
- `received_at` timestamptz NOT NULL default now() — quando a Cora recebeu.
- `processed_at` timestamptz NULL — quando o reflexo no status foi aplicado (null = ainda nao
  processado). Permite reprocessar/auditar.

Indices: o UNIQUE em asaas_event_id ja cria indice. Adicionar indice em `subscription_id` (pro
painel listar eventos por assinante) e em `event_type` (pra filtrar). Opcional: indice em
`external_reference`.

### 4. RLS e grants (CRITICO — seguir o padrao pos-revoke 0019)
- Habilitar RLS na asaas_webhook_events.
- Escrita: SOMENTE service_role (o endpoint usa service_role). NAO conceder
  INSERT/UPDATE/DELETE a authenticated nem anon. Nenhum cliente do portal escreve aqui.
- Leitura: o painel do backoffice le. Definir conforme o backoffice acessa os dados hoje
  (provavelmente via service_role no server do backoffice, OU uma policy de leitura pro
  authenticated do backoffice). Seguir o MESMO padrao que as outras tabelas de dominio do
  backoffice ja usam (lotes_insumo, pedidos_pontuais, etc.). NAO inventar um padrao novo de
  acesso; espelhar o existente.
- Em hipotese alguma conceder escrita a anon/authenticated (mesma licao da 0019).

---

## Pontos de parada obrigatorios (apos item 8 do template)

9. NAO aplicar a migration. Hugo aplica via SQL Editor (NAO db push — historico do repo nao
   esta sincronizado com a CLI; db push reaplica tudo e quebra. Mesma licao da 0018/0019).
10. Expand-only: nao alterar/dropar nada existente. Nao mexer no enum subscription_status nem
    na coluna status. Nao popular as colunas novas.
11. Escrita na asaas_webhook_events e SO service_role. Nunca authenticated/anon. Espelhar o
    padrao de acesso das tabelas de dominio existentes do backoffice pra leitura.
12. Determinar o numero da migration pelo repo (git log + listagem), nao assumir.
13. NAO escrever o endpoint nem o painel. Esta perna e so a migration (DDL).

---

## Entrega

1. CC autora o arquivo de migration na pasta do cora-backoffice, branch propria, PR draft.
2. CC NAO aplica. Entrega o SQL pronto + queries de verificacao pre/pos pro Hugo rodar no SQL
   Editor.
3. Verificacao pos esperada: enum payment_status_enum existe com os 3 valores; subscriptions
   tem as 3 colunas novas (nullable); asaas_webhook_events existe com a unique em
   asaas_event_id, a FK pra subscriptions, RLS habilitada, e grants so pro service_role
   (authenticated/anon sem escrita).
4. Hugo aplica, valida, confirma, e so entao ready + merge.

---

## Refs

- Doc Asaas: https://docs.asaas.com/docs/webhook-para-cobrancas (eventos + payload),
  https://docs.asaas.com/docs/sobre-os-webhooks (fila pausa em 15 falhas),
  https://docs.asaas.com/docs/como-implementar-idempotencia-em-webhooks.
- Migration 0019 (revoke): padrao de "escrita so service_role". Espelhar.
- subscriptions ja tem asaas_customer_id/asaas_subscription_id (D.1).
- Proximas pernas (NAO neste briefing): endpoint /api/webhooks/asaas no cora-portal
  (valida asaas-access-token, grava evento cru, responde 200, reflete payment_status);
  painel no cora-backoffice (quem pagou / pendente / vencido).

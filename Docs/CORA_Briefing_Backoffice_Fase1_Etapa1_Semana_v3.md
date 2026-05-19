# CORA — Briefing Técnico Backoffice Fase 1 Etapa 1 — Módulo Semana — v3

**Repo:** `cora-backoffice`
**Branch destino:** `fase-1-semana`
**Predecessor:** Fase 1 Etapa 0 (Schema) — `main` em `1594d25` + commit de housekeeping `85c9248` (corrigido)
**Dependências:** migration 0015 (incluída), `normalize.ts` portado do Portal, libs `date-fns` + `date-fns-tz`
**Data:** 2026-05-19

### Changelog v2 → v3

Correções aplicadas após review do Claude Code, que bateu o briefing contra a migration 0012 real e achou 3 bugs em Q6:

- §8: adicionado bloco explícito de instalação de `date-fns` + `date-fns-tz` (eram implícitos no v2).
- §9: `etapaAgora()` — `prod.status !== 'em_producao'` → `!== 'em_curso'`. Enum real é `producao_status_enum (planejada, em_curso, concluida, cancelada)`.
- §14 Q6: FK em `producoes` é `versao_receita_id` (não `receita_id`). Join correto: `producoes → versoes_receita → receitas → produtos`.
- §14 Q6: nome da etapa vive em `etapas_receita.nome`, acessado via `etapas_producao.etapa_receita_id → etapas_receita`. `etapas_producao` não tem coluna `nome`.
- §5: nota sobre remoção de `pages/Home.tsx` (rota órfã pós-redirect de `/`).

### Changelog v1 → v2

- §6: bloco de validação prévia do `coverage_whitelist`.
- §13: comportamento explícito do botão "Cancelar".
- §14 Q5: regra de display da grafia do bairro.
- §16 #3: data corrigida — `data_entrega = qui 28 mai 2026`.
- §17 #10: cálculo de levain como heurística MVP.

---

## 0. Como usar este briefing

Documento auto-contido para o Claude Code executar a Etapa 1. Tudo que está aqui foi fechado em rodada de discussão entre Hugo e Claude Chat — não re-decidir.

Onde houver dúvida na implementação, **parar e perguntar antes**. Convenções da Fase 0/Etapa 0 (pt-BR snake_case no schema do Backoffice, `is_admin()` em todas as policies, `set_updated_at()` em toda tabela com `updated_at`, ASCII-only em commits) continuam valendo.

A ordem das seções é a ordem sugerida de implementação. Tarefas atômicas dentro de cada seção podem rodar em paralelo.

---

## 1. Objetivo da Etapa 1

Entregar o **módulo Semana** funcional: criação, navegação e detalhe (3 estados) de uma semana, com sub-tela embutida de cardápio. É a tela que Hugo abre primeiro toda segunda-feira para ver o que vem pela frente.

**Não é objetivo desta etapa:** Produção (Etapa 2), Pedidos pontuais (Etapa 3), Expedição completa, Receitas, lista paginada de semanas.

---

## 2. Escopo

### Dentro

- Migration **0015** — tabela `bairros_atendidos` + seed espelhando `src/config/coverage.js` do Portal.
- Helper `src/lib/normalize.ts` — port literal do Portal.
- Rotas: `/` e `/semanas` redirecionam para `/semanas/atual`; resolução de `atual` para UUID; `/semanas/:id` (detalhe); `/semanas/:id/cardapio` (sub-tela).
- Modal de criação com input único de `data_entrega` e derivação automática dos demais campos.
- Detalhe com **3 estados derivados de tempo** (A pré-corte, B pós-corte, C pós-quinta) × 2 plataformas (desktop, mobile 375).
- Sub-tela de cardápio (CRUD restrito: toggle de rotativos via INSERT/DELETE em `cardapios`; base/fixo trancados; CTA publicar congela a semana).
- Wireframe canônico: `Docs/wireframes/semana/Cora_Backoffice_-_Semana_wireframes_v5.html`.

### Fora desta etapa

- Coluna **Etapa agora** da tabela de produção implementada como leitura derivada de `etapas_producao`. **Renderiza vazio até Etapa 2 popular dados** — sem mock.
- Card de Entregas com **agrupamento por bairro** (sem zonas — zona fica para Expedição/Haversine futura).
- Card de Insumos com **alertas estáticos** (`quantidade_atual_g < quantidade_minima_g`). Sem cruzamento com `mise_en_place_semana()`.
- Pedidos pontuais **não aparecem no card de Entregas**, mas **estão contados** na tabela de produção (via view `planejamento_semana`).
- Calculadora de levain (essa fica na Etapa 2, TER).
- Listagem paginada de semanas (YAGNI: navegação só via `‹/›` no header).
- Edição manual de `data_corte`, `data_inicio`, `data_fim` (deriva tudo de `data_entrega` no MVP; parametrizar se virar dor).
- Refatoração do Portal para ler de `bairros_atendidos` (segue Frente D, fora desta etapa).

---

## 3. Pré-requisitos confirmados contra o banco real

Validado no Supabase `kjzuvmhedicxbuynfqev` em 19/mai/2026.

### Tabelas e funções existentes que esta etapa consome

| Recurso | Origem | Uso na Etapa 1 |
|---|---|---|
| `semanas` | 0010 | criar, ler, atualizar status |
| `cardapios` | 0010 | sub-tela de cardápio (INSERT/DELETE) |
| `produtos` (com `tipo_cardapio`) | 0004 + 0009 | listar base/fixo/rotativos |
| `receitas`, `versoes_receita`, `ingredientes_receita` | 0005 | derivar `peso_massa_g` para cálculo de massa total |
| `planejamento_semana` (view) | 0013 | volume e tabela de produção |
| `ingredientes` (com colunas de estoque) | 0008 | card de Insumos |
| `weekly_orders`, `subscriptions` | Portal (pré-existentes) | card de Entregas |
| `popular_cardapio_padrao(uuid)` | 0010 | chamada no momento da abertura da semana |
| `peso_farinha_por_pao(uuid)` | 0012 | **não usada nesta etapa** (Etapa 2) |
| `is_admin()`, `set_updated_at()` | Fase 0 | policies e triggers |

### Pendência confirmada como aceita

- **`weekly_orders.subscription_id`** — FK assumida com esse nome. Se a introspection no momento de implementação mostrar nome diferente, ajustar e seguir. Se a FK não existir, ler via 2 queries (busca `subscription_id` em `weekly_orders` e depois `subscriptions` por lista de IDs).
- **Schema desalinhado:** as colunas `next_billing_change_date` e `next_billing_value` em `subscriptions` foram aplicadas fora do controle de migrations (não estão em `schema_migrations`). Não tocar nelas nesta etapa. Rodada separada de housekeeping resolve depois.

---

## 4. Decisões fechadas (referência rápida)

Resumo do que foi resolvido na rodada de discussão. Documenta intenção — não re-discutir durante a implementação.

| # | Decisão | Resolução |
|---|---|---|
| 1 | Listagem de semanas | Sem lista no MVP. Nav `‹/›` no header cobre. `/` e `/semanas` → `/semanas/atual` → resolve UUID. |
| 2 | Sub-tela de cardápio | Aba dentro do detalhe com URL própria (`/semanas/:id/cardapio`). Sketch textual aqui — sem wireframe formal. **Comentário obrigatório de provisoriedade no código** (ver §13). |
| 3 | Planejamento na sidebar | Vai para "em breve" com tooltip "Cardápio da semana fica em Semana → [link]". |
| 4 | Criação de semana | Modal com único input `data_entrega` (date picker, default = próxima quinta). Sistema deriva numero/ano (ISO week), `data_corte` (terça 12h da mesma semana), `data_inicio` (segunda), `data_fim` (domingo). |
| 5 | Tabela de produção × pontuais | Total na coluna principal + caption `"45 base + 2 pontuais"` apenas quando `qty_pontual > 0`. |
| 6 | Card de Entregas | Agrupamento **por bairro**, agrupado por cidade. Bairros fora de `bairros_atendidos.ativo` destacados em **amarelo** (atenção, não crítico). Inclui apenas `weekly_orders` confirmadas (pontuais não entram aqui — Expedição cuida). Link "ver detalhe na Expedição →" desabilitado. |
| 7 | Card de Insumos | Alertas estáticos: `WHERE quantidade_atual_g < quantidade_minima_g`. Linha "X insumos OK" = `COUNT(*) WHERE NOT (...)`. Cruzamento com mise_en_place fica para refinamento depois. |
| 8 | Cardápio | Toggle rotativo via INSERT/DELETE em `cardapios`. Base/fixo trancados (não removíveis). Reclassificação é via `produtos.tipo_cardapio`, não cardápio semanal. |
| 9 | Nav `‹/›` | Anterior/próxima **existentes no banco**, não calendário. Se não existir vizinha, botão desabilitado. |
| 10 | Empty state | "Você ainda não criou nenhuma semana." + CTA "Criar semana". |
| 11 | UUID inválido | Redireciona para `/semanas/atual`. |
| 12 | Mobile "Mais ▾" | Drawer (não bottom-sheet) com Planejamento (em breve) + Receitas + Configs. |
| 13 | Status `rascunho` | Renderiza como Estado A com banner amarelo "Semana ainda não publicada. **Abrir semana →**" no topo. |
| 14 | Estado A/B/C | **Derivados de tempo**, não input manual. Lógica em §11. |
| 15 | Coluna "Etapa agora" (Estado B) | Leitura derivada de `etapas_producao`. Renderiza vazio/aguardando até Etapa 2 popular dados. |

---

## 5. Convenções desta etapa

- React + TypeScript + Tailwind v4 (consistente com Fase 0).
- Roteamento via **React Router** (a Fase 0 já tem `/login`, `/auth/callback` — assumir react-router-dom configurado em `App.tsx`).
- Acesso ao banco via `supabase` client de `src/lib/supabase.ts`.
- Tokens visuais via CSS variables do design system (mesmas usadas no wireframe v5).
- Hit targets ≥ 44px em mobile.
- Escala tipográfica mobile do backoffice (DS v1): ação 16px, info 12px, caption 11px, micro 10px.
- Datas: **sempre** considerar timezone America/Sao_Paulo na derivação (terça 12h é horário local).
- Cores brand-500 só em: nav ativa, "hoje", CTAs e links. Vermelho apenas em alerta crítico (estoque zero, não usar para fora-da-whitelist).

### Estrutura de arquivos proposta

```
src/
  lib/
    supabase.ts                    (existe)
    normalize.ts                   (NOVO — port literal do Portal)
    date.ts                        (NOVO — derivações ISO week, terça 12h)
    semana.ts                      (NOVO — derivaEstado, cálculo etapa-agora)
  hooks/
    useSemana.ts                   (NOVO — fetch + derivações da rota)
    useSemanaCardapio.ts           (NOVO — fetch da sub-tela de cardápio)
  pages/
    Semana/
      SemanaAtualRedirect.tsx      (NOVO — resolve /semanas/atual → UUID)
      SemanaDetalhe.tsx            (NOVO — rota /semanas/:id)
      SemanaCardapio.tsx           (NOVO — rota /semanas/:id/cardapio)
      components/
        WkHeader.tsx               (header com nav ‹/› e título)
        EstadoBanner.tsx           (banner contextual por estado)
        Cronograma.tsx             (TER/QUA/QUI cards)
        CardsVolume.tsx            (4 cards: pães, massa, levain, insumos)
        TabelaProducao.tsx         (linhas por produto, derivada da view)
        CardInsumos.tsx            (alertas estáticos + collapsed OK)
        CardEntregas.tsx           (bairros agrupados por cidade)
        ModalCriarSemana.tsx       (modal único)
        MobileShell.tsx            (wrapper mobile com bottom-nav)
        DrawerMais.tsx             (drawer "Mais ▾" do mobile)
  App.tsx                          (adicionar rotas)
```

Componentes filhos recebem `estado: 'A' | 'B' | 'C' | 'rascunho'` como prop e ajustam o render localmente. Não duplicar telas inteiras por estado.

### Limpeza prévia

`src/pages/Home.tsx` da Fase 0 era healthcheck pós-login. Com `/` redirecionando pra `/semanas/atual`, vira rota órfã. **Remover arquivo + import + rota** ao adicionar as rotas novas em `App.tsx`. Smoke test pós-deploy continua coberto por `/semanas/atual` (testa auth + render + DB).

---

## 6. Migration 0015 — `bairros_atendidos`

Arquivo: `supabase/migrations/0015_bairros_atendidos.sql`

### Validação prévia (executada antes desta migration)

Schema atual de `coverage_whitelist` confirmado via SQL Editor em 19/mai/2026:

```
column_name | data_type                | nullable
------------|--------------------------|---------
id          | uuid (PK)                | NO
cpf         | text                     | YES
email       | text                     | YES
cep         | text                     | YES
note        | text                     | YES
created_at  | timestamp with time zone | NO
```

Estrutura confirma whitelist **individual por pessoa** (cpf/email/cep) — conceito distinto de "lista de bairros cobertos". Justifica criar `bairros_atendidos` como tabela separada em vez de ALTER em `coverage_whitelist`. As duas continuam coexistindo com responsabilidades distintas.

### Migration

```sql
-- Migration: 0015_bairros_atendidos
-- Origem: Fase 1 Etapa 1 — card de Entregas por bairro (Módulo Semana)
-- Objetivo: fonte unica de bairros atendidos consultavel por Backoffice
--           e (futuramente) Portal. Substitui hardcoded em
--           src/config/coverage.js do Portal quando a Frente D do Portal
--           fechar (fora desta etapa).
--
-- NAO confundir com coverage_whitelist (existente): aquela tabela e
-- whitelist individual por cpf/email/cep, conceito distinto.

CREATE TABLE bairros_atendidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cidade text NOT NULL,
  bairro text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cidade, bairro)
);

CREATE INDEX idx_bairros_atendidos_ativo
  ON bairros_atendidos(ativo) WHERE ativo = true;

ALTER TABLE bairros_atendidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_bairros_atendidos"
  ON bairros_atendidos FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "anon_read_bairros_atendidos_ativos"
  ON bairros_atendidos FOR SELECT
  USING (ativo = true);

CREATE TRIGGER trg_bairros_atendidos_updated_at
  BEFORE UPDATE ON bairros_atendidos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed (espelha src/config/coverage.js do Portal nesta data)
INSERT INTO bairros_atendidos (cidade, bairro) VALUES
  ('Niterói',        'Icaraí'),
  ('Niterói',        'Ingá'),
  ('Niterói',        'São Francisco'),
  ('Rio de Janeiro', 'Botafogo'),
  ('Rio de Janeiro', 'Humaitá'),
  ('Rio de Janeiro', 'Copacabana');
```

### Validação pós-aplicação

```sql
-- Estrutura criada
\d bairros_atendidos

-- Seed aplicado
SELECT cidade, bairro FROM bairros_atendidos ORDER BY cidade, bairro;
-- Esperado: 6 linhas, 3 Niteroi + 3 Rio

-- Policy admin funciona
SELECT * FROM bairros_atendidos WHERE ativo = true;
-- Esperado: 6 linhas (logado como admin)
```

---

## 7. Helper `src/lib/normalize.ts`

Port literal do Portal (`cora-portal/src/utils/normalize.js`), tipado.

```typescript
/**
 * Normaliza string pra comparacao tolerante: lowercase + remove
 * diacriticos (acentos, cedilha, etc.).
 *
 * Espelha src/utils/normalize.js do Portal. Manter sincronizado.
 */
export const normalize = (s: string | null | undefined): string =>
  (s ?? '')
    .toString()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

export const equalsLoose = (
  a: string | null | undefined,
  b: string | null | undefined
): boolean => normalize(a) === normalize(b);
```

---

## 8. Helper `src/lib/date.ts`

Derivações para a criação de semana (input único = `data_entrega`).

### Dependências

Instalar antes de implementar:

```bash
npm install date-fns date-fns-tz
```

Ambas como deps prod. `date-fns-tz` é necessária pro fuso `America/Sao_Paulo` (terça 12h00 BRT precisa considerar DST correto — `Intl.DateTimeFormat` puro complica).

### Implementação

```typescript
import { format, getISOWeek, getISOWeekYear, previousDay, startOfDay, addDays, setHours, setMinutes } from 'date-fns';
// (instalar date-fns se nao estiver — preferivel a lib nova; ja e leve)

/**
 * Deriva os campos de uma semana a partir de data_entrega (quinta).
 *
 * Regras:
 * - data_corte = terca 12h00 (America/Sao_Paulo) da mesma semana ISO
 * - data_inicio = segunda da mesma semana ISO
 * - data_fim = domingo da mesma semana ISO
 * - numero = ISO week da data_entrega
 * - ano = ISO week year (ATENCAO: nao igual a getFullYear no final/inicio de ano)
 *
 * Importante: data_corte e timestamptz; semanas.data_inicio/data_fim/data_entrega
 * sao date (sem hora).
 */
export function derivaSemana(dataEntrega: Date): {
  numero: number;
  ano: number;
  data_inicio: string;     // ISO date YYYY-MM-DD
  data_fim: string;        // ISO date YYYY-MM-DD
  data_entrega: string;    // ISO date YYYY-MM-DD
  data_corte: string;      // ISO timestamp com fuso
} {
  // Implementacao: usar date-fns com tz America/Sao_Paulo (date-fns-tz)
  // Detalhe: terca = quinta - 2 dias. Segunda = quinta - 3. Domingo = quinta + 3.
  // ...
}

/**
 * Proxima quinta a partir de hoje. Se hoje for quinta, retorna proxima quinta.
 * Usado como default no date picker do modal de criacao.
 */
export function proximaQuinta(referencia: Date = new Date()): Date {
  // ...
}
```

**Nota técnica:** ISO week year é o que importa pra `semanas.ano`, **não** `getFullYear()`. Semana ISO 53/2024 vs Semana ISO 1/2025 podem cair em dezembro/janeiro respectivamente — `getISOWeekYear` resolve. Documentar com 2-3 testes unitários simples cobrindo a virada de ano.

---

## 9. Helper `src/lib/semana.ts`

Derivações específicas do estado da semana.

```typescript
import type { Database } from './database.types';

type Semana = Database['public']['Tables']['semanas']['Row'];

export type EstadoSemana = 'rascunho' | 'A' | 'B' | 'C' | 'concluida';

/**
 * Deriva o estado de exibicao a partir da semana e do "agora".
 *
 * Regras:
 * - status='rascunho' → 'rascunho' (banner amarelo, render como A)
 * - status='concluida' → 'C' (retrospectivo)
 * - status in ('aberta','congelada'):
 *     hoje < data_corte → 'A' (previsao com ~)
 *     data_corte <= hoje <= data_entrega → 'B' (volume definitivo)
 *     hoje > data_entrega → 'C' (delta realizado)
 *
 * Timezone: comparar usando ISO no fuso America/Sao_Paulo. Ver date.ts.
 */
export function derivaEstado(semana: Semana, agora: Date = new Date()): EstadoSemana {
  // ...
}

/**
 * Etapa "agora" para uma producao da semana.
 *
 * Regras:
 * - etapa com iniciada_at, concluida_at IS NULL, iniciada_at > now() - 2h → mostra `etapas_receita.nome` (ex: "Dobras 2/3")
 * - existe producao em status 'em_curso' mas nenhuma etapa recente → 'em produção' (label generico)
 * - sem producao → 'aguardando'
 */
export function etapaAgora(producao: ProducaoComEtapas | null, agora: Date = new Date()): {
  label: string;
  ha: string | null;
  tom: 'brand' | 'warm' | 'mute';
} {
  // ...
}
```

---

## 10. Rotas

Adicionar em `App.tsx` (assumindo react-router-dom v6+):

```tsx
<Route path="/" element={<Navigate to="/semanas/atual" replace />} />
<Route path="/semanas" element={<Navigate to="/semanas/atual" replace />} />
<Route path="/semanas/atual" element={<SemanaAtualRedirect />} />
<Route path="/semanas/:id" element={<SemanaDetalhe />} />
<Route path="/semanas/:id/cardapio" element={<SemanaCardapio />} />
```

### `SemanaAtualRedirect.tsx`

Resolve `/semanas/atual` para um UUID.

**Lógica de "atual" (em ordem de prioridade):**
1. Semana com `data_corte <= now() AND data_entrega + interval '3 days' >= now()` (semana "viva" pós-corte ou recém-entregue).
2. Senão, semana com menor `data_entrega - now()` positivo (próxima futura).
3. Senão, semana mais recente passada.
4. Senão, **empty state**: "Você ainda não criou nenhuma semana." + CTA "Criar semana" que abre o modal direto.

Query única:
```typescript
const { data: semanas } = await supabase
  .from('semanas')
  .select('id, data_entrega, status')
  .order('data_entrega', { ascending: true });

// Lógica de seleção no client (poucos rows; sem query SQL custom)
```

Redireciona via `<Navigate to={`/semanas/${id}`} replace />`.

UUID inválido em `/semanas/:id` → 404 do `single()` → redireciona para `/semanas/atual`.

---

## 11. `SemanaDetalhe.tsx` — Estados A/B/C

Componente único que renderiza desktop e mobile. Detecta viewport via media query (`window.matchMedia('(max-width: 768px)')` ou Tailwind responsive classes).

### Hook `useSemana(id)`

Retorna:
```typescript
{
  semana: Semana | null;
  estado: EstadoSemana;
  planejamento: LinhaProducao[];       // join planejamento_semana × produtos × receitas
  insumos: { alertas: Ingrediente[]; okCount: number };
  entregas: { cidades: { nome: string; bairros: { nome: string; count: number; foraDaLista: boolean }[] }[]; totalGeral: number };
  etapasAgora: Map<string, EtapaAgora>;  // chave: produto.slug
  semanaAnterior: string | null;       // UUID ou null
  semanaProxima: string | null;        // UUID ou null
  loading: boolean;
  error: Error | null;
}
```

### Layout (síntese do wireframe v5)

**Desktop:**
1. Sidebar fixa 220px (Semana ativa; Planejamento/Estoque/Assinantes/Financeiro/Configs em "em breve").
2. Header: eyebrow + título "SEMANA 14 · 30 MAR — 5 ABR" + sub-info + nav `‹/›` + avatar.
3. EstadoBanner (se Estado A, rascunho ou C).
4. Cronograma TER/QUA/QUI (cards com today highlight).
5. CardsVolume 4-col: Pães, Massa, Levain, Insumos.
6. TabelaProducao.
7. Row2 (50/50): CardInsumos | CardEntregas.

**Mobile:**
1. Top bar fixo (hamburger, brand, nv).
2. Header compacto + wnav `‹/›`.
3. Mb-cron horizontal (3 dias).
4. Mb-vol 2x2.
5. Mb-prod (cards empilhados).
6. Mb-ins e Mb-ent empilhados.
7. Bottom nav (Semana / Produção / Expedição / Mais ▾).

### Diferenças por estado

| Elemento | A (pré-corte) | B (pós-corte) | C (pós-quinta) |
|---|---|---|---|
| Eyebrow | "em curso · estimativa" | "em curso" | "concluída" |
| Cards de volume | Prefixo `~`, opacidade .78, cor warm-500 | Definitivo, brand-800 | Definitivo + linha de delta |
| Banner de topo | "Estimativa. Confirmação no corte de terça 12h." (warm-100) | sem banner | "Semana concluída. 82/82 ✓" + link "abrir Semana 15 →" (success-bg) |
| Coluna tabela | Pães / Receitas / Massa / Levain (sem "Etapa agora") | + coluna "Etapa agora" | troca Pães/Receitas por Previsto/Realizado/Δ |
| Cronograma | hoje destacado em SEG ou TER | hoje em QUA ou QUI | todos com `✓` |
| Card de Entregas | counts com `~` | counts definitivos | counts `n/total ✓` |

### Estado `rascunho`

Renderiza como Estado A **com banner amarelo no topo**:

> ⚠ Semana ainda não publicada. **Abrir semana →**

Botão chama `popular_cardapio_padrao(:id)` e atualiza `semanas.status = 'aberta'`. Pós-update, refetch.

---

## 12. Modal de Criação de Semana

Acionado via botão "+ Nova" no header do `SemanaDetalhe` (ou via empty state quando não há nenhuma semana).

### UX

Modal centralizado (não bottom-sheet — backoffice é principalmente desktop).

Campos:
- **`data_entrega`** — date picker, default = `proximaQuinta()`.

Tudo derivado:
- `numero`, `ano`: via ISO week da `data_entrega`.
- `data_inicio`: segunda da mesma semana ISO.
- `data_fim`: domingo.
- `data_corte`: terça 12h00 (America/Sao_Paulo) da mesma semana.
- `status`: `'rascunho'` no INSERT.

Preview abaixo do date picker:
> Semana 22 · 25 mai a 31 mai · corte ter 26 mai 12h · entrega qui 28 mai

### Submit

1. INSERT em `semanas` com `status='rascunho'`.
2. Fechar modal.
3. `navigate(`/semanas/${novoId}`)`.

Constraint `UNIQUE (numero, ano)` → se Hugo tentar criar semana duplicada, exibir erro toast: "Semana X de YYYY já existe."

`popular_cardapio_padrao()` **não roda aqui** — roda só quando Hugo clica "Abrir semana" no banner amarelo do rascunho. Separa intenção de "criar lugar" e "abrir operação".

---

## 13. Sub-tela de Cardápio — `/semanas/:id/cardapio`

Aba dentro do detalhe com URL própria para deep-link.

### Sketch (textual)

```
┌─────────────────────────────────────────────────────────────┐
│ ← Voltar pra Semana 14                                      │
│                                                             │
│ CARDÁPIO · Semana 14                                        │
│ 30 mar — 5 abr 2026                                         │
│                                                             │
│ ┌─ Base e fixos (sempre presentes) ─────────────────────┐ │
│ │ ● Pão Original          R$ 27.00                       │ │
│ │ ● Pão Integral          R$ 29.00                       │ │
│ │   trancado nesta tela. edite via Receitas →            │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ Rotativos (selecione 1 ou mais) ─────────────────────┐ │
│ │ [ ] Multigrãos          R$ 32.00                       │ │
│ │ [x] Focaccia Genovesa   R$ 22.00                       │ │
│ │ [ ] Brioche             R$ 32.00                       │ │
│ │ [ ] Ciabatta Rústica    R$ 25.00                       │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│                            [ Cancelar ] [ Publicar →  ]    │
└─────────────────────────────────────────────────────────────┘
```

### Carregamento

Hook `useSemanaCardapio(id)`:

```typescript
const { data: produtos } = await supabase
  .from('produtos')
  .select('id, slug, nome, preco_avulso, tipo_cardapio')
  .eq('ativo', true)
  .not('preco_avulso', 'is', null)
  .order('tipo_cardapio')
  .order('nome');

const { data: cardapioAtual } = await supabase
  .from('cardapios')
  .select('produto_id')
  .eq('semana_id', semanaId);

// Estado local: Set<produto_id> dos rotativos marcados
const marcados = new Set(
  produtos
    .filter(p => p.tipo_cardapio === 'rotativo')
    .filter(p => cardapioAtual.some(c => c.produto_id === p.id))
    .map(p => p.id)
);
```

### Publicar

Em ordem:

1. **Diff** os rotativos: `paraInserir = marcados - jaNoBanco`, `paraDeletar = jaNoBanco - marcados`.
2. Para cada `produto_id` em `paraInserir`:
   ```typescript
   await supabase.from('cardapios').insert({
     semana_id: semanaId,
     produto_id,
     tipo: 'rotativo',
     preco_avulso: produto.preco_avulso,  // snapshot
   });
   ```
3. Para cada `produto_id` em `paraDeletar`:
   ```typescript
   await supabase.from('cardapios').delete()
     .eq('semana_id', semanaId)
     .eq('produto_id', produto_id);
   ```
4. Se `semanas.status = 'aberta'`, atualizar para `'congelada'`:
   ```typescript
   await supabase.from('semanas').update({ status: 'congelada' }).eq('id', semanaId);
   ```
5. Navegar para `/semanas/:id`.

**Sem transação** no MVP. Se um INSERT falhar no meio, mostrar toast com erro e deixar Hugo retomar — operação é idempotente (publicar de novo recalcula o diff).

### Cancelar

Botão "Cancelar" descarta o diff local (rotativos marcados/desmarcados na sessão) e navega para `/semanas/:id` sem operação no banco. Não pede confirmação — undo é só voltar e re-marcar.

### Comentário obrigatório no código

No topo de `SemanaCardapio.tsx`:

```typescript
/**
 * PROVISÓRIO — Fase 1
 *
 * Esta sub-tela de cardapio vive aqui porque o modulo Planejamento completo
 * so entra na Fase 3/4. Quando Planejamento existir como modulo separado
 * (rota /planejamento), esta seçao é removida e substituida por link
 * "Editar cardápio →" pra /planejamento/:semana_id.
 *
 * Briefing original: Docs/CORA_Briefing_Backoffice_Fase1_Schema_v3.md (Decisao #1)
 * Briefing técnico: Docs/CORA_Briefing_Backoffice_Fase1_Etapa1_Semana_v3.md (§13)
 * Wireframe definitivo do Planejamento: Planejamento_wireframes_v2.html (Fase 3/4)
 */
```

---

## 14. Queries Supabase

Bloco de referência. Implementação real pode agregar várias dentro de hooks. Tipagem vem de `src/lib/database.types.ts` (re-gerar via `npm run db:types` após aplicar 0015).

### Q1. Semana corrente

```typescript
const { data: semana, error } = await supabase
  .from('semanas')
  .select('*')
  .eq('id', id)
  .single();
// error: 'PGRST116' (no rows) → redirect /semanas/atual
```

### Q2. Vizinhança (para nav ‹/›)

```typescript
const { data: anterior } = await supabase
  .from('semanas')
  .select('id')
  .lt('data_entrega', semana.data_entrega)
  .order('data_entrega', { ascending: false })
  .limit(1)
  .maybeSingle();

const { data: proxima } = await supabase
  .from('semanas')
  .select('id')
  .gt('data_entrega', semana.data_entrega)
  .order('data_entrega', { ascending: true })
  .limit(1)
  .maybeSingle();
```

Botões desabilitados se `null`.

### Q3. Planejamento (volume e tabela de produção)

```typescript
// View agregada
const { data: planejamento } = await supabase
  .from('planejamento_semana')
  .select('slug, qty_total, qty_recorrente_base, qty_recorrente_extra, qty_pontual')
  .eq('semana_id', semana.id);

// Enriquecer com produtos + receitas + versão ativa (peso_massa_g)
const slugs = planejamento?.map(p => p.slug) ?? [];

const { data: produtos } = await supabase
  .from('produtos')
  .select(`
    id,
    slug,
    nome,
    formato,
    peso_alvo_g,
    receitas (
      id,
      grupo_sugerido,
      versao_ativa_id,
      versoes_receita!receitas_versao_ativa_id_fkey (
        peso_massa_g
      )
    )
  `)
  .in('slug', slugs);
```

**Atenção:** o nome do constraint `receitas_versao_ativa_id_fkey` é placeholder — confirmar via introspection. Se Supabase não permitir `select` aninhado por FK específica, alternativa: 3 queries separadas e join no client.

**Cálculo derivado no client:**
```typescript
const linhas = planejamento.map(p => {
  const prod = produtos.find(x => x.slug === p.slug)!;
  const receita = prod.receitas[0];               // 1:1 fabricado→receita
  const pesoMassaG = receita.versoes_receita.peso_massa_g;
  const qty = p.qty_total;
  const massaTotalG = pesoMassaG * qty;
  const levainG = Math.round(massaTotalG * 0.10); // 10% — heurística MVP

  return {
    slug: p.slug,
    nome: prod.nome,
    formato: prod.formato,
    grupo: receita.grupo_sugerido,            // 1, 2, 3 → "G1", "G2", "G3" no render
    qty,
    qtyBase: p.qty_recorrente_base + p.qty_recorrente_extra,
    qtyPontual: p.qty_pontual,
    massaTotalG,
    levainG,
  };
});
```

Caption "X base + Y pontuais" só quando `qtyPontual > 0`.

Footer da tabela: soma de qty, massa, levain.

### Q4. Insumos

```typescript
const { data: insumos } = await supabase
  .from('ingredientes')
  .select('slug, nome, unidade, quantidade_atual_g, quantidade_minima_g')
  .order('nome');

const alertas = insumos.filter(i =>
  i.quantidade_atual_g != null &&
  i.quantidade_minima_g != null &&
  i.quantidade_atual_g < i.quantidade_minima_g
);
const okCount = insumos.length - alertas.length;
```

**Critério crit vs warn:**
- `quantidade_atual_g === 0` → crit (vermelho, "abaixo do mínimo. pede hoje.")
- `quantidade_atual_g > 0 AND < quantidade_minima_g` → warn (amarelo)

Sem cruzamento com `mise_en_place_semana()` nesta etapa.

### Q5. Entregas por bairro

```typescript
// Pedidos confirmados da semana (assume FK weekly_orders.subscription_id)
const { data: ordens } = await supabase
  .from('weekly_orders')
  .select(`
    subscriptions!inner (
      cidade,
      bairro
    )
  `)
  .eq('status', 'confirmado')
  .eq('delivery_date', semana.data_entrega);

// Bairros atendidos (whitelist)
const { data: bairrosAtendidos } = await supabase
  .from('bairros_atendidos')
  .select('cidade, bairro')
  .eq('ativo', true);
```

**Agregação no client:**

Display da grafia segue regra: **bairros na whitelist exibem a grafia oficial cadastrada em `bairros_atendidos`** (consistência visual). **Bairros fora dela exibem a grafia vinda de `subscriptions.bairro`** (que vem do ViaCEP). Agrupamento normaliza via `normalize()` pra evitar duplicação por case/acento.

```typescript
import { normalize } from '@/lib/normalize';

// Map de chave normalizada → grafia oficial da whitelist
const grafiaOficial = new Map<string, { cidade: string; bairro: string }>();
for (const b of bairrosAtendidos) {
  const key = `${normalize(b.cidade)}|${normalize(b.bairro)}`;
  grafiaOficial.set(key, { cidade: b.cidade, bairro: b.bairro });
}

// Set para checar pertinência rápido
const whitelist = new Set(grafiaOficial.keys());

// Contar pedidos por cidade+bairro; primeira ocorrência define display
type Acc = { cidade: string; bairro: string; count: number };
const contagem = new Map<string, Acc>();
for (const o of ordens) {
  const sub = (o as any).subscriptions;          // tipar via database.types
  const key = `${normalize(sub.cidade)}|${normalize(sub.bairro)}`;
  const ja = contagem.get(key);
  if (ja) {
    ja.count++;
  } else {
    // Whitelist tem prioridade pra grafia; fora dela usa o que veio do assinante.
    const display = grafiaOficial.get(key) ?? { cidade: sub.cidade, bairro: sub.bairro };
    contagem.set(key, { ...display, count: 1 });
  }
}

// Agrupar por cidade, marcar fora-da-lista
type BairroAgregado = { nome: string; count: number; foraDaLista: boolean };
const porCidade = new Map<string, BairroAgregado[]>();
for (const { cidade, bairro, count } of contagem.values()) {
  const key = `${normalize(cidade)}|${normalize(bairro)}`;
  const arr = porCidade.get(cidade) ?? [];
  arr.push({ nome: bairro, count, foraDaLista: !whitelist.has(key) });
  porCidade.set(cidade, arr);
}
```

Cidades não-whitelisted (improvável no MVP, mas possível se ViaCEP retornar grafia diferente) ficam agrupadas pelo `subscriptions.cidade` literal — útil pra Hugo notar inconsistência.

### Q6. Etapa agora (Estado B, coluna da tabela)

Só roda se `estado === 'B'`.

**Cadeia de joins real** (validada contra migration 0012):

```
producoes
  ├─ status: producao_status_enum ('planejada' | 'em_curso' | 'concluida' | 'cancelada')
  ├─ versao_receita_id → versoes_receita
  │                       └─ receita_id → receitas
  │                                        └─ produto_id → produtos.slug
  └─ etapas_producao (1:N)
       ├─ etapa_receita_id → etapas_receita
       │                      └─ nome (ex: "Mistura", "Dobra 1", "Coccao")
       ├─ tipo: etapa_tipo_enum
       ├─ iniciada_at, concluida_at
       └─ ordem
```

```typescript
const { data: producoes } = await supabase
  .from('producoes')
  .select(`
    id,
    status,
    versao_receita_id,
    versoes_receita!inner (
      receitas!inner (
        produtos!inner (slug)
      )
    ),
    etapas_producao (
      ordem,
      tipo,
      iniciada_at,
      concluida_at,
      etapa_receita_id,
      etapas_receita!inner (
        nome
      )
    )
  `)
  .eq('semana_id', semana.id);
```

Confirmar nomes exatos dos constraints via introspection antes da query (briefing pré-Q6 já alerta o padrão defensivo). Se Supabase não permitir nested select pela FK, alternativa é 4 queries separadas com `.in()` e join no client.

**Derivação por slug** (no client):

```typescript
type EtapaAgora = { label: string; ha: string | null; tom: 'brand' | 'warm' | 'mute' };

function etapaAgora(prod: any | null): EtapaAgora {
  if (!prod) return { label: 'aguardando', tom: 'mute', ha: null };
  if (prod.status !== 'em_curso') return { label: 'aguardando', tom: 'mute', ha: null };

  // Etapa "ao vivo": iniciada_at < 2h, concluida_at IS NULL
  const recente = prod.etapas_producao
    .filter((e: any) => e.concluida_at == null && e.iniciada_at != null)
    .filter((e: any) => Date.now() - new Date(e.iniciada_at).getTime() < 2 * 60 * 60 * 1000)
    .sort((a: any, b: any) => b.iniciada_at.localeCompare(a.iniciada_at))[0];

  if (recente) {
    const minutos = Math.floor((Date.now() - new Date(recente.iniciada_at).getTime()) / 60000);
    return {
      label: recente.etapas_receita.nome,
      ha: formatHa(minutos),         // "há 12 min", "há 1h20"
      tom: 'brand',
    };
  }

  return { label: 'em produção', ha: null, tom: 'warm' };
}

// Indexar por slug pra render rápido na tabela
const etapasPorSlug = new Map<string, EtapaAgora>();
for (const p of producoes ?? []) {
  const slug = p.versoes_receita.receitas.produtos.slug;
  etapasPorSlug.set(slug, etapaAgora(p));
}
```

Antes de Etapa 2 popular dados, sempre retorna `'aguardando'`. Esperado.

---

## 15. Mobile

Breakpoint: `max-width: 768px` (Tailwind `md:` invertido) → renderiza variante mobile.

### Bottom nav

```tsx
<nav className="mb-bot">
  <NavLink to="/semanas/atual">Semana</NavLink>
  <NavLink to="/producao" disabled>Produção</NavLink>
  <NavLink to="/expedicao" disabled>Expedição</NavLink>
  <button onClick={() => setMaisAberto(true)}>Mais ▾</button>
</nav>
```

"Produção" e "Expedição" desabilitados nesta etapa (Etapa 2+). Visual cinza, sem navegação.

### Drawer "Mais ▾"

Drawer lateral direito (não bottom-sheet). Lista:
- Planejamento (em breve, com tooltip — ver Decisão #3)
- Receitas (em breve)
- Configurações (em breve)

Hugo pode fechar tocando fora do drawer ou no header do próprio drawer.

---

## 16. Critério de pronto

Para mergear `fase-1-semana` em `main`:

1. **Migration 0015 aplicada** em `kjzuvmhedicxbuynfqev`. `npm run db:push` sem erro. `bairros_atendidos` tem 6 rows seedadas.
2. **`npm run db:types`** atualizado e commitado (`database.types.ts` deve ter `bairros_atendidos`).
3. **Criar semana 22** via modal: input `data_entrega = qui 28 mai 2026`. Sistema deriva: `data_inicio = seg 25 mai`, `data_corte = ter 26 mai 12h00 (America/Sao_Paulo)`, `data_fim = dom 31 mai`, `numero = 22`, `ano = 2026`. Verifica:
   - INSERT em `semanas` com `status='rascunho'`.
   - Redirect pra `/semanas/<uuid>`.
   - Render como Estado A com banner amarelo de rascunho.
4. **Abrir semana**: clicar "Abrir semana" no banner roda `popular_cardapio_padrao()` e atualiza `status='aberta'`. Verifica:
   - INSERTs em `cardapios` (Original + Integral, tipo `base`).
   - Banner some.
5. **Publicar cardápio** com 1 rotativo (Focaccia). Verifica:
   - INSERT em `cardapios` (Focaccia, tipo `rotativo`).
   - `semanas.status = 'congelada'`.
6. **Inserir 2 weekly_orders manuais** apontando para a semana (delivery_date alinhado, status='confirmado', composition `{"original": 2}` e `{"integral": 1}`). Verifica:
   - View `planejamento_semana` retorna 2 linhas (slugs original e integral).
   - Tabela de produção renderiza com qty correta.
   - Massa e levain calculados.
7. **Inserir 1 pedido_pontual** confirmado com composicao `{"original": 1}`. Verifica:
   - Caption "X base + 1 pontual" aparece na linha Original.
   - Card de Entregas NÃO inclui esse pedido (só weekly_orders).
8. **Inserir subscription com bairro 'Pendotiba'** (fora da whitelist). Verifica:
   - Card de Entregas mostra Pendotiba em amarelo.
9. **Nav `‹/›`** funciona entre semana 22 e (se criada) semana 23. Botão desabilitado nos extremos.
10. **Mobile (375px)** renderiza sem quebras horizontais. Bottom nav visível e fixo.
11. **Vercel Preview** do PR builda sem erro e abre `admin.acora.com.br` (preview URL) com auth e dashboard funcionais.
12. Portal continua funcionando (login + dashboard) — smoke test rápido.
13. Commit messages **ASCII-only**. Squash merge via GitHub UI.
14. PORTAL_STATUS.md atualizado com seção "Fase 1 Etapa 1" fechada.

---

## 17. Pendências e TBDs residuais

Não bloqueiam a Etapa 1; lembrar para depois.

1. **Coluna "Etapa agora"** fica sempre `aguardando` até Etapa 2 popular `etapas_producao`. Comportamento intencional, não é bug.
2. **Pedidos pontuais não aparecem no card de Entregas.** Decisão consciente. Quando Expedição entrar, ela cuida.
3. **Whitelist Portal ↔ Backoffice:** ambas as fontes (hardcoded em `src/config/coverage.js` e `bairros_atendidos`) precisam ser mantidas sincronizadas até a Frente D do Portal refatorar. Pra evitar drift, recomendar PRs simultâneos. Listar no PORTAL_STATUS como "atenção".
4. **Schema migrations desalinhado:** `next_billing_change_date`, `next_billing_value` em `subscriptions` aplicadas fora do controle. Rodada de housekeeping em momento separado.
5. **Função `peso_farinha_por_pao()`** existe mas não é usada nesta etapa (entra na Etapa 2, Produção).
6. **Calculadora de Levain** confirmadamente fora desta etapa — vai em Etapa 2 TER.
7. **Refatoração do Portal para ler bairros do banco** = Frente D, fora desta etapa.
8. **Refatoração `data_corte` parametrizável** se Hugo quiser cortar em horário diferente — adiar até virar dor real.
9. **Grupos G1/G2/G3** ainda placeholder; validação com `/master-baker` em rodada separada.
10. **Cálculo de levain** (`Math.round(massaTotalG * 0.10)` em §14 Q3) é heurística MVP. Refinar quando produção real começar (jun/2026). Possível evolução: coluna `levain_pct numeric` em `versoes_receita`, lida na query enriquecida; assim cada receita carrega seu próprio percentual.

---

## 18. Anexos referenciados

- `Docs/CORA_Briefing_Backoffice_Fase1_Schema_v3.md` — schema completo da Fase 1.
- `Docs/wireframes/semana/Cora_Backoffice_-_Semana_wireframes_v5.html` — wireframe canônico (3 estados × 2 plataformas).
- `Docs/CORA_Backoffice_Spec_Consolidada_v2.md` — spec geral do Backoffice.
- `Docs/CORA_Design_System_v1.md` — tokens visuais, anti-padrões.
- `Docs/CORA_Zoneamento_Entregas_v1.md` — referência futura para zonas (Expedição).
- `cora-portal/src/utils/normalize.js` — fonte do `normalize.ts` portado.
- `cora-portal/src/config/coverage.js` — fonte do seed da `bairros_atendidos`.
- `PORTAL_STATUS.md` (raiz) — estado vivo; atualizar ao fechar a Etapa 1.

---

## 19. Princípios reforçados

- **"Evolve, don't revolutionize."** A sub-tela de cardápio é provisória, marcada explicitamente. Não inventar abstração que vai virar dívida.
- **YAGNI sobre listagem de semanas.** Nav `‹/›` cobre o uso real. Se virar dor, lista entra.
- **Schema gerenciado só pelo Backoffice.** Toda alteração de schema passa por migration aqui. A 0015 segue esse padrão. `bairros_atendidos` é consumida pelo Portal via leitura — não escreve.
- **Cruzar no client é mais simples que view nova.** Para o MVP, joins manuais no cliente reduzem migrations e mantêm o schema enxuto.
- **Question premises.** Se durante a implementação algo deste briefing parecer errado, parar e perguntar — não improvisar.

---

*Briefing técnico · Backoffice Fase 1 Etapa 1 · Módulo Semana · v3 · Maio 2026*

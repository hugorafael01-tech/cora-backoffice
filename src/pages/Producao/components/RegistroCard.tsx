import { Fragment, useState } from 'react';
import { grupoLabel } from '../../../lib/semana';
import { formataHoraSp } from '../../../lib/date';
import {
  calcDelta,
  duracaoMin,
  etapaTipoLabel,
  fmtDeltaPct,
  fmtDeltaUn,
  fmtDuracaoMin,
  fmtTempC,
  lerDobras,
  producaoStatusLabel,
  resumoDobras,
} from '../../../lib/producao';
import type {
  ContextoProducaoInput,
  RealizadoProducao,
} from '../../../lib/producaoActions';
import type { EtapaAcomp, EtapaStatus, ProducaoAcomp, ProducaoStatus } from '../types';

interface Props {
  producao: ProducaoAcomp;
  aberta: boolean;
  onToggle: () => void;
  salvando: string | null; // chave ("realizado:{id}" / "contexto:{id}") em escrita
  onSalvarRealizado: (producaoId: string, campos: RealizadoProducao) => void;
  onSalvarContexto: (producaoId: string, campos: ContextoProducaoInput) => void;
}

/** "" -> null; senao Number (NaN vira null). Aceita virgula. */
function parseNum(s: string): number | null {
  const t = s.trim();
  if (t === '') return null;
  const n = Number(t.replace(',', '.'));
  return Number.isNaN(n) ? null : n;
}

/** Numero do banco -> string do input (virgula decimal na UI). '' se nulo. */
function numParaInput(v: number | null): string {
  return v == null ? '' : String(v).replace('.', ',');
}

/** Numero pt-BR pra exibicao read-only (ate 3 casas). Travessao se nulo. */
function fmtNum(v: number | null, casas = 3): string {
  if (v == null) return '—';
  return v.toLocaleString('pt-BR', { maximumFractionDigits: casas });
}

function detNum(det: Record<string, unknown>, key: string): number | null {
  const v = det[key];
  return typeof v === 'number' ? v : null;
}

function detStr(det: Record<string, unknown>, key: string): string | null {
  const v = det[key];
  return typeof v === 'string' && v !== '' ? v : null;
}

function chipClasse(status: ProducaoStatus): string {
  if (status === 'em_curso') return 'border-brand-200 bg-brand-50 text-brand-600';
  if (status === 'concluida') return 'border-success-border bg-success-bg text-success-text';
  return 'border-warm-300 bg-warm-100 text-warm-600'; // planejada
}

function etapaStatusLabel(status: EtapaStatus): string {
  if (status === 'em_curso') return 'em curso';
  if (status === 'concluida') return 'concluída';
  if (status === 'pulada') return 'pulada';
  return 'aguardando';
}

const INPUT =
  'min-h-[36px] w-full rounded border border-warm-300 bg-white px-2.5 text-[13px] tabular-nums text-warm-800 placeholder:text-warm-400 focus:border-brand-300 focus:outline-none disabled:cursor-not-allowed disabled:bg-warm-100 disabled:text-warm-400';
const BTN_SALVAR =
  'min-h-[36px] rounded-md bg-brand-500 px-4 font-display text-[12px] uppercase tracking-[0.04em] text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-warm-200 disabled:text-warm-400';
const TITULO_BLOCO =
  'font-display text-[11px] font-semibold uppercase tracking-[0.06em] text-warm-700';

/**
 * Card do Registro (Estado C / fatia 1), por producao:
 *  1a. previsto x realizado (escreve em producoes, update parcial so com os
 *      campos editados; editavel com producao em_curso OU concluida)
 *  1b. retrospectiva read-only da execucao (etapas, capturas, duracoes —
 *      vazio mostra travessao, nao some: "esqueci de registrar" e informacao)
 *  1c. nota pos-producao (upsert parcial em contextos_producao.notas)
 */
export function RegistroCard({
  producao,
  aberta,
  onToggle,
  salvando,
  onSalvarRealizado,
  onSalvarContexto,
}: Props) {
  const realizadoBusy = salvando === `realizado:${producao.id}`;
  const contextoBusy = salvando === `contexto:${producao.id}`;

  // Strings locais dos inputs (virgula/trailing). Reseed quando o valor salvo
  // muda POR FORA (refetch pos-save / edicao em outra aba) — padrao LevainCard.
  const [qtyStr, setQtyStr] = useState(numParaInput(producao.qtyRealizada));
  const [massaStr, setMassaStr] = useState(numParaInput(producao.massaRealizadaKg));
  const [levainStr, setLevainStr] = useState(numParaInput(producao.levainConsumidoKg));
  const [notas, setNotas] = useState(producao.notasProducao ?? '');
  const [prev, setPrev] = useState(producao);
  if (producao !== prev) {
    setPrev(producao);
    if (parseNum(qtyStr) !== producao.qtyRealizada) setQtyStr(numParaInput(producao.qtyRealizada));
    if (parseNum(massaStr) !== producao.massaRealizadaKg)
      setMassaStr(numParaInput(producao.massaRealizadaKg));
    if (parseNum(levainStr) !== producao.levainConsumidoKg)
      setLevainStr(numParaInput(producao.levainConsumidoKg));
    if (notas.trim() !== (producao.notasProducao ?? '')) setNotas(producao.notasProducao ?? '');
  }

  // Gate: a massa realizada se sabe na divisao, nao no fim — em_curso ja edita.
  const editavel = producao.status === 'em_curso' || producao.status === 'concluida';

  const qty = parseNum(qtyStr);
  const massa = parseNum(massaStr);
  const levain = parseNum(levainStr);

  // Update parcial: SO os campos que diferem do salvo entram no payload.
  const campos: RealizadoProducao = {};
  if (qty !== producao.qtyRealizada) campos.qtyPaesRealizada = qty;
  if (massa !== producao.massaRealizadaKg) campos.massaRealizadaKg = massa;
  if (levain !== producao.levainConsumidoKg) campos.levainConsumidoKg = levain;
  const temMudanca = Object.keys(campos).length > 0;

  const notasSalvas = producao.notasProducao ?? '';
  const notasMudou = notas.trim() !== notasSalvas;

  const duracaoTotal = duracaoMin(producao.iniciadaAt, producao.concluidaAt);

  const linhas: {
    label: string;
    previsto: number | null;
    valor: string;
    setValor: (s: string) => void;
    realizado: number | null;
    deltaUn: boolean;
  }[] = [
    {
      label: 'Pães (un)',
      previsto: producao.qtyPrevista,
      valor: qtyStr,
      setValor: setQtyStr,
      realizado: qty,
      deltaUn: true,
    },
    {
      label: 'Massa (kg)',
      previsto: producao.massaPrevistaKg,
      valor: massaStr,
      setValor: setMassaStr,
      realizado: massa,
      deltaUn: false,
    },
    {
      label: 'Levain (kg)',
      previsto: producao.levainPrevistoKg,
      valor: levainStr,
      setValor: setLevainStr,
      realizado: levain,
      deltaUn: false,
    },
  ];

  return (
    <div className="overflow-hidden rounded-md border border-warm-300 bg-white">
      <button
        onClick={onToggle}
        aria-expanded={aberta}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-warm-50 md:px-5"
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[16px] font-semibold text-warm-800">{producao.nome}</span>
          {producao.rascunho ? (
            <span className="rounded border border-warm-300 bg-white px-1.5 py-0.5 text-[11px] font-medium text-warm-500">
              rascunho
            </span>
          ) : (
            <span className="rounded border border-warm-300 bg-warm-100 px-1.5 py-0.5 text-[11px] font-medium text-warm-600">
              {grupoLabel(producao.grupo)}
            </span>
          )}
          <span
            className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${chipClasse(
              producao.status
            )}`}
          >
            {producaoStatusLabel(producao.status)}
          </span>
        </span>
        <span className="flex items-center gap-3 text-[12.5px] tabular-nums text-warm-500">
          {producao.qtyPrevista != null && <span>{producao.qtyPrevista} un</span>}
          {duracaoTotal != null && <span>{fmtDuracaoMin(duracaoTotal)}</span>}
          <span className="text-warm-300">{aberta ? '▾' : '▸'}</span>
        </span>
      </button>

      {aberta && (
        <div className="space-y-4 border-t border-warm-200 px-4 pb-4 pt-3 md:px-5">
          {/* 1a. Previsto x realizado */}
          <div>
            <div className="mb-2 flex flex-wrap items-baseline gap-2">
              <span className={TITULO_BLOCO}>Previsto x realizado</span>
              {!editavel && (
                <span className="text-[12px] text-warm-500">
                  Inicie a produção para registrar
                </span>
              )}
            </div>

            <div className="grid grid-cols-[auto_1fr_1fr_1fr] items-center gap-x-3 gap-y-1.5 text-[13px]">
              <span />
              <span className="text-[11px] uppercase tracking-[0.04em] text-warm-500">
                previsto
              </span>
              <span className="text-[11px] uppercase tracking-[0.04em] text-warm-500">
                realizado
              </span>
              <span className="text-[11px] uppercase tracking-[0.04em] text-warm-500">delta</span>

              {linhas.map((l) => {
                const delta = calcDelta(l.previsto, l.realizado);
                return (
                  <Fragment key={l.label}>
                    <span className="text-warm-600">{l.label}</span>
                    <span className="tabular-nums text-warm-800">{fmtNum(l.previsto)}</span>
                    <input
                      className={INPUT}
                      inputMode="decimal"
                      value={l.valor}
                      onChange={(e) => l.setValor(e.target.value)}
                      disabled={!editavel}
                      aria-label={`${l.label} realizado`}
                      placeholder="—"
                    />
                    <span className="tabular-nums text-warm-700">
                      {delta == null ? (
                        '—'
                      ) : (
                        <>
                          {l.deltaUn && l.previsto != null && l.realizado != null && (
                            <>
                              {fmtDeltaUn(l.previsto, l.realizado)}
                              <span className="text-warm-300"> · </span>
                            </>
                          )}
                          {fmtDeltaPct(delta)}
                        </>
                      )}
                    </span>
                  </Fragment>
                );
              })}
            </div>

            {editavel && (
              <div className="mt-2.5 flex justify-end">
                <button
                  onClick={() => onSalvarRealizado(producao.id, campos)}
                  disabled={realizadoBusy || !temMudanca}
                  className={BTN_SALVAR}
                >
                  {realizadoBusy ? 'Salvando…' : 'Salvar realizado'}
                </button>
              </div>
            )}
          </div>

          {/* 1b. Retrospectiva (read-only — capturado no Acompanhamento/B1) */}
          <div>
            <div className="mb-2 flex flex-wrap items-baseline gap-2">
              <span className={TITULO_BLOCO}>Retrospectiva</span>
              <span className="text-[12px] text-warm-500">
                duração total {duracaoTotal != null ? fmtDuracaoMin(duracaoTotal) : '—'}
                <span className="mx-1.5 text-warm-300">·</span>
                hidratação ajustada{' '}
                {producao.hidratacaoAjustadaPct != null
                  ? `${fmtNum(producao.hidratacaoAjustadaPct, 1)}%`
                  : '—'}
              </span>
            </div>

            {producao.etapas.length === 0 ? (
              <p className="text-[13px] text-warm-500">Sem etapas geradas.</p>
            ) : (
              <ol className="space-y-1">
                {producao.etapas.map((e) => (
                  <EtapaRegistroRow key={e.id} etapa={e} />
                ))}
              </ol>
            )}
          </div>

          {/* 1c. Nota pos-producao (contextos_producao.notas) */}
          <div>
            <label className={`${TITULO_BLOCO} mb-1.5 block`} htmlFor={`notas-${producao.id}`}>
              Notas da produção
            </label>
            <textarea
              id={`notas-${producao.id}`}
              className="min-h-[64px] w-full rounded border border-warm-300 bg-white px-2.5 py-1.5 text-[13px] text-warm-800 placeholder:text-warm-400 focus:border-brand-300 focus:outline-none"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="como foi essa produção? o que mudar na próxima?"
            />
            <div className="mt-2 flex justify-end">
              <button
                onClick={() =>
                  onSalvarContexto(producao.id, { notas: notas.trim() === '' ? null : notas.trim() })
                }
                disabled={contextoBusy || !notasMudou}
                className={BTN_SALVAR}
              >
                {contextoBusy ? 'Salvando…' : 'Salvar nota'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Linha read-only da retrospectiva: ordem, tipo, status final, duracao e as
 * capturas do B1 (temp/dobras/detalhes/notas). Campo relevante vazio mostra
 * travessao — o vazio e informacao, nao se esconde a linha.
 */
function EtapaRegistroRow({ etapa }: { etapa: EtapaAcomp }) {
  const dur = duracaoMin(etapa.iniciadaAt, etapa.concluidaAt);
  const pulada = etapa.status === 'pulada';

  const capturas: { node: React.ReactNode; nowrap: boolean }[] = [];
  const tipo = etapa.tipo;

  if (tipo === 'autolise_mistura' || tipo === 'batimento' || tipo === 'pre_shape') {
    capturas.push({
      node: <>temp da massa {etapa.tempC != null ? fmtTempC(etapa.tempC) : '—'}</>,
      nowrap: true,
    });
  }
  if (tipo === 'dobra') {
    const dobras = lerDobras(etapa.detalhes);
    capturas.push({ node: <>{resumoDobras(dobras) ?? 'dobras —'}</>, nowrap: true });
  }
  if (tipo === 'coccao') {
    const det = etapa.detalhes;
    const qty = detNum(det, 'qty_paes');
    const base = detNum(det, 'base_c');
    const teto = detNum(det, 'teto_c');
    const durMin = detNum(det, 'duracao_min');
    const fornadaNum = detNum(det, 'fornada_num');
    const fornadaTotal = detNum(det, 'fornada_total');
    capturas.push(
      { node: <>{qty != null ? `${qty} pães` : 'pães —'}</>, nowrap: true },
      { node: <>base {base != null ? fmtTempC(base) : '—'}</>, nowrap: true },
      { node: <>teto {teto != null ? fmtTempC(teto) : '—'}</>, nowrap: true },
      { node: <>{durMin != null ? fmtDuracaoMin(durMin) : 'duração —'}</>, nowrap: true },
      {
        node: (
          <>
            fornada{' '}
            {fornadaNum != null ? `${fornadaNum}${fornadaTotal != null ? `/${fornadaTotal}` : ''}` : '—'}
          </>
        ),
        nowrap: true,
      }
    );
  }
  if (tipo === 'shape') {
    const peso = detNum(etapa.detalhes, 'peso_medio_g');
    const recipiente = detStr(etapa.detalhes, 'recipiente');
    capturas.push(
      { node: <>peso médio {peso != null ? `${fmtNum(peso, 0)} g` : '—'}</>, nowrap: true },
      { node: <>{recipiente ?? 'recipiente —'}</>, nowrap: true }
    );
  }
  if (etapa.notas) {
    capturas.push({ node: <span className="text-warm-600">{etapa.notas}</span>, nowrap: false });
  }

  return (
    <li
      className={`rounded border border-warm-200 px-3 py-2 ${pulada ? 'bg-warm-50' : 'bg-white'}`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded bg-warm-100 text-[11px] tabular-nums text-warm-500">
          {etapa.ordem}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`font-medium ${pulada ? 'text-warm-500' : 'text-warm-800'}`}>
              {etapaTipoLabel(etapa.tipo)}
            </span>
            <span className="text-[11px] uppercase tracking-[0.04em] text-warm-500">
              {etapaStatusLabel(etapa.status)}
            </span>
          </div>
          <div className="mt-0.5 text-[12px] leading-snug text-warm-500">
            <span className="whitespace-nowrap">
              {etapa.iniciadaAt ? `iniciada ${formataHoraSp(etapa.iniciadaAt)}` : 'iniciada —'}
            </span>
            <span className="text-warm-300"> · </span>
            <span className="whitespace-nowrap">
              {etapa.concluidaAt ? `concluída ${formataHoraSp(etapa.concluidaAt)}` : 'concluída —'}
            </span>
            <span className="text-warm-300"> · </span>
            <span className="whitespace-nowrap">{dur != null ? fmtDuracaoMin(dur) : '—'}</span>
            {capturas.map((c, i) => (
              <Fragment key={i}>
                <span className="text-warm-300"> · </span>
                <span className={c.nowrap ? 'whitespace-nowrap' : undefined}>{c.node}</span>
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </li>
  );
}

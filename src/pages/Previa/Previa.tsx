import { useMemo, useState } from 'react';
import { usePrevia } from '../../hooks/usePrevia';
import { gerarCobrancas, type GerarResultado } from '../../lib/gerarCobrancas';
import { mesAnterior, reais } from '../../lib/previa';
import { Shell } from '../Semana/components/Shell';
import { AlertasPainel } from './components/AlertasPainel';
import { GrupoCard } from './components/GrupoCard';
import { ResultadoGeracao } from './components/ResultadoGeracao';
import { opcoesDePeriodo, periodoPadrao, rotuloPeriodo } from './periodo';
import { PESO_POR_CODIGO, type RespostaGeracao } from './types';

export function Previa() {
  const padrao = useMemo(() => periodoPadrao(new Date()), []);
  const [periodo, setPeriodo] = useState(padrao);
  const { previa, loading, error } = usePrevia(periodo);

  const [gerando, setGerando] = useState(false);
  const [resultado, setResultado] = useState<RespostaGeracao | null>(null);
  const [falha, setFalha] = useState<string | null>(null);

  const bloqueios = previa
    ? previa.alertas.filter((a) => PESO_POR_CODIGO[a.codigo] === 'bloqueia').length
    : 0;

  // Trocar de período descarta o resultado: ele é de um período específico, e
  // deixá-lo na tela sob outro mês faria o Hugo ler números do mês errado.
  function trocaPeriodo(novo: string) {
    setPeriodo(novo);
    setResultado(null);
    setFalha(null);
  }

  async function gera() {
    // O botão já está desabilitado nas duas condições; isto é a segunda tranca.
    // A primeira de verdade é do servidor, que recalcula a prévia e recusa
    // sozinho — a tela nunca é a guarda.
    if (gerando || bloqueios > 0) return;
    setGerando(true);
    setFalha(null);
    const r: GerarResultado = await gerarCobrancas(periodo);
    setGerando(false);

    switch (r.tipo) {
      case 'ok':
        setResultado(r.resposta);
        return;
      case 'previa_bloqueada':
        // O servidor viu bloqueio que a tela não viu: a prévia mudou entre
        // carregar e clicar. Recarregar é o caminho, não insistir.
        setFalha(
          `O servidor recusou: ${r.alertas.length} ${
            r.alertas.length === 1 ? 'alerta bloqueia' : 'alertas bloqueiam'
          } a geração. Recarregue a prévia e resolva antes de tentar de novo.`,
        );
        return;
      case 'em_voo':
        setFalha(r.detalhe);
        return;
      case 'periodo_invalido':
        setFalha('O servidor não aceitou este período.');
        return;
      case 'unauthorized':
        setFalha('Sua sessão expirou. Entre de novo para gerar.');
        return;
      case 'erro':
        setFalha(r.detalhe);
    }
  }

  return (
    <Shell>
      <header className="px-5 pt-6 md:px-8">
        <h1 className="font-display text-[28px] tracking-wide text-ink-700">Prévia de cobrança</h1>
        <p className="text-[14px] text-warm-500">
          O que vai ser cobrado de cada pessoa, para conferir antes de gerar.
        </p>

        <label className="mt-3 flex flex-wrap items-baseline gap-2 text-[14px]">
          <span className="text-warm-500">Cobrança de</span>
          <select
            value={periodo}
            onChange={(e) => trocaPeriodo(e.target.value)}
            className="rounded-md border border-warm-200 bg-white px-2 py-1 text-ink-700"
          >
            {opcoesDePeriodo(padrao).map((p) => (
              <option key={p} value={p}>
                {rotuloPeriodo(p)}
              </option>
            ))}
          </select>
          <span className="text-[13px] text-warm-400">
            com os extras das quintas de {rotuloPeriodo(mesAnterior(periodo))}
          </span>
        </label>
      </header>

      {loading && <div className="p-8 text-warm-500">Carregando…</div>}

      {error && (
        <div className="p-8 text-danger-text">
          Não foi possível montar a prévia: {error.message}
        </div>
      )}

      {resultado && <ResultadoGeracao resposta={resultado} />}

      {previa && !loading && !error && !resultado && (
        <>
          <AlertasPainel alertas={previa.alertas} />

          {previa.grupos.length === 0 ? (
            <p className="px-5 py-6 text-warm-500 md:px-8">
              Nenhuma assinatura entra nesta cobrança.
            </p>
          ) : (
            <ul className="space-y-2 px-5 py-2 md:px-8">
              {previa.grupos.map((g) => (
                <GrupoCard key={g.pagadorId} grupo={g} />
              ))}
            </ul>
          )}

          <footer className="sticky bottom-0 border-t border-warm-200 bg-warm-50/95 px-5 py-3 backdrop-blur md:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[12px] text-warm-500">
                  {previa.grupos.length === 1 ? '1 cobrança' : `${previa.grupos.length} cobranças`}
                </div>
                <div className="font-display text-[26px] leading-none tabular-nums text-ink-700">
                  {reais(previa.totalGeral)}
                </div>
              </div>

              <div className="text-right">
                {/* Botão único e geral, nunca por linha: a geração roda o ciclo
                    inteiro de uma vez, e um botão por pessoa convidaria a gerar
                    parcial numa tela com alerta em aberto. */}
                <button
                  type="button"
                  onClick={gera}
                  disabled={gerando || bloqueios > 0}
                  className={
                    gerando || bloqueios > 0
                      ? 'cursor-not-allowed rounded-md bg-warm-200 px-4 py-2 text-[14px] text-warm-500'
                      : 'rounded-md bg-brand-500 px-4 py-2 text-[14px] text-white hover:bg-brand-600'
                  }
                >
                  {gerando ? 'Gerando…' : 'Gerar cobranças'}
                </button>
                <div className="mt-1 max-w-xs text-[12px] text-warm-400">
                  {falha ? (
                    <span className="text-danger-text">{falha}</span>
                  ) : gerando ? (
                    'Não feche esta página.'
                  ) : bloqueios > 0 ? (
                    'Resolva o que bloqueia antes de gerar.'
                  ) : (
                    'Cria as cobranças no Asaas. Não dá para desfazer pela tela.'
                  )}
                </div>
              </div>
            </div>
          </footer>
        </>
      )}
    </Shell>
  );
}

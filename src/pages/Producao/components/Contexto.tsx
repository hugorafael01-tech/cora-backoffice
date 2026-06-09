import { useMemo, useState } from 'react';
import { diasContexto } from '../../../lib/producao';
import { useContextosDia } from '../../../hooks/useContextosDia';
import { salvarContextoDia, type ContextoDiaInput } from '../../../lib/producaoActions';
import { BlocoContextoDia } from './BlocoContextoDia';

interface Props {
  semanaId: string;
  dataEntrega: string;
}

/**
 * Aba Contexto (B2b-1): contexto POR DIA do ciclo (contextos_dia) — refresh do
 * levain, temp ambiente max, notas. 3 blocos D2/D1/D0 abertos na vertical.
 * Escreve via salvarContextoDia (upsert por semana_id,dia); refetch no sucesso.
 */
export function Contexto({ semanaId, dataEntrega }: Props) {
  const { porDia, loading, error, refetch } = useContextosDia(semanaId);
  const dias = useMemo(() => diasContexto(dataEntrega), [dataEntrega]);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<number | null>(null);

  async function onSalvar(dia: number, campos: ContextoDiaInput) {
    setErroAcao(null);
    setSalvando(dia);
    try {
      await salvarContextoDia(semanaId, dia, campos);
      refetch();
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(null);
    }
  }

  // Loading-screen so no 1o load: no refetch o map persiste, entao os blocos nao
  // desmontam (preserva edits em andamento nos outros dias).
  if (loading && !porDia) {
    return <div className="px-5 py-8 text-warm-500 md:px-8">Carregando…</div>;
  }
  if (error) {
    return <div className="px-5 py-8 text-danger-text md:px-8">Erro: {error.message}</div>;
  }

  return (
    <section className="px-5 pb-10 pt-6 md:px-8">
      <div className="mb-2.5 flex flex-wrap items-center gap-3">
        <h2 className="font-display text-[13px] uppercase tracking-[0.06em] text-warm-600">
          Contexto do ciclo
        </h2>
        <span className="text-[12px] text-warm-500">
          refresh do levain · temp ambiente · notas, por dia
        </span>
      </div>

      {erroAcao && <p className="mb-3 text-[13px] text-danger-text">Erro: {erroAcao}</p>}

      <div className="space-y-3">
        {dias.map((d) => (
          <BlocoContextoDia
            key={d.dia}
            info={d}
            ctx={porDia?.get(d.dia) ?? null}
            salvando={salvando === d.dia}
            onSalvar={onSalvar}
          />
        ))}
      </div>
    </section>
  );
}

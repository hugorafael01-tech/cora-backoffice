import { useState } from 'react';
import { useContextosDia } from '../../../hooks/useContextosDia';
import { salvarTempAmbiente } from '../../../lib/producaoActions';
import { formataDiaSemanaDiaMes, ymdMenosDias } from '../../../lib/date';

interface Props {
  semanaId: string;
  dataEntrega: string;
}

/** "" -> null; senao Number (NaN vira null). Aceita virgula. */
function parseNum(s: string): number | null {
  const t = s.trim();
  if (t === '') return null;
  const n = Number(t.replace(',', '.'));
  return Number.isNaN(n) ? null : n;
}

/**
 * Temp ambiente da fermentacao (nivel de ciclo). Vive no topo do Acompanhamento
 * porque e a temp ambiente que dita o tempo de fermentacao. Armazenada em
 * contextos_dia.temp_ambiente_max_c no dia D1 (vespera da entrega). Save focado
 * (salvarTempAmbiente) que nao clobbera outras colunas; refetch no sucesso.
 */
export function TempAmbienteCiclo({ semanaId, dataEntrega }: Props) {
  const { porDia, refetch } = useContextosDia(semanaId);
  const [valor, setValor] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Cue discreto de sucesso: "salvo HH:mm" ate a proxima edicao do input.
  const [salvoEm, setSalvoEm] = useState<string | null>(null);

  // Seed do input quando a fonte carrega/muda (padrao "ajustar estado no render").
  const atual = porDia ? (porDia.get(1)?.tempAmbienteMaxC ?? null) : undefined;
  const [origem, setOrigem] = useState<number | null | undefined>(undefined);
  if (atual !== undefined && atual !== origem) {
    setOrigem(atual);
    setValor(atual != null ? String(atual) : '');
  }

  const rotuloDia = `D1 . ${formataDiaSemanaDiaMes(ymdMenosDias(dataEntrega, 1))}`;

  async function salvar() {
    setErro(null);
    setSalvando(true);
    try {
      await salvarTempAmbiente(semanaId, parseNum(valor));
      setSalvoEm(
        new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      );
      refetch();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mb-3 rounded-md border border-warm-300 bg-white px-4 py-3 md:px-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-display text-[12px] uppercase tracking-[0.06em] text-warm-600">
            Temp ambiente (fermentação)
          </div>
          <div className="mt-0.5 text-[12px] text-warm-500">referência {rotuloDia}</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <input
              className="min-h-[36px] w-24 rounded border border-warm-300 bg-white px-2.5 text-[14px] tabular-nums text-warm-800 placeholder:text-warm-400 focus:border-brand-300 focus:outline-none"
              inputMode="decimal"
              value={valor}
              onChange={(e) => {
                setValor(e.target.value);
                setSalvoEm(null);
              }}
              placeholder="ex: 27,5"
            />
            <span className="text-[13px] text-warm-500">C</span>
          </div>
          <button
            onClick={salvar}
            disabled={salvando}
            className="min-h-[36px] rounded-md bg-brand-500 px-3.5 font-display text-[12px] uppercase tracking-[0.04em] text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-warm-200 disabled:text-warm-400"
          >
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
          {salvoEm && !salvando && (
            <span className="text-[12px] text-success-text">salvo {salvoEm}</span>
          )}
        </div>
      </div>
      {erro && <p className="mt-2 text-[13px] text-danger-text">Erro: {erro}</p>}
    </div>
  );
}

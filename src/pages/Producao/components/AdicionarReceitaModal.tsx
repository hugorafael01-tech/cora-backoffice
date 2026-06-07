import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { carregarLinhaVolume } from '../../../lib/producaoActions';
import { grupoLabel } from '../../../lib/semana';
import type { LinhaVolume } from '../types';

interface Candidato {
  versaoAtivaId: string;
  nome: string;
  grupo: number | null;
}

interface Props {
  excluirVersaoIds: Set<string>;
  onAdd: (linha: LinhaVolume) => void;
  onClose: () => void;
}

/** Picker de qualquer receita ativa (produto ativo + versao ativa) fora da lista. */
export function AdicionarReceitaModal({ excluirVersaoIds, onAdd, onClose }: Props) {
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      try {
        const { data: receitas } = await supabase
          .from('receitas')
          .select('produto_id, versao_ativa_id, grupo_sugerido')
          .not('versao_ativa_id', 'is', null);

        const produtoIds = (receitas ?? []).map((r) => r.produto_id as string);
        const { data: produtos } = await supabase
          .from('produtos')
          .select('id, nome, ativo')
          .in('id', produtoIds.length ? produtoIds : ['00000000-0000-0000-0000-000000000000'])
          .eq('ativo', true);

        const produtoById = new Map((produtos ?? []).map((p) => [p.id as string, p]));
        const lista: Candidato[] = [];
        for (const r of receitas ?? []) {
          const vid = r.versao_ativa_id as string;
          if (excluirVersaoIds.has(vid)) continue;
          const produto = produtoById.get(r.produto_id as string);
          if (!produto) continue;
          lista.push({ versaoAtivaId: vid, nome: produto.nome as string, grupo: r.grupo_sugerido ?? null });
        }
        lista.sort((a, b) => a.nome.localeCompare(b.nome));
        if (!cancelado) setCandidatos(lista);
      } catch (e) {
        if (!cancelado) setErro(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelado) setLoading(false);
      }
    }
    carregar();
    return () => {
      cancelado = true;
    };
  }, [excluirVersaoIds]);

  async function adicionar(c: Candidato) {
    setAddingId(c.versaoAtivaId);
    setErro(null);
    try {
      const linha = await carregarLinhaVolume(c.versaoAtivaId, 'adicionada');
      onAdd(linha);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setAddingId(null);
    }
  }

  const filtrados = candidatos.filter((c) =>
    c.nome.toLowerCase().includes(busca.trim().toLowerCase())
  );

  return (
    <ModalShell titulo="Adicionar receita" onClose={onClose}>
      <input
        autoFocus
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar receita ativa…"
        className="mb-3 min-h-[44px] w-full rounded-lg border-[1.5px] border-warm-300 px-3 text-[14px] text-warm-800 outline-none focus:border-brand-500"
      />
      {erro && <p className="mb-2 text-[13px] text-danger-text">{erro}</p>}
      {loading ? (
        <p className="py-6 text-center text-warm-500">Carregando…</p>
      ) : filtrados.length === 0 ? (
        <p className="py-6 text-center text-[14px] text-warm-500">
          Nenhuma receita ativa fora da lista.
        </p>
      ) : (
        <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
          {filtrados.map((c) => (
            <li key={c.versaoAtivaId}>
              <button
                disabled={addingId != null}
                onClick={() => adicionar(c)}
                className="flex min-h-[44px] w-full items-center justify-between rounded-md px-3 py-2 text-left hover:bg-warm-100 disabled:opacity-50"
              >
                <span className="text-warm-800">{c.nome}</span>
                <span className="flex items-center gap-2">
                  <span className="rounded border border-warm-300 bg-warm-100 px-1.5 py-0.5 text-[11px] text-warm-600">
                    {grupoLabel(c.grupo)}
                  </span>
                  <span className="text-[13px] text-brand-600">
                    {addingId === c.versaoAtivaId ? 'Adicionando…' : '+ adicionar'}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </ModalShell>
  );
}

export function ModalShell({
  titulo,
  eyebrow,
  onClose,
  children,
}: {
  titulo: string;
  eyebrow?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 p-5 md:p-10"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-[560px] overflow-hidden rounded-xl border border-warm-200 bg-white">
        <div className="flex items-start justify-between gap-3 border-b border-warm-200 px-5 py-4">
          <div>
            {eyebrow && (
              <div className="font-display text-[11px] uppercase tracking-[0.06em] text-warm-500">
                {eyebrow}
              </div>
            )}
            <h2 className="font-display text-[22px] uppercase tracking-[0.02em] text-brand-500">
              {titulo}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-md border border-warm-300 text-[17px] text-warm-500 hover:bg-warm-100"
          >
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

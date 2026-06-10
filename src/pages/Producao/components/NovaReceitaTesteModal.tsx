import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Constants } from '../../../lib/database.types';
import { criarPaoNovo, criarVariacao } from '../../../lib/producaoActions';
import type { LinhaVolume, ProdutoFormato } from '../types';
import { ModalShell } from './AdicionarReceitaModal';

const FORMATOS = Constants.public.Enums.produto_formato;

interface BaseOption {
  versaoAtivaId: string;
  nome: string;
}

type Modo = 'variacao' | 'novo';

interface Props {
  onAdd: (linha: LinhaVolume) => void;
  onClose: () => void;
}

export function NovaReceitaTesteModal({ onAdd, onClose }: Props) {
  const [modo, setModo] = useState<Modo>('variacao');
  const [bases, setBases] = useState<BaseOption[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // form variacao
  const [baseId, setBaseId] = useState('');
  const [vHid, setVHid] = useState(75);
  const [vPref, setVPref] = useState(20);
  const [vPeso, setVPeso] = useState(600);
  const [vNotas, setVNotas] = useState('');

  // form novo
  const [nNome, setNNome] = useState('');
  const [nFormato, setNFormato] = useState<ProdutoFormato>('banneton');
  const [nPeso, setNPeso] = useState(500);
  const [nHid, setNHid] = useState(75);
  const [nPref, setNPref] = useState(20);
  const [nNotas, setNNotas] = useState('');

  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      const { data: receitas } = await supabase
        .from('receitas')
        .select('produto_id, versao_ativa_id')
        .not('versao_ativa_id', 'is', null);
      const ids = (receitas ?? []).map((r) => r.produto_id as string);
      const { data: produtos } = await supabase
        .from('produtos')
        .select('id, nome, ativo')
        .in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
        .eq('ativo', true);
      const nomeById = new Map((produtos ?? []).map((p) => [p.id as string, p.nome as string]));
      const lista: BaseOption[] = [];
      for (const r of receitas ?? []) {
        const nome = nomeById.get(r.produto_id as string);
        if (nome) lista.push({ versaoAtivaId: r.versao_ativa_id as string, nome });
      }
      lista.sort((a, b) => a.nome.localeCompare(b.nome));
      if (!cancelado) {
        setBases(lista);
        setBaseId((prev) => prev || lista[0]?.versaoAtivaId || '');
      }
    }
    carregar();
    return () => {
      cancelado = true;
    };
  }, []);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      let linha: LinhaVolume;
      if (modo === 'variacao') {
        if (!baseId) throw new Error('Selecione um pão base.');
        linha = await criarVariacao({
          versaoOrigemId: baseId,
          pesoMassaG: vPeso,
          hidratacaoAlvo: vHid,
          prefermentoPct: vPref,
          notas: vNotas,
        });
      } else {
        if (!nNome.trim()) throw new Error('Informe o nome do pão.');
        linha = await criarPaoNovo({
          nome: nNome.trim(),
          formato: nFormato,
          pesoMassaG: nPeso,
          hidratacaoAlvo: nHid,
          prefermentoPct: nPref,
          notas: nNotas,
        });
      }
      onAdd(linha);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setSalvando(false);
    }
  }

  return (
    <ModalShell titulo="Nova receita de teste" eyebrow="mini-fluxo · status rascunho" onClose={onClose}>
      <div className="mb-4 grid grid-cols-2 overflow-hidden rounded-lg border-[1.5px] border-warm-300">
        <SegBtn ativo={modo === 'variacao'} onClick={() => setModo('variacao')}>
          Variação de pão existente
          <span className="block text-[11px] font-normal text-warm-500">-&gt; nova versão</span>
        </SegBtn>
        <SegBtn ativo={modo === 'novo'} onClick={() => setModo('novo')} borda>
          Pão novo
          <span className="block text-[11px] font-normal text-warm-500">
            -&gt; novo produto + receita
          </span>
        </SegBtn>
      </div>

      {modo === 'variacao' ? (
        <div>
          <Campo label="Pão base">
            <select
              value={baseId}
              onChange={(e) => setBaseId(e.target.value)}
              className="min-h-[44px] w-full rounded-lg border-[1.5px] border-warm-300 px-3 text-[14px] text-warm-800 outline-none focus:border-brand-500"
            >
              {bases.map((b) => (
                <option key={b.versaoAtivaId} value={b.versaoAtivaId}>
                  {b.nome}
                </option>
              ))}
            </select>
            <Hint>A versão herda formato, grupo, ingredientes e etapas do pão base.</Hint>
          </Campo>
          <div className="grid grid-cols-2 gap-3.5">
            <CampoNum label="Hidratação alvo" unidade="%" value={vHid} onChange={setVHid} />
            <CampoNum label="% de prefermento" unidade="%" value={vPref} onChange={setVPref} />
          </div>
          <CampoNum label="Peso da massa / pão" unidade="g" step={10} value={vPeso} onChange={setVPeso} />
          <Campo label="Notas">
            <textarea
              value={vNotas}
              onChange={(e) => setVNotas(e.target.value)}
              placeholder="o que está testando nesta versão"
              className="min-h-[64px] w-full resize-y rounded-lg border-[1.5px] border-warm-300 px-3 py-2 text-[14px] text-warm-800 outline-none focus:border-brand-500"
            />
          </Campo>
        </div>
      ) : (
        <div>
          <Campo label="Nome do pão">
            <input
              value={nNome}
              onChange={(e) => setNNome(e.target.value)}
              placeholder="ex.: Italiano de azeitonas"
              className="min-h-[44px] w-full rounded-lg border-[1.5px] border-warm-300 px-3 text-[14px] text-warm-800 outline-none focus:border-brand-500"
            />
          </Campo>
          <div className="grid grid-cols-2 gap-3.5">
            <Campo label="Formato">
              <select
                value={nFormato}
                onChange={(e) => setNFormato(e.target.value as ProdutoFormato)}
                className="min-h-[44px] w-full rounded-lg border-[1.5px] border-warm-300 px-3 text-[14px] text-warm-800 outline-none focus:border-brand-500"
              >
                {FORMATOS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </Campo>
            <CampoNum label="Peso da massa / pão" unidade="g" step={10} value={nPeso} onChange={setNPeso} />
          </div>
          <div className="grid grid-cols-2 gap-3.5">
            <CampoNum label="Hidratação alvo" unidade="%" value={nHid} onChange={setNHid} />
            <CampoNum label="% de prefermento" unidade="%" value={nPref} onChange={setNPref} />
          </div>
          <Hint>
            Nasce sem ingredientes (massa = un x peso; levain definido depois no módulo Receitas).
            Hidratação e prefermento ficam registrados nas notas.
          </Hint>
          <Campo label="Notas">
            <textarea
              value={nNotas}
              onChange={(e) => setNNotas(e.target.value)}
              placeholder="o que está testando neste pão"
              className="min-h-[64px] w-full resize-y rounded-lg border-[1.5px] border-warm-300 px-3 py-2 text-[14px] text-warm-800 outline-none focus:border-brand-500"
            />
          </Campo>
        </div>
      )}

      {erro && <p className="mt-2 text-[13px] text-danger-text">{erro}</p>}

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-warm-200 pt-4">
        <span className="text-[12px] text-warm-500">
          <span className="rounded border border-warm-300 bg-white px-1.5 py-0.5 text-warm-500">
            ● rascunho
          </span>{' '}
          · origem teste
        </span>
        <button
          onClick={salvar}
          disabled={salvando}
          className="min-h-[44px] rounded-md bg-brand-500 px-5 font-display text-[13px] uppercase tracking-[0.06em] text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {salvando ? 'Adicionando…' : 'Adicionar à semana'}
        </button>
      </div>
    </ModalShell>
  );
}

function SegBtn({
  ativo,
  onClick,
  borda,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  borda?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`min-h-[44px] px-3 py-2.5 text-left text-[13px] leading-snug ${
        borda ? 'border-l-[1.5px] border-warm-300' : ''
      } ${ativo ? 'bg-brand-50 font-semibold text-brand-700' : 'bg-white text-warm-600'}`}
    >
      {children}
    </button>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3.5">
      <div className="mb-1.5 font-display text-[10px] uppercase tracking-[0.06em] text-warm-500">
        {label}
      </div>
      {children}
    </div>
  );
}

function CampoNum({
  label,
  unidade,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  unidade: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
}) {
  return (
    <Campo label={label}>
      <div className="flex items-center overflow-hidden rounded-lg border-[1.5px] border-warm-300 focus-within:border-brand-500">
        <input
          type="number"
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="min-h-[44px] w-full border-0 bg-transparent px-3 text-[14px] text-warm-800 outline-none"
        />
        <span className="px-3 text-[12px] text-warm-500">{unidade}</span>
      </div>
    </Campo>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-[11px] leading-snug text-warm-500">{children}</p>;
}

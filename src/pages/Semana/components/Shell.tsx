import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';

const SIDEBAR_ITENS: { label: string; to?: string; emBreve?: boolean }[] = [
  { label: 'Semana', to: '/semanas/atual' },
  { label: 'Produção', to: '/producao/atual' },
  { label: 'Planejamento', emBreve: true },
  { label: 'Estoque', emBreve: true },
  { label: 'Assinantes', emBreve: true },
  { label: 'Financeiro', to: '/financeiro' },
  { label: 'Configurações', emBreve: true },
];

const MAIS_ITENS = ['Planejamento', 'Receitas', 'Configurações'];

async function sair() {
  await supabase.auth.signOut();
  window.location.href = '/login';
}

/** Layout chrome: sidebar (desktop) + bottom nav e drawer (mobile). */
export function Shell({ children }: { children: ReactNode }) {
  const [maisAberto, setMaisAberto] = useState(false);

  return (
    <div className="min-h-screen bg-warm-50 text-warm-700">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-[220px] flex-col border-r border-warm-200 bg-warm-100 px-4 py-6">
        <div className="font-display text-2xl tracking-wide text-brand-500 mb-8 px-2">CORA</div>
        <nav className="flex-1 space-y-1">
          {SIDEBAR_ITENS.map((item) =>
            item.emBreve ? (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-md px-3 py-2 text-warm-400 cursor-default select-none"
                title="Em breve"
              >
                <span>{item.label}</span>
                <span className="text-[10px] uppercase tracking-wide">em breve</span>
              </div>
            ) : (
              <NavLink
                key={item.label}
                to={item.to!}
                className={({ isActive }) =>
                  `block rounded-md px-3 py-2 ${
                    isActive
                      ? 'bg-brand-500 text-white'
                      : 'text-warm-700 hover:bg-warm-200'
                  }`
                }
              >
                {item.label}
              </NavLink>
            )
          )}
        </nav>
        <button onClick={sair} className="px-3 py-2 text-left text-sm text-warm-500 hover:underline">
          Sair
        </button>
      </aside>

      {/* Conteudo */}
      <main className="md:pl-[220px] pb-20 md:pb-0">{children}</main>

      {/* Bottom nav mobile */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 flex border-t border-warm-200 bg-warm-100">
        <NavLink
          to="/semanas/atual"
          className={({ isActive }) =>
            `flex-1 py-3 text-center text-[12px] ${isActive ? 'text-brand-500 font-medium' : 'text-warm-600'}`
          }
          style={{ minHeight: 44 }}
        >
          Semana
        </NavLink>
        <NavLink
          to="/producao/atual"
          className={({ isActive }) =>
            `flex-1 py-3 text-center text-[12px] ${isActive ? 'text-brand-500 font-medium' : 'text-warm-600'}`
          }
          style={{ minHeight: 44 }}
        >
          Produção
        </NavLink>
        <span className="flex-1 py-3 text-center text-[12px] text-warm-300 select-none" style={{ minHeight: 44 }}>
          Expedição
        </span>
        <button
          onClick={() => setMaisAberto(true)}
          className="flex-1 py-3 text-center text-[12px] text-warm-600"
          style={{ minHeight: 44 }}
        >
          Mais ▾
        </button>
      </nav>

      {/* Drawer "Mais" */}
      {maisAberto && (
        <div className="md:hidden fixed inset-0 z-30" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMaisAberto(false)} />
          <div className="absolute right-0 inset-y-0 w-64 bg-warm-50 shadow-xl p-5">
            <button
              onClick={() => setMaisAberto(false)}
              className="mb-4 font-display text-xl text-warm-700"
            >
              Mais ▾
            </button>
            <ul className="space-y-1">
              <li>
                <NavLink
                  to="/financeiro"
                  onClick={() => setMaisAberto(false)}
                  className={({ isActive }) =>
                    `block rounded-md px-3 py-3 ${
                      isActive ? 'bg-brand-500 text-white' : 'text-warm-700 hover:bg-warm-200'
                    }`
                  }
                >
                  Financeiro
                </NavLink>
              </li>
              {MAIS_ITENS.map((label) => (
                <li
                  key={label}
                  className="flex items-center justify-between rounded-md px-3 py-3 text-warm-400"
                  title="Em breve"
                >
                  <span>{label}</span>
                  <span className="text-[10px] uppercase tracking-wide">em breve</span>
                </li>
              ))}
              <li>
                <button
                  onClick={sair}
                  className="w-full rounded-md px-3 py-3 text-left text-warm-600 hover:bg-warm-200"
                >
                  Sair
                </button>
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

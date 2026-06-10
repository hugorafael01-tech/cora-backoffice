import { enderecoCompleto, resumoItens, type EntregaLite } from '../../../lib/expedicao';

/**
 * Vista de impressao das etiquetas: escondida na tela (`hidden`), visivel so no
 * print (`print:block`). A regra @media print em index.css (.etiquetas-print)
 * esconde o resto da pagina. Uma etiqueta por entrega: nome / endereco completo /
 * itens / observacao. Layout simples — refino visual vem depois com o Hugo.
 */
export function EtiquetasPrint({ entregas }: { entregas: EntregaLite[] }) {
  return (
    <div className="etiquetas-print hidden print:block">
      <div className="grid grid-cols-2 gap-3 p-3">
        {entregas.map((e) => {
          const resumo = resumoItens(e.itens);
          return (
            <div
              key={e.id}
              className="break-inside-avoid rounded border border-black/40 p-3 text-[12px] text-black"
            >
              <div className="text-[15px] font-semibold">{e.nome}</div>
              <div className="mt-1">{enderecoCompleto(e)}</div>
              {e.whatsapp && <div className="mt-1">WhatsApp: {e.whatsapp}</div>}
              <div className="mt-1.5 border-t border-black/20 pt-1.5">{resumo || 'sem itens'}</div>
              {e.observacao && e.observacao.trim() && (
                <div className="mt-1 italic">Obs.: {e.observacao.trim()}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

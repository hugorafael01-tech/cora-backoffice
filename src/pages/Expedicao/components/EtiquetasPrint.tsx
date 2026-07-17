import { enderecoCompleto, resumoItens, type EntregaLite } from '../../../lib/expedicao';

/**
 * Vista de impressao das etiquetas: escondida na tela (`hidden`), visivel so no
 * print (`print:block`). A geometria da folha (PIMACO 6183 / Avery 5163) e
 * definida em mm pela regra @media print .etiquetas-print em index.css — as
 * classes aqui cuidam so de tipografia e conteudo. Uma etiqueta por entrega:
 * nome / endereco completo / itens / observacao.
 */
export function EtiquetasPrint({ entregas }: { entregas: EntregaLite[] }) {
  return (
    <div className="etiquetas-print hidden print:block">
      <div className="etiquetas-grid">
        {entregas.map((e) => {
          const resumo = resumoItens(e.itens);
          return (
            <div key={e.id} className="etiqueta text-[12px] text-black">
              <div className="text-[15px] font-semibold leading-tight">{e.nome}</div>
              <div className="mt-1 text-[11px] leading-snug">{enderecoCompleto(e)}</div>
              {e.whatsapp && <div className="mt-1 text-[11px]">WhatsApp: {e.whatsapp}</div>}
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

import { resumoItens, rotuloSequencia, type EntregaLite } from '../../../lib/expedicao';
import { ondaDaEntrega, zonaDaEntrega, type Zona } from '../../../lib/zonas';
import { MarcaZona } from './MarcaZona';

/**
 * Vista de impressao das etiquetas: escondida na tela (`hidden`), visivel so no
 * print (`print:block`). A geometria da folha (PIMACO 6183 / Avery 5163) e
 * definida em mm pela regra @media print .etiquetas-print em index.css — as
 * classes aqui cuidam so de tipografia e conteudo.
 *
 * Ordem de destaque visual (briefing de logistica 17/08/2026):
 *   1. CODIGO DE SEQUENCIA + BAIRRO ("R-07 · BOTAFOGO") no maior corpo da
 *      etiqueta — e o que se le a um metro, na bancada e dentro da bag.
 *   2. MARCA DE ZONA (forma preenchida + codigo) na mesma linha, a direita:
 *      diz em que bag o pacote vai sem custar altura. Ver MarcaZona pra por que
 *      a forma manda e a cor so acompanha.
 *   3. Nome, itens e endereco — como ja era antes das zonas.
 *   4. Zona que nao viaja na bag: tarja preta invertida
 *      "ENTREGA PRÓPRIA — NÃO VAI NA BAG". Pacote que nao viaja tem que ser
 *      impossivel de confundir com pacote que viaja, inclusive em preto e
 *      branco — dai a tarja cheia, nao so uma cor diferente.
 *
 * O telefone do assinante NAO entra na etiqueta, que viaja colada no pacote e
 * fica exposta na portaria e no elevador (decisao do Hugo, 04/08). Contato de
 * assinante nao circula fora da Cora: nao adicionar aqui, nem na rota
 * (linhaRota / textoRota), nem em nenhum texto exportado.
 *
 * O endereco e composto campo a campo aqui em vez de usar enderecoCompleto(),
 * que devolve uma string unica e segue servindo a linha expandida na tela.
 */
export function EtiquetasPrint({
  entregas,
  zonas,
}: {
  entregas: EntregaLite[];
  zonas: Map<string, Zona>;
}) {
  return (
    <div className="etiquetas-print hidden print:block">
      <div className="etiquetas-grid">
        {entregas.map((e) => {
          const zona = zonaDaEntrega(e, zonas);
          const onda = ondaDaEntrega(e, zonas);
          const codigo = rotuloSequencia(e, onda);
          const naBag = zona ? zona.entraNaOnda : true;
          const resumo = resumoItens(e.itens);
          const logradouro = [e.rua, e.numero, e.complemento]
            .filter((x) => x && String(x).trim())
            .join(', ');
          // O bairro ja e o segundo elemento da linha de topo, no maior corpo da
          // etiqueta — repeti-lo aqui so ocupa espaco. Sobram cidade e CEP.
          const contexto = [e.cidade, e.cep ? `CEP ${e.cep}` : ''].filter(Boolean).join(' · ');

          return (
            <div key={e.id} className="etiqueta text-[12px] text-black">
              {/* 1 + 2: o par que se le de longe. */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 text-[22px] font-bold uppercase leading-none tracking-[0.01em]">
                  {codigo && <span className="tabular-nums">{codigo} · </span>}
                  <span>{e.bairro}</span>
                </div>
                <MarcaZona zona={zona} tamanho={20} className="flex-shrink-0 text-[14px]" />
              </div>

              {/* 4: so pra quem nao viaja na bag. */}
              {!naBag && (
                <div className="mt-1 bg-black px-1.5 py-0.5 text-center text-[10px] font-bold uppercase tracking-[0.06em] text-white">
                  Entrega própria — não vai na bag
                </div>
              )}

              {/* 3: conteudo de sempre. */}
              <div className="mt-1 text-[19px] font-bold leading-none">{e.nome}</div>
              <div className="text-[16px] font-semibold leading-snug">{resumo || 'sem itens'}</div>
              <div className="mt-0.5 border-t border-black/20 pt-0.5">
                <div className="text-[14px] leading-snug">{logradouro}</div>
                {contexto && <div className="text-[10px] leading-snug">{contexto}</div>}
              </div>
              {e.observacao && e.observacao.trim() && (
                <div className="etiqueta-obs text-[10px] italic leading-snug">
                  Obs.: {e.observacao.trim()}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

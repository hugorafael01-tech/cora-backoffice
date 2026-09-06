import { supabase } from './supabase';
import type { RespostaGeracao } from '../pages/Previa/types';

/** URL base do cora-portal (endpoints server-side). Config via env, fallback prod. */
const PORTAL_URL = (import.meta.env.VITE_PORTAL_URL ?? 'https://app.acora.com.br').replace(/\/$/, '');

/**
 * Alerta que o servidor recusou. Só código e mensagem: a tela já sabe traduzir
 * o código, e o texto vem pronto do módulo puro.
 */
export interface BloqueioServidor {
  codigo: string;
  mensagem: string;
}

/**
 * Resultado da geração, traduzido do contrato HTTP pra casos que a tela trata.
 *
 * Os dois 409 viram casos SEPARADOS de propósito. Eles pedem coisas opostas do
 * operador: `previa_bloqueada` quer que ele resolva alertas antes de tentar de
 * novo; `em_voo` quer que ele espere e não faça nada. Colapsar os dois num
 * "conflito" genérico esconderia justamente qual é qual.
 */
export type GerarResultado =
  | { tipo: 'ok'; resposta: RespostaGeracao }
  | { tipo: 'previa_bloqueada'; alertas: BloqueioServidor[] } // 409 + error
  | { tipo: 'em_voo'; detalhe: string } //                       409 + error
  | { tipo: 'periodo_invalido' } //                              400
  | { tipo: 'unauthorized' } //                                  401/403 ou sem sessão
  | { tipo: 'erro'; detalhe: string }; //                        500, rede, corpo ilegível

/**
 * Dispara a geração de cobranças chamando o endpoint do portal.
 *
 * NENHUM valor vai daqui: só o período. O servidor recalcula a prévia do zero
 * com o gêmeo — é a razão de a fase existir, e mandar o total da tela abriria
 * exatamente o buraco que ela fecha.
 *
 * Usa o access_token da sessão atual do admin, no molde do vincularAsaas.
 */
export async function gerarCobrancas(periodoReferencia: string): Promise<GerarResultado> {
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) return { tipo: 'unauthorized' };

  let resp: Response;
  try {
    resp = await fetch(`${PORTAL_URL}/api/cobrancas/gerar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ periodo_referencia: periodoReferencia }),
    });
  } catch {
    // A geração pode ter rodado do mesmo jeito: a rede caiu na resposta, não
    // necessariamente no pedido. A mensagem diz isso, porque "falhou" sozinho
    // convidaria a tentar de novo às cegas.
    return {
      tipo: 'erro',
      detalhe:
        'Não deu para falar com o servidor. A geração pode ter rodado assim mesmo — ' +
        'confira antes de tentar de novo.',
    };
  }

  let corpo: Record<string, unknown> = {};
  try {
    corpo = await resp.json();
  } catch {
    if (resp.ok) return { tipo: 'erro', detalhe: 'O servidor respondeu algo que não dá para ler.' };
  }

  if (resp.ok) return { tipo: 'ok', resposta: corpo as unknown as RespostaGeracao };

  switch (resp.status) {
    case 409:
      // Os dois 409 se distinguem pelo corpo, nunca pelo status.
      if (corpo.error === 'geracao_em_voo') {
        return { tipo: 'em_voo', detalhe: String(corpo.detalhe ?? 'Já tem uma geração rodando.') };
      }
      return { tipo: 'previa_bloqueada', alertas: (corpo.alertas ?? []) as BloqueioServidor[] };
    case 400:
      return { tipo: 'periodo_invalido' };
    case 401:
    case 403:
      return { tipo: 'unauthorized' };
    default:
      return { tipo: 'erro', detalhe: String(corpo.detalhe ?? 'O servidor falhou.') };
  }
}

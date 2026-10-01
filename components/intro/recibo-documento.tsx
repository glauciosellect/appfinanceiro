import { formatCurrency } from '@/lib/utils'
import type { ReciboDados } from '@/lib/intro/acertos'

const dataBR = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR')
const ACAO: Record<string, string> = { manter: 'Mantido na loja', devolver: 'Devolvido ao fornecedor', trocar: 'Trocado por validade nova' }

// Documento do acerto de consignação: é o mesmo conteúdo no PDF (impressão),
// na tela do lojista e na página pública do fornecedor.
export function ReciboDocumento({ dados }: { dados: ReciboDados }) {
  const s = dados.snapshot
  const recebido = dados.status === 'recebido'
  const cancelado = dados.status === 'cancelado'

  return (
    <div className="bg-white text-black border-2 border-gray-700 text-[12px] leading-snug">
      <div className="border-b-2 border-gray-700 p-4 flex items-center gap-3">
        {s.loja.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.loja.logo_url} alt="" className="h-14 w-14 object-contain" />
        )}
        <div>
          <p className="font-bold text-base">{s.loja.nome || 'Loja'}</p>
          {s.loja.cnpj_cpf && <p>CNPJ/CPF: {s.loja.cnpj_cpf}</p>}
          {s.loja.endereco && <p>{s.loja.endereco}</p>}
          {s.loja.telefone && <p>Tel.: {s.loja.telefone}</p>}
        </div>
      </div>

      <div className="border-b-2 border-gray-700 bg-gray-50 py-2 text-center">
        <p className="font-bold text-base tracking-wide">ACERTO DE CONSIGNAÇÃO Nº {dados.numero}</p>
        <p className="text-[11px] text-gray-600">Período: {dataBR(s.periodo.ini)} a {dataBR(s.periodo.fim)}</p>
        {cancelado && <p className="text-red-700 font-bold mt-1">DOCUMENTO CANCELADO</p>}
      </div>

      <div className="border-b border-gray-700 p-4">
        <p>Fornecedor: <strong>{s.fornecedor.nome}</strong></p>
        {s.fornecedor.cpf_cnpj && <p>CPF/CNPJ: <strong>{s.fornecedor.cpf_cnpj}</strong></p>}
      </div>

      <div className="border-b border-gray-700">
        <p className="bg-gray-100 px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-center border-b border-gray-400">Produtos vendidos</p>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-300 text-[10px] uppercase text-gray-600">
              <th className="px-3 py-1 text-left">Produto</th>
              <th className="px-3 py-1 text-right">Qtd</th>
              <th className="px-3 py-1 text-right">Valor unit.</th>
              <th className="px-3 py-1 text-right">A receber</th>
            </tr>
          </thead>
          <tbody>
            {s.itens.length === 0 && <tr><td colSpan={4} className="px-3 py-3 text-center text-gray-500">Nenhuma venda no período.</td></tr>}
            {s.itens.map((i, idx) => (
              <tr key={idx} className="border-b border-gray-200">
                <td className="px-3 py-1">{i.produto}</td>
                <td className="px-3 py-1 text-right">{Number(i.quantidade)}</td>
                <td className="px-3 py-1 text-right">{formatCurrency(Number(i.custo_unitario))}</td>
                <td className="px-3 py-1 text-right font-medium">{formatCurrency(Number(i.valor_repasse))}</td>
              </tr>
            ))}
            <tr className="font-bold bg-gray-50">
              <td className="px-3 py-2" colSpan={3}>TOTAL</td>
              <td className="px-3 py-2 text-right">{formatCurrency(Number(s.total_repasse))}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {s.sobras.length > 0 && (
        <div className="border-b border-gray-700">
          <p className="bg-gray-100 px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-center border-b border-gray-400">Saldo na loja (devolver / trocar)</p>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-300 text-[10px] uppercase text-gray-600">
                <th className="px-3 py-1 text-left">Produto</th>
                <th className="px-3 py-1 text-right">Qtd</th>
                <th className="px-3 py-1 text-left">Validade</th>
                <th className="px-3 py-1 text-left">Situação</th>
              </tr>
            </thead>
            <tbody>
              {s.sobras.map((o, idx) => (
                <tr key={idx} className="border-b border-gray-200">
                  <td className="px-3 py-1">{o.produto}</td>
                  <td className="px-3 py-1 text-right">{Number(o.quantidade)}</td>
                  <td className="px-3 py-1">{o.validade ? dataBR(o.validade) : '—'}</td>
                  <td className="px-3 py-1">{ACAO[o.acao]}{o.acao === 'trocar' && o.nova_validade ? ` (nova validade ${dataBR(o.nova_validade)})` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="p-4 space-y-3">
        <p>{s.texto_recibo}</p>
        <p className="text-[11px] text-gray-600">
          Valor total a receber: <strong>{formatCurrency(Number(s.total_repasse))}</strong>
        </p>

        {recebido ? (
          <div className="rounded border-2 border-green-700 bg-green-50 p-3 text-green-900">
            <p className="font-bold text-sm">✔ RECEBIDO</p>
            <p>Confirmado por <strong>{dados.recebido_nome}</strong> (CPF/CNPJ {dados.recebido_documento})</p>
            <p>em {dados.recebido_em ? new Date(dados.recebido_em).toLocaleString('pt-BR') : ''}</p>
          </div>
        ) : (
          !cancelado && <p className="text-[11px] text-gray-500">Aguardando confirmação de recebimento pelo fornecedor.</p>
        )}

        {dados.hash && <p className="text-[9px] text-gray-400 break-all">Código de integridade (SHA-256): {dados.hash}</p>}
        <p className="text-[9px] text-gray-400">Emitido em {s.emitido_em.replace('T', ' ')} · Documento gerado no SyncroMoney Intro</p>
      </div>
    </div>
  )
}

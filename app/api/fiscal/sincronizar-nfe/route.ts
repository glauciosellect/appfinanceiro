import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { consultarNFe } from '@/lib/fiscal/focusnfe'

// Consulta o status atual de uma NF-e na Focus NFe/SEFAZ — usado quando a
// emissão original ficou "processando" (a espera de até 20s em
// app/api/fiscal/emitir-nfe/route.ts não é suficiente pra toda autorização),
// mesmo padrão de app/api/nfse/sincronizar/route.ts.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { ref, id } = (await req.json()) as { ref: string; id: string }
  if (!ref || !id) return NextResponse.json({ error: 'ref e id são obrigatórios' }, { status: 400 })

  let retorno
  try {
    retorno = await consultarNFe(ref)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }

  const statusMap: Record<string, string> = {
    autorizado: 'emitida',
    processando_autorizacao: 'processando',
    erro_autorizacao: 'erro',
    denegado: 'erro',
    cancelado: 'cancelada',
  }
  const status = statusMap[retorno.status ?? ''] ?? 'processando'
  const erro = retorno.erros?.map((e) => `${e.codigo}: ${e.mensagem}`).join('; ') ?? retorno.mensagem_sefaz ?? null

  const { error: dbError } = await supabase
    .from('nfe_emitidas')
    .update({
      status,
      chave_acesso: retorno.chave_nfe ?? undefined,
      numero: retorno.numero ? Number(retorno.numero) : undefined,
      serie: retorno.serie ?? undefined,
      danfe_url: retorno.caminho_danfe
        ? (retorno.caminho_danfe.startsWith('http') ? retorno.caminho_danfe : `https://api.focusnfe.com.br${retorno.caminho_danfe}`)
        : undefined,
      xml_url: retorno.caminho_xml_nota_fiscal
        ? (retorno.caminho_xml_nota_fiscal.startsWith('http') ? retorno.caminho_xml_nota_fiscal : `https://api.focusnfe.com.br${retorno.caminho_xml_nota_fiscal}`)
        : undefined,
      erro_mensagem: erro,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)

  if (dbError) console.error('[sincronizar-nfe] erro ao atualizar banco:', dbError)
  console.log('[sincronizar-nfe] ref:', ref, '| retorno:', JSON.stringify(retorno))

  return NextResponse.json({ ok: true, status, retorno })
}

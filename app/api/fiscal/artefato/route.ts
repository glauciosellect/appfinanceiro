import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { baixarArtefato, type TipoDocumentoArtefato } from '@/lib/fiscal/contora'

const TABELA_POR_TIPO: Record<TipoDocumentoArtefato, string> = {
  nfe: 'nfe_emitidas',
  nfce: 'nfce',
  nfse: 'nfse',
}

// Proxy de download de PDF/XML — a Contora exige Bearer token pra baixar
// artefato (diferente da Focus NFe, que dava um link público direto), então
// o navegador não pode buscar isso sozinho. Esta rota busca no servidor
// (autenticado) e devolve o binário pro usuário dono da nota.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const tipo = searchParams.get('tipo') as TipoDocumentoArtefato | null
  const id = searchParams.get('id')
  const formato = searchParams.get('formato') === 'xml' ? 'xml' : 'pdf'

  if (!tipo || !id || !TABELA_POR_TIPO[tipo]) {
    return NextResponse.json({ error: 'Parâmetros tipo (nfe|nfce|nfse) e id são obrigatórios' }, { status: 400 })
  }

  const [{ data: nota }, { data: fiscalConfig }] = await Promise.all([
    supabase.from(TABELA_POR_TIPO[tipo]).select('contora_document_id').eq('id', id).eq('user_id', user.id).single(),
    supabase.from('fiscal_config').select('contora_company_id, ambiente').eq('user_id', user.id).single(),
  ])

  if (!nota?.contora_document_id || !fiscalConfig?.contora_company_id) {
    return NextResponse.json({ error: 'Nota ou empresa não encontrada na Contora' }, { status: 404 })
  }

  const ambiente = (fiscalConfig.ambiente as 'homologacao' | 'producao' | undefined) ?? 'homologacao'
  const artefato = formato === 'xml' ? 'xml_authorized' : 'pdf_danfe'

  const resultado = await baixarArtefato(fiscalConfig.contora_company_id, tipo, nota.contora_document_id, artefato, ambiente)
  if (!resultado) {
    return NextResponse.json({ error: 'Artefato ainda não disponível — a nota pode não estar autorizada ainda' }, { status: 404 })
  }

  return new NextResponse(new Uint8Array(resultado.buffer), {
    headers: {
      'Content-Type': resultado.contentType,
      'Content-Disposition': `inline; filename="${tipo}-${id}.${formato}"`,
    },
  })
}

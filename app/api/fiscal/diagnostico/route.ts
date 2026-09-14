import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { consultarNFe } from '@/lib/fiscal/contora'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: config } = await supabase
    .from('fiscal_config')
    .select('cnpj, numero_proximo_nfe, serie_nfe, habilita_nfe, habilita_nfse, contora_company_id, ambiente')
    .eq('user_id', user.id)
    .single()

  const ambiente = (config?.ambiente as 'homologacao' | 'producao' | undefined) ?? 'homologacao'

  // Últimas 5 NF-e emitidas
  const { data: ultimasNfe } = await supabase
    .from('nfe_emitidas')
    .select('id, numero, serie, status, contora_document_id, ambiente, data_emissao, destinatario')
    .eq('user_id', user.id)
    .order('id', { ascending: false })
    .limit(5)

  // Consulta status real de cada NF-e direto na Contora
  const consultas = await Promise.all(
    (ultimasNfe ?? []).map(async (nfe) => {
      if (!nfe.contora_document_id || !config?.contora_company_id) {
        return { ...nfe, contora_status: null }
      }
      try {
        const resultado = await consultarNFe(config.contora_company_id, nfe.contora_document_id, ambiente)
        return { ...nfe, contora_status: resultado }
      } catch (err) {
        return { ...nfe, contora_status: { error: String(err) } }
      }
    })
  )

  const body = {
    ambiente,
    contora_company_id: config?.contora_company_id ?? null,
    fiscal_config_supabase: config,
    ultimas_nfe_e_status_contora: consultas,
  }

  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

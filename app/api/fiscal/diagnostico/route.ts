import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: config } = await supabase
    .from('fiscal_config')
    .select('cnpj, numero_proximo_nfe, serie_nfe, habilita_nfe, habilita_nfse')
    .eq('user_id', user.id)
    .single()

  const ambiente = process.env.FOCUSNFE_AMBIENTE ?? 'homologacao'
  const tokenProducao = process.env.FOCUSNFE_TOKEN_PRODUCAO ?? ''
  const tokenHomologacao = process.env.FOCUSNFE_TOKEN_HOMOLOGACAO ?? ''
  const tokenAtivo = ambiente === 'producao' ? tokenProducao : tokenHomologacao
  const baseUrl = ambiente === 'producao'
    ? 'https://api.focusnfe.com.br/v2'
    : 'https://homologacao.focusnfe.com.br/v2'

  // Últimas 5 NF-e emitidas
  const { data: ultimasNfe } = await supabase
    .from('nfe_emitidas')
    .select('id, numero, serie, status, focus_ref, ambiente, data_emissao, destinatario')
    .eq('user_id', user.id)
    .order('id', { ascending: false })
    .limit(5)

  const headersFocus = {
    Authorization: `Basic ${Buffer.from(`${tokenAtivo}:`).toString('base64')}`,
    'Content-Type': 'application/json',
  }

  // Consulta status real de cada NF-e na Focus NFe
  const consultas = await Promise.all(
    (ultimasNfe ?? []).map(async (nfe) => {
      if (!nfe.focus_ref) return { ...nfe, focus_status: null }
      const url = `${baseUrl}/nfe/${encodeURIComponent(nfe.focus_ref)}`
      try {
        const res = await fetch(url, { headers: headersFocus })
        const text = await res.text()
        let parsed: unknown = null
        try { parsed = JSON.parse(text) } catch { /* mantém parsed = null */ }
        return { ...nfe, focus_status: { http: res.status, parsed, raw: text } }
      } catch (err) {
        return { ...nfe, focus_status: { error: String(err) } }
      }
    })
  )

  const body = {
    ambiente,
    base_url: baseUrl,
    tem_token_producao: !!tokenProducao,
    tem_token_homologacao: !!tokenHomologacao,
    fiscal_config_supabase: config,
    ultimas_nfe_e_status_focus: consultas,
  }

  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

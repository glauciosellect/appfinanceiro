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

  if (!config?.cnpj) {
    return NextResponse.json({ error: 'CNPJ não configurado' }, { status: 400 })
  }

  const ambiente = process.env.FOCUSNFE_AMBIENTE ?? 'homologacao'
  const tokenProducao = process.env.FOCUSNFE_TOKEN_PRODUCAO ?? ''
  const tokenHomologacao = process.env.FOCUSNFE_TOKEN_HOMOLOGACAO ?? ''
  const tokenAtivo = tokenProducao || tokenHomologacao

  if (!tokenAtivo) {
    return NextResponse.json({
      ambiente,
      token_configurado: false,
      fiscal_config_supabase: config,
    }, { headers: { 'content-type': 'application/json; charset=utf-8' } })
  }

  const cnpjLimpo = config.cnpj.replace(/\D/g, '')
  const url = `https://api.focusnfe.com.br/v2/empresas/${cnpjLimpo}`
  const encoded = Buffer.from(`${tokenAtivo}:`).toString('base64')

  const res = await fetch(url, {
    headers: { Authorization: `Basic ${encoded}`, 'Content-Type': 'application/json' },
  })
  const status = res.status
  const rawText = await res.text()
  let parsed: unknown = null
  try { parsed = JSON.parse(rawText) } catch { /* mantém parsed = null */ }

  const body = {
    ambiente,
    tem_token_producao: !!tokenProducao,
    tem_token_homologacao: !!tokenHomologacao,
    fiscal_config_supabase: config,
    focus_nfe_request: { url, cnpj_limpo: cnpjLimpo },
    focus_nfe_response: { status, parsed, raw_text: rawText },
  }

  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

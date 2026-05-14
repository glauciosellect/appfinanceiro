import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { consultarEmpresa, getAmbiente, isTokenConfigured } from '@/lib/fiscal/focusnfe'

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

  const ambiente = getAmbiente()
  const tokenConfigurado = isTokenConfigured()

  if (!tokenConfigurado) {
    return NextResponse.json({
      ambiente,
      token_configurado: false,
      fiscal_config_supabase: config,
    })
  }

  // Consulta o estado atual da empresa na Focus NFe
  const empresaFocus = await consultarEmpresa(config.cnpj)

  return NextResponse.json({
    ambiente,
    token_configurado: true,
    fiscal_config_supabase: config,
    empresa_na_focus_nfe: empresaFocus,
  })
}

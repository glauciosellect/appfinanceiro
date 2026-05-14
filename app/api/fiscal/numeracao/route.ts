import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cadastrarEmpresa, isTokenConfigured } from '@/lib/fiscal/focusnfe'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { numero_proximo_nfe, serie_nfe } = await req.json() as {
    numero_proximo_nfe?: number
    serie_nfe?: string
  }

  if (!numero_proximo_nfe || numero_proximo_nfe < 1) {
    return NextResponse.json({ error: 'Número inválido' }, { status: 400 })
  }

  // Salva no banco (upsert garante que cria a linha se não existir)
  const { error: dbErr } = await supabase.from('fiscal_config').upsert({
    user_id: user.id,
    numero_proximo_nfe,
    serie_nfe: serie_nfe ?? '1',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  if (dbErr) {
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  // Sincroniza com Focus NFe se token configurado
  if (!isTokenConfigured()) {
    return NextResponse.json({ ok: true, aviso: 'Token não configurado — salvo apenas localmente.' })
  }

  // Busca dados da empresa para reenviar ao Focus NFe
  const { data: config } = await supabase
    .from('fiscal_config')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!config?.cnpj || !config?.razao_social) {
    return NextResponse.json({ error: 'Ative o módulo fiscal antes de configurar a numeração.' }, { status: 400 })
  }

  let retorno
  try {
    retorno = await cadastrarEmpresa({
      cnpj:                  config.cnpj,
      razao_social:          config.razao_social,
      inscricao_estadual:    config.inscricao_estadual,
      inscricao_municipal:   config.inscricao_municipal,
      regime_tributario:     config.regime_tributario,
      cep:                   config.cep,
      logradouro:            config.logradouro,
      numero:                config.numero,
      complemento:           config.complemento,
      bairro:                config.bairro,
      municipio:             config.municipio,
      uf:                    config.uf,
      telefone:              config.telefone,
      email:                 config.email,
      habilita_nfse:         config.habilita_nfse,
      habilita_nfe:          config.habilita_nfe,
      numero_proximo_nfe,
      serie_nfe:             serie_nfe ?? '1',
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }

  const temErro = retorno.erros && retorno.erros.length > 0
  if (temErro) {
    const msg = retorno.erros!.map(e => e.mensagem).join('; ')
    return NextResponse.json({ ok: false, error: msg })
  }

  return NextResponse.json({ ok: true })
}

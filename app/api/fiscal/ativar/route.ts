import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cadastrarEmpresa, isTokenConfigured } from '@/lib/fiscal/focusnfe'

const REGIME_MAP: Record<string, string> = {
  simples: '1',
  mei: '1',
  lucro_presumido: '3',
  lucro_real: '3',
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { habilita_nfse, habilita_nfe } = await req.json() as {
    habilita_nfse?: boolean
    habilita_nfe?: boolean
  }

  // Lê dados do perfil da empresa
  const { data: perfil } = await supabase
    .from('perfil_empresa')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!perfil?.cnpj_cpf || !perfil?.razao_social) {
    return NextResponse.json(
      { error: 'Preencha o CNPJ e a Razão Social no Perfil antes de ativar o módulo fiscal.' },
      { status: 400 }
    )
  }

  const regimeFocus = REGIME_MAP[perfil.regime_tributario as string] ?? '1'

  // Salva/atualiza config fiscal no banco
  await supabase.from('fiscal_config').upsert({
    user_id: user.id,
    cnpj: perfil.cnpj_cpf.replace(/\D/g, ''),
    razao_social: perfil.razao_social,
    inscricao_estadual: perfil.inscricao_estadual ?? '',
    inscricao_municipal: perfil.inscricao_municipal ?? '',
    regime_tributario: regimeFocus,
    cep: perfil.cep ?? '',
    logradouro: perfil.logradouro ?? '',
    numero: perfil.numero ?? '',
    complemento: perfil.complemento ?? '',
    bairro: perfil.bairro ?? '',
    municipio: perfil.cidade ?? '',
    uf: perfil.uf ?? '',
    telefone: perfil.telefone ?? '',
    email: perfil.email_comercial ?? '',
    habilita_nfse: habilita_nfse !== false,
    habilita_nfe: habilita_nfe === true,
    focus_status: 'cadastrando',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  // Se não há token configurado, ativa apenas localmente
  if (!isTokenConfigured()) {
    await supabase.from('fiscal_config').update({
      focus_status: 'cadastrado',
      focus_erro: null,
      ativo: true,
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id)
    return NextResponse.json({ ok: true, focus_status: 'cadastrado', aviso: 'Token Focus NFe não configurado — módulo ativado localmente.' })
  }

  // Cadastra/atualiza empresa na Focus NFe
  let retorno
  try {
    retorno = await cadastrarEmpresa({
      cnpj: perfil.cnpj_cpf,
      razao_social: perfil.razao_social,
      inscricao_estadual: perfil.inscricao_estadual,
      inscricao_municipal: perfil.inscricao_municipal,
      regime_tributario: regimeFocus,
      cep: perfil.cep,
      logradouro: perfil.logradouro,
      numero: perfil.numero,
      complemento: perfil.complemento,
      bairro: perfil.bairro,
      municipio: perfil.cidade,
      uf: perfil.uf,
      telefone: perfil.telefone,
      email: perfil.email_comercial,
      habilita_nfse: habilita_nfse !== false,
      habilita_nfe: habilita_nfe === true,
    })
  } catch (err) {
    await supabase.from('fiscal_config')
      .update({ focus_status: 'erro', focus_erro: String(err), updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }

  const temErro = retorno.erros && retorno.erros.length > 0
  const focusStatus = temErro ? 'erro' : 'cadastrado'
  const focusErro = temErro ? retorno.erros!.map(e => e.mensagem).join('; ') : null

  await supabase.from('fiscal_config').update({
    focus_status: focusStatus,
    focus_erro: focusErro,
    ativo: !temErro,
    updated_at: new Date().toISOString(),
  }).eq('user_id', user.id)

  return NextResponse.json({ ok: !temErro, retorno, focus_status: focusStatus, focus_erro: focusErro })
}

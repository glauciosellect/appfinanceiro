import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cadastrarEmpresa, isTokenConfigured } from '@/lib/fiscal/contora'

const REGIME_MAP: Record<string, 'mei' | 'simples' | 'presumido' | 'real'> = {
  mei: 'mei',
  simples: 'simples',
  lucro_presumido: 'presumido',
  lucro_real: 'real',
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

  const regimeContora = REGIME_MAP[perfil.regime_tributario as string] ?? 'simples'

  // Preserva codigo_municipio já resolvido antes (config fiscal), se houver —
  // o upsert abaixo não inclui esse campo pra não sobrescrever com vazio.
  const { data: configAtual } = await supabase
    .from('fiscal_config')
    .select('codigo_municipio, ambiente')
    .eq('user_id', user.id)
    .single()

  const ambiente = (configAtual?.ambiente as 'homologacao' | 'producao' | undefined) ?? 'homologacao'

  // Salva/atualiza config fiscal no banco
  await supabase.from('fiscal_config').upsert({
    user_id: user.id,
    cnpj: perfil.cnpj_cpf.replace(/\D/g, ''),
    razao_social: perfil.razao_social,
    inscricao_estadual: perfil.inscricao_estadual ?? '',
    inscricao_municipal: perfil.inscricao_municipal ?? '',
    regime_tributario: regimeContora,
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
    contora_status: 'cadastrando',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  // Se não há token configurado, ativa apenas localmente
  if (!isTokenConfigured()) {
    await supabase.from('fiscal_config').update({
      contora_status: 'cadastrado',
      contora_erro: null,
      ativo: true,
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id)
    return NextResponse.json({ ok: true, contora_status: 'cadastrado', aviso: 'Token Fiscal Contora não configurado — módulo ativado localmente.' })
  }

  // Cadastra/atualiza empresa na Fiscal Contora
  let retorno
  try {
    retorno = await cadastrarEmpresa({
      cnpj: perfil.cnpj_cpf,
      razao_social: perfil.razao_social,
      inscricao_estadual: perfil.inscricao_estadual,
      inscricao_municipal: perfil.inscricao_municipal,
      regime_tributario: regimeContora,
      ambiente,
      cep: perfil.cep,
      logradouro: perfil.logradouro,
      numero: perfil.numero,
      complemento: perfil.complemento,
      bairro: perfil.bairro,
      municipio: perfil.cidade,
      uf: perfil.uf,
      codigo_municipio: configAtual?.codigo_municipio ?? undefined,
      telefone: perfil.telefone,
    })
  } catch (err) {
    await supabase.from('fiscal_config')
      .update({ contora_status: 'erro', contora_erro: String(err), updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }

  const contoraStatus = retorno.ok ? 'cadastrado' : 'erro'

  await supabase.from('fiscal_config').update({
    contora_status: contoraStatus,
    contora_erro: retorno.erro ?? null,
    contora_company_id: retorno.contora_company_id ?? null,
    ativo: retorno.ok === true,
    updated_at: new Date().toISOString(),
  }).eq('user_id', user.id)

  return NextResponse.json({ ok: retorno.ok === true, retorno, contora_status: contoraStatus, contora_erro: retorno.erro })
}

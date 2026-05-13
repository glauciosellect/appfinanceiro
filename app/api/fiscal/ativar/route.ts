import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cadastrarEmpresa } from '@/lib/fiscal/focusnfe'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json() as Record<string, string | boolean>

  const {
    cnpj, razao_social, inscricao_estadual, inscricao_municipal,
    regime_tributario, cep, logradouro, numero, complemento,
    bairro, municipio, uf, telefone, email,
    habilita_nfse, habilita_nfe,
  } = body

  if (!cnpj || !razao_social) {
    return NextResponse.json({ error: 'CNPJ e Razão Social são obrigatórios' }, { status: 400 })
  }

  // Salva config no banco primeiro
  await supabase.from('fiscal_config').upsert({
    user_id: user.id,
    cnpj: String(cnpj).replace(/\D/g, ''),
    razao_social, inscricao_estadual, inscricao_municipal,
    regime_tributario: regime_tributario ?? '1',
    cep, logradouro, numero, complemento, bairro, municipio, uf,
    telefone, email,
    habilita_nfse: habilita_nfse !== false,
    habilita_nfe: habilita_nfe === true,
    focus_status: 'cadastrando',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  // Cadastra empresa na Focus NFe
  let retorno
  try {
    retorno = await cadastrarEmpresa({
      cnpj: String(cnpj),
      razao_social: String(razao_social),
      inscricao_estadual: inscricao_estadual ? String(inscricao_estadual) : undefined,
      inscricao_municipal: inscricao_municipal ? String(inscricao_municipal) : undefined,
      regime_tributario: regime_tributario ? String(regime_tributario) : '1',
      cep: cep ? String(cep) : undefined,
      logradouro: logradouro ? String(logradouro) : undefined,
      numero: numero ? String(numero) : undefined,
      complemento: complemento ? String(complemento) : undefined,
      bairro: bairro ? String(bairro) : undefined,
      municipio: municipio ? String(municipio) : undefined,
      uf: uf ? String(uf) : undefined,
      telefone: telefone ? String(telefone) : undefined,
      email: email ? String(email) : undefined,
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

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enviarCertificado } from '@/lib/fiscal/focusnfe'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // Recebe como multipart/form-data
  const form = await req.formData()
  const arquivo = form.get('certificado') as File | null
  const senha = form.get('senha') as string | null

  if (!arquivo || !senha) {
    return NextResponse.json({ error: 'Certificado e senha são obrigatórios' }, { status: 400 })
  }

  // Busca CNPJ: tenta fiscal_config, fallback para perfil_empresa
  const { data: configRow } = await supabase
    .from('fiscal_config')
    .select('cnpj')
    .eq('user_id', user.id)
    .single()

  let cnpjFinal = configRow?.cnpj?.replace(/\D/g, '') ?? ''

  if (!cnpjFinal) {
    const { data: perfil } = await supabase
      .from('perfil_empresa')
      .select('cnpj_cpf')
      .eq('user_id', user.id)
      .single()
    if (!perfil?.cnpj_cpf) {
      return NextResponse.json({ error: 'Ative o módulo fiscal antes de enviar o certificado' }, { status: 400 })
    }
    cnpjFinal = perfil.cnpj_cpf.replace(/\D/g, '')
    await supabase.from('fiscal_config')
      .update({ cnpj: cnpjFinal })
      .eq('user_id', user.id)
  }

  // Converte .pfx para base64
  const buffer = await arquivo.arrayBuffer()
  const pfxBase64 = Buffer.from(buffer).toString('base64')

  let retorno
  try {
    retorno = await enviarCertificado(cnpjFinal, pfxBase64, senha)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }

  const temErro = retorno.erros && retorno.erros.length > 0
  const erroMsg = temErro
    ? retorno.erros!.map((e: { codigo?: string; mensagem?: string }) => `[${e.codigo ?? '?'}] ${e.mensagem ?? ''}`).join('; ')
    : (retorno.message && retorno.status !== 'ok' ? retorno.message : null)

  if (!temErro && !erroMsg) {
    await supabase.from('fiscal_config').update({
      certificado_status: 'enviado',
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id)
  }

  console.log('[certificado] retorno Focus NFe:', JSON.stringify(retorno))

  return NextResponse.json({
    ok: !temErro && !erroMsg,
    error: erroMsg ?? undefined,
    retorno,
  })
}

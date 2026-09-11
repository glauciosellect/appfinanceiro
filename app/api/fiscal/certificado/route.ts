import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enviarCertificado } from '@/lib/fiscal/contora'

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

  // Certificado é por empresa na Contora — precisa do cadastro (ativar) feito antes
  const { data: configRow } = await supabase
    .from('fiscal_config')
    .select('contora_company_id, ambiente')
    .eq('user_id', user.id)
    .single()

  if (!configRow?.contora_company_id) {
    return NextResponse.json({ error: 'Ative o módulo fiscal antes de enviar o certificado' }, { status: 400 })
  }

  // Converte .pfx para base64
  const buffer = await arquivo.arrayBuffer()
  const pfxBase64 = Buffer.from(buffer).toString('base64')

  let retorno
  try {
    const ambiente = (configRow.ambiente as 'homologacao' | 'producao' | undefined) ?? 'homologacao'
    retorno = await enviarCertificado(configRow.contora_company_id, pfxBase64, senha, ambiente)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }

  if (retorno.ok) {
    await supabase.from('fiscal_config').update({
      certificado_status: 'enviado',
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id)
  }

  console.log('[certificado] retorno Fiscal Contora:', JSON.stringify(retorno))

  return NextResponse.json({
    ok: retorno.ok === true,
    error: retorno.erro,
    retorno,
  })
}

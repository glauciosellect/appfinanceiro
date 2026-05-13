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

  // Busca CNPJ da config do usuário
  const { data: config } = await supabase
    .from('fiscal_config')
    .select('cnpj')
    .eq('user_id', user.id)
    .single()

  if (!config?.cnpj) {
    return NextResponse.json({ error: 'Ative o cadastro fiscal antes de enviar o certificado' }, { status: 400 })
  }

  // Converte .pfx para base64
  const buffer = await arquivo.arrayBuffer()
  const pfxBase64 = Buffer.from(buffer).toString('base64')

  let retorno
  try {
    retorno = await enviarCertificado(config.cnpj, pfxBase64, senha)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }

  const temErro = retorno.erros && retorno.erros.length > 0

  if (!temErro) {
    await supabase.from('fiscal_config').update({
      certificado_status: 'enviado',
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id)
  }

  return NextResponse.json({ ok: !temErro, retorno })
}

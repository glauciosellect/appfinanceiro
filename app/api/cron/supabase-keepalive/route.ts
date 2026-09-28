import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Ping periódico (Vercel Cron, ver vercel.json) só pra gerar atividade real
 * no banco. O plano free do Supabase pausa o projeto após 7 dias sem
 * nenhuma requisição — como este sistema é usado esporadicamente (só na
 * hora de emitir NF), sem isso o projeto pausa sozinho e quebra o próximo
 * acesso. Roda diariamente (limite do plano Hobby da Vercel é 1x/dia por
 * cron), bem abaixo do limiar de 7 dias.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const supabase = await createClient()
  const { error } = await supabase.from('assinaturas').select('id').limit(1)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, pingedAt: new Date().toISOString() })
}

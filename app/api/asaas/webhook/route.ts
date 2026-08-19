import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buscarAssinatura } from '@/lib/asaas'

// Usar service role para operações de webhook (sem RLS) — mesmo padrão do
// antigo app/api/stripe/webhook/route.ts.
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface AsaasWebhookPayload {
  event: string
  payment?: {
    id: string
    subscription?: string
    status?: string
  }
}

export async function POST(req: NextRequest) {
  const authToken = req.headers.get('asaas-access-token')

  if (!authToken || authToken !== process.env.ASAAS_WEBHOOK_TOKEN) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
  }

  const body = (await req.json()) as AsaasWebhookPayload
  const { event, payment } = body

  if (!payment?.subscription) {
    // Eventos sem pagamento/assinatura associados (ou fora do fluxo de
    // assinatura recorrente) — não há o que atualizar, mas retornamos 200
    // para a Asaas não ficar retentando.
    return NextResponse.json({ received: true })
  }

  const supabase = getSupabaseAdmin()

  const { data: assinaturaRow } = await supabase
    .from('assinaturas')
    .select('id, user_id')
    .eq('asaas_subscription_id', payment.subscription)
    .single()

  if (!assinaturaRow) {
    // Assinatura não encontrada localmente — nada a fazer, mas 200 evita
    // retentativas infinitas da Asaas.
    return NextResponse.json({ received: true })
  }

  switch (event) {
    case 'PAYMENT_CONFIRMED':
    case 'PAYMENT_RECEIVED': {
      let proximoVencimento: string | null = null
      try {
        const sub = await buscarAssinatura(payment.subscription)
        proximoVencimento = sub.nextDueDate ?? null
      } catch (err) {
        console.error('Erro ao buscar nextDueDate da assinatura Asaas:', err)
      }

      await supabase
        .from('assinaturas')
        .update({
          status: 'active',
          proximo_vencimento: proximoVencimento,
          ultimo_pagamento_em: new Date().toISOString(),
        })
        .eq('id', assinaturaRow.id)
      break
    }

    case 'PAYMENT_OVERDUE': {
      await supabase
        .from('assinaturas')
        .update({ status: 'past_due' })
        .eq('id', assinaturaRow.id)
      break
    }

    case 'PAYMENT_DELETED': {
      await supabase
        .from('assinaturas')
        .update({ status: 'canceled' })
        .eq('id', assinaturaRow.id)
      break
    }

    default:
      // Outros eventos (PAYMENT_CREATED, PAYMENT_REFUNDED, etc.) — no-op.
      break
  }

  return NextResponse.json({ received: true })
}

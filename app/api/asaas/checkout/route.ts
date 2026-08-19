import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  criarClienteAsaas,
  criarCheckoutAssinatura,
  criarAssinaturaPix,
  buscarPagamentosDaAssinatura,
  buscarQrCodePix,
  cancelarAssinatura,
} from '@/lib/asaas'

const VALORES: Record<'pro' | 'premium', number> = {
  pro: 97.0,
  premium: 147.0,
}

const NOMES: Record<'pro' | 'premium', string> = {
  pro: 'SyncroMoney PRO',
  premium: 'SyncroMoney PREMIUM',
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { plano, metodoPagamento, cpfCnpj, nome } = await req.json()

    if (plano !== 'pro' && plano !== 'premium') {
      return NextResponse.json({ error: 'plano inválido' }, { status: 400 })
    }
    if (metodoPagamento !== 'PIX' && metodoPagamento !== 'CREDIT_CARD') {
      return NextResponse.json({ error: 'metodoPagamento inválido' }, { status: 400 })
    }
    if (!cpfCnpj || typeof cpfCnpj !== 'string' || cpfCnpj.trim().length < 11) {
      return NextResponse.json({ error: 'CPF/CNPJ obrigatório' }, { status: 400 })
    }

    const { data: existente } = await supabase
      .from('assinaturas')
      .select('asaas_customer_id, asaas_subscription_id, plano, status')
      .eq('user_id', user.id)
      .single()

    let customerId = existente?.asaas_customer_id as string | undefined

    // Troca de plano (ex: PRO → PREMIUM): cancela a assinatura recorrente
    // anterior no Asaas antes de criar a nova, para não cobrar as duas.
    if (
      existente?.asaas_subscription_id &&
      existente.plano !== plano &&
      existente.status !== 'canceled'
    ) {
      try {
        await cancelarAssinatura(existente.asaas_subscription_id)
      } catch (err) {
        console.error('Falha ao cancelar assinatura anterior no Asaas:', err)
      }
    }

    if (!customerId) {
      const customer = await criarClienteAsaas({
        name: nome && typeof nome === 'string' && nome.trim() ? nome.trim() : (user.email ?? 'Cliente SyncroMoney'),
        cpfCnpj: cpfCnpj.replace(/\D/g, ''),
        email: user.email,
        externalReference: user.id,
      })
      customerId = customer.id
    }

    const value = VALORES[plano as 'pro' | 'premium']
    const description = `Assinatura ${NOMES[plano as 'pro' | 'premium']}`
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    if (metodoPagamento === 'CREDIT_CARD') {
      const checkout = await criarCheckoutAssinatura({
        customerId,
        value,
        description,
        successUrl: `${appUrl}/dashboard?assinatura=sucesso`,
        cancelUrl: `${appUrl}/assinar?cancelado=true`,
      })

      await supabase.from('assinaturas').upsert({
        user_id: user.id,
        plano,
        asaas_customer_id: customerId,
        billing_type: 'CREDIT_CARD',
        status: 'pending',
        valor: value,
      }, { onConflict: 'user_id' })

      return NextResponse.json({ link: checkout.link })
    }

    // PIX
    const subscription = await criarAssinaturaPix({
      customerId,
      value,
      description,
      externalReference: user.id,
    })

    await supabase.from('assinaturas').upsert({
      user_id: user.id,
      plano,
      asaas_customer_id: customerId,
      asaas_subscription_id: subscription.id,
      billing_type: 'PIX',
      status: 'pending',
      valor: value,
    }, { onConflict: 'user_id' })

    const pagamentos = await buscarPagamentosDaAssinatura(subscription.id)
    const primeiroPagamento = pagamentos[0]

    if (!primeiroPagamento) {
      return NextResponse.json({ error: 'Não foi possível gerar a cobrança PIX' }, { status: 500 })
    }

    const qrCode = await buscarQrCodePix(primeiroPagamento.id)

    return NextResponse.json({
      qrCodeBase64: qrCode.encodedImage,
      payload: qrCode.payload,
      expirationDate: qrCode.expirationDate,
    })
  } catch (err) {
    console.error('Asaas checkout error:', err)
    return NextResponse.json({ error: 'Erro ao criar pagamento' }, { status: 500 })
  }
}

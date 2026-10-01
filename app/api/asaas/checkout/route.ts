import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  AsaasError,
  atualizarClienteAsaas,
  buscarClienteAsaasPorReferencia,
  criarClienteAsaas,
  criarCheckoutAssinatura,
  criarAssinaturaPix,
  buscarPagamentosDaAssinatura,
  buscarQrCodePix,
  cancelarAssinatura,
} from '@/lib/asaas'

const VALORES: Record<'intro' | 'pro' | 'premium', number> = {
  intro: 57.9,
  pro: 97.0,
  premium: 147.0,
}

const NOMES: Record<'intro' | 'pro' | 'premium', string> = {
  intro: 'SyncroMoney INTRO',
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

    const { plano, metodoPagamento, cpfCnpj, nome, telefone, endereco } = await req.json()

    if (plano !== 'intro' && plano !== 'pro' && plano !== 'premium') {
      return NextResponse.json({ error: 'plano inválido' }, { status: 400 })
    }
    if (metodoPagamento !== 'PIX' && metodoPagamento !== 'CREDIT_CARD') {
      return NextResponse.json({ error: 'metodoPagamento inválido' }, { status: 400 })
    }
    if (!cpfCnpj || typeof cpfCnpj !== 'string' || cpfCnpj.trim().length < 11) {
      return NextResponse.json({ error: 'CPF/CNPJ obrigatório' }, { status: 400 })
    }

    const telefoneDigitos = typeof telefone === 'string' ? telefone.replace(/\D/g, '') : ''
    if (telefoneDigitos.length < 10 || telefoneDigitos.length > 11) {
      return NextResponse.json({ error: 'Telefone obrigatório: informe com DDD (ex.: 32 99999-9999)' }, { status: 400 })
    }

    // Endereço (exigido pelo Asaas para o checkout de cartão)
    const cepDigitos = typeof endereco?.cep === 'string' ? endereco.cep.replace(/\D/g, '') : ''
    const logradouro = typeof endereco?.logradouro === 'string' ? endereco.logradouro.trim() : ''
    const numeroEnd = typeof endereco?.numero === 'string' ? endereco.numero.trim() : ''
    if (cepDigitos.length !== 8 || !logradouro || !numeroEnd) {
      return NextResponse.json({ error: 'Endereço obrigatório: informe CEP, rua e número' }, { status: 400 })
    }
    const enderecoAsaas = {
      cep: cepDigitos,
      logradouro: logradouro.slice(0, 100),
      numero: numeroEnd.slice(0, 10),
      bairro: typeof endereco?.bairro === 'string' ? endereco.bairro.trim().slice(0, 60) : undefined,
      complemento: typeof endereco?.complemento === 'string' ? endereco.complemento.trim().slice(0, 40) : undefined,
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

    const nomeCliente = nome && typeof nome === 'string' && nome.trim() ? nome.trim() : (user.email ?? 'Cliente SyncroMoney')

    // Reaproveita o cliente do Asaas de tentativas anteriores (evita duplicar a cada tentativa)
    if (!customerId) {
      customerId = (await buscarClienteAsaasPorReferencia(user.id))?.id
    }

    if (!customerId) {
      const customer = await criarClienteAsaas({
        name: nomeCliente,
        cpfCnpj: cpfCnpj.replace(/\D/g, ''),
        email: user.email,
        telefone: telefoneDigitos,
        endereco: enderecoAsaas,
        externalReference: user.id,
      })
      customerId = customer.id
    } else {
      // Cliente já existente: garante telefone e nome atuais (exigidos pelo checkout de cartão)
      try {
        await atualizarClienteAsaas(customerId, { name: nomeCliente, email: user.email ?? undefined, telefone: telefoneDigitos, endereco: enderecoAsaas })
      } catch (err) {
        console.error('Falha ao atualizar cliente no Asaas:', err)
      }
    }

    const value = VALORES[plano as 'intro' | 'pro' | 'premium']
    const description = `Assinatura ${NOMES[plano as 'intro' | 'pro' | 'premium']}`
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    if (metodoPagamento === 'CREDIT_CARD') {
      const checkout = await criarCheckoutAssinatura({
        customerId,
        value,
        name: NOMES[plano as 'intro' | 'pro' | 'premium'],
        description,
        successUrl: `${appUrl}${plano === 'intro' ? '/intro' : '/dashboard'}?assinatura=sucesso`,
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
    // Recusa por dado inválido (ex.: CPF/CNPJ): o Asaas explica o motivo em português, e o cliente pode corrigir
    if (err instanceof AsaasError && err.status === 400) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro ao criar pagamento' }, { status: 500 })
  }
}

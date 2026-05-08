import { createClient } from '@/lib/supabase/client'
import type { Cartao, FaturaCartao } from '@/types'

export async function getCartoes(userId: string): Promise<Cartao[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('cartoes')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .eq('ativo', true)
    .order('banco')
  if (error) throw error
  return (data ?? []) as Cartao[]
}

export async function getCartaoById(id: string): Promise<Cartao | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('cartoes')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data as Cartao
}

export async function createCartao(userId: string, formData: Omit<Cartao, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'>): Promise<Cartao> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('cartoes')
    .insert({ ...formData, user_id: userId, limite_disponivel: formData.limite_total })
    .select()
    .single()
  if (error) throw error
  return data as Cartao
}

export async function updateCartao(
  userId: string,
  id: string,
  formData: Partial<Cartao>
): Promise<Cartao> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('cartoes')
    .update(formData)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()
  if (error) throw error
  return data as Cartao
}

export async function deleteCartao(userId: string, id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('cartoes')
    .update({ deleted_at: new Date().toISOString(), ativo: false })
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
}

export async function getFaturaAtual(cartaoId: string): Promise<FaturaCartao | null> {
  const supabase = createClient()
  const hoje = new Date()
  const mesRef = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0]

  const { data } = await supabase
    .from('faturas_cartao')
    .select('*')
    .eq('cartao_id', cartaoId)
    .eq('mes_referencia', mesRef)
    .single()

  return data as FaturaCartao | null
}

export async function getFaturas(cartaoId: string): Promise<FaturaCartao[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('faturas_cartao')
    .select('*')
    .eq('cartao_id', cartaoId)
    .order('mes_referencia', { ascending: false })
  if (error) throw error
  return (data ?? []) as FaturaCartao[]
}

export function calcularMesFatura(cartao: Cartao, dataCompra: Date): Date {
  const diaCompra = dataCompra.getDate()
  if (diaCompra > cartao.melhor_dia_compra) {
    return new Date(dataCompra.getFullYear(), dataCompra.getMonth() + 1, 1)
  }
  return new Date(dataCompra.getFullYear(), dataCompra.getMonth(), 1)
}

export async function getOuCriarFatura(
  userId: string,
  cartao: Cartao,
  mesRef: Date
): Promise<FaturaCartao> {
  const supabase = createClient()
  const mesRefStr = new Date(mesRef.getFullYear(), mesRef.getMonth(), 1)
    .toISOString()
    .split('T')[0]

  const { data: existing } = await supabase
    .from('faturas_cartao')
    .select('*')
    .eq('cartao_id', cartao.id)
    .eq('mes_referencia', mesRefStr)
    .single()

  if (existing) return existing as FaturaCartao

  const dataVenc = new Date(mesRef.getFullYear(), mesRef.getMonth(), cartao.dia_vencimento)
  const dataFech = new Date(mesRef.getFullYear(), mesRef.getMonth(), cartao.melhor_dia_compra)

  const { data, error } = await supabase
    .from('faturas_cartao')
    .insert({
      user_id: userId,
      cartao_id: cartao.id,
      mes_referencia: mesRefStr,
      valor_total: 0,
      valor_pago: 0,
      data_vencimento: dataVenc.toISOString().split('T')[0],
      data_fechamento: dataFech.toISOString().split('T')[0],
      status: 'aberta',
    })
    .select()
    .single()

  if (error) throw error
  return data as FaturaCartao
}

export async function pagarFatura(
  userId: string,
  faturaId: string,
  valor: number,
  contaCorrenteId: string
): Promise<void> {
  const supabase = createClient()

  const { data: fatura } = await supabase
    .from('faturas_cartao')
    .select('*, cartoes(*)')
    .eq('id', faturaId)
    .single()

  if (!fatura) throw new Error('Fatura não encontrada')

  const novoPago = fatura.valor_pago + valor
  const novoStatus = novoPago >= fatura.valor_total ? 'paga' : 'parcial'

  await supabase
    .from('faturas_cartao')
    .update({ valor_pago: novoPago, status: novoStatus })
    .eq('id', faturaId)

  const { data: conta } = await supabase
    .from('contas_correntes')
    .select('saldo_atual')
    .eq('id', contaCorrenteId)
    .single()

  if (conta) {
    const novoSaldo = conta.saldo_atual - valor
    await supabase
      .from('contas_correntes')
      .update({ saldo_atual: novoSaldo })
      .eq('id', contaCorrenteId)

    await supabase.from('movimentacoes_conta').insert({
      user_id: userId,
      conta_corrente_id: contaCorrenteId,
      tipo: 'debito',
      valor,
      saldo_anterior: conta.saldo_atual,
      saldo_posterior: novoSaldo,
      descricao: `Pagamento fatura cartão`,
      data_movimentacao: new Date().toISOString().split('T')[0],
    })
  }

  if (novoStatus === 'paga') {
    await supabase
      .from('cartoes')
      .update({ limite_disponivel: fatura.cartoes.limite_total })
      .eq('id', fatura.cartao_id)
  }
}

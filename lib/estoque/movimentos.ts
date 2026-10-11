import type { SupabaseClient } from '@supabase/supabase-js'

// Movimentação de estoque feita no servidor (NF-e de entrada e de saída).
// Mantém o mesmo modelo do PDV: produtos_fiscais.estoque (saldo total) +
// lotes_estoque (de onde a venda sai, FEFO) + movimentos_estoque (histórico).

const arred3 = (n: number) => Math.round(n * 1000) / 1000

export interface ItemBaixa {
  produto_id?: string | null
  codigo?: string | null
  quantidade: number
}

export interface ResultadoBaixa {
  baixados: number
  jaBaixada: boolean
  erros: string[]
}

// Dá baixa no estoque das mercadorias de uma NF-e de saída autorizada.
// Idempotente: se a nota (ref) já tem saída registrada, não baixa de novo —
// por isso pode ser chamada na emissão e de novo na sincronização de status.
// Nunca bloqueia: nota fiscal já emitida não pode ser desfeita por falta de
// saldo, então o estoque pode ficar negativo (aparece em "Abaixo do mínimo").
export async function baixarEstoqueNfe(
  supabase: SupabaseClient,
  userId: string,
  ref: string,
  itens: ItemBaixa[]
): Promise<ResultadoBaixa> {
  const resultado: ResultadoBaixa = { baixados: 0, jaBaixada: false, erros: [] }

  const { data: jaExiste } = await supabase
    .from('movimentos_estoque')
    .select('id')
    .eq('user_id', userId)
    .eq('tipo', 'saida')
    .eq('nf_referencia', ref)
    .limit(1)
  if (jaExiste && jaExiste.length > 0) {
    resultado.jaBaixada = true
    return resultado
  }

  const hoje = new Date().toISOString().slice(0, 10)

  for (const item of itens) {
    const qtd = Number(item.quantidade)
    if (!(qtd > 0)) continue

    let query = supabase
      .from('produtos_fiscais')
      .select('id, codigo, descricao, estoque')
      .eq('user_id', userId)
    if (item.produto_id) query = query.eq('id', item.produto_id)
    else if (item.codigo) query = query.eq('codigo', item.codigo)
    else continue
    const { data: produto } = await query.maybeSingle()
    // Item digitado à mão (sem produto cadastrado) não tem estoque para baixar
    if (!produto) continue

    // Sai primeiro o lote que vence primeiro; lote vencido não é vendido (igual ao PDV)
    let resto = qtd
    const { data: lotes } = await supabase
      .from('lotes_estoque')
      .select('id, qtd_saldo')
      .eq('user_id', userId)
      .eq('produto_id', produto.id)
      .eq('status', 'ativo')
      .gt('qtd_saldo', 0)
      .or(`validade.is.null,validade.gte.${hoje}`)
      .order('validade', { ascending: true, nullsFirst: false })
      .order('consignado', { ascending: false })
      .order('created_at', { ascending: true })
    for (const lote of lotes ?? []) {
      if (resto <= 0) break
      const saldo = Number(lote.qtd_saldo)
      const tira = Math.min(saldo, resto)
      const novoSaldo = arred3(saldo - tira)
      const { error } = await supabase
        .from('lotes_estoque')
        .update({ qtd_saldo: novoSaldo, status: novoSaldo === 0 ? 'esgotado' : 'ativo' })
        .eq('id', lote.id)
        .eq('user_id', userId)
      if (error) { resultado.erros.push(`Lote de ${produto.descricao}: ${error.message}`); break }
      resto = arred3(resto - tira)
    }

    const { error: errEstoque } = await supabase
      .from('produtos_fiscais')
      .update({ estoque: arred3(Number(produto.estoque ?? 0) - qtd) })
      .eq('id', produto.id)
      .eq('user_id', userId)
    if (errEstoque) { resultado.erros.push(`Estoque de ${produto.descricao}: ${errEstoque.message}`); continue }

    const { error: errMov } = await supabase.from('movimentos_estoque').insert({
      user_id: userId,
      produto_id: produto.id,
      produto_codigo: produto.codigo,
      produto_nome: produto.descricao,
      tipo: 'saida',
      quantidade: qtd,
      motivo: 'Venda por NF-e',
      nf_referencia: ref,
      data: new Date().toISOString(),
    })
    if (errMov) resultado.erros.push(`Movimentação de ${produto.descricao}: ${errMov.message}`)
    resultado.baixados += 1
  }

  return resultado
}

export interface EntradaLote {
  produtoId: string
  produtoCodigo: string
  produtoNome: string
  fornecedorId: string
  quantidade: number
  custo: number
  dataIso: string
  motivo: string
  nfReferencia: string
}

// Soma a quantidade ao estoque do produto, cria o lote (para o PDV vender dele)
// e registra a movimentação de entrada.
export async function registrarEntradaEstoque(
  supabase: SupabaseClient,
  userId: string,
  e: EntradaLote,
  estoqueAtual: number
): Promise<string | null> {
  const { error: errLote } = await supabase.from('lotes_estoque').insert({
    user_id: userId,
    produto_id: e.produtoId,
    fornecedor_id: e.fornecedorId,
    origem: 'entrada',
    consignado: false,
    custo_unitario: e.custo,
    validade: null,
    qtd_inicial: e.quantidade,
    qtd_saldo: e.quantidade,
  })
  if (errLote) return `Lote de ${e.produtoNome}: ${errLote.message}`

  const { error: errEstoque } = await supabase
    .from('produtos_fiscais')
    .update({ estoque: arred3(estoqueAtual + e.quantidade) })
    .eq('id', e.produtoId)
    .eq('user_id', userId)
  if (errEstoque) return `Estoque de ${e.produtoNome}: ${errEstoque.message}`

  const { error: errMov } = await supabase.from('movimentos_estoque').insert({
    user_id: userId,
    produto_id: e.produtoId,
    produto_codigo: e.produtoCodigo,
    produto_nome: e.produtoNome,
    tipo: 'entrada',
    quantidade: e.quantidade,
    motivo: e.motivo,
    nf_referencia: e.nfReferencia,
    data: e.dataIso,
  })
  return errMov ? `Movimentação de ${e.produtoNome}: ${errMov.message}` : null
}

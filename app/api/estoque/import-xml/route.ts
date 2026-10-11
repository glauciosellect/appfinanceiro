import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { registrarEntradaEstoque } from '@/lib/estoque/movimentos'

interface ItemImport {
  produto_id?: string | null   // produto já cadastrado a atualizar; vazio = criar produto novo
  barcode?: string | null
  descricao: string
  ncm: string
  cfop: string
  unidade: string
  quantidade: number
  custo: number                // custo unitário EXATAMENTE como veio na nota fiscal
  margem: number               // % de lucro, aplicada SOBRE o custo só para chegar ao preço de venda
  preco_venda: number
}

interface ImportPayload {
  numero: string
  serie: string
  dataEmissao: string
  fornecedorNome: string
  fornecedorCnpj: string
  naturezaOperacao: string
  itens: ItemImport[]
}

const arred = (n: number) => Math.round(n * 100) / 100

function maskCnpj(d: string) {
  return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : d
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = (await req.json()) as ImportPayload
  if (!Array.isArray(body.itens) || body.itens.length === 0) {
    return NextResponse.json({ ok: false, erros: ['A nota não tem itens para lançar.'] }, { status: 400 })
  }
  const nfRef = `NF-e ${body.serie}/${body.numero} — ${body.fornecedorNome}`

  // Mesma nota lançada duas vezes dobraria o estoque
  const { data: duplicada } = await supabase
    .from('movimentos_estoque')
    .select('id')
    .eq('user_id', user.id)
    .eq('tipo', 'entrada')
    .eq('nf_referencia', nfRef)
    .limit(1)
  if (duplicada && duplicada.length > 0) {
    return NextResponse.json({ ok: false, erros: ['Esta nota já foi lançada no estoque.'] }, { status: 409 })
  }

  // Fornecedor: usa o cadastrado ou cadastra automaticamente
  const cnpjLimpo = (body.fornecedorCnpj ?? '').replace(/\D/g, '')
  let fornecedorId: string | null = null
  if (cnpjLimpo) {
    const { data } = await supabase
      .from('fornecedores')
      .select('id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .or(`cpf_cnpj.eq.${cnpjLimpo},cpf_cnpj.eq.${maskCnpj(cnpjLimpo)}`)
      .limit(1)
    fornecedorId = data?.[0]?.id ?? null
  }
  if (!fornecedorId) {
    const { data } = await supabase
      .from('fornecedores')
      .select('id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .eq('nome', body.fornecedorNome)
      .limit(1)
    fornecedorId = data?.[0]?.id ?? null
  }
  if (!fornecedorId) {
    const { data, error } = await supabase
      .from('fornecedores')
      .insert({
        user_id: user.id,
        nome: body.fornecedorNome,
        cpf_cnpj: cnpjLimpo || null,
        tipo: cnpjLimpo.length === 11 ? 'pessoa_fisica' : 'pessoa_juridica',
        ativo: true,
      })
      .select('id')
      .single()
    if (error || !data) {
      return NextResponse.json({ ok: false, erros: [`Não foi possível cadastrar o fornecedor: ${error?.message}`] }, { status: 500 })
    }
    fornecedorId = data.id as string
  }

  // Próximo código sequencial para produtos novos (mesmo padrão da tela Produtos: 0001, 0002...)
  const { data: codigos } = await supabase.from('produtos_fiscais').select('codigo').eq('user_id', user.id)
  let proximoCodigo = (codigos ?? []).reduce((max, c) => {
    const n = /^\d+$/.test(String(c.codigo)) ? Number(c.codigo) : 0
    return Math.max(max, n)
  }, 0) + 1

  const erros: string[] = []
  let criados = 0
  let atualizados = 0
  const dataIso = body.dataEmissao ? new Date(body.dataEmissao + 'T12:00:00').toISOString() : new Date().toISOString()

  for (const item of body.itens) {
    const quantidade = Number(item.quantidade)
    const custo = arred(Number(item.custo))
    if (!(quantidade > 0) || !(custo >= 0)) { erros.push(`Quantidade ou custo inválido: ${item.descricao}`); continue }

    // O custo guardado é o da nota. O preço de venda é que recebe a margem.
    let precoVenda = arred(Number(item.preco_venda) || 0)
    let margem = Math.max(0, Number(item.margem) || 0)
    if (precoVenda <= 0) precoVenda = arred(custo * (1 + margem / 100))
    if (custo > 0) margem = Math.min(999.99, Math.max(0, Math.round((precoVenda / custo - 1) * 10000) / 100))

    let produtoId: string
    let produtoCodigo: string
    let estoqueAtual = 0

    if (item.produto_id) {
      const { data: existente } = await supabase
        .from('produtos_fiscais')
        .select('id, codigo, estoque')
        .eq('id', item.produto_id)
        .eq('user_id', user.id)
        .maybeSingle()
      if (!existente) { erros.push(`Produto não encontrado: ${item.descricao}`); continue }

      const { error } = await supabase
        .from('produtos_fiscais')
        .update({ preco_custo: custo, margem_lucro: margem, preco_venda: precoVenda })
        .eq('id', existente.id)
        .eq('user_id', user.id)
      if (error) { erros.push(`Erro ao atualizar ${item.descricao}: ${error.message}`); continue }
      produtoId = existente.id as string
      produtoCodigo = existente.codigo as string
      estoqueAtual = Number(existente.estoque ?? 0)
      atualizados += 1
    } else {
      const codigo = String(proximoCodigo).padStart(4, '0')
      const { data: novo, error } = await supabase
        .from('produtos_fiscais')
        .insert({
          user_id: user.id,
          codigo,
          descricao: item.descricao,
          barcode: item.barcode || null,
          ncm: item.ncm || '',
          cfop: item.cfop || '5102',
          unidade: item.unidade || 'UN',
          preco_custo: custo,
          margem_lucro: margem,
          preco_venda: precoVenda,
          estoque: 0,
          estoque_minimo: 0,
          ativo: true,
        })
        .select('id')
        .single()
      if (error || !novo) { erros.push(`Erro ao cadastrar ${item.descricao}: ${error?.message}`); continue }
      proximoCodigo += 1
      produtoId = novo.id as string
      produtoCodigo = codigo
      criados += 1
    }

    const erroEstoque = await registrarEntradaEstoque(supabase, user.id, {
      produtoId,
      produtoCodigo,
      produtoNome: item.descricao,
      fornecedorId,
      quantidade,
      custo,
      dataIso,
      motivo: `Compra — ${body.naturezaOperacao || 'NF-e de entrada'}`,
      nfReferencia: nfRef,
    }, estoqueAtual)
    if (erroEstoque) erros.push(erroEstoque)
  }

  if (erros.length > 0) return NextResponse.json({ ok: false, erros, criados, atualizados }, { status: 207 })
  return NextResponse.json({ ok: true, criados, atualizados })
}

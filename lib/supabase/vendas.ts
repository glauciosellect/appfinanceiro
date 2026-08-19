import { createClient } from '@/lib/supabase/client'
import type {
  Produto,
  Venda,
  VendaItem,
  VendaPagamento,
  VendaItemFormData,
  VendaPagamentoFormData,
  FormaPagamento,
  ParcelaReceber,
} from '@/types'

// Linha crua vinda de produtos_fiscais, na forma necessária para montar um Produto.
type ProdutoFiscalRow = {
  id: string
  descricao: string
  barcode: string | null
  plu: string | null
  unidade: string | null
  preco_custo: number | null
  preco_venda: number | null
  margem_lucro: number | null
  ativo: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

// Reshape de produtos_fiscais -> tipo Produto (mesmos nomes de campo usados por
// pdv/page.tsx: nome, preco_unitario como preço de VENDA), para que o
// componente PDV não precise mudar nada ao consumir o resultado.
function mapProdutoFiscalParaProduto(p: ProdutoFiscalRow): Produto {
  return {
    id: p.id,
    user_id: '',
    nome: p.descricao,
    detalhes: undefined,
    barcode: p.barcode ?? undefined,
    plu: p.plu ?? undefined,
    unidade_medida: p.unidade ?? 'UN',
    preco_custo: p.preco_custo ?? 0,
    preco_unitario: p.preco_venda || p.preco_custo || 0,
    margem_lucro: p.margem_lucro ?? 0,
    ativo: p.ativo,
    created_at: p.created_at,
    updated_at: p.updated_at,
    deleted_at: p.deleted_at ?? undefined,
  }
}

export async function buscarProdutoParaVenda(userId: string, termo: string): Promise<Produto[]> {
  const supabase = createClient()

  const { data: exato } = await supabase
    .from('produtos_fiscais')
    .select('id, descricao, barcode, plu, unidade, preco_custo, preco_venda, margem_lucro, ativo, created_at, updated_at, deleted_at')
    .eq('user_id', userId)
    .eq('ativo', true)
    .is('deleted_at', null)
    .or(`barcode.eq.${termo},plu.eq.${termo}`)
    .limit(1)

  if (exato && exato.length > 0) return (exato as ProdutoFiscalRow[]).map(mapProdutoFiscalParaProduto)

  const { data, error } = await supabase
    .from('produtos_fiscais')
    .select('id, descricao, barcode, plu, unidade, preco_custo, preco_venda, margem_lucro, ativo, created_at, updated_at, deleted_at')
    .eq('user_id', userId)
    .eq('ativo', true)
    .is('deleted_at', null)
    .ilike('descricao', `%${termo}%`)
    .order('descricao')
    .limit(20)
  if (error) throw error
  return ((data ?? []) as ProdutoFiscalRow[]).map(mapProdutoFiscalParaProduto)
}

export async function getFormasPagamento(userId: string): Promise<FormaPagamento[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('formas_pagamento')
    .select('*')
    .or(`user_id.eq.${userId},user_id.is.null`)
    .eq('ativo', true)
    .order('nome')
  if (error) throw error
  return (data ?? []) as FormaPagamento[]
}

export async function getVendaAtual(userId: string): Promise<Venda | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('vendas')
    .select('*, clientes(id, nome)')
    .eq('user_id', userId)
    .eq('status', 'em_andamento')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  if (error) return null
  return data as Venda
}

export async function getVendasEmEspera(userId: string): Promise<Venda[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('vendas')
    .select('*, clientes(id, nome)')
    .eq('user_id', userId)
    .eq('status', 'em_espera')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Venda[]
}

export async function getVendaComItens(
  userId: string,
  id: string
): Promise<{ venda: Venda; itens: VendaItem[]; pagamentos: VendaPagamento[] } | null> {
  const supabase = createClient()

  const { data: venda, error: errVenda } = await supabase
    .from('vendas')
    .select('*, clientes(id, nome)')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  if (errVenda) return null

  const { data: itens, error: errItens } = await supabase
    .from('vendas_itens')
    .select('*')
    .eq('venda_id', id)
    .eq('user_id', userId)
    .order('created_at')
  if (errItens) throw errItens

  const { data: pagamentos, error: errPagamentos } = await supabase
    .from('vendas_pagamentos')
    .select('*')
    .eq('venda_id', id)
    .eq('user_id', userId)
    .order('created_at')
  if (errPagamentos) throw errPagamentos

  return {
    venda: venda as Venda,
    itens: (itens ?? []) as VendaItem[],
    pagamentos: (pagamentos ?? []) as VendaPagamento[],
  }
}

export async function gerarNumeroSequencialVenda(userId: string): Promise<string> {
  const supabase = createClient()
  const anoAtual = new Date().getFullYear()
  const { count, error } = await supabase
    .from('vendas')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .like('numero_sequencial', `%-${anoAtual}`)
  if (error) throw error
  const proximo = (count ?? 0) + 1
  return `${String(proximo).padStart(3, '0')}-${anoAtual}`
}

export async function criarVenda(userId: string, caixaSessaoId: string, clienteId?: string): Promise<Venda> {
  const supabase = createClient()
  const numero_sequencial = await gerarNumeroSequencialVenda(userId)

  const { data, error } = await supabase
    .from('vendas')
    .insert({
      user_id: userId,
      numero_sequencial,
      cliente_id: clienteId,
      status: 'em_andamento',
      caixa_sessao_id: caixaSessaoId,
      subtotal: 0,
      desconto: 0,
      total: 0,
    })
    .select('*, clientes(id, nome)')
    .single()
  if (error) throw error
  return data as Venda
}

export async function adicionarItemVenda(
  userId: string,
  vendaId: string,
  item: VendaItemFormData
): Promise<VendaItem> {
  const supabase = createClient()
  const subtotal = item.quantidade * item.preco_unitario - item.desconto_item

  const { data, error } = await supabase
    .from('vendas_itens')
    .insert({ ...item, venda_id: vendaId, user_id: userId, subtotal, cancelado: false })
    .select()
    .single()
  if (error) throw error

  await recalcularTotaisVenda(userId, vendaId)
  return data as VendaItem
}

export async function removerItemVenda(userId: string, vendaId: string, itemId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('vendas_itens')
    .delete()
    .eq('id', itemId)
    .eq('venda_id', vendaId)
    .eq('user_id', userId)
  if (error) throw error

  await recalcularTotaisVenda(userId, vendaId)
}

export async function pausarVenda(userId: string, vendaId: string, identificador: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('vendas')
    .update({ status: 'em_espera', identificador_espera: identificador })
    .eq('id', vendaId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function retomarVenda(userId: string, vendaId: string): Promise<Venda> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('vendas')
    .update({ status: 'em_andamento' })
    .eq('id', vendaId)
    .eq('user_id', userId)
    .select('*, clientes(id, nome)')
    .single()
  if (error) throw error
  return data as Venda
}

// Classifica um pagamento como cartao_credito (parcela(s) 'aberto',
// vencimento futuro) ou "à vista" (dinheiro/pix/cartao_debito e fallback
// ted/doc/boleto/cheque/outro — crédito imediato). Busca formas_pagamento.tipo
// via forma_pagamento_id, mesmo padrão de ehPagamentoEmDinheiro em caixa.ts.
// Fallback defensivo por nome quando não há forma_pagamento_id (linhas
// legadas/importadas), comparando com o valor de seed conhecido.
async function ehCartaoCredito(
  supabase: ReturnType<typeof createClient>,
  pagamento: VendaPagamentoFormData
): Promise<boolean> {
  if (pagamento.forma_pagamento_id) {
    const { data: forma } = await supabase
      .from('formas_pagamento')
      .select('tipo')
      .eq('id', pagamento.forma_pagamento_id)
      .single()
    if (forma) return forma.tipo === 'cartao_credito'
  }
  return pagamento.forma_pagamento_nome === 'Cartão de Crédito'
}

// Gera as parcelas de uma venda em cartão de crédito: valor dividido
// igualmente entre as parcelas, com a última absorvendo o resto do
// arredondamento (mesma técnica de gerarParcelas em contas-receber.ts/
// gerarParcelasPagar em contas-pagar.ts), vencimentos espaçados por ~30 dias
// a partir de dataPrimeiraParcela.
function gerarParcelasCartao(
  userId: string,
  contaReceberId: string,
  valorTotal: number,
  numParcelas: number,
  dataPrimeiraParcela: string
): Omit<ParcelaReceber, 'id' | 'created_at' | 'updated_at'>[] {
  const valorParcela = Math.floor((valorTotal / numParcelas) * 100) / 100
  const ajuste = Math.round((valorTotal - valorParcela * numParcelas) * 100) / 100
  const dataPrimeiraDate = new Date(dataPrimeiraParcela + 'T12:00:00')

  return Array.from({ length: numParcelas }, (_, i) => {
    const dataVenc = new Date(dataPrimeiraDate)
    dataVenc.setMonth(dataVenc.getMonth() + i)
    return {
      conta_receber_id: contaReceberId,
      user_id: userId,
      numero_parcela: i + 1,
      total_parcelas: numParcelas,
      valor: i === numParcelas - 1 ? valorParcela + ajuste : valorParcela,
      valor_recebido: undefined,
      data_vencimento: dataVenc.toISOString().split('T')[0],
      data_recebimento: undefined,
      juros: 0,
      multa: 0,
      desconto: 0,
      status: 'aberto' as const,
      forma_pagamento_id: undefined,
      conta_corrente_id: undefined,
      observacoes: undefined,
    }
  })
}

export async function concluirVenda(
  userId: string,
  vendaId: string,
  pagamentos: VendaPagamentoFormData[]
): Promise<Venda> {
  const supabase = createClient()

  const registros = pagamentos.map((p) => ({
    ...p,
    venda_id: vendaId,
    user_id: userId,
    troco: p.troco ?? 0,
  }))
  const { error: errPagamentos } = await supabase.from('vendas_pagamentos').insert(registros)
  if (errPagamentos) throw errPagamentos

  // Busca dados da venda necessários para gerar os lançamentos financeiros.
  const { data: vendaAtual, error: errVendaAtual } = await supabase
    .from('vendas')
    .select('caixa_sessao_id, cliente_id, numero_sequencial')
    .eq('id', vendaId)
    .eq('user_id', userId)
    .single()
  if (errVendaAtual) throw errVendaAtual

  const clienteId: string | undefined = vendaAtual.cliente_id ?? undefined
  const numeroSequencial: string = vendaAtual.numero_sequencial

  // Conta corrente vinculada à sessão de caixa (opcional — ver Task 1). Só
  // formas_pagamento.tipo é um enum simples, sem vínculo de conta próprio;
  // quem decide qual conta recebe o crédito é a sessão de caixa.
  let contaCorrenteId: string | undefined
  if (vendaAtual.caixa_sessao_id) {
    const { data: sessao } = await supabase
      .from('caixa_sessoes')
      .select('conta_corrente_id')
      .eq('id', vendaAtual.caixa_sessao_id)
      .single()
    contaCorrenteId = sessao?.conta_corrente_id ?? undefined
  }

  const hoje = new Date().toISOString().split('T')[0]

  for (const pagamento of pagamentos) {
    // Classificação: dinheiro, pix e cartao_debito são "à vista" (crédito
    // imediato); cartao_credito é sempre parcela(s) 'aberto' com vencimento
    // futuro, mesmo em 1x; o resto (ted/doc/boleto/cheque/outro) cai no
    // fallback "à vista" por padrão.
    const isCartaoCredito = await ehCartaoCredito(supabase, pagamento)

    if (!isCartaoCredito) {
      // ---- Branch "à vista": dinheiro, pix, cartao_debito, e fallback
      // ted/doc/boleto/cheque/outro ----
      const { data: contaReceber, error: errContaReceber } = await supabase
        .from('contas_receber')
        .insert({
          user_id: userId,
          cliente_id: clienteId,
          conta_corrente_id: contaCorrenteId,
          descricao: `Venda PDV Nº ${numeroSequencial}`,
          valor_total: pagamento.valor,
          valor_entrada: 0,
          num_parcelas: 1,
          juros_percentual: 0,
          multa_percentual: 0,
          desconto_valor: 0,
          data_primeira_parcela: hoje,
          status: 'quitado',
        })
        .select()
        .single()
      if (errContaReceber) throw errContaReceber

      const { data: parcelaReceber, error: errParcelaReceber } = await supabase
        .from('parcelas_receber')
        .insert({
          conta_receber_id: contaReceber.id,
          user_id: userId,
          numero_parcela: 1,
          total_parcelas: 1,
          valor: pagamento.valor,
          valor_recebido: pagamento.valor,
          data_vencimento: hoje,
          data_recebimento: hoje,
          status: 'recebido',
          conta_corrente_id: contaCorrenteId,
        })
        .select()
        .single()
      if (errParcelaReceber) throw errParcelaReceber

      // Credita a conta corrente vinculada, se houver — mesmo padrão de
      // pagarFatura em cartoes.ts: lê saldo_atual, calcula novo saldo,
      // grava update + movimentacoes_conta em sequência (sem transação).
      if (contaCorrenteId) {
        const { data: conta } = await supabase
          .from('contas_correntes')
          .select('saldo_atual')
          .eq('id', contaCorrenteId)
          .single()

        if (conta) {
          const novoSaldo = conta.saldo_atual + pagamento.valor
          await supabase
            .from('contas_correntes')
            .update({ saldo_atual: novoSaldo })
            .eq('id', contaCorrenteId)

          await supabase.from('movimentacoes_conta').insert({
            user_id: userId,
            conta_corrente_id: contaCorrenteId,
            tipo: 'credito',
            valor: pagamento.valor,
            saldo_anterior: conta.saldo_atual,
            saldo_posterior: novoSaldo,
            descricao: `Venda PDV Nº ${numeroSequencial}`,
            data_movimentacao: hoje,
            parcela_receber_id: parcelaReceber.id,
          })
        }
      }
    } else {
      // ---- Branch cartao_credito: sempre parcelas 'aberto', mesmo 1x ----
      const numParcelas = pagamento.parcelas ?? 1
      const dataPrimeiraParcela = new Date()
      dataPrimeiraParcela.setDate(dataPrimeiraParcela.getDate() + 30)
      const dataPrimeiraParcelaStr = dataPrimeiraParcela.toISOString().split('T')[0]

      const bandeiraTxt = pagamento.bandeira ? ` ${pagamento.bandeira}` : ''
      const descricao = `Venda PDV Nº ${numeroSequencial} (Cartão${bandeiraTxt} ${numParcelas}x)`

      const { data: contaReceber, error: errContaReceber } = await supabase
        .from('contas_receber')
        .insert({
          user_id: userId,
          cliente_id: clienteId,
          descricao,
          valor_total: pagamento.valor,
          valor_entrada: 0,
          num_parcelas: numParcelas,
          juros_percentual: 0,
          multa_percentual: 0,
          desconto_valor: 0,
          data_primeira_parcela: dataPrimeiraParcelaStr,
          status: 'aberto',
        })
        .select()
        .single()
      if (errContaReceber) throw errContaReceber

      const parcelas = gerarParcelasCartao(
        userId,
        contaReceber.id,
        pagamento.valor,
        numParcelas,
        dataPrimeiraParcelaStr
      )
      const { error: errParcelas } = await supabase.from('parcelas_receber').insert(parcelas)
      if (errParcelas) throw errParcelas
    }
  }

  // TODO: decrementar estoque ao concluir venda

  const { data, error } = await supabase
    .from('vendas')
    .update({ status: 'concluida' })
    .eq('id', vendaId)
    .eq('user_id', userId)
    .select('*, clientes(id, nome)')
    .single()
  if (error) throw error
  return data as Venda
}

export async function cancelarVenda(userId: string, vendaId: string, motivo: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('vendas')
    .update({
      status: 'cancelada',
      cancelada_motivo: motivo,
      cancelada_em: new Date().toISOString(),
    })
    .eq('id', vendaId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function recalcularTotaisVenda(userId: string, vendaId: string): Promise<Venda> {
  const supabase = createClient()

  const { data: itens, error: errItens } = await supabase
    .from('vendas_itens')
    .select('subtotal')
    .eq('venda_id', vendaId)
    .eq('user_id', userId)
    .eq('cancelado', false)
  if (errItens) throw errItens

  const subtotal = (itens ?? []).reduce((s: number, i: { subtotal: number }) => s + i.subtotal, 0)
  const total = subtotal

  const { data, error } = await supabase
    .from('vendas')
    .update({ subtotal, total })
    .eq('id', vendaId)
    .eq('user_id', userId)
    .select('*, clientes(id, nome)')
    .single()
  if (error) throw error
  return data as Venda
}

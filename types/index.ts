// ============================================================
// TIPOS EXISTENTES (transactions)
// ============================================================
export type TransactionType = 'income' | 'expense'

export interface Category {
  id: string
  name: string
  color: string
  icon: string
  type: TransactionType
}

export interface Transaction {
  id: string
  user_id: string
  type: TransactionType
  amount: number
  description: string
  category: string
  date: string
  conta_corrente_id?: string | null
  created_at: string
}

export interface TransactionFilters {
  period: 'current_month' | 'last_month' | 'last_3_months' | 'custom'
  category: string
  type: TransactionType | 'all'
  startDate?: string
  endDate?: string
}

export interface MonthlySummary {
  totalIncome: number
  totalExpenses: number
  balance: number
}

export interface CategorySummary {
  category: string
  amount: number
  color: string
  percentage: number
}

// ============================================================
// CLIENTES
// ============================================================
export type TipoPessoa = 'pessoa_fisica' | 'pessoa_juridica'

export interface Cliente {
  id: string
  user_id: string
  nome: string
  cpf_cnpj?: string
  inscricao_estadual?: string
  telefone?: string
  email?: string
  cep?: string
  endereco?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  estado?: string
  tipo: TipoPessoa
  observacoes?: string
  ativo: boolean
  created_at: string
  updated_at: string
  deleted_at?: string
}

export interface ClienteFormData {
  nome: string
  cpf_cnpj?: string
  inscricao_estadual?: string
  telefone?: string
  email?: string
  cep?: string
  endereco?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  estado?: string
  tipo: TipoPessoa
  observacoes?: string
}

// ============================================================
// TRANSPORTADORAS
// ============================================================
export interface Transportadora {
  id: string
  user_id: string
  razao_social: string
  nome_fantasia?: string
  cnpj?: string
  ie?: string
  rntrc?: string
  cep?: string
  endereco?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  estado?: string
  telefone?: string
  email?: string
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface TransportadoraFormData {
  razao_social: string
  nome_fantasia?: string
  cnpj?: string
  ie?: string
  rntrc?: string
  cep?: string
  endereco?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  estado?: string
  telefone?: string
  email?: string
}

// ============================================================
// FORNECEDORES
// ============================================================
export interface Fornecedor {
  id: string
  user_id: string
  nome: string
  cpf_cnpj?: string
  telefone?: string
  email?: string
  cep?: string
  endereco?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  estado?: string
  tipo: TipoPessoa
  categoria?: string
  observacoes?: string
  ativo: boolean
  created_at: string
  updated_at: string
  deleted_at?: string
}

export interface FornecedorFormData {
  nome: string
  cpf_cnpj?: string
  telefone?: string
  email?: string
  cep?: string
  endereco?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  estado?: string
  tipo: TipoPessoa
  categoria?: string
  observacoes?: string
}

// ============================================================
// CATEGORIAS
// ============================================================
export type TipoCategoria = 'receita' | 'despesa' | 'ambos'

export interface Categoria {
  id: string
  user_id?: string
  nome: string
  tipo: TipoCategoria
  cor: string
  icone: string
  ativo: boolean
  created_at: string
}

// ============================================================
// FORMAS DE PAGAMENTO
// ============================================================
export type TipoFormaPagamento =
  | 'dinheiro' | 'pix' | 'ted' | 'doc' | 'boleto'
  | 'cartao_credito' | 'cartao_debito' | 'cheque' | 'outro'

export interface FormaPagamento {
  id: string
  user_id?: string
  nome: string
  tipo: TipoFormaPagamento
  ativo: boolean
  created_at: string
}

// ============================================================
// CONTAS CORRENTES
// ============================================================
export type TipoConta = 'corrente' | 'poupanca' | 'investimento' | 'caixa'

export interface ContaCorrente {
  id: string
  user_id: string
  nome_apelido: string
  banco: string
  agencia?: string
  conta?: string
  digito?: string
  tipo_conta: TipoConta
  saldo_inicial: number
  saldo_atual: number
  chave_pix?: string
  ativo: boolean
  created_at: string
  updated_at: string
  deleted_at?: string
}

export interface ContaCorrenteFormData {
  nome_apelido: string
  banco?: string
  agencia?: string
  conta?: string
  digito?: string
  tipo_conta: TipoConta
  saldo_inicial: number
  chave_pix?: string
}

// ============================================================
// CARTÕES
// ============================================================
export type Bandeira = 'visa' | 'mastercard' | 'elo' | 'amex' | 'hipercard' | 'outro'

export interface Cartao {
  id: string
  user_id: string
  conta_corrente_id?: string
  banco: string
  bandeira: Bandeira
  nome_titular: string
  final_cartao?: string
  limite_total: number
  limite_disponivel: number
  dia_vencimento: number
  melhor_dia_compra: number
  ativo: boolean
  created_at: string
  updated_at: string
  deleted_at?: string
}

// ============================================================
// CONTAS A RECEBER
// ============================================================
export type StatusConta = 'aberto' | 'parcial' | 'quitado' | 'cancelado'
export type StatusParcela = 'aberto' | 'recebido' | 'pago' | 'atrasado' | 'cancelado' | 'entrada'

export interface ContaReceber {
  id: string
  user_id: string
  cliente_id?: string
  categoria_id?: string
  forma_pagamento_id?: string
  conta_corrente_id?: string
  descricao: string
  valor_total: number
  valor_entrada: number
  num_parcelas: number
  juros_percentual: number
  multa_percentual: number
  desconto_valor: number
  data_primeira_parcela: string
  observacoes?: string
  status: StatusConta
  created_at: string
  updated_at: string
  deleted_at?: string
  // joins
  clientes?: Pick<Cliente, 'id' | 'nome' | 'cpf_cnpj'>
  categorias?: Pick<Categoria, 'id' | 'nome' | 'cor' | 'icone'>
}

export interface ParcelaReceber {
  id: string
  conta_receber_id: string
  user_id: string
  numero_parcela: number
  total_parcelas: number
  valor: number
  valor_recebido?: number
  data_vencimento: string
  data_recebimento?: string
  juros: number
  multa: number
  desconto: number
  status: StatusParcela
  forma_pagamento_id?: string
  conta_corrente_id?: string
  observacoes?: string
  created_at: string
  updated_at: string
  // joins
  contas_receber?: Pick<ContaReceber, 'id' | 'descricao' | 'valor_total'>
  clientes?: Pick<Cliente, 'id' | 'nome'>
}

// ============================================================
// CONTAS A PAGAR
// ============================================================
export interface ContaPagar {
  id: string
  user_id: string
  fornecedor_id?: string
  categoria_id?: string
  forma_pagamento_id?: string
  conta_corrente_id?: string
  cartao_id?: string
  centro_custo_id?: string
  descricao: string
  valor_total: number
  num_parcelas: number
  juros_percentual: number
  multa_percentual: number
  desconto_valor: number
  data_primeira_parcela: string
  observacoes?: string
  status: StatusConta
  created_at: string
  updated_at: string
  deleted_at?: string
  // joins
  fornecedores?: Pick<Fornecedor, 'id' | 'nome' | 'cpf_cnpj'>
  categorias?: Pick<Categoria, 'id' | 'nome' | 'cor' | 'icone'>
}

export interface ParcelaPagar {
  id: string
  conta_pagar_id: string
  user_id: string
  numero_parcela: number
  total_parcelas: number
  valor: number
  valor_pago?: number
  data_vencimento: string
  data_pagamento?: string
  juros: number
  multa: number
  desconto: number
  status: StatusParcela
  forma_pagamento_id?: string
  conta_corrente_id?: string
  cartao_id?: string
  observacoes?: string
  created_at: string
  updated_at: string
}

// ============================================================
// FATURA DE CARTÃO
// ============================================================
export type StatusFatura = 'aberta' | 'fechada' | 'paga' | 'parcial'

export interface FaturaCartao {
  id: string
  user_id: string
  cartao_id: string
  mes_referencia: string
  valor_total: number
  valor_pago: number
  data_vencimento: string
  data_fechamento: string
  status: StatusFatura
  created_at: string
  updated_at: string
}

// ============================================================
// MOVIMENTAÇÕES DE CONTA
// ============================================================
export type TipoMovimentacao =
  | 'credito' | 'debito' | 'transferencia_entrada' | 'transferencia_saida'

export interface MovimentacaoConta {
  id: string
  user_id: string
  conta_corrente_id: string
  tipo: TipoMovimentacao
  valor: number
  saldo_anterior: number
  saldo_posterior: number
  descricao: string
  data_movimentacao: string
  parcela_receber_id?: string
  parcela_pagar_id?: string
  created_at: string
}

// ============================================================
// CENTRO DE CUSTO
// ============================================================
export interface CentroCusto {
  id: string
  user_id: string
  nome: string
  descricao?: string
  ativo: boolean
  created_at: string
}

// ============================================================
// RESUMOS / DASHBOARD
// ============================================================
export interface ResumoDashboard {
  saldoTotal: number
  totalReceber: number
  totalPagar: number
  resultadoMensal: number
  recebimentosVencidos: number
  pagamentosVencidos: number
  venceHoje: number
  valorFaturaProxima: number
}

export interface FluxoCaixaItem {
  data: string
  descricao: string
  conta_nome: string
  entrada: number
  saida: number
  saldo: number
  realizado: boolean
}

// ============================================================
// PRODUTOS (catálogo — compartilhado entre Orçamento e PDV)
// ============================================================
export interface Produto {
  id: string
  user_id: string
  nome: string
  detalhes?: string
  barcode?: string
  plu?: string
  unidade_medida: string
  preco_custo: number
  preco_unitario: number
  margem_lucro: number
  ativo: boolean
  created_at: string
  updated_at: string
  deleted_at?: string
}

export interface ProdutoFormData {
  nome: string
  detalhes?: string
  barcode?: string
  plu?: string
  unidade_medida: string
  preco_custo: number
  preco_unitario: number
}

// ============================================================
// SERVIÇOS (catálogo)
// ============================================================
export interface Servico {
  id: string
  user_id: string
  nome: string
  detalhes?: string
  unidade_medida: string
  preco_custo: number
  preco_unitario: number
  margem_lucro: number
  ativo: boolean
  created_at: string
  updated_at: string
  deleted_at?: string
}

export interface ServicoFormData {
  nome: string
  detalhes?: string
  unidade_medida: string
  preco_custo: number
  preco_unitario: number
}

// ============================================================
// FISCAL CONFIG
// ============================================================
export interface FiscalConfig {
  id: string
  user_id: string
  cnpj?: string
  razao_social?: string
  inscricao_estadual?: string
  inscricao_municipal?: string
  regime_tributario?: string
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  municipio?: string
  uf?: string
  telefone?: string
  email?: string
  habilita_nfse?: boolean
  habilita_nfe?: boolean
  ambiente?: string
  focus_status?: string
  focus_erro?: string
  certificado_status?: string
  certificado_vencimento?: string
  ativo?: boolean
  created_at?: string
  updated_at?: string
  // Orçamento PDF: logo + toggles de visibilidade
  logo_url?: string
  mostrar_logo: boolean
  mostrar_cnpj: boolean
  mostrar_endereco: boolean
  mostrar_telefone: boolean
  mostrar_email: boolean
}

// ============================================================
// PEDIDOS (Orçamento/Pedido)
// ============================================================
export type StatusPedido = 'pendente' | 'aguardando_pagamento' | 'concluido' | 'cancelado'
export type TipoDesconto = 'percentual' | 'valor'
export type TipoItemPedido = 'produto' | 'servico'

export interface Pedido {
  id: string
  user_id: string
  numero_sequencial: string
  cliente_id?: string
  data_pedido: string
  referencia?: string
  observacoes?: string
  titulo?: string
  condicoes_pagamento?: string
  garantia?: string
  informacoes_adicionais?: string
  status: StatusPedido
  desconto_tipo: TipoDesconto
  desconto_valor: number
  subtotal: number
  total: number
  created_at: string
  updated_at: string
  deleted_at?: string
  clientes?: { id: string; nome: string; telefone?: string } | null
  token_publico: string
  aceito_em?: string
  aceito_ip?: string
}

export interface PedidoItem {
  id: string
  pedido_id: string
  user_id: string
  tipo: TipoItemPedido
  item_id: string
  nome_item: string
  quantidade: number
  preco_unitario: number
  desconto_tipo: TipoDesconto
  desconto_valor: number
  subtotal: number
  created_at: string
}

export interface PedidoFormData {
  cliente_id?: string
  data_pedido: string
  referencia?: string
  observacoes?: string
  titulo?: string
  condicoes_pagamento?: string
  garantia?: string
  informacoes_adicionais?: string
  desconto_tipo: TipoDesconto
  desconto_valor: number
}

export interface PedidoItemFormData {
  tipo: TipoItemPedido
  item_id: string
  nome_item: string
  quantidade: number
  preco_unitario: number
  desconto_tipo: TipoDesconto
  desconto_valor: number
}

// ============================================================
// PDV — VENDAS
// ============================================================
export type StatusVenda = 'em_andamento' | 'em_espera' | 'concluida' | 'cancelada'

export interface Venda {
  id: string
  user_id: string
  numero_sequencial: string
  caixa_sessao_id?: string
  cliente_id?: string
  status: StatusVenda
  identificador_espera?: string
  subtotal: number
  desconto: number
  total: number
  cancelada_motivo?: string
  cancelada_por?: string
  cancelada_em?: string
  created_at: string
  updated_at: string
  clientes?: { id: string; nome: string } | null
}

export interface VendaItem {
  id: string
  venda_id: string
  user_id: string
  produto_id: string
  nome_produto: string
  quantidade: number
  preco_unitario: number
  desconto_item: number
  subtotal: number
  cancelado: boolean
  created_at: string
}

export interface VendaPagamento {
  id: string
  venda_id: string
  user_id: string
  forma_pagamento_id?: string
  forma_pagamento_nome: string
  valor: number
  troco: number
  bandeira?: string
  parcelas?: number
  created_at: string
}

export interface VendaItemFormData {
  produto_id: string
  nome_produto: string
  quantidade: number
  preco_unitario: number
  desconto_item: number
}

export interface VendaPagamentoFormData {
  forma_pagamento_id?: string
  forma_pagamento_nome: string
  valor: number
  troco?: number
  bandeira?: string
  parcelas?: number
}

// ============================================================
// CAIXA (sessão de caixa do PDV)
// ============================================================
export type StatusCaixaSessao = 'aberto' | 'fechado'
export type TipoMovimentacaoCaixa = 'sangria' | 'suprimento'

export interface CaixaSessao {
  id: string
  user_id: string
  operador: string
  fundo_troco_inicial: number
  aberto_em: string
  fechado_em?: string
  saldo_esperado?: number
  saldo_contado?: number
  diferenca?: number
  status: StatusCaixaSessao
  created_at: string
  conta_corrente_id?: string
}

export interface CaixaMovimentacao {
  id: string
  user_id: string
  caixa_sessao_id: string
  tipo: TipoMovimentacaoCaixa
  valor: number
  motivo: string
  criado_por?: string
  criado_em: string
  estorno_de_id?: string
}

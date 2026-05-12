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
  ativo: boolean
  created_at: string
  updated_at: string
  deleted_at?: string
}

export interface ContaCorrenteFormData {
  nome_apelido: string
  banco: string
  agencia?: string
  conta?: string
  digito?: string
  tipo_conta: TipoConta
  saldo_inicial: number
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

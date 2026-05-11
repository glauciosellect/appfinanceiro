export type StatusNF = 'rascunho' | 'emitida' | 'cancelada' | 'erro'

export interface ProdutoFiscal {
  id: string
  codigo: string
  descricao: string
  ncm: string
  cfop: string
  unidade: string
  precoUnitario: number
  estoque: number
  estoqueMinimo: number
  ativo: boolean
}

export interface ServicoFiscal {
  id: string
  codigo: string
  descricao: string
  codigoLc116: string
  aliquotaIss: number
  valorHora?: number
  ativo: boolean
}

export interface ItemNFe {
  produto: ProdutoFiscal
  quantidade: number
  valorUnitario: number
  desconto: number
  total: number
}

export interface ItemNFSe {
  servico: ServicoFiscal
  descricao: string
  quantidade: number
  valorUnitario: number
  total: number
}

export interface NFe {
  id: string
  numero: string
  serie: string
  chaveAcesso?: string
  dataEmissao: string
  destinatario: string
  cnpjDestinatario: string
  itens: ItemNFe[]
  valorTotal: number
  status: StatusNF
  tipo: 'saida' | 'entrada'
  naturezaOperacao: string
}

export interface NFSe {
  id: string
  numero: string
  codigoVerificacao?: string
  dataEmissao: string
  tomador: string
  cnpjTomador: string
  itens: ItemNFSe[]
  valorServicos: number
  valorIss: number
  valorLiquido: number
  status: StatusNF
  discriminacao: string
}

export interface MovimentoEstoque {
  id: string
  data: string
  produto: string
  tipo: 'entrada' | 'saida'
  quantidade: number
  motivo: string
  nfReferencia?: string
}

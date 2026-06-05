/** Extrai dados mínimos de um XML de NF-e (nfeProc / NFe) para registro de entrada. */

function childByLocal(parent: Element, local: string): Element | null {
  for (const c of parent.children) {
    if (c.localName === local) return c
  }
  return null
}

function deepChild(root: Element | null, path: string[]): Element | null {
  let el: Element | null = root
  for (const p of path) {
    if (!el) return null
    el = childByLocal(el, p)
  }
  return el
}

function findInfNFe(doc: Document): Element | null {
  const all = doc.querySelectorAll('*')
  for (const el of all) {
    if (el.localName === 'infNFe') return el
  }
  return null
}

function text(el: Element | null): string {
  return el?.textContent?.trim() ?? ''
}

function formatCnpj(d: string): string {
  const x = d.replace(/\D/g, '')
  if (x.length !== 14) return d
  return `${x.slice(0, 2)}.${x.slice(2, 5)}.${x.slice(5, 8)}/${x.slice(8, 12)}-${x.slice(12)}`
}

export type ParsedNFeXml = {
  numero: string
  serie: string
  chaveAcesso: string
  dataEmissao: string
  naturezaOperacao: string
  valorTotal: number
  fornecedorNome: string
  fornecedorCnpj: string
}

export function parseNFeXml(xmlString: string): ParsedNFeXml {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlString, 'text/xml')
  const err = doc.querySelector('parsererror')
  if (err) {
    throw new Error('XML inválido ou corrompido.')
  }

  const infNFe = findInfNFe(doc)
  if (!infNFe) {
    throw new Error('Não foi encontrado o bloco da NF-e (infNFe). Confirme se é um XML de NF-e de mercadoria.')
  }

  const idAttr = infNFe.getAttribute('Id') ?? ''
  const chave = idAttr.replace(/^NFe/i, '').replace(/\D/g, '').slice(0, 44)
  if (chave.length !== 44) {
    throw new Error('Não foi possível obter a chave de 44 dígitos no XML.')
  }

  const ide = childByLocal(infNFe, 'ide')
  const emit = childByLocal(infNFe, 'emit')
  const serie = ide ? text(childByLocal(ide, 'serie')) || '1' : '1'
  const nNF = ide ? text(childByLocal(ide, 'nNF')) || '—' : '—'
  const dhEmi = ide
    ? text(childByLocal(ide, 'dhEmi')) || text(childByLocal(ide, 'dEmi'))
    : ''
  const dataEmissao = dhEmi ? dhEmi.slice(0, 10) : new Date().toISOString().slice(0, 10)
  const natOp = ide ? text(childByLocal(ide, 'natOp')) || 'Compra / Importação XML' : 'Compra / Importação XML'

  const cnpjRaw = emit
    ? text(childByLocal(emit, 'CNPJ')) || text(childByLocal(emit, 'CPF'))
    : ''
  const xNome = emit ? text(childByLocal(emit, 'xNome')) || 'Emitente não identificado' : 'Emitente não identificado'

  const vNFel = deepChild(infNFe, ['total', 'ICMSTot', 'vNF'])
  const vNF = vNFel ? parseFloat(text(vNFel).replace(',', '.')) : NaN
  const valorTotal = Number.isFinite(vNF) ? vNF : 0

  return {
    numero: nNF.padStart(6, '0'),
    serie,
    chaveAcesso: chave,
    dataEmissao,
    naturezaOperacao: natOp,
    valorTotal,
    fornecedorNome: xNome,
    fornecedorCnpj: cnpjRaw ? formatCnpj(cnpjRaw) : '—',
  }
}

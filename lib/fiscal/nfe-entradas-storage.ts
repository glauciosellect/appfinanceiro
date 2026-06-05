/** Registros de NF-e de entrada importados pelo usuário (navegador). */

/** v2: zera importações antigas (v1) após limpeza do módulo fiscal de demonstração. */
const STORAGE_KEY = 'syncromoney_nfe_entradas_v2'

export type NFeEntradaImportada = {
  id: string
  numero: string
  serie: string
  chaveAcesso: string
  dataEmissao: string
  naturezaOperacao: string
  valorTotal: number
  fornecedorNome: string
  fornecedorCnpj: string
  fonte: 'xml' | 'chave'
  importadoEm: string
}

export function loadEntradasImportadas(): NFeEntradaImportada[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as NFeEntradaImportada[]
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export function saveEntradaImportada(
  entry: NFeEntradaImportada
): { ok: true } | { ok: false; error: string } {
  const existing = loadEntradasImportadas()
  if (existing.some((e) => e.chaveAcesso === entry.chaveAcesso)) {
    return { ok: false, error: 'Esta nota (mesma chave) já foi importada.' }
  }
  existing.unshift(entry)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing))
  return { ok: true }
}

export function findEntradaImportada(id: string): NFeEntradaImportada | null {
  return loadEntradasImportadas().find((e) => e.id === id) ?? null
}

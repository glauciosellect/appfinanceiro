'use client'

import { useCallback, useState } from 'react'

// Seleção por caixinha (marcar vários itens de uma lista para agir em lote).
export function useSelecao() {
  const [ids, setIds] = useState<Set<string>>(new Set())

  const alternar = useCallback((id: string) => {
    setIds((atual) => {
      const novo = new Set(atual)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }, [])

  // Marca (ou desmarca) todos os ids informados de uma vez — caixinha do cabeçalho
  const alternarTodos = useCallback((lista: string[], marcar: boolean) => {
    setIds((atual) => {
      const novo = new Set(atual)
      for (const id of lista) {
        if (marcar) novo.add(id)
        else novo.delete(id)
      }
      return novo
    })
  }, [])

  const limpar = useCallback(() => setIds(new Set()), [])

  return { ids, alternar, alternarTodos, limpar }
}

import { createClient } from '@/lib/supabase/client'

export interface ProdutoIntro {
  id: string
  codigo: string
  descricao: string
  barcode: string | null
  plu: string | null
  unidade: string
  preco_custo: number
  margem_lucro: number
  preco_venda: number
  estoque: number
  estoque_minimo: number
  controla_validade: boolean
  ativo: boolean
}

export const COLUNAS_PRODUTO =
  'id, codigo, descricao, barcode, plu, unidade, preco_custo, margem_lucro, preco_venda, estoque, estoque_minimo, controla_validade, ativo'

// Próximo código interno (0001, 0002...) e próximo PLU curto do usuário.
export async function proximoCodigo(userId: string): Promise<{ codigo: string; plu: string }> {
  const { data } = await createClient().from('produtos_fiscais').select('codigo, plu').eq('user_id', userId)
  const linhas = (data ?? []) as { codigo: string; plu: string | null }[]
  const maxNum = (vals: (string | null)[]) =>
    vals.reduce((m, v) => (v && /^\d+$/.test(v) ? Math.max(m, Number(v)) : m), 0)
  return {
    codigo: String(maxNum(linhas.map((l) => l.codigo)) + 1).padStart(4, '0'),
    plu: String(maxNum(linhas.map((l) => l.plu)) + 1),
  }
}

// Cadastro rápido usado na entrada de mercadoria. Preço de venda é definido
// na própria entrada (custo + margem).
export async function criarProdutoRapido(
  userId: string,
  dados: { descricao: string; barcode: string | null; unidade: string; controla_validade: boolean }
): Promise<{ produto: ProdutoIntro | null; erro: string | null }> {
  const supabase = createClient()
  const { codigo, plu } = await proximoCodigo(userId)
  const { data, error } = await supabase
    .from('produtos_fiscais')
    .insert({
      user_id: userId,
      codigo,
      plu: dados.barcode ? null : plu,
      descricao: dados.descricao,
      barcode: dados.barcode,
      unidade: dados.unidade,
      controla_validade: dados.controla_validade,
      ncm: '',
      cfop: '5102',
      preco_custo: 0,
      margem_lucro: 0,
      preco_venda: 0,
      estoque: 0,
      estoque_minimo: 0,
      ativo: true,
    })
    .select(COLUNAS_PRODUTO)
    .single()
  if (error) {
    return {
      produto: null,
      erro: error.code === '23505' ? 'Já existe um produto com esse código de barras.' : error.message,
    }
  }
  return { produto: data as ProdutoIntro, erro: null }
}

export function hojeISO(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

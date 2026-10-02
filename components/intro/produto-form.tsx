'use client'

import { useState } from 'react'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { COLUNAS_PRODUTO, encontrarDuplicado, proximoCodigo, type ProdutoIntro } from '@/lib/intro/produtos'

interface Props {
  modo: 'novo' | 'editar'
  // editar: o produto sendo editado
  inicial?: ProdutoIntro | null
  // novo: nome já digitado (ex.: na busca da entrada de mercadoria)
  nomeInicial?: string
  // lista usada para avisar de nome repetido
  produtosExistentes: ProdutoIntro[]
  margemPadrao: number
  // editar: saldo real em tempo real e abertura do ajuste
  estoqueAtual?: number
  onAjustarEstoque?: () => void
  onClose: () => void
  onSalvo: (produto: ProdutoIntro) => void
  // nome repetido: o que fazer ao escolher "é o mesmo produto"
  onUsarExistente: (produto: ProdutoIntro) => void
  rotuloUsarExistente: string
}

const arredondar = (n: number) => Math.round(n * 100) / 100
const rotulo = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

// Cadastro completo de produto do Intro, usado na tela Produtos e na Entrada de mercadoria.
// Monte este componente só quando for abrir: o estado inicial vem das propriedades.
export function ProdutoFormDialog({
  modo, inicial, nomeInicial, produtosExistentes, margemPadrao, estoqueAtual, onAjustarEstoque,
  onClose, onSalvo, onUsarExistente, rotuloUsarExistente,
}: Props) {
  const [form, setForm] = useState<Partial<ProdutoIntro>>(
    modo === 'editar' && inicial
      ? inicial
      : { descricao: nomeInicial ?? '', unidade: 'UN', preco_custo: 0, margem_lucro: margemPadrao, preco_venda: 0, estoque_minimo: 0, controla_validade: false }
  )
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [duplicado, setDuplicado] = useState<ProdutoIntro | null>(null)

  // Preço calculado pela margem quando há custo; senão vale o preço digitado.
  function precoDoForm(f: Partial<ProdutoIntro>): number {
    const custo = f.preco_custo ?? 0
    return custo > 0 ? arredondar(custo * (1 + (f.margem_lucro ?? 0) / 100)) : (f.preco_venda ?? 0)
  }

  async function salvar(forcar = false) {
    setErro('')
    const descricao = (form.descricao ?? '').trim()
    if (!descricao) { setErro('Informe o nome do produto.'); return }
    if (!forcar) {
      const dup = encontrarDuplicado(produtosExistentes, descricao, modo === 'editar' ? form.id : undefined)
      if (dup) { setDuplicado(dup); return }
    }
    const preco = precoDoForm(form)
    if (preco <= 0) { setErro('Informe o custo e a margem, ou o preço de venda.'); return }

    setSalvando(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSalvando(false); return }

    const barcode = (form.barcode ?? '').trim() || null
    const campos = {
      descricao,
      barcode,
      unidade: form.unidade || 'UN',
      preco_custo: form.preco_custo ?? 0,
      margem_lucro: form.margem_lucro ?? 0,
      preco_venda: preco,
      estoque_minimo: form.estoque_minimo ?? 0,
      controla_validade: !!form.controla_validade,
    }

    let resp
    if (modo === 'novo') {
      const { codigo, plu } = await proximoCodigo(user.id)
      // Sem código de barras, o PLU curto é o código de venda no PDV.
      resp = await supabase
        .from('produtos_fiscais')
        .insert({ ...campos, user_id: user.id, codigo, plu: barcode ? null : plu, ncm: '', cfop: '5102', estoque: 0, ativo: true })
        .select(COLUNAS_PRODUTO)
        .single()
    } else {
      resp = await supabase
        .from('produtos_fiscais')
        .update(campos)
        .eq('id', form.id!)
        .eq('user_id', user.id)
        .select(COLUNAS_PRODUTO)
        .single()
    }

    setSalvando(false)
    if (resp.error || !resp.data) {
      setErro(
        resp.error?.code === '23505'
          ? 'Já existe um produto com esse código de barras.'
          : `Erro ao salvar: ${resp.error?.message ?? 'tente novamente'}`
      )
      return
    }
    onSalvo(resp.data as ProdutoIntro)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !salvando && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{duplicado ? 'Já existe um produto com esse nome' : modo === 'novo' ? 'Novo produto' : 'Editar produto'}</DialogTitle>
        </DialogHeader>

        {duplicado ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <strong>{duplicado.descricao}</strong>
              {duplicado.barcode ? ` (código ${duplicado.barcode})` : duplicado.plu ? ` (PLU ${duplicado.plu})` : ''}
              {' '}já está cadastrado. É o mesmo produto?
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => onUsarExistente(duplicado)}>{rotuloUsarExistente}</Button>
              <Button variant="outline" onClick={() => { setDuplicado(null); salvar(true) }}>Não, é outro produto: salvar mesmo assim</Button>
              <Button variant="ghost" onClick={() => setDuplicado(null)}>Voltar</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className={rotulo}>Nome do produto *</label>
              <Input autoFocus value={form.descricao || ''} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={rotulo}>Código de barras</label>
                <Input placeholder="Leia com o leitor ou digite" value={form.barcode || ''} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
                <p className="text-xs text-gray-400 mt-1">Sem código de barras, o sistema gera um PLU curto.</p>
              </div>
              <div>
                <label className={rotulo}>Unidade</label>
                <select className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.unidade || 'UN'} onChange={(e) => setForm({ ...form, unidade: e.target.value })}>
                  {['UN', 'CX', 'KG', 'LT', 'MT', 'PC', 'PAR'].map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={rotulo}>Custo (R$)</label>
                <Input type="number" step="0.01" min="0" value={form.preco_custo || ''} onChange={(e) => setForm({ ...form, preco_custo: Number(e.target.value) })} />
              </div>
              <div>
                <label className={rotulo}>Margem (%)</label>
                <Input type="number" step="1" min="0" max="999" value={form.margem_lucro ?? 0}
                  onChange={(e) => setForm({ ...form, margem_lucro: Math.max(0, Number(e.target.value)) })} />
              </div>
              <div>
                <label className={rotulo}>Preço de venda (R$)</label>
                <Input type="number" step="0.01" min="0" className="text-green-700 dark:text-green-400 font-semibold"
                  value={precoDoForm(form) || ''}
                  onChange={(e) => {
                    const preco = Number(e.target.value)
                    const custo = form.preco_custo ?? 0
                    if (custo > 0) setForm({ ...form, margem_lucro: Math.max(0, Math.round((preco / custo - 1) * 100)) })
                    else setForm({ ...form, preco_venda: preco })
                  }} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 items-end">
              <div>
                <label className={rotulo}>Estoque mínimo</label>
                <Input type="number" min="0" value={form.estoque_minimo ?? 0} onChange={(e) => setForm({ ...form, estoque_minimo: Number(e.target.value) })} />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 pb-2">
                <input type="checkbox" checked={!!form.controla_validade} onChange={(e) => setForm({ ...form, controla_validade: e.target.checked })} />
                Controla validade
              </label>
            </div>

            {modo === 'editar' ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2">
                <div>
                  <p className="text-xs text-gray-500">Estoque atual (em tempo real)</p>
                  <p className={cn('text-xl font-bold', (estoqueAtual ?? 0) < 0 ? 'text-red-600' : 'text-gray-900 dark:text-white')}>
                    {estoqueAtual ?? 0} {form.unidade}
                  </p>
                  {(estoqueAtual ?? 0) < 0 && <p className="text-xs text-red-600">Negativo: vendas feitas sem estoque.</p>}
                </div>
                {onAjustarEstoque && (
                  <Button type="button" variant="outline" size="sm" onClick={onAjustarEstoque}>Ajustar estoque</Button>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-400">O estoque entra pela Entrada de mercadoria, com fornecedor, custo e validade.</p>
            )}

            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={onClose} disabled={salvando}>Cancelar</Button>
              <Button className="flex-1" onClick={() => salvar()} disabled={salvando}>
                <Save className="h-4 w-4 mr-1" />{salvando ? 'Salvando...' : modo === 'novo' ? 'Cadastrar' : 'Salvar'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

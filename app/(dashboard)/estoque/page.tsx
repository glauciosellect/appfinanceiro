'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Package, AlertTriangle, ArrowUp, ArrowDown, ClipboardEdit, Search, ChevronUp, ChevronDown, ChevronsUpDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { cn, formatCurrency, formatDate } from '@/lib/utils'

interface ProdutoEstoque {
  id: string
  codigo: string
  descricao: string
  ncm: string
  unidade: string
  estoque: number
  estoque_minimo: number
  preco_venda: number
}

interface MovimentoEstoqueRow {
  id: string
  data: string
  produto_nome: string
  tipo: 'entrada' | 'saida'
  quantidade: number
  motivo: string
  nf_referencia: string | null
}

type ColunaOrdem = 'codigo' | 'descricao' | 'unidade' | 'estoque' | 'estoque_minimo' | 'preco_venda' | 'total' | 'situacao'

const COLUNAS: { chave: ColunaOrdem; rotulo: string; direita?: boolean }[] = [
  { chave: 'codigo', rotulo: 'Código' },
  { chave: 'descricao', rotulo: 'Produto' },
  { chave: 'unidade', rotulo: 'Un.' },
  { chave: 'estoque', rotulo: 'Estoque Atual', direita: true },
  { chave: 'estoque_minimo', rotulo: 'Mínimo', direita: true },
  { chave: 'preco_venda', rotulo: 'Valor Unit.', direita: true },
  { chave: 'total', rotulo: 'Total', direita: true },
  { chave: 'situacao', rotulo: 'Situação' },
]

const semAcento = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export default function EstoquePage() {
  const { toast: _toast } = useToast()
  const [produtos, setProdutos] = useState<ProdutoEstoque[]>([])
  const [movimentos, setMovimentos] = useState<MovimentoEstoqueRow[]>([])
  const [loading, setLoading] = useState(true)

  // Busca rápida, filtro "abaixo do mínimo" e ordenação clicando no título da coluna
  const [busca, setBusca] = useState('')
  // O alerta do Dashboard ("N abaixo do mínimo") abre esta tela já filtrada (?filtro=baixo)
  const [somenteBaixo, setSomenteBaixo] = useState(useSearchParams().get('filtro') === 'baixo')
  const [ordem, setOrdem] = useState<{ coluna: ColunaOrdem; dir: 'asc' | 'desc' }>({ coluna: 'descricao', dir: 'asc' })


  const [dialogAjuste, setDialogAjuste] = useState(false)
  const [produtoIdAjuste, setProdutoIdAjuste] = useState('')
  const [tipoAjuste, setTipoAjuste] = useState<'entrada' | 'saida'>('entrada')
  const [quantidadeAjuste, setQuantidadeAjuste] = useState('')
  const [motivoAjuste, setMotivoAjuste] = useState('')
  const [salvandoAjuste, setSalvandoAjuste] = useState(false)

  const fetchEstoque = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/estoque')
      if (!res.ok) throw new Error('Falha ao carregar estoque')
      const data = await res.json()
      setProdutos(data.produtos ?? [])
      setMovimentos(data.movimentos ?? [])
    } catch {
      _toast('Erro ao carregar estoque', 'error')
    } finally {
      setLoading(false)
    }
  }, [_toast])

  useEffect(() => {
    fetchEstoque()
  }, [fetchEstoque])

  function abrirDialogAjuste() {
    setProdutoIdAjuste('')
    setTipoAjuste('entrada')
    setQuantidadeAjuste('')
    setMotivoAjuste('')
    setDialogAjuste(true)
  }

  async function handleConfirmarAjuste() {
    const quantidade = Number(quantidadeAjuste)
    if (!produtoIdAjuste || !quantidade || quantidade <= 0 || !motivoAjuste.trim()) return
    setSalvandoAjuste(true)
    try {
      const res = await fetch('/api/estoque/ajuste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produto_id: produtoIdAjuste,
          tipo: tipoAjuste,
          quantidade,
          motivo: motivoAjuste.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao ajustar estoque')
      _toast('Estoque ajustado com sucesso!', 'success')
      setDialogAjuste(false)
      fetchEstoque()
    } catch (err) {
      _toast(err instanceof Error ? err.message : 'Erro ao ajustar estoque', 'error')
    } finally {
      setSalvandoAjuste(false)
    }
  }

  function ordenarPor(coluna: ColunaOrdem) {
    setOrdem((o) => (o.coluna === coluna ? { coluna, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { coluna, dir: 'asc' }))
  }

  const abaixoMinimo = produtos.filter((p) => p.estoque <= p.estoque_minimo)

  const lista = useMemo(() => {
    const termo = semAcento(busca.trim())
    const filtrados = produtos.filter((p) => {
      if (somenteBaixo && !(p.estoque <= p.estoque_minimo)) return false
      if (!termo) return true
      return semAcento(p.descricao).includes(termo) || semAcento(p.codigo).includes(termo) || (p.ncm ?? '').includes(termo)
    })
    const valor = (p: ProdutoEstoque): string | number => {
      switch (ordem.coluna) {
        case 'codigo': return p.codigo
        case 'descricao': return p.descricao
        case 'unidade': return p.unidade
        case 'estoque': return Number(p.estoque)
        case 'estoque_minimo': return Number(p.estoque_minimo)
        case 'preco_venda': return Number(p.preco_venda)
        case 'total': return Number(p.estoque) * Number(p.preco_venda)
        case 'situacao': return p.estoque <= p.estoque_minimo ? 0 : 1
      }
    }
    const fator = ordem.dir === 'asc' ? 1 : -1
    return [...filtrados].sort((a, b) => {
      const va = valor(a)
      const vb = valor(b)
      const cmp = typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb), 'pt-BR', { numeric: true, sensitivity: 'base' })
      return cmp * fator || a.descricao.localeCompare(b.descricao, 'pt-BR')
    })
  }, [produtos, busca, somenteBaixo, ordem])
  const valorTotal = produtos.reduce((s, p) => s + p.estoque * p.preco_venda, 0)

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-100 dark:bg-gray-700 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-gray-100 dark:bg-gray-700 rounded-2xl animate-pulse" />
        <div className="h-64 bg-gray-100 dark:bg-gray-700 rounded-2xl animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Controle de Estoque</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Atualizado automaticamente a cada emissão de NF-e
          </p>
        </div>
        <Button onClick={abrirDialogAjuste}>
          <ClipboardEdit className="h-4 w-4 mr-2" />
          Ajustar Estoque
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total de Produtos',   value: String(produtos.length),                                     sub: 'ativos no cadastro' },
          { label: 'Total em Estoque',    value: String(produtos.reduce((s, p) => s + p.estoque, 0)),         sub: 'unidades' },
          { label: 'Abaixo do Mínimo',    value: String(abaixoMinimo.length),                                 sub: 'precisam reposição', alert: abaixoMinimo.length > 0 },
          { label: 'Valor em Estoque',    value: formatCurrency(valorTotal),                                   sub: 'pelo preço de venda' },
        ].map(({ label, value, sub, alert }) => (
          <Card key={label}
            onClick={alert ? () => setSomenteBaixo((v) => !v) : undefined}
            title={alert ? 'Clique para listar só os produtos abaixo do mínimo' : undefined}
            className={cn(alert && 'border-yellow-300 dark:border-yellow-700 cursor-pointer hover:shadow-md transition-shadow')}>
            <CardContent className="pt-6">
              <p className={cn('text-sm mb-1', alert ? 'text-yellow-700 dark:text-yellow-400' : 'text-gray-500 dark:text-gray-400')}>{label}</p>
              <p className={cn('text-2xl font-bold', alert ? 'text-yellow-700 dark:text-yellow-400' : 'text-gray-900 dark:text-white')}>{value}</p>
              {alert && value !== '0' ? (
                <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Atenção necessária
                </p>
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Posição de estoque */}
      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">Posição de Estoque</CardTitle>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                className="pl-9 pr-9"
                placeholder="Busca rápida: nome, código ou NCM..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
              {busca && (
                <button type="button" onClick={() => setBusca('')} title="Limpar busca"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={somenteBaixo ? 'outline' : 'default'} onClick={() => setSomenteBaixo(false)}>
                Todos ({produtos.length})
              </Button>
              <Button type="button" size="sm" variant={somenteBaixo ? 'default' : 'outline'} onClick={() => setSomenteBaixo(true)}>
                <AlertTriangle className="h-3.5 w-3.5 mr-1" />Abaixo do mínimo ({abaixoMinimo.length})
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                  {COLUNAS.map(({ chave, rotulo, direita }) => {
                    const ativa = ordem.coluna === chave
                    const Seta = !ativa ? ChevronsUpDown : ordem.dir === 'asc' ? ChevronUp : ChevronDown
                    return (
                      <th key={chave} aria-sort={ativa ? (ordem.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                        className={cn('px-6 py-3 text-xs font-semibold uppercase tracking-wide', direita ? 'text-right' : 'text-left')}>
                        <button type="button" onClick={() => ordenarPor(chave)}
                          title={`Ordenar por ${rotulo} (A-Z / Z-A)`}
                          className={cn('inline-flex items-center gap-1 uppercase tracking-wide hover:text-gray-900 dark:hover:text-white',
                            ativa ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400')}>
                          {rotulo}
                          <Seta className={cn('h-3.5 w-3.5', !ativa && 'opacity-40')} />
                        </button>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {lista.map((p) => {
                  const abaixo = p.estoque <= p.estoque_minimo
                  return (
                    <tr key={p.id} className={cn('hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors', abaixo && 'bg-yellow-50/50 dark:bg-yellow-900/10')}>
                      <td className="px-6 py-4 font-mono text-gray-600 dark:text-gray-400">{p.codigo}</td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-800 dark:text-gray-200">{p.descricao}</p>
                        <p className="text-xs text-gray-400">NCM: {p.ncm}</p>
                      </td>
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{p.unidade}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={cn('text-lg font-bold', abaixo ? 'text-yellow-700 dark:text-yellow-400' : 'text-gray-800 dark:text-gray-200')}>{p.estoque}</span>
                      </td>
                      <td className="px-6 py-4 text-right text-gray-500 dark:text-gray-400">{p.estoque_minimo}</td>
                      <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-400">{formatCurrency(p.preco_venda)}</td>
                      <td className="px-6 py-4 text-right font-semibold text-gray-800 dark:text-gray-200">{formatCurrency(p.estoque * p.preco_venda)}</td>
                      <td className="px-6 py-4">
                        {abaixo ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                            <AlertTriangle className="h-3 w-3" />Baixo
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            Normal
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {produtos.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400 text-sm">
                      Nenhum produto cadastrado. Cadastre em Fiscal → Produtos.
                    </td>
                  </tr>
                )}
                {produtos.length > 0 && lista.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400 text-sm">
                      Nenhum produto encontrado com esse filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Movimentações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Movimentações Recentes</CardTitle>
          <p className="text-xs text-gray-500 dark:text-gray-400">Entradas e saídas registradas automaticamente pelas notas fiscais</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                  {['Data', 'Produto', 'Tipo', 'Qtd', 'Motivo', 'NF Referência'].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {movimentos.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-6 py-3 text-gray-600 dark:text-gray-400">{formatDate(m.data)}</td>
                    <td className="px-6 py-3 font-medium text-gray-800 dark:text-gray-200">{m.produto_nome}</td>
                    <td className="px-6 py-3">
                      <span className={cn('flex items-center gap-1.5 text-sm font-medium w-fit', m.tipo === 'entrada' ? 'text-green-600' : 'text-red-600')}>
                        {m.tipo === 'entrada' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                        {m.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                      </span>
                    </td>
                    <td className="px-6 py-3 font-semibold text-gray-800 dark:text-gray-200">
                      {m.tipo === 'entrada' ? '+' : '-'}{m.quantidade}
                    </td>
                    <td className="px-6 py-3 text-gray-600 dark:text-gray-400">{m.motivo}</td>
                    <td className="px-6 py-3">
                      {m.nf_referencia && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                          {m.nf_referencia}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {movimentos.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400 text-sm">
                      Nenhuma movimentação registrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Ajustar Estoque */}
      <Dialog open={dialogAjuste} onOpenChange={setDialogAjuste}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Ajustar Estoque</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Produto</Label>
              <Select value={produtoIdAjuste} onValueChange={setProdutoIdAjuste}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um produto" />
                </SelectTrigger>
                <SelectContent>
                  {produtos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.codigo} — {p.descricao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tipo de Movimento</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  type="button"
                  variant={tipoAjuste === 'entrada' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setTipoAjuste('entrada')}
                >
                  <ArrowUp className="h-4 w-4 mr-1.5" />
                  Entrada
                </Button>
                <Button
                  type="button"
                  variant={tipoAjuste === 'saida' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setTipoAjuste('saida')}
                >
                  <ArrowDown className="h-4 w-4 mr-1.5" />
                  Saída
                </Button>
              </div>
            </div>

            <div>
              <Label>Quantidade</Label>
              <Input
                type="number" step="1" min="1"
                value={quantidadeAjuste}
                onChange={(e) => setQuantidadeAjuste(e.target.value)}
                placeholder="0"
              />
            </div>

            <div>
              <Label>Motivo</Label>
              <Input
                value={motivoAjuste}
                onChange={(e) => setMotivoAjuste(e.target.value)}
                placeholder="Ex: contagem física, perda, avaria"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogAjuste(false)} className="flex-1">
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmarAjuste}
                disabled={salvandoAjuste || !produtoIdAjuste || !Number(quantidadeAjuste) || !motivoAjuste.trim()}
                className="flex-1"
              >
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

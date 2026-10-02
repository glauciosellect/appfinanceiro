'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { ajustarEstoqueProduto } from '@/lib/intro/estoque'

interface Props {
  produto: { id: string; descricao: string; unidade: string }
  atual: number
  onClose: () => void
  onAjustado: () => void
}

interface Forn { id: string; nome: string }

const rotulo = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

// Ajuste de estoque de UM produto: você informa a quantidade que realmente tem agora.
// Saldo negativo (vendas feitas sem estoque) é regularizado; se sobrar quantidade, entra como estoque novo.
// Monte este componente só quando for abrir (o estado inicial vem das propriedades).
export function AjusteEstoqueDialog({ produto, atual, onClose, onAjustado }: Props) {
  const [nova, setNova] = useState(String(Math.max(atual, 0)))
  const [motivo, setMotivo] = useState('')
  const [fornecedorId, setFornecedorId] = useState('')
  const [fornecedores, setFornecedores] = useState<Forn[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    async function carregar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('fornecedores').select('id, nome').eq('user_id', user.id).is('deleted_at', null).order('nome')
      setFornecedores((data ?? []) as Forn[])
    }
    carregar()
  }, [])

  const n = Number(nova.replace(',', '.'))
  const valida = nova !== '' && Number.isFinite(n) && n >= 0
  // Entra estoque NOVO quando a quantidade informada passa do que já existe fisicamente
  const entraEstoqueNovo = valida && n > Math.max(atual, 0)
  const diferenca = valida ? n - atual : 0

  async function confirmar() {
    setErro('')
    if (!valida) { setErro('Informe a quantidade que você tem agora (0 ou mais).'); return }
    if (diferenca === 0) { setErro('A quantidade informada é igual ao estoque atual.'); return }
    if (!motivo.trim()) { setErro('Informe o motivo do ajuste.'); return }
    setSalvando(true)
    const msg = await ajustarEstoqueProduto(produto.id, n, motivo.trim(), fornecedorId || null)
    setSalvando(false)
    if (msg) { setErro(msg); return }
    onAjustado()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !salvando && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Ajustar estoque</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2">
            <p className="text-sm font-medium text-gray-900 dark:text-white">{produto.descricao}</p>
            <p className="text-xs text-gray-500">
              Estoque atual: <strong className={cn(atual < 0 && 'text-red-600')}>{atual} {produto.unidade}</strong>
              {atual < 0 && ' (negativo: vendas feitas sem estoque)'}
            </p>
          </div>

          <div>
            <label className={rotulo}>Quantidade que você tem agora *</label>
            <Input type="number" min="0" step="1" value={nova} onChange={(e) => setNova(e.target.value)} autoFocus />
            <p className="text-xs text-gray-400 mt-1">
              {atual < 0
                ? 'Para regularizar o saldo negativo, informe 0 (ou o que realmente tem na prateleira).'
                : 'Conte o que existe de fato e informe aqui. O sistema ajusta a diferença.'}
            </p>
            {valida && diferenca !== 0 && (
              <p className={cn('text-xs font-semibold mt-1', diferenca > 0 ? 'text-emerald-700' : 'text-amber-700')}>
                Diferença: {diferenca > 0 ? '+' : ''}{diferenca} {produto.unidade}
              </p>
            )}
          </div>

          <div>
            <label className={rotulo}>Motivo *</label>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Contagem, perda, quebra, venda sem estoque..." />
          </div>

          {entraEstoqueNovo && (
            <div>
              <label className={rotulo}>Fornecedor do estoque que está entrando</label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)}>
                <option value="">Usar o do último lote do produto</option>
                {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">Só é necessário quando o produto ainda não tem nenhuma entrada registrada.</p>
            </div>
          )}

          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={salvando}>Cancelar</Button>
            <Button className="flex-1" onClick={confirmar} disabled={salvando}>{salvando ? 'Salvando...' : 'Confirmar ajuste'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

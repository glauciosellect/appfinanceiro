'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ClienteForm } from '@/components/clientes/cliente-form'
import { createCliente } from '@/lib/supabase/clientes'
import { createServico } from '@/lib/supabase/servicos'
import { useToast } from '@/components/ui/toast'
import type { Cliente, ClienteFormData, Servico } from '@/types'

// Cadastros feitos sem sair da tela do orçamento.

export function NovoClienteDialog({ userId, onClose, onCriado }: {
  userId: string
  onClose: () => void
  onCriado: (cliente: Cliente) => void
}) {
  const { toast } = useToast()

  async function handleSubmit(data: ClienteFormData) {
    try {
      const novo = await createCliente(userId, data)
      toast('Cliente cadastrado!', 'success')
      onCriado(novo)
    } catch {
      toast('Erro ao cadastrar cliente', 'error')
    }
  }

  return (
    <Dialog open onOpenChange={(aberto) => { if (!aberto) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Novo Cliente</DialogTitle></DialogHeader>
        <ClienteForm onSubmit={handleSubmit} onCancel={onClose} />
      </DialogContent>
    </Dialog>
  )
}

export function NovoServicoDialog({ userId, nomeInicial, onClose, onCriado }: {
  userId: string
  nomeInicial: string
  onClose: () => void
  onCriado: (servico: Servico) => void
}) {
  const { toast } = useToast()
  const [nome, setNome] = useState(nomeInicial)
  const [detalhes, setDetalhes] = useState('')
  const [unidade, setUnidade] = useState('UN')
  const [custo, setCusto] = useState('')
  const [preco, setPreco] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    setErro('')
    if (!nome.trim()) { setErro('Informe o nome do serviço.'); return }
    const valor = Number(preco.replace(',', '.'))
    if (!(valor > 0)) { setErro('Informe o preço do serviço.'); return }
    setSalvando(true)
    try {
      const novo = await createServico(userId, {
        nome: nome.trim(),
        detalhes: detalhes.trim() || undefined,
        unidade_medida: unidade.trim() || 'UN',
        preco_custo: Number(custo.replace(',', '.')) || 0,
        preco_unitario: valor,
      })
      toast('Serviço cadastrado!', 'success')
      onCriado(novo)
    } catch {
      setErro('Erro ao cadastrar serviço.')
      setSalvando(false)
    }
  }

  return (
    <Dialog open onOpenChange={(aberto) => { if (!aberto) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Novo Serviço</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus /></div>
          <div><Label>Detalhes</Label><Input value={detalhes} onChange={(e) => setDetalhes(e.target.value)} placeholder="Opcional" /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Unidade</Label><Input value={unidade} onChange={(e) => setUnidade(e.target.value)} /></div>
            <div><Label>Custo (R$)</Label><Input type="number" min="0" step="0.01" value={custo} onChange={(e) => setCusto(e.target.value)} /></div>
            <div><Label>Preço (R$) *</Label><Input type="number" min="0" step="0.01" value={preco} onChange={(e) => setPreco(e.target.value)} /></div>
          </div>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={salvando}>Cancelar</Button>
            <Button className="flex-1" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Cadastrar e adicionar'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { Plus, Search, Edit2, Wrench, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn, formatCurrency } from '@/lib/utils'
import { servicosFiscais as inicial } from '@/lib/fiscal/mock-data'
import type { ServicoFiscal } from '@/lib/fiscal/types'

export default function FiscalServicosPage() {
  const [servicos, setServicos] = useState<ServicoFiscal[]>(inicial)
  const [busca, setBusca] = useState('')
  const [open, setOpen] = useState(false)
  const [modo, setModo] = useState<'novo' | 'editar'>('novo')
  const [form, setForm] = useState<Partial<ServicoFiscal>>({})

  const filtrados = servicos.filter(
    (s) => !busca || s.descricao.toLowerCase().includes(busca.toLowerCase()) || s.codigo.includes(busca)
  )

  function abrirNovo() {
    setForm({ ativo: true, aliquotaIss: 2 })
    setModo('novo')
    setOpen(true)
  }

  function salvar() {
    if (!form.descricao) return
    if (modo === 'novo') {
      setServicos([...servicos, {
        id: `s${Date.now()}`,
        codigo: `SV${String(servicos.length + 1).padStart(3, '0')}`,
        descricao: form.descricao,
        codigoLc116: form.codigoLc116 || '',
        aliquotaIss: form.aliquotaIss ?? 2,
        valorHora: form.valorHora,
        ativo: true,
      }])
    } else {
      setServicos(servicos.map((s) => s.id === form.id ? { ...s, ...form } as ServicoFiscal : s))
    }
    setOpen(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Serviços</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Cadastre uma vez, reutilize em toda emissão de NFS-e
          </p>
        </div>
        <Button variant="success" onClick={abrirNovo}><Plus className="h-4 w-4" />Novo Serviço</Button>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Buscar serviço..." className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-0"><CardTitle className="text-base">{filtrados.length} serviço(s) cadastrado(s)</CardTitle></CardHeader>
        <CardContent className="p-0 mt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                  {['Código','Descrição','Código LC 116','Alíquota ISS','Valor/Hora','Status','Ações'].map((h) => (
                    <th key={h} className={cn('px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide', ['Alíquota ISS','Valor/Hora','Ações'].includes(h) ? 'text-right' : 'text-left')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtrados.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-6 py-4 font-mono text-gray-600 dark:text-gray-400">{s.codigo}</td>
                    <td className="px-6 py-4 font-medium text-gray-800 dark:text-gray-200">{s.descricao}</td>
                    <td className="px-6 py-4 font-mono text-gray-500 dark:text-gray-400">{s.codigoLc116}</td>
                    <td className="px-6 py-4 text-right text-gray-700 dark:text-gray-300">{s.aliquotaIss}%</td>
                    <td className="px-6 py-4 text-right font-medium text-gray-800 dark:text-gray-200">
                      {s.valorHora ? formatCurrency(s.valorHora) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', s.ativo ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400')}>
                        {s.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => { setForm(s); setModo('editar'); setOpen(true) }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filtrados.length === 0 && (
                  <tr><td colSpan={7} className="px-6 py-12 text-center">
                    <Wrench className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-400 dark:text-gray-500">Nenhum serviço encontrado</p>
                    <button onClick={abrirNovo} className="mt-3 text-green-600 font-medium text-sm hover:underline">Cadastrar primeiro serviço</button>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{modo === 'novo' ? 'Novo Serviço' : 'Editar Serviço'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrição *</label>
              <Input placeholder="Nome do serviço" value={form.descricao || ''} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Código LC 116/2003</label>
              <Input placeholder="Ex: 1.04, 17.01..." value={form.codigoLc116 || ''} onChange={(e) => setForm({ ...form, codigoLc116: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Alíquota ISS (%)</label>
                <Input type="number" step="0.01" min={0} max={5} value={form.aliquotaIss ?? 2} onChange={(e) => setForm({ ...form, aliquotaIss: Number(e.target.value) })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor/Hora (R$) <span className="text-gray-400 font-normal">opcional</span></label>
                <Input type="number" step="0.01" value={form.valorHora || ''} onChange={(e) => setForm({ ...form, valorHora: Number(e.target.value) || undefined })} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button variant="success" className="flex-1" onClick={salvar}><Save className="h-4 w-4" />{modo === 'novo' ? 'Cadastrar' : 'Salvar'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

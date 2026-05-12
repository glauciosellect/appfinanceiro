'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Pencil, Trash2, Truck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  getTransportadoras,
  createTransportadora,
  updateTransportadora,
  deleteTransportadora,
} from '@/lib/supabase/transportadoras'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { maskCNPJ, maskPhone, maskCEP, buscarCEP } from '@/lib/masks'
import type { Transportadora, TransportadoraFormData } from '@/types'

const ESTADOS_BR = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA',
  'MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN',
  'RO','RR','RS','SC','SE','SP','TO',
]

const formVazio: TransportadoraFormData = {
  razao_social: '', nome_fantasia: '', cnpj: '', ie: '', rntrc: '',
  cep: '', endereco: '', numero: '', complemento: '', bairro: '',
  cidade: '', estado: '', telefone: '', email: '',
}

export default function TransportadorasPage() {
  const [lista, setLista] = useState<Transportadora[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<Transportadora | null>(null)
  const [form, setForm] = useState<TransportadoraFormData>(formVazio)
  const [salvando, setSalvando] = useState(false)
  const [buscandoCEP, setBuscandoCEP] = useState(false)
  const [buscandoCNPJ, setBuscandoCNPJ] = useState(false)
  const [userId, setUserId] = useState('')
  const { toast } = useToast()

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [])

  const fetchLista = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const data = await getTransportadoras(userId, search || undefined)
      setLista(data)
    } catch {
      toast('Erro ao carregar transportadoras', 'error')
    } finally {
      setLoading(false)
    }
  }, [userId, search, toast])

  useEffect(() => { fetchLista() }, [fetchLista])

  function abrirNovo() {
    setEditando(null)
    setForm(formVazio)
    setDialogOpen(true)
  }

  function abrirEditar(t: Transportadora) {
    setEditando(t)
    setForm({
      razao_social: t.razao_social,
      nome_fantasia: t.nome_fantasia ?? '',
      cnpj: t.cnpj ?? '',
      ie: t.ie ?? '',
      rntrc: t.rntrc ?? '',
      cep: t.cep ?? '',
      endereco: t.endereco ?? '',
      numero: t.numero ?? '',
      complemento: t.complemento ?? '',
      bairro: t.bairro ?? '',
      cidade: t.cidade ?? '',
      estado: t.estado ?? '',
      telefone: t.telefone ?? '',
      email: t.email ?? '',
    })
    setDialogOpen(true)
  }

  function setF(field: keyof TransportadoraFormData, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleCNPJ(val: string) {
    const masked = maskCNPJ(val)
    setF('cnpj', masked)
    const digits = masked.replace(/\D/g, '')
    if (digits.length !== 14) return
    setBuscandoCNPJ(true)
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`)
      if (res.ok) {
        const data = await res.json()
        if (data.razao_social) setF('razao_social', data.razao_social)
        if (data.nome_fantasia) setF('nome_fantasia', data.nome_fantasia)
        if (data.ddd_telefone_1) setF('telefone', maskPhone(data.ddd_telefone_1.replace(/\D/g, '')))
        if (data.email) setF('email', data.email.toLowerCase())
        if (data.cep) { const cep = maskCEP(data.cep.replace(/\D/g, '')); setF('cep', cep); await handleCEP(cep) }
        if (data.logradouro) setF('endereco', data.logradouro)
        if (data.numero) setF('numero', data.numero)
        if (data.complemento) setF('complemento', data.complemento)
        if (data.bairro) setF('bairro', data.bairro)
        if (data.municipio) setF('cidade', data.municipio)
        if (data.uf) setF('estado', data.uf)
      }
    } catch { /* silencioso */ }
    setBuscandoCNPJ(false)
  }

  async function handleCEP(val: string) {
    const masked = maskCEP(val)
    setF('cep', masked)
    const digits = masked.replace(/\D/g, '')
    if (digits.length === 8) {
      setBuscandoCEP(true)
      const addr = await buscarCEP(digits)
      if (addr) {
        setF('endereco', addr.logradouro)
        setF('bairro', addr.bairro)
        setF('cidade', addr.localidade)
        setF('estado', addr.uf)
      }
      setBuscandoCEP(false)
    }
  }

  async function handleSalvar() {
    if (!form.razao_social.trim()) {
      toast('Razão Social é obrigatória', 'error')
      return
    }
    setSalvando(true)
    try {
      if (editando) {
        await updateTransportadora(userId, editando.id, form)
        toast('Transportadora atualizada!', 'success')
      } else {
        await createTransportadora(userId, form)
        toast('Transportadora cadastrada!', 'success')
      }
      setDialogOpen(false)
      fetchLista()
    } catch {
      toast('Erro ao salvar', 'error')
    } finally {
      setSalvando(false)
    }
  }

  async function handleExcluir(t: Transportadora) {
    if (!confirm(`Excluir "${t.razao_social}"?`)) return
    try {
      await deleteTransportadora(userId, t.id)
      toast('Transportadora excluída', 'success')
      fetchLista()
    } catch {
      toast('Erro ao excluir', 'error')
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transportadoras</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{lista.length} cadastrada(s)</p>
        </div>
        <Button onClick={abrirNovo}>
          <Plus className="h-4 w-4" />Nova Transportadora
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input className="pl-9" placeholder="Buscar por razão social, CNPJ..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-600" />
            Lista de Transportadoras
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">{[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}</div>
          ) : lista.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <Truck className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhuma transportadora cadastrada</p>
              <p className="text-sm mt-1">Clique em &quot;Nova Transportadora&quot; para começar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
                    <th className="text-left px-6 py-3">Razão Social</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">CNPJ</th>
                    <th className="text-left px-4 py-3 hidden lg:table-cell">RNTRC</th>
                    <th className="text-left px-4 py-3 hidden lg:table-cell">Cidade / UF</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Telefone</th>
                    <th className="text-right px-6 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                  {lista.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900 dark:text-white">{t.razao_social}</p>
                        {t.nome_fantasia && <p className="text-xs text-gray-400">{t.nome_fantasia}</p>}
                      </td>
                      <td className="px-4 py-4 text-gray-500 dark:text-gray-400 hidden md:table-cell font-mono">{t.cnpj || '—'}</td>
                      <td className="px-4 py-4 text-gray-500 dark:text-gray-400 hidden lg:table-cell font-mono">{t.rntrc || '—'}</td>
                      <td className="px-4 py-4 text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                        {t.cidade && t.estado ? `${t.cidade} / ${t.estado}` : '—'}
                      </td>
                      <td className="px-4 py-4 text-gray-500 dark:text-gray-400 hidden md:table-cell">{t.telefone || '—'}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => abrirEditar(t)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors" title="Editar">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleExcluir(t)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Excluir">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar Transportadora' : 'Nova Transportadora'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Identificação */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Razão Social *</Label>
                <Input placeholder="Nome ou Razão Social" value={form.razao_social} onChange={(e) => setF('razao_social', e.target.value)} />
              </div>
              <div>
                <Label>Nome Fantasia</Label>
                <Input placeholder="Nome Fantasia (opcional)" value={form.nome_fantasia} onChange={(e) => setF('nome_fantasia', e.target.value)} />
              </div>
              <div>
                <Label>CNPJ {buscandoCNPJ && <span className="text-xs text-blue-500 ml-1">buscando...</span>}</Label>
                <Input placeholder="00.000.000/0001-00" value={form.cnpj} onChange={(e) => handleCNPJ(e.target.value)} />
              </div>
              <div>
                <Label>Inscrição Estadual</Label>
                <Input placeholder="IE ou ISENTO" value={form.ie} onChange={(e) => setF('ie', e.target.value)} />
              </div>
              <div>
                <Label>RNTRC</Label>
                <Input placeholder="Registro Nacional de Transportadores" value={form.rntrc} onChange={(e) => setF('rntrc', e.target.value)} />
              </div>
            </div>

            {/* Endereço */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>CEP {buscandoCEP && <span className="text-xs text-blue-500 ml-1">buscando...</span>}</Label>
                <Input placeholder="00000-000" value={form.cep} onChange={(e) => handleCEP(e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label>Logradouro</Label>
                <Input placeholder="Rua, Av..." value={form.endereco} onChange={(e) => setF('endereco', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label>Número</Label>
                <Input placeholder="Nº" value={form.numero} onChange={(e) => setF('numero', e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label>Complemento</Label>
                <Input placeholder="Sala, Galpão..." value={form.complemento} onChange={(e) => setF('complemento', e.target.value)} />
              </div>
              <div>
                <Label>Bairro</Label>
                <Input placeholder="Bairro" value={form.bairro} onChange={(e) => setF('bairro', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Label>Cidade</Label>
                <Input placeholder="Cidade" value={form.cidade} onChange={(e) => setF('cidade', e.target.value)} />
              </div>
              <div>
                <Label>UF</Label>
                <Select value={form.estado ?? ''} onValueChange={(v) => setF('estado', v)}>
                  <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>
                    {ESTADOS_BR.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Contato */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Telefone</Label>
                <Input placeholder="(00) 00000-0000" value={form.telefone} onChange={(e) => setF('telefone', maskPhone(e.target.value))} />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input type="email" placeholder="contato@transportadora.com.br" value={form.email} onChange={(e) => setF('email', e.target.value)} />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">Cancelar</Button>
              <Button onClick={handleSalvar} disabled={salvando} className="flex-1">
                {salvando ? 'Salvando...' : editando ? 'Salvar Alterações' : 'Cadastrar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

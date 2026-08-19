'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Settings, Plus, Pencil, Trash2, Tag, CreditCard as CardIcon, Crown, CheckCircle, Clock, AlertTriangle, Upload, Building2, Save, X, Zap, Receipt } from 'lucide-react'
import FiscalTab from '@/components/configuracoes/fiscal-tab'
import type { Categoria, TipoCategoria } from '@/types'
import { assinaturaAtiva, type Assinatura } from '@/lib/supabase/assinatura'
import {
  getPerfilEmpresa, upsertPerfilEmpresa, uploadLogo, perfilVazio,
  type PerfilEmpresa,
} from '@/lib/supabase/perfil-empresa'
import { maskCEP, maskPhone, buscarCEP } from '@/lib/masks'

const schemaCategoria = z.object({
  nome: z.string().min(2, 'Mínimo 2 caracteres'),
  tipo: z.enum(['receita', 'despesa', 'ambos']),
  cor: z.string().min(4, 'Cor inválida'),
  icone: z.string().min(1, 'Informe um ícone/emoji'),
})
type CategoriaForm = z.infer<typeof schemaCategoria>

const schemaAlterarSenha = z.object({
  nova_senha: z.string().min(6, 'Mínimo 6 caracteres'),
  confirmar_senha: z.string(),
}).refine(d => d.nova_senha === d.confirmar_senha, {
  message: 'Senhas não coincidem',
  path: ['confirmar_senha'],
})
type AlterarSenhaForm = z.infer<typeof schemaAlterarSenha>

const EMOJIS_RAPIDOS = ['💰','💵','💳','🏦','📊','📈','📉','🛒','🏠','🚗','🍔','💊','📚','🎬','👕','✈️','🏋️','💼','🤝','🏢']
const CORES_RAPIDAS = ['#22c55e','#3b82f6','#f97316','#ef4444','#8b5cf6','#ec4899','#f59e0b','#6366f1','#14b8a6','#64748b']

export default function ConfiguracoesPage() {
  const [aba, setAba] = useState<'categorias' | 'perfil' | 'senha' | 'assinatura' | 'fiscal'>('categorias')
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogCat, setDialogCat] = useState(false)
  const [editandoCat, setEditandoCat] = useState<Categoria | undefined>()
  const [userId, setUserId] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null)
  const [perfil, setPerfil] = useState<PerfilEmpresa | null>(null)
  const [savingPerfil, setSavingPerfil] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [buscandoCNPJ, setBuscandoCNPJ] = useState(false)
  const [buscandoCEP, setBuscandoCEP] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const { toast: _toast } = useToast()

  const formCat = useForm<CategoriaForm>({
    resolver: zodResolver(schemaCategoria),
    defaultValues: { tipo: 'despesa', cor: '#6366f1', icone: '💰' },
  })
  const formSenha = useForm<AlterarSenhaForm>({ resolver: zodResolver(schemaAlterarSenha) })

  useEffect(() => {
    createClient().auth.getUser().then(async ({ data }) => {
      if (data.user) {
        setUserId(data.user.id)
        setUserEmail(data.user.email ?? '')
        const { data: ass } = await createClient().from('assinaturas').select('*').eq('user_id', data.user.id).single()
        setAssinatura(ass as Assinatura | null)
        const p = await getPerfilEmpresa(data.user.id)
        setPerfil(p ?? { ...perfilVazio, user_id: data.user.id })
      }
    })
  }, [])

  useEffect(() => {
    if (!userId) return
    const supabase = createClient()
    supabase
      .from('categorias')
      .select('*')
      .or(`user_id.eq.${userId},user_id.is.null`)
      .order('nome')
      .then(({ data }) => {
        setCategorias((data ?? []) as Categoria[])
        setLoading(false)
      })
  }, [userId])

  async function handleSalvarCategoria(values: CategoriaForm) {
    const supabase = createClient()
    try {
      if (editandoCat && editandoCat.user_id) {
        await supabase.from('categorias').update(values).eq('id', editandoCat.id)
        _toast('Categoria atualizada!', 'success')
      } else {
        await supabase.from('categorias').insert({ ...values, user_id: userId })
        _toast('Categoria criada!', 'success')
      }
      setDialogCat(false)
      const { data } = await supabase
        .from('categorias')
        .select('*')
        .or(`user_id.eq.${userId},user_id.is.null`)
        .order('nome')
      setCategorias((data ?? []) as Categoria[])
    } catch {
      _toast('Erro ao salvar categoria', 'error')
    }
  }

  async function handleDeleteCategoria(id: string) {
    if (!confirm('Excluir esta categoria?')) return
    const supabase = createClient()
    const { error } = await supabase.from('categorias').delete().eq('id', id).eq('user_id', userId)
    if (error) {
      _toast('Não é possível excluir (pode ter registros vinculados)', 'error')
      return
    }
    setCategorias(c => c.filter(x => x.id !== id))
    _toast('Categoria excluída', 'success')
  }

  async function handleAlterarSenha(values: AlterarSenhaForm) {
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: values.nova_senha })
    if (error) {
      _toast(error.message, 'error')
      return
    }
    _toast('Senha alterada com sucesso!', 'success')
    formSenha.reset()
  }

  async function handleSalvarPerfil() {
    if (!perfil) return
    setSavingPerfil(true)
    const { error } = await upsertPerfilEmpresa(perfil)
    if (error) _toast('Erro ao salvar: ' + error, 'error')
    else _toast('Dados da empresa salvos!', 'success')
    setSavingPerfil(false)
  }

  async function handleUploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      _toast('Imagem muito grande. Máximo 2 MB.', 'error')
      e.target.value = ''
      return
    }
    if (!perfil) {
      _toast('Aguarde o carregamento do perfil.', 'error')
      return
    }
    setUploadingLogo(true)
    const { url, error } = await uploadLogo(perfil.user_id, file)
    if (error) _toast('Erro no upload: ' + error, 'error')
    else if (url) {
      setPerfil({ ...perfil, logo_url: url })
      _toast('Logo atualizada!', 'success')
    }
    e.target.value = ''
    setUploadingLogo(false)
  }

  function setP(field: keyof PerfilEmpresa, value: string) {
    setPerfil((p) => p ? { ...p, [field]: value } : p)
  }

  async function handleCNPJPerfil(val: string) {
    setP('cnpj_cpf', val)
    const digits = val.replace(/\D/g, '')
    if (digits.length !== 14) return
    setBuscandoCNPJ(true)
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`)
      if (res.ok) {
        const data = await res.json()
        if (data.razao_social) setP('razao_social', data.razao_social)
        if (data.nome_fantasia) setP('nome_fantasia', data.nome_fantasia)
        if (data.telefone) setP('telefone', maskPhone(data.ddd_telefone_1?.replace(/\D/g, '') ?? ''))
        if (data.email) setP('email_comercial', data.email.toLowerCase())
        if (data.cep) { const cep = maskCEP(data.cep.replace(/\D/g, '')); setP('cep', cep); await handleCEPPerfil(cep) }
        if (data.logradouro) setP('logradouro', data.logradouro)
        if (data.numero) setP('numero', data.numero)
        if (data.complemento) setP('complemento', data.complemento)
        if (data.bairro) setP('bairro', data.bairro)
        if (data.municipio) setP('cidade', data.municipio)
        if (data.uf) setP('uf', data.uf)
      }
    } catch { /* silencioso */ }
    setBuscandoCNPJ(false)
  }

  async function handleCEPPerfil(val: string) {
    const masked = maskCEP(val)
    setP('cep', masked)
    const digits = masked.replace(/\D/g, '')
    if (digits.length !== 8) return
    setBuscandoCEP(true)
    const addr = await buscarCEP(digits)
    if (addr) {
      setP('logradouro', addr.logradouro)
      setP('bairro', addr.bairro)
      setP('cidade', addr.localidade)
      setP('uf', addr.uf)
    }
    setBuscandoCEP(false)
  }

  const TIPO_LABEL: Record<TipoCategoria, string> = { receita: 'Receita', despesa: 'Despesa', ambos: 'Ambos' }
  const TIPO_COLOR: Record<TipoCategoria, string> = { receita: 'text-green-600', despesa: 'text-red-600', ambos: 'text-blue-600' }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-sm text-gray-500">Gerencie seu perfil e preferências do sistema</p>
      </div>

      {/* Abas */}
      <div className="flex flex-wrap rounded-xl border border-gray-200 overflow-hidden w-fit">
        {([
          ['categorias', 'Categorias', Tag],
          ['perfil', 'Perfil', Settings],
          ['senha', 'Alterar Senha', CardIcon],
          ['assinatura', 'Assinatura', Crown],
          ['fiscal', 'Fiscal', Receipt],
        ] as const).map(([tab, label, Icon]) => (
          <button key={tab} onClick={() => setAba(tab)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${aba === tab ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Aba: Categorias */}
      {aba === 'categorias' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Categorias</CardTitle>
              <Button size="sm" onClick={() => { setEditandoCat(undefined); formCat.reset({ tipo: 'despesa', cor: '#6366f1', icone: '💰' }); setDialogCat(true) }}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Categoria
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-2">{[1,2,3].map(i => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {categorias.map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <span
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-lg"
                        style={{ backgroundColor: cat.cor + '20' }}
                      >
                        {cat.icone}
                      </span>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{cat.nome}</p>
                        <p className={`text-xs ${TIPO_COLOR[cat.tipo]}`}>{TIPO_LABEL[cat.tipo]}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!cat.user_id && (
                        <Badge variant="secondary" className="text-xs">Padrão</Badge>
                      )}
                      {cat.user_id && (
                        <>
                          <button onClick={() => { setEditandoCat(cat); formCat.reset(cat); setDialogCat(true) }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleDeleteCategoria(cat.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Aba: Perfil */}
      {aba === 'perfil' && perfil && (
        <div className="space-y-4">
          {/* Logomarca */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                Logomarca da Empresa
              </CardTitle>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Aparecerá no cabeçalho das NF-e e NFS-e emitidas
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                {/* Preview */}
                <div className="w-32 h-32 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center bg-gray-50 dark:bg-gray-800 shrink-0 overflow-hidden">
                  {perfil.logo_url ? (
                    <div className="relative w-full h-full group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={perfil.logo_url} alt="Logo" className="w-full h-full object-contain p-2" />
                      <button
                        onClick={() => setP('logo_url', '')}
                        className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3 text-white" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Building2 className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-1" />
                      <p className="text-xs text-gray-400">Sem logo</p>
                    </div>
                  )}
                </div>
                {/* Upload */}
                <div className="space-y-3">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                    className="hidden"
                    onChange={handleUploadLogo}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploadingLogo}
                    onClick={() => logoInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    {uploadingLogo ? 'Enviando...' : 'Escolher imagem'}
                  </Button>
                  <div className="text-xs text-gray-400 dark:text-gray-500 space-y-0.5">
                    <p>PNG, JPG ou SVG — recomendado 300×100 px</p>
                    <p>Tamanho máximo: 2 MB</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Acesso */}
          <Card>
            <CardHeader><CardTitle>Acesso</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>E-mail de acesso</Label>
                <Input value={userEmail} disabled className="bg-gray-50 dark:bg-gray-700/50" />
                <p className="text-xs text-gray-400 mt-1">Não pode ser alterado aqui</p>
              </div>
              <div>
                <Label>ID do Usuário</Label>
                <Input value={userId} disabled className="bg-gray-50 dark:bg-gray-700/50 font-mono text-xs" />
              </div>
            </CardContent>
          </Card>

          {/* Identificação */}
          <Card>
            <CardHeader><CardTitle>Identificação</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tipo de Pessoa</Label>
                  <select
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={perfil.tipo_pessoa}
                    onChange={(e) => setP('tipo_pessoa', e.target.value)}
                  >
                    <option value="juridica">Pessoa Jurídica (CNPJ)</option>
                    <option value="fisica">Pessoa Física (CPF)</option>
                  </select>
                </div>
                <div>
                  <Label>
                    {perfil.tipo_pessoa === 'juridica' ? 'CNPJ' : 'CPF'}
                    {buscandoCNPJ && <span className="text-xs text-blue-500 ml-1">buscando...</span>}
                  </Label>
                  <Input
                    placeholder={perfil.tipo_pessoa === 'juridica' ? '00.000.000/0001-00' : '000.000.000-00'}
                    value={perfil.cnpj_cpf}
                    onChange={(e) => perfil.tipo_pessoa === 'juridica' ? handleCNPJPerfil(e.target.value) : setP('cnpj_cpf', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Razão Social / Nome Completo</Label>
                  <Input placeholder="Nome completo ou razão social" value={perfil.razao_social} onChange={(e) => setP('razao_social', e.target.value)} />
                </div>
                <div>
                  <Label>Nome Fantasia</Label>
                  <Input placeholder="Nome fantasia (opcional)" value={perfil.nome_fantasia} onChange={(e) => setP('nome_fantasia', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>{perfil.tipo_pessoa === 'juridica' ? 'Inscrição Estadual' : 'RG'}</Label>
                  <Input
                    placeholder={perfil.tipo_pessoa === 'juridica' ? 'IE ou ISENTO' : '00.000.000-0'}
                    value={perfil.inscricao_estadual}
                    onChange={(e) => setP('inscricao_estadual', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Inscrição Municipal</Label>
                  <Input placeholder="Número IM" value={perfil.inscricao_municipal} onChange={(e) => setP('inscricao_municipal', e.target.value)} />
                </div>
                <div>
                  <Label>Regime Tributário</Label>
                  <select
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={perfil.regime_tributario}
                    onChange={(e) => setP('regime_tributario', e.target.value)}
                  >
                    <option value="simples">Simples Nacional</option>
                    <option value="mei">MEI</option>
                    <option value="lucro_presumido">Lucro Presumido</option>
                    <option value="lucro_real">Lucro Real</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Endereço */}
          <Card>
            <CardHeader><CardTitle>Endereço</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label>
                    CEP {buscandoCEP && <span className="text-xs text-blue-500 ml-1">buscando...</span>}
                  </Label>
                  <Input placeholder="00000-000" value={perfil.cep} onChange={(e) => handleCEPPerfil(e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <Label>Logradouro (Rua / Av.)</Label>
                  <Input placeholder="Rua das Flores" value={perfil.logradouro} onChange={(e) => setP('logradouro', e.target.value)} />
                </div>
                <div>
                  <Label>Número</Label>
                  <Input placeholder="123" value={perfil.numero} onChange={(e) => setP('numero', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Complemento</Label>
                  <Input placeholder="Sala 10, Apto 2..." value={perfil.complemento} onChange={(e) => setP('complemento', e.target.value)} />
                </div>
                <div>
                  <Label>Bairro</Label>
                  <Input placeholder="Centro" value={perfil.bairro} onChange={(e) => setP('bairro', e.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Label>Cidade</Label>
                    <Input placeholder="Juiz de Fora" value={perfil.cidade} onChange={(e) => setP('cidade', e.target.value)} />
                  </div>
                  <div>
                    <Label>UF</Label>
                    <Input placeholder="MG" maxLength={2} value={perfil.uf} onChange={(e) => setP('uf', e.target.value.toUpperCase())} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contato */}
          <Card>
            <CardHeader><CardTitle>Contato</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Telefone / WhatsApp</Label>
                <Input placeholder="(32) 99999-9999" value={perfil.telefone} onChange={(e) => setP('telefone', e.target.value)} />
              </div>
              <div>
                <Label>E-mail Comercial</Label>
                <Input type="email" placeholder="contato@empresa.com.br" value={perfil.email_comercial} onChange={(e) => setP('email_comercial', e.target.value)} />
              </div>
              <div>
                <Label>Site</Label>
                <Input placeholder="www.empresa.com.br" value={perfil.site} onChange={(e) => setP('site', e.target.value)} />
              </div>
            </CardContent>
          </Card>

          {/* Salvar */}
          <div className="flex justify-end">
            <Button onClick={handleSalvarPerfil} disabled={savingPerfil} className="min-w-[180px]">
              <Save className="h-4 w-4" />
              {savingPerfil ? 'Salvando...' : 'Salvar Dados da Empresa'}
            </Button>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 text-right">
            Estes dados serão usados como emissor em todas as NF-e e NFS-e emitidas.
          </p>
        </div>
      )}

      {/* Aba: Senha */}
      {aba === 'senha' && (
        <Card>
          <CardHeader><CardTitle>Alterar Senha</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={formSenha.handleSubmit(handleAlterarSenha)} className="space-y-4 max-w-sm">
              <div>
                <Label>Nova Senha</Label>
                <Input {...formSenha.register('nova_senha')} type="password" placeholder="Mínimo 6 caracteres" />
                {formSenha.formState.errors.nova_senha && (
                  <p className="text-xs text-red-500 mt-1">{formSenha.formState.errors.nova_senha.message}</p>
                )}
              </div>
              <div>
                <Label>Confirmar Nova Senha</Label>
                <Input {...formSenha.register('confirmar_senha')} type="password" placeholder="Repita a nova senha" />
                {formSenha.formState.errors.confirmar_senha && (
                  <p className="text-xs text-red-500 mt-1">{formSenha.formState.errors.confirmar_senha.message}</p>
                )}
              </div>
              <Button type="submit">Alterar Senha</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Aba: Assinatura */}
      {aba === 'assinatura' && (
        <Card>
          <CardHeader><CardTitle>Minha Assinatura</CardTitle></CardHeader>
          <CardContent className="space-y-6">

            {/* Status atual */}
            <div className={`rounded-2xl p-4 flex items-center gap-4 ${
              assinatura?.status === 'active' ? 'bg-green-50 border border-green-200' :
              assinatura?.status === 'pending' ? 'bg-blue-50 border border-blue-200' :
              'bg-red-50 border border-red-200'
            }`}>
              {assinatura?.status === 'active' && <CheckCircle className="h-8 w-8 text-green-600 shrink-0" />}
              {assinatura?.status === 'pending' && <Clock className="h-8 w-8 text-blue-600 shrink-0" />}
              {(!assinatura || assinatura.status === 'canceled' || assinatura.status === 'past_due') && <AlertTriangle className="h-8 w-8 text-red-600 shrink-0" />}
              <div>
                {assinatura?.status === 'active' && (
                  <>
                    <p className="font-bold text-green-800">Assinatura ativa</p>
                    <p className="text-sm text-green-700">
                      {assinatura.proximo_vencimento
                        ? `Próximo vencimento: ${new Date(assinatura.proximo_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}`
                        : 'Plano SyncroMoney'}
                    </p>
                  </>
                )}
                {assinatura?.status === 'pending' && (
                  <>
                    <p className="font-bold text-blue-800">Pagamento pendente</p>
                    <p className="text-sm text-blue-700">
                      Assim que o pagamento for confirmado pela Asaas, seu plano é ativado automaticamente.
                    </p>
                  </>
                )}
                {(!assinatura || assinatura.status === 'canceled') && (
                  <>
                    <p className="font-bold text-red-800">Sem assinatura ativa</p>
                    <p className="text-sm text-red-700">Assine para continuar usando o SyncroMoney</p>
                  </>
                )}
                {assinatura?.status === 'past_due' && (
                  <>
                    <p className="font-bold text-red-800">Pagamento em atraso</p>
                    <p className="text-sm text-red-700">Regularize seu pagamento para continuar</p>
                  </>
                )}
              </div>
            </div>

            {/* Plano atual */}
            {(() => {
              const isPremium = assinatura?.plano === 'premium'
              const planName  = isPremium ? 'SyncroMoney PREMIUM' : 'SyncroMoney PRO'
              const planPrice = isPremium ? 'R$ 147,00/mês' : 'R$ 97,00/mês'
              const features  = isPremium
                ? ['Dashboard completo', 'Contas a pagar e receber', 'Controle de cartões', 'Clientes e fornecedores', 'Fluxo de caixa', 'Relatórios', 'Produtos, Serviços e Estoque', 'PDV e Caixa', 'NF-e de Produtos (DANFE)', 'NFS-e de Serviços']
                : ['Dashboard completo', 'Contas a pagar e receber', 'Controle de cartões', 'Clientes e fornecedores', 'Fluxo de caixa', 'Relatórios', 'Produtos, Serviços e Estoque']

              return (
                <div className={`rounded-2xl border p-5 space-y-3 ${isPremium ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/10' : 'border-gray-200'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-900 text-lg">{planName}</p>
                        {isPremium && (
                          <Badge className="bg-amber-400 text-amber-900 text-[10px] font-bold">PREMIUM</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{planPrice}</p>
                      {assinatura?.proximo_vencimento && (
                        <p className="text-xs text-amber-600 mt-1 font-medium">
                          {assinatura.status === 'active'
                            ? `Próximo vencimento: ${new Date(assinatura.proximo_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}`
                            : `Vencimento: ${new Date(assinatura.proximo_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}`}
                        </p>
                      )}
                    </div>
                    <Crown className={`h-8 w-8 ${isPremium ? 'text-amber-500' : 'text-blue-600'}`} />
                  </div>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {features.map(f => (
                      <li key={f} className="flex items-center gap-2">
                        <CheckCircle className={`h-4 w-4 shrink-0 ${isPremium ? 'text-amber-500' : 'text-green-500'}`} />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })()}

            {/* Banner upgrade para Premium — só aparece se estiver no PRO */}
            {assinatura?.status === 'active' && assinatura?.plano !== 'premium' && (
              <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400">
                    <Zap className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-amber-900 dark:text-amber-300">Ative o PREMIUM</p>
                    <p className="text-sm text-amber-800 dark:text-amber-400 mt-1">
                      Emita NF-e e NFS-e, use o PDV e o Caixa sem sair do SyncroMoney.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {['PDV e Caixa', 'NF-e (Produtos)', 'NFS-e (Serviços)'].map(f => (
                        <span key={f} className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-800/40 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                          <CheckCircle className="h-3 w-3" />{f}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-amber-600 font-medium">por apenas</p>
                    <p className="text-xl font-bold text-amber-900 dark:text-amber-300">R$ 147,00</p>
                    <p className="text-xs text-amber-600">/mês</p>
                  </div>
                </div>
                <Button
                  className="w-full mt-4 bg-amber-400 hover:bg-amber-500 text-amber-900 font-bold"
                  onClick={() => window.location.href = '/assinar'}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Fazer upgrade para PREMIUM
                </Button>
              </div>
            )}

            {/* Botões de ação */}
            {!assinaturaAtiva(assinatura) ? (
              <Button className="w-full" onClick={() => window.location.href = '/assinar'}>
                <Crown className="h-4 w-4 mr-2" />
                {assinatura?.status === 'pending' ? 'Concluir pagamento' : 'Ver planos e assinar'}
              </Button>
            ) : null}

            {assinaturaAtiva(assinatura) && (
              <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-600">
                <p className="font-medium text-gray-800 mb-1">Precisa alterar sua forma de pagamento ou cancelar?</p>
                <p className="mb-3">Fale com a gente que resolvemos rapidinho.</p>
                <a
                  href={`https://wa.me/55?text=${encodeURIComponent('Olá! Preciso alterar/cancelar minha assinatura do SyncroMoney.')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" className="w-full">
                    Falar sobre minha assinatura
                  </Button>
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Aba: Fiscal */}
      {aba === 'fiscal' && <FiscalTab userId={userId} />}

      {/* Dialog: Categoria */}
      <Dialog open={dialogCat} onOpenChange={setDialogCat}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editandoCat ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle></DialogHeader>
          <form onSubmit={formCat.handleSubmit(handleSalvarCategoria)} className="space-y-4">
            <div className="grid grid-cols-3 gap-4 items-end">
              <div className="col-span-2">
                <Label>Nome da Categoria</Label>
                <Input {...formCat.register('nome')} placeholder="Ex: Alimentação" />
                {formCat.formState.errors.nome && <p className="text-xs text-red-500 mt-1">{formCat.formState.errors.nome.message}</p>}
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl border"
                  style={{ backgroundColor: (formCat.watch('cor') ?? '#6366f1') + '20' }}
                >
                  {formCat.watch('icone') || '💰'}
                </div>
              </div>
            </div>

            <div>
              <Label>Tipo</Label>
              <Select value={formCat.watch('tipo') ?? 'despesa'} onValueChange={(v) => formCat.setValue('tipo', v as TipoCategoria)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                  <SelectItem value="ambos">Ambos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Cor</Label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={formCat.watch('cor') ?? '#6366f1'}
                  onChange={e => formCat.setValue('cor', e.target.value)}
                  className="w-10 h-10 rounded-lg border cursor-pointer"
                />
                <div className="flex gap-1 flex-wrap">
                  {CORES_RAPIDAS.map(cor => (
                    <button key={cor} type="button" onClick={() => formCat.setValue('cor', cor)}
                      className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: cor }} />
                  ))}
                </div>
              </div>
            </div>

            <div>
              <Label>Ícone (emoji)</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {EMOJIS_RAPIDOS.map(em => (
                  <button key={em} type="button" onClick={() => formCat.setValue('icone', em)}
                    className={`text-xl p-1 rounded-lg hover:bg-gray-100 ${formCat.watch('icone') === em ? 'bg-blue-50 ring-2 ring-blue-400' : ''}`}>
                    {em}
                  </button>
                ))}
              </div>
              <Input {...formCat.register('icone')} className="mt-2" placeholder="Ou digite um emoji..." />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogCat(false)} className="flex-1">Cancelar</Button>
              <Button type="submit" className="flex-1">{editandoCat ? 'Salvar' : 'Criar'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

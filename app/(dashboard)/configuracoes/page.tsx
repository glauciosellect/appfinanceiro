'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
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
import { Settings, Plus, Pencil, Trash2, Tag, CreditCard as CardIcon, Crown, CheckCircle, Clock, AlertTriangle } from 'lucide-react'
import type { Categoria, TipoCategoria } from '@/types'
import { assinaturaAtiva, diasRestantesTrial, type Assinatura } from '@/lib/supabase/assinatura'

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
  const [aba, setAba] = useState<'categorias' | 'perfil' | 'senha' | 'assinatura'>('categorias')
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogCat, setDialogCat] = useState(false)
  const [editandoCat, setEditandoCat] = useState<Categoria | undefined>()
  const [userId, setUserId] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null)
  const [loadingPortal, setLoadingPortal] = useState(false)
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
      {aba === 'perfil' && (
        <Card>
          <CardHeader><CardTitle>Informações do Perfil</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>E-mail</Label>
              <Input value={userEmail} disabled className="bg-gray-50" />
              <p className="text-xs text-gray-400 mt-1">O e-mail não pode ser alterado aqui</p>
            </div>
            <div>
              <Label>ID do Usuário</Label>
              <Input value={userId} disabled className="bg-gray-50 font-mono text-xs" />
            </div>
          </CardContent>
        </Card>
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
              assinatura?.status === 'trialing' ? 'bg-blue-50 border border-blue-200' :
              'bg-red-50 border border-red-200'
            }`}>
              {assinatura?.status === 'active' && <CheckCircle className="h-8 w-8 text-green-600 shrink-0" />}
              {assinatura?.status === 'trialing' && <Clock className="h-8 w-8 text-blue-600 shrink-0" />}
              {(!assinatura || assinatura.status === 'canceled' || assinatura.status === 'past_due') && <AlertTriangle className="h-8 w-8 text-red-600 shrink-0" />}
              <div>
                {assinatura?.status === 'active' && (
                  <>
                    <p className="font-bold text-green-800">Assinatura ativa</p>
                    <p className="text-sm text-green-700">
                      {assinatura.current_period_end
                        ? `Próxima renovação: ${new Date(assinatura.current_period_end).toLocaleDateString('pt-BR')}`
                        : 'Plano SyncroMoney Pro'}
                    </p>
                  </>
                )}
                {assinatura?.status === 'trialing' && (
                  <>
                    <p className="font-bold text-blue-800">Período de teste</p>
                    <p className="text-sm text-blue-700">
                      {diasRestantesTrial(assinatura)} dia(s) restante(s) — aproveite todos os recursos!
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
                    <p className="font-bold text-red-800">Pagamento pendente</p>
                    <p className="text-sm text-red-700">Atualize seu método de pagamento para continuar</p>
                  </>
                )}
              </div>
            </div>

            {/* Plano */}
            <div className="rounded-2xl border border-gray-200 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-900 text-lg">SyncroMoney Pro</p>
                  <p className="text-sm text-gray-500">R$ 29,90/mês</p>
                </div>
                <Crown className="h-8 w-8 text-blue-600" />
              </div>
              <ul className="text-sm text-gray-600 space-y-1">
                {['Dashboard completo', 'Contas a pagar e receber', 'Controle de cartões', 'Clientes e fornecedores', 'Fluxo de caixa', 'Relatórios'].map(f => (
                  <li key={f} className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Botões */}
            {!assinaturaAtiva(assinatura) || assinatura?.status === 'trialing' ? (
              <Button className="w-full" onClick={() => window.location.href = '/assinar'}>
                <Crown className="h-4 w-4 mr-2" />
                {assinatura?.status === 'trialing' ? 'Assinar agora' : 'Ver planos e assinar'}
              </Button>
            ) : null}

            {assinatura?.stripe_customer_id && (
              <Button variant="outline" className="w-full" disabled={loadingPortal}
                onClick={async () => {
                  setLoadingPortal(true)
                  const res = await fetch('/api/stripe/portal', { method: 'POST' })
                  const json = await res.json()
                  if (json.url) window.location.href = json.url
                  setLoadingPortal(false)
                }}>
                {loadingPortal ? 'Abrindo...' : 'Gerenciar assinatura'}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

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

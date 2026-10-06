'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Save, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { uploadLogo } from '@/lib/supabase/perfil-empresa'
import { getIntroConfig, salvarIntroConfig, type IntroConfig } from '@/lib/intro/config'
import { carregarContextoSistema } from '@/lib/intro/sistema-client'
import { AlterarSenhaCard } from '@/components/intro/alterar-senha'
import { diasRestantesTrial, assinaturaAtiva } from '@/lib/supabase/assinatura'
import { maskPhone } from '@/lib/masks'

const label = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

export default function IntroConfiguracoesPage() {
  const [cfg, setCfg] = useState<IntroConfig | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [assinatura, setAssinatura] = useState<{ ativa: boolean; dias: number; proximo: string | null } | null>(null)
  const logoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function carregar() {
      const { data: { user } } = await createClient().auth.getUser()
      if (!user) return
      setCfg(await getIntroConfig(user.id))
      const ctx = await carregarContextoSistema()
      if (ctx) {
        setAssinatura({
          ativa: assinaturaAtiva(ctx.assinatura),
          dias: diasRestantesTrial(ctx.user.created_at),
          proximo: ctx.assinatura?.proximo_vencimento ?? null,
        })
      }
    }
    carregar()
  }, [])

  async function salvar() {
    if (!cfg) return
    setSalvando(true)
    setMsg(null)
    const erro = await salvarIntroConfig(cfg)
    setMsg(erro ? { tipo: 'erro', texto: `Erro ao salvar: ${erro}` } : { tipo: 'ok', texto: 'Configurações salvas.' })
    setSalvando(false)
  }

  async function enviarLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !cfg) return
    if (file.size > 2 * 1024 * 1024) { setMsg({ tipo: 'erro', texto: 'A logo deve ter até 2 MB.' }); return }
    const { url, error } = await uploadLogo(cfg.user_id, file)
    if (error || !url) { setMsg({ tipo: 'erro', texto: `Erro ao enviar a logo: ${error}` }); return }
    setCfg({ ...cfg, logo_url: url })
    setMsg({ tipo: 'ok', texto: 'Logo enviada. Clique em Salvar para confirmar.' })
  }

  if (!cfg) return <p className="text-sm text-gray-500">Carregando...</p>

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Configurações</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Dados da sua loja e preferências do sistema.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Dados da loja</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-gray-500">Aparecem no comprovante de venda e no recibo enviado ao fornecedor.</p>
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-gray-800">
              {cfg.logo_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={cfg.logo_url} alt="Logo da loja" className="h-full w-full object-contain" />
                : <span className="text-xs text-gray-400">Sem logo</span>}
            </div>
            <div>
              <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={enviarLogo} />
              <Button type="button" variant="outline" onClick={() => logoRef.current?.click()}>
                <Upload className="h-4 w-4 mr-1" />Enviar logo
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>Nome da loja</label>
              <Input value={cfg.nome_loja} onChange={(e) => setCfg({ ...cfg, nome_loja: e.target.value })} />
            </div>
            <div>
              <label className={label}>CNPJ ou CPF</label>
              <Input value={cfg.cnpj_cpf} onChange={(e) => setCfg({ ...cfg, cnpj_cpf: e.target.value })} />
            </div>
            <div>
              <label className={label}>Telefone / WhatsApp</label>
              <Input value={cfg.telefone} onChange={(e) => setCfg({ ...cfg, telefone: maskPhone(e.target.value) })} />
            </div>
            <div>
              <label className={label}>Endereço</label>
              <Input value={cfg.endereco} onChange={(e) => setCfg({ ...cfg, endereco: e.target.value })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Preferências</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>Margem de lucro padrão (%)</label>
              <Input type="number" min="0" step="1" value={cfg.margem_padrao}
                onChange={(e) => setCfg({ ...cfg, margem_padrao: Math.max(0, Number(e.target.value)) })} />
              <p className="text-xs text-gray-400 mt-1">Sugerida ao cadastrar um produto novo.</p>
            </div>
            <div>
              <label className={label}>Avisar validade com (dias)</label>
              <Input type="number" min="0" step="1" value={cfg.dias_alerta_validade}
                onChange={(e) => setCfg({ ...cfg, dias_alerta_validade: Math.max(0, Math.round(Number(e.target.value))) })} />
              <p className="text-xs text-gray-400 mt-1">Produtos que vencem dentro desse prazo entram no alerta.</p>
            </div>
          </div>
          <div>
            <label className={label}>Texto do recibo</label>
            <textarea
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={cfg.texto_recibo}
              onChange={(e) => setCfg({ ...cfg, texto_recibo: e.target.value })}
            />
            <p className="text-xs text-gray-400 mt-1">Frase de quitação impressa no recibo do acerto com o fornecedor.</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={salvar} disabled={salvando}>
          <Save className="h-4 w-4 mr-1" />{salvando ? 'Salvando...' : 'Salvar'}
        </Button>
        {msg && <span className={msg.tipo === 'ok' ? 'text-sm text-green-600' : 'text-sm text-red-600'}>{msg.texto}</span>}
      </div>

      <AlterarSenhaCard />

      <Card>
        <CardHeader><CardTitle className="text-base">Assinatura</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <p className="font-medium">SyncroMoney Intro — R$ 57,90/mês</p>
          {assinatura?.ativa ? (
            <p>Assinatura ativa{assinatura.proximo ? `. Próximo vencimento: ${new Date(assinatura.proximo + 'T00:00:00').toLocaleDateString('pt-BR')}.` : '.'}</p>
          ) : (
            <>
              <p>{assinatura && assinatura.dias > 0 ? `Período grátis: restam ${assinatura.dias} dia(s).` : 'Período grátis encerrado.'}</p>
              <Link href="/assinar" className="inline-block text-emerald-600 font-semibold hover:underline">Assinar agora</Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

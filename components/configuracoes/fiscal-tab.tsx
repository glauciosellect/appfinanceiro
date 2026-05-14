'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { CheckCircle2, AlertCircle, Loader2, FileKey, Zap, Receipt, ExternalLink, Upload, FileText, Hash } from 'lucide-react'

interface FiscalConfig {
  habilita_nfse?: boolean
  habilita_nfe?: boolean
  focus_status?: string
  focus_erro?: string
  certificado_status?: string
  ativo?: boolean
  cnpj?: string
  numero_proximo_nfe?: number
  serie_nfe?: string
}

export default function FiscalTab({ userId }: { userId: string }) {
  const [config, setConfig] = useState<FiscalConfig>({ habilita_nfse: true, habilita_nfe: false })
  const [perfilOk, setPerfilOk] = useState(false)
  const [loading, setLoading] = useState(true)
  const [ativando, setAtivando] = useState(false)
  const [enviandoCert, setEnviandoCert] = useState(false)
  const [numeroProximo, setNumeroProximo] = useState('')
  const [serieNfe, setSerieNfe] = useState('1')
  const [salvandoNum, setSalvandoNum] = useState(false)
  const [senhaCert, setSenhaCert] = useState('')
  const [arquivoCert, setArquivoCert] = useState<File | null>(null)
  const certInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (!userId) return
    Promise.all([
      createClient().from('fiscal_config').select('habilita_nfse,habilita_nfe,focus_status,focus_erro,certificado_status,ativo,cnpj,numero_proximo_nfe,serie_nfe').eq('user_id', userId).single(),
      createClient().from('perfil_empresa').select('cnpj_cpf, razao_social').eq('user_id', userId).single(),
    ]).then(([{ data: fiscal }, { data: perfil }]) => {
      if (fiscal) {
        setConfig(fiscal as FiscalConfig)
        setNumeroProximo(String(fiscal.numero_proximo_nfe ?? 1))
        setSerieNfe(fiscal.serie_nfe ?? '1')
      }
      setPerfilOk(!!(perfil?.cnpj_cpf && perfil?.razao_social))
      setLoading(false)
    })
  }, [userId])

  async function handleAtivar() {
    setAtivando(true)
    try {
      const res = await fetch('/api/fiscal/ativar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          habilita_nfse: config.habilita_nfse,
          habilita_nfe: config.habilita_nfe,
        }),
      })
      const json = await res.json() as { ok?: boolean; error?: string; focus_erro?: string }
      if (json.ok) {
        toast('Módulo fiscal ativado com sucesso!', 'success')
        setConfig(c => ({ ...c, focus_status: 'cadastrado', ativo: true }))
      } else {
        toast(json.focus_erro ?? json.error ?? 'Erro ao ativar', 'error')
        setConfig(c => ({ ...c, focus_status: 'erro' }))
      }
    } catch {
      toast('Erro de conexão', 'error')
    } finally {
      setAtivando(false)
    }
  }

  async function handleEnviarCertificado() {
    if (!arquivoCert || !senhaCert) {
      toast('Selecione o arquivo .pfx e informe a senha', 'error')
      return
    }
    setEnviandoCert(true)
    try {
      const form = new FormData()
      form.append('certificado', arquivoCert)
      form.append('senha', senhaCert)
      const res = await fetch('/api/fiscal/certificado', { method: 'POST', body: form })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (json.ok) {
        toast('Certificado enviado com sucesso!', 'success')
        setConfig(c => ({ ...c, certificado_status: 'enviado' }))
        setArquivoCert(null)
        setSenhaCert('')
      } else {
        toast(json.error ?? 'Erro ao enviar certificado', 'error')
      }
    } catch {
      toast('Erro de conexão', 'error')
    } finally {
      setEnviandoCert(false)
    }
  }

  async function handleSalvarNumeracao() {
    const num = parseInt(numeroProximo)
    if (!num || num < 1) { toast('Informe um número válido (mínimo 1)', 'error'); return }
    setSalvandoNum(true)
    try {
      const res = await fetch('/api/fiscal/numeracao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero_proximo_nfe: num, serie_nfe: serieNfe }),
      })
      const json = await res.json() as { ok?: boolean; error?: string; aviso?: string }
      if (json.ok) {
        toast(json.aviso ?? 'Numeração sincronizada com a Focus NFe!', 'success')
        setConfig(c => ({ ...c, numero_proximo_nfe: num, serie_nfe: serieNfe }))
      } else {
        toast(json.error ?? 'Erro ao salvar numeração', 'error')
      }
    } catch {
      toast('Erro de conexão', 'error')
    } finally {
      setSalvandoNum(false)
    }
  }

  async function handleConfirmarManual() {
    try {
      await createClient().from('fiscal_config').update({
        certificado_status: 'enviado',
        updated_at: new Date().toISOString(),
      }).eq('user_id', userId)
      toast('Certificado confirmado!', 'success')
      setConfig(c => ({ ...c, certificado_status: 'enviado' }))
    } catch {
      toast('Erro ao salvar confirmação', 'error')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />Carregando...
      </div>
    )
  }

  const isAtivo = config.focus_status === 'cadastrado' || config.ativo
  const certEnviado = config.certificado_status === 'enviado'

  return (
    <div className="space-y-6">

      {/* Status */}
      {isAtivo ? (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
          <div>
            <p className="font-semibold text-green-800 text-sm">Módulo fiscal ativo</p>
            <p className="text-green-700 text-xs">
              {config.habilita_nfse && 'NFS-e habilitada'}
              {config.habilita_nfse && config.habilita_nfe && ' · '}
              {config.habilita_nfe && 'NF-e habilitada'}
            </p>
          </div>
        </div>
      ) : config.focus_status === 'erro' ? (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <div>
            <p className="font-semibold text-red-800 text-sm">Erro no cadastro fiscal</p>
            <p className="text-red-700 text-xs">{config.focus_erro}</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
          <div>
            <p className="text-amber-800 text-sm font-medium">Módulo fiscal inativo</p>
            <p className="text-amber-700 text-xs">
              {perfilOk
                ? 'Selecione os tipos de nota abaixo e clique em Ativar.'
                : 'Preencha primeiro os dados de Perfil (CNPJ e Razão Social são obrigatórios).'}
            </p>
          </div>
        </div>
      )}

      {/* Tipos de nota */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-5 w-5 text-blue-600" />
            Tipos de Nota Fiscal
          </CardTitle>
          <p className="text-sm text-gray-500">Os dados da empresa são lidos automaticamente do seu Perfil.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* NFS-e */}
          <div
            onClick={() => setConfig(c => ({ ...c, habilita_nfse: !c.habilita_nfse }))}
            className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer select-none transition-all ${
              config.habilita_nfse ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className={`w-11 h-6 rounded-full transition-colors shrink-0 ${config.habilita_nfse ? 'bg-green-500' : 'bg-gray-300'}`}>
              <div className={`w-5 h-5 bg-white rounded-full shadow mt-0.5 transition-transform ${config.habilita_nfse ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
            <div>
              <p className="font-medium text-sm text-gray-800">NFS-e — Nota Fiscal de Serviços Eletrônica</p>
              <p className="text-xs text-gray-500">Para empresas prestadoras de serviço. Não exige certificado digital.</p>
            </div>
          </div>

          {/* NF-e */}
          <div
            onClick={() => setConfig(c => ({ ...c, habilita_nfe: !c.habilita_nfe }))}
            className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer select-none transition-all ${
              config.habilita_nfe ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className={`w-11 h-6 rounded-full transition-colors shrink-0 ${config.habilita_nfe ? 'bg-blue-500' : 'bg-gray-300'}`}>
              <div className={`w-5 h-5 bg-white rounded-full shadow mt-0.5 transition-transform ${config.habilita_nfe ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
            <div>
              <p className="font-medium text-sm text-gray-800">NF-e — Nota Fiscal de Produtos</p>
              <p className="text-xs text-gray-500">Para comércio e indústria. Requer certificado digital A1 (.pfx).</p>
            </div>
          </div>

          {/* Botão ativar */}
          <div className="flex justify-end pt-2">
            <Button
              className="bg-green-600 hover:bg-green-700 text-white gap-2"
              onClick={handleAtivar}
              disabled={ativando || !perfilOk || (!config.habilita_nfse && !config.habilita_nfe)}
            >
              {ativando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {isAtivo ? 'Atualizar Configuração' : 'Ativar Emissão Fiscal'}
            </Button>
          </div>
          {!perfilOk && (
            <p className="text-xs text-red-500 text-right">Preencha o CNPJ e Razão Social na aba Perfil primeiro.</p>
          )}
        </CardContent>
      </Card>

      {/* Numeração NF-e — só aparece se NF-e estiver habilitada e módulo ativo */}
      {config.habilita_nfe && isAtivo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Hash className="h-5 w-5 text-blue-600" />
              Numeração da NF-e
            </CardTitle>
            <p className="text-sm text-gray-500">
              Configure o próximo número da nota. Se veio de outro sistema, informe o número seguinte ao último emitido.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-[2fr_1fr] gap-3">
              <div>
                <Label>Próximo número da NF-e</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="Ex: 109"
                  value={numeroProximo}
                  onChange={e => setNumeroProximo(e.target.value)}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Último número do sistema anterior + 1
                </p>
              </div>
              <div>
                <Label>Série</Label>
                <Input
                  placeholder="Ex: 1"
                  value={serieNfe}
                  onChange={e => setSerieNfe(e.target.value)}
                />
              </div>
            </div>
            {config.numero_proximo_nfe && (
              <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
                <p className="text-xs text-blue-700">
                  Configuração atual: Nº <strong>{config.numero_proximo_nfe}</strong> / Série <strong>{config.serie_nfe ?? '1'}</strong>
                </p>
              </div>
            )}
            <Button
              className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleSalvarNumeracao}
              disabled={salvandoNum || !numeroProximo}
            >
              {salvandoNum ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hash className="h-4 w-4" />}
              Salvar e sincronizar com Focus NFe
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Certificado Digital — só aparece se NF-e estiver habilitada */}
      {config.habilita_nfe && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileKey className="h-5 w-5 text-purple-600" />
              Certificado Digital A1
            </CardTitle>
            <p className="text-sm text-gray-500">Necessário para emitir NF-e. Formato .pfx ou .p12.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {certEnviado ? (
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                <div>
                  <p className="text-sm text-green-800 font-medium">Certificado ativo</p>
                  <p className="text-xs text-green-700">Seu certificado está registrado e válido.</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                <p className="text-sm text-amber-800">Nenhum certificado enviado. Necessário para emitir NF-e.</p>
              </div>
            )}

            <div
              className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors"
              onClick={() => certInputRef.current?.click()}
            >
              {arquivoCert ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText className="h-5 w-5 text-purple-600" />
                  <p className="text-sm font-medium text-purple-700">{arquivoCert.name}</p>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Clique para selecionar o arquivo .pfx</p>
                </>
              )}
              <input
                ref={certInputRef}
                type="file"
                accept=".pfx,.p12"
                className="hidden"
                onChange={e => setArquivoCert(e.target.files?.[0] ?? null)}
              />
            </div>

            <div>
              <Label>Senha do Certificado</Label>
              <Input
                type="password"
                placeholder="Senha do arquivo .pfx"
                value={senhaCert}
                onChange={e => setSenhaCert(e.target.value)}
              />
            </div>

            <Button
              className="w-full gap-2"
              onClick={handleEnviarCertificado}
              disabled={enviandoCert || !arquivoCert || !senhaCert}
            >
              {enviandoCert ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {certEnviado ? 'Substituir Certificado' : 'Enviar Certificado'}
            </Button>

            <div className="border-t pt-3 space-y-2">
              <p className="text-xs text-gray-400 text-center">
                Prefere fazer pelo painel da Focus NFe?{' '}
                <a href="https://app.focusnfe.com.br" target="_blank" rel="noopener noreferrer"
                  className="text-purple-600 hover:underline inline-flex items-center gap-0.5">
                  Acesse aqui <ExternalLink className="h-3 w-3" />
                </a>
                {' '}e depois clique em:
              </p>
              <Button variant="outline" className="w-full gap-2 text-sm" onClick={handleConfirmarManual}
                disabled={certEnviado}>
                <CheckCircle2 className="h-4 w-4" />
                {certEnviado ? 'Certificado já confirmado' : 'Já enviei pelo painel — confirmar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

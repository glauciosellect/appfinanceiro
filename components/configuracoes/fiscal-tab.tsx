'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { CheckCircle2, AlertCircle, Loader2, FileKey, Zap, Receipt, ExternalLink } from 'lucide-react'

interface FiscalConfig {
  habilita_nfse?: boolean
  habilita_nfe?: boolean
  focus_status?: string
  focus_erro?: string
  certificado_status?: string
  ativo?: boolean
  cnpj?: string
}

export default function FiscalTab({ userId }: { userId: string }) {
  const [config, setConfig] = useState<FiscalConfig>({ habilita_nfse: true, habilita_nfe: false })
  const [perfilOk, setPerfilOk] = useState(false)
  const [loading, setLoading] = useState(true)
  const [ativando, setAtivando] = useState(false)
  const [confirmandoCert, setConfirmandoCert] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (!userId) return
    Promise.all([
      createClient().from('fiscal_config').select('habilita_nfse,habilita_nfe,focus_status,focus_erro,certificado_status,ativo,cnpj').eq('user_id', userId).single(),
      createClient().from('perfil_empresa').select('cnpj_cpf, razao_social').eq('user_id', userId).single(),
    ]).then(([{ data: fiscal }, { data: perfil }]) => {
      if (fiscal) setConfig(fiscal as FiscalConfig)
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

  async function handleConfirmarCertificado() {
    setConfirmandoCert(true)
    try {
      const supabase = createClient()
      await supabase.from('fiscal_config').update({
        certificado_status: 'enviado',
        updated_at: new Date().toISOString(),
      }).eq('user_id', userId)
      toast('Certificado confirmado!', 'success')
      setConfig(c => ({ ...c, certificado_status: 'enviado' }))
    } catch {
      toast('Erro ao salvar confirmação', 'error')
    } finally {
      setConfirmandoCert(false)
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

      {/* Certificado Digital — só aparece se NF-e estiver habilitada */}
      {config.habilita_nfe && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileKey className="h-5 w-5 text-purple-600" />
              Certificado Digital A1
            </CardTitle>
            <p className="text-sm text-gray-500">Necessário para emitir NF-e. O upload é feito diretamente no painel da Focus NFe.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {certEnviado ? (
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                <div>
                  <p className="text-sm text-green-800 font-medium">Certificado confirmado</p>
                  <p className="text-xs text-green-700">O certificado foi registrado no painel da Focus NFe.</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                <p className="text-sm text-amber-800">Certificado ainda não confirmado. Siga os passos abaixo.</p>
              </div>
            )}

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
              <p className="text-sm font-medium text-gray-700">Como enviar o certificado:</p>
              <ol className="text-sm text-gray-600 space-y-2 list-none">
                <li className="flex gap-2"><span className="font-semibold text-purple-600">1.</span> Acesse o painel da Focus NFe no link abaixo</li>
                <li className="flex gap-2"><span className="font-semibold text-purple-600">2.</span> Vá em <strong>Empresas</strong> → selecione sua empresa</li>
                <li className="flex gap-2"><span className="font-semibold text-purple-600">3.</span> Clique em <strong>Certificado Digital</strong> e faça o upload do arquivo .pfx</li>
                <li className="flex gap-2"><span className="font-semibold text-purple-600">4.</span> Volte aqui e clique em <strong>Confirmar envio</strong></li>
              </ol>
              <a
                href="https://app.focusnfe.com.br"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 justify-center w-full px-4 py-2 rounded-lg border border-purple-300 text-purple-700 bg-white hover:bg-purple-50 transition-colors text-sm font-medium"
              >
                <ExternalLink className="h-4 w-4" />
                Abrir painel Focus NFe
              </a>
            </div>

            <Button
              className="w-full gap-2"
              variant="outline"
              onClick={handleConfirmarCertificado}
              disabled={confirmandoCert || certEnviado}
            >
              {confirmandoCert ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {certEnviado ? 'Certificado já confirmado' : 'Confirmar envio do certificado'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

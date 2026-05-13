'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { CheckCircle2, AlertCircle, Loader2, Upload, FileKey, Building2, Zap } from 'lucide-react'
import { maskCEP, maskPhone, buscarCEP } from '@/lib/masks'

interface FiscalConfig {
  cnpj?: string
  razao_social?: string
  inscricao_estadual?: string
  inscricao_municipal?: string
  regime_tributario?: string
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  municipio?: string
  uf?: string
  telefone?: string
  email?: string
  habilita_nfse?: boolean
  habilita_nfe?: boolean
  focus_status?: string
  focus_erro?: string
  certificado_status?: string
  ativo?: boolean
}

const REGIMES = [
  { value: '1', label: 'Simples Nacional' },
  { value: '2', label: 'Simples Nacional — Excesso de sublimite' },
  { value: '3', label: 'Regime Normal (Lucro Presumido / Real)' },
]

export default function FiscalTab({ userId }: { userId: string }) {
  const [config, setConfig] = useState<FiscalConfig>({
    habilita_nfse: true, habilita_nfe: false, regime_tributario: '1',
  })
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [enviandoCert, setEnviandoCert] = useState(false)
  const [buscandoCEPState, setBuscandoCEP] = useState(false)
  const [senhaCert, setSenhaCert] = useState('')
  const [arquivoCert, setArquivoCert] = useState<File | null>(null)
  const certInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (!userId) return
    createClient()
      .from('fiscal_config')
      .select('*')
      .eq('user_id', userId)
      .single()
      .then(({ data }) => {
        if (data) setConfig(data as FiscalConfig)
        setLoading(false)
      })
  }, [userId])

  function set(field: keyof FiscalConfig, value: unknown) {
    setConfig(c => ({ ...c, [field]: value }))
  }

  async function handleCEP(v: string) {
    set('cep', maskCEP(v))
    if (v.replace(/\D/g, '').length === 8) {
      setBuscandoCEP(true)
      const end = await buscarCEP(v.replace(/\D/g, ''))
      if (end) {
        setConfig(c => ({
          ...c,
          logradouro: end.logradouro,
          bairro: end.bairro,
          municipio: end.localidade,
          uf: end.uf,
        }))
      }
      setBuscandoCEP(false)
    }
  }

  async function handleAtivar() {
    if (!config.cnpj || !config.razao_social) {
      toast('CNPJ e Razão Social são obrigatórios', 'error')
      return
    }
    setSalvando(true)
    try {
      const res = await fetch('/api/fiscal/ativar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      const json = await res.json() as { ok?: boolean; error?: string; focus_erro?: string }
      if (json.ok) {
        toast('Cadastro fiscal ativado com sucesso!', 'success')
        setConfig(c => ({ ...c, focus_status: 'cadastrado', ativo: true }))
      } else {
        toast(json.focus_erro ?? json.error ?? 'Erro ao ativar', 'error')
        setConfig(c => ({ ...c, focus_status: 'erro' }))
      }
    } catch {
      toast('Erro de conexão', 'error')
    } finally {
      setSalvando(false)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />Carregando configurações fiscais...
      </div>
    )
  }

  const isAtivo = config.focus_status === 'cadastrado' || config.ativo
  const certEnviado = config.certificado_status === 'enviado'

  return (
    <div className="space-y-6">

      {/* Status geral */}
      {isAtivo ? (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
          <div>
            <p className="font-semibold text-green-800 text-sm">Módulo fiscal ativo</p>
            <p className="text-green-700 text-xs">Emissão de NFS-e habilitada para {config.cnpj}</p>
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
          <p className="text-amber-800 text-sm font-medium">
            Preencha os dados abaixo e clique em <strong>Ativar Emissão Fiscal</strong> para começar a emitir notas.
          </p>
        </div>
      )}

      {/* Dados da empresa */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-5 w-5 text-blue-600" />
            Dados da Empresa Emitente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>CNPJ *</Label>
              <Input
                placeholder="00.000.000/0001-00"
                value={config.cnpj ?? ''}
                onChange={e => set('cnpj', e.target.value)}
              />
            </div>
            <div>
              <Label>Razão Social *</Label>
              <Input
                placeholder="Nome da empresa"
                value={config.razao_social ?? ''}
                onChange={e => set('razao_social', e.target.value)}
              />
            </div>
            <div>
              <Label>Inscrição Estadual</Label>
              <Input
                placeholder="000.000.000.000"
                value={config.inscricao_estadual ?? ''}
                onChange={e => set('inscricao_estadual', e.target.value)}
              />
            </div>
            <div>
              <Label>Inscrição Municipal</Label>
              <Input
                placeholder="Número de registro na prefeitura"
                value={config.inscricao_municipal ?? ''}
                onChange={e => set('inscricao_municipal', e.target.value)}
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                placeholder="(00) 00000-0000"
                value={config.telefone ?? ''}
                onChange={e => set('telefone', maskPhone(e.target.value))}
              />
            </div>
            <div>
              <Label>E-mail da empresa</Label>
              <Input
                type="email"
                placeholder="fiscal@empresa.com.br"
                value={config.email ?? ''}
                onChange={e => set('email', e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Regime Tributário</Label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={config.regime_tributario ?? '1'}
              onChange={e => set('regime_tributario', e.target.value)}
            >
              {REGIMES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Endereço */}
      <Card>
        <CardHeader><CardTitle className="text-base">Endereço</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>CEP {buscandoCEPState && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}</Label>
              <Input
                placeholder="00000-000"
                value={config.cep ?? ''}
                onChange={e => handleCEP(e.target.value)}
                maxLength={9}
              />
            </div>
            <div className="md:col-span-2">
              <Label>Logradouro</Label>
              <Input value={config.logradouro ?? ''} onChange={e => set('logradouro', e.target.value)} />
            </div>
            <div>
              <Label>Número</Label>
              <Input value={config.numero ?? ''} onChange={e => set('numero', e.target.value)} />
            </div>
            <div>
              <Label>Complemento</Label>
              <Input value={config.complemento ?? ''} onChange={e => set('complemento', e.target.value)} />
            </div>
            <div>
              <Label>Bairro</Label>
              <Input value={config.bairro ?? ''} onChange={e => set('bairro', e.target.value)} />
            </div>
            <div>
              <Label>Município</Label>
              <Input value={config.municipio ?? ''} onChange={e => set('municipio', e.target.value)} />
            </div>
            <div>
              <Label>UF</Label>
              <Input value={config.uf ?? ''} onChange={e => set('uf', e.target.value)} maxLength={2} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Habilitações */}
      <Card>
        <CardHeader><CardTitle className="text-base">Tipos de Nota Fiscal</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => set('habilita_nfse', !config.habilita_nfse)}
              className={`w-11 h-6 rounded-full transition-colors ${config.habilita_nfse ? 'bg-green-500' : 'bg-gray-300'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow mt-0.5 transition-transform ${config.habilita_nfse ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
            <div>
              <p className="font-medium text-sm text-gray-800">NFS-e — Nota Fiscal de Serviços</p>
              <p className="text-xs text-gray-500">Para empresas prestadoras de serviço</p>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => set('habilita_nfe', !config.habilita_nfe)}
              className={`w-11 h-6 rounded-full transition-colors ${config.habilita_nfe ? 'bg-blue-500' : 'bg-gray-300'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow mt-0.5 transition-transform ${config.habilita_nfe ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
            <div>
              <p className="font-medium text-sm text-gray-800">NF-e — Nota Fiscal de Produtos</p>
              <p className="text-xs text-gray-500">Requer certificado digital A1 (.pfx)</p>
            </div>
          </label>
        </CardContent>
      </Card>

      {/* Botão ativar */}
      <div className="flex justify-end">
        <Button
          className="bg-green-600 hover:bg-green-700 text-white gap-2"
          onClick={handleAtivar}
          disabled={salvando}
        >
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {isAtivo ? 'Atualizar Cadastro Fiscal' : 'Ativar Emissão Fiscal'}
        </Button>
      </div>

      {/* Certificado Digital (NF-e) */}
      {config.habilita_nfe && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileKey className="h-5 w-5 text-purple-600" />
              Certificado Digital A1 — NF-e
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {certEnviado ? (
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <p className="text-sm text-green-800 font-medium">Certificado enviado e ativo</p>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <p className="text-sm text-amber-800">Nenhum certificado enviado. Necessário para emitir NF-e.</p>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <Label>Arquivo .pfx</Label>
                <div
                  className="mt-1 border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors"
                  onClick={() => certInputRef.current?.click()}
                >
                  <Upload className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  {arquivoCert ? (
                    <p className="text-sm font-medium text-purple-700">{arquivoCert.name}</p>
                  ) : (
                    <p className="text-sm text-gray-400">Clique para selecionar o arquivo .pfx</p>
                  )}
                  <input
                    ref={certInputRef}
                    type="file"
                    accept=".pfx,.p12"
                    className="hidden"
                    onChange={e => setArquivoCert(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>
              <div>
                <Label>Senha do Certificado</Label>
                <Input
                  type="password"
                  placeholder="Senha do .pfx"
                  value={senhaCert}
                  onChange={e => setSenhaCert(e.target.value)}
                />
              </div>
              <Button
                className="w-full gap-2"
                variant="outline"
                onClick={handleEnviarCertificado}
                disabled={enviandoCert || !arquivoCert || !senhaCert}
              >
                {enviandoCert ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {certEnviado ? 'Substituir Certificado' : 'Enviar Certificado'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

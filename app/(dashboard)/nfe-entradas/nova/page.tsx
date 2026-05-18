'use client'

import { useCallback, useEffect, useState, type ChangeEvent, type DragEvent } from 'react'
import Link from 'next/link'
import { ArrowLeft, Upload, QrCode, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { parseNFeXml } from '@/lib/fiscal/parse-nfe-xml'
import { saveEntradaImportada } from '@/lib/fiscal/nfe-entradas-storage'

type Modo = 'chave' | 'upload' | null

function onlyNFeKeyDigits(raw: string) {
  return raw.replace(/\D/g, '').slice(0, 44)
}

function isXmlNFeFile(file: File) {
  return file.name.toLowerCase().endsWith('.xml')
}

export default function NovaEntradaPage() {
  const [modo, setModo] = useState<Modo>(null)
  const [chave, setChave] = useState('')
  const [xmlFile, setXmlFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [xmlErro, setXmlErro] = useState<string | null>(null)
  const [importando, setImportando] = useState(false)
  const [step, setStep] = useState<'form' | 'success'>('form')

  /** Evita que o navegador abra o XML em nova aba ao soltar o arquivo fora da área tracejada. */
  useEffect(() => {
    if (modo !== 'upload' || step !== 'form') return
    const bloquearNavegacao = (e: globalThis.DragEvent) => {
      e.preventDefault()
    }
    window.addEventListener('dragover', bloquearNavegacao)
    window.addEventListener('drop', bloquearNavegacao)
    return () => {
      window.removeEventListener('dragover', bloquearNavegacao)
      window.removeEventListener('drop', bloquearNavegacao)
    }
  }, [modo, step])

  const assignXmlFile = useCallback((file: File | null) => {
    setXmlErro(null)
    if (!file) {
      setXmlFile(null)
      return
    }
    if (!isXmlNFeFile(file)) {
      setXmlFile(null)
      setXmlErro('Selecione um arquivo .xml de NF-e.')
      return
    }
    setXmlFile(file)
  }, [])

  const onXmlInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    assignXmlFile(file)
    e.target.value = ''
  }

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0] ?? null
    assignXmlFile(file)
  }

  const onDragOver = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }

  const onDragLeave = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }

  async function handleImportarXml() {
    if (!xmlFile) return
    setXmlErro(null)
    setImportando(true)
    try {
      const text = await xmlFile.text()
      const parsed = parseNFeXml(text)
      const result = saveEntradaImportada({
        id: crypto.randomUUID(),
        ...parsed,
        fonte: 'xml',
        importadoEm: new Date().toISOString(),
      })
      if (!result.ok) {
        setXmlErro(result.error)
        return
      }
      window.dispatchEvent(new Event('syncromoney:nfe-entradas'))
      setStep('success')
    } catch (err) {
      setXmlErro(err instanceof Error ? err.message : 'Não foi possível ler o XML.')
    } finally {
      setImportando(false)
    }
  }

  function handleImportarChave() {
    if (chave.length !== 44) return
    setXmlErro(null)
    const result = saveEntradaImportada({
      id: crypto.randomUUID(),
      numero: '—',
      serie: '—',
      chaveAcesso: chave,
      dataEmissao: new Date().toISOString().slice(0, 10),
      naturezaOperacao: 'Importação por chave de acesso',
      valorTotal: 0,
      fornecedorNome: 'A identificar (consulta SEFAZ pendente)',
      fornecedorCnpj: '—',
      fonte: 'chave',
      importadoEm: new Date().toISOString(),
    })
    if (!result.ok) {
      setXmlErro(result.error)
      return
    }
    window.dispatchEvent(new Event('syncromoney:nfe-entradas'))
    setStep('success')
  }

  if (step === 'success') {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Importação registrada</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          A nota foi salva e aparece em <strong>Notas de Entrada</strong> neste navegador. Os dados do XML já foram
          lidos; a consulta automática à SEFAZ e a atualização de estoque podem ser ativadas em versões futuras.
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" asChild><Link href="/estoque">Ver Estoque</Link></Button>
          <Button asChild><Link href="/nfe-entradas">Ver Entradas</Link></Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/nfe-entradas"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Registrar NF-e de Entrada</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Registro de compras com NF-e de mercadoria (fornecedor)
          </p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Como você quer importar a nota?</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { id: 'chave' as Modo, icon: QrCode, title: 'Pela Chave de Acesso', desc: 'Digite a chave de 44 dígitos da NF-e do fornecedor' },
            { id: 'upload' as Modo, icon: Upload, title: 'Upload do XML', desc: 'Importe o arquivo XML da nota fiscal eletrônica' },
          ].map(({ id, icon: Icon, title, desc }) => (
            <button key={id as string} onClick={() => { setModo(id); setXmlErro(null); setXmlFile(null); setChave('') }}
              className={cn('p-5 rounded-xl border-2 text-left transition-all', modo === id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600')}>
              <Icon className={cn('h-7 w-7 mb-3', modo === id ? 'text-blue-600' : 'text-gray-400 dark:text-gray-500')} />
              <p className="font-semibold text-gray-800 dark:text-gray-200">{title}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{desc}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      {modo === 'chave' && (
        <Card>
          <CardHeader><CardTitle className="text-base">Chave de Acesso</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Chave de Acesso (44 dígitos)</label>
              <Input
                className="font-mono tracking-wider"
                placeholder="Cole a chave — pontos e espaços são ignorados"
                inputMode="numeric"
                autoComplete="off"
                maxLength={54}
                value={chave}
                onChange={(e) => setChave(onlyNFeKeyDigits(e.target.value))}
              />
              <p className="text-xs text-gray-400 mt-1">{chave.length}/44 dígitos</p>
              <p className="text-xs text-amber-700 dark:text-amber-400/90 mt-2">
                A chave de <strong>NF-e de mercadoria</strong> tem sempre 44 números (no DANFE costuma aparecer em bloco ou com espaços).
                <strong> NFS-e</strong> (serviço) não usa esta chave — use o módulo de notas de serviço ou o XML da prefeitura, conforme o caso.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300">
              <p className="font-semibold mb-1">Como funciona?</p>
              <p>O registro por chave grava a nota na lista localmente. Quando houver integração com a SEFAZ, os dados completos serão preenchidos automaticamente.</p>
            </div>
            {xmlErro && <p className="text-sm text-red-600 dark:text-red-400">{xmlErro}</p>}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setModo(null); setXmlErro(null) }}>Voltar</Button>
              <Button className="flex-1" disabled={chave.length < 44} onClick={handleImportarChave}>
                Consultar e Importar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {modo === 'upload' && (
        <Card>
          <CardHeader><CardTitle className="text-base">Upload do XML</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
              Solte o arquivo <strong>só dentro da área tracejada</strong>. Se soltar em cima da barra de endereço ou fora do app, o navegador pode abrir o XML em uma aba nova — isso é comportamento do Chrome, não do SyncroMoney.
            </p>
            {/*
              <label> em volta do input: o clique abre o seletor em qualquer navegador/PWA
              (melhor que input invisível por cima ou input.click() via botão).
            */}
            <label
              htmlFor="nfe-xml-upload"
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              className={cn(
                'flex w-full min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors',
                dragActive
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/25'
                  : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50/80 dark:hover:bg-gray-800/40',
                xmlFile && 'border-green-500 bg-green-50/80 dark:bg-green-900/20'
              )}
            >
              <input
                id="nfe-xml-upload"
                type="file"
                accept=".xml,text/xml,application/xml,application/octet-stream"
                className="sr-only"
                onChange={onXmlInputChange}
              />
              <Upload className="h-10 w-10 text-gray-400 dark:text-gray-500 mx-auto mb-3 shrink-0" aria-hidden />
              <span className="font-medium text-gray-700 dark:text-gray-300">Arraste o XML aqui</span>
              <span className="text-sm text-gray-500 dark:text-gray-400 mt-1">ou clique para selecionar o arquivo</span>
              <span className="text-xs text-gray-400 mt-2">Apenas arquivos .xml de NF-e</span>
              {xmlFile && (
                <span className="text-sm font-medium text-green-700 dark:text-green-400 mt-4 max-w-full break-all px-2">
                  Arquivo: {xmlFile.name}
                </span>
              )}
            </label>
            {xmlErro && <p className="text-sm text-red-600 dark:text-red-400">{xmlErro}</p>}
            <p className="text-center text-sm text-blue-600 dark:text-blue-400">
              <label htmlFor="nfe-xml-upload" className="cursor-pointer underline underline-offset-2 hover:text-blue-800 dark:hover:text-blue-300">
                Abrir pasta de arquivos…
              </label>
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setModo(null)
                  setXmlFile(null)
                  setXmlErro(null)
                }}
              >
                Voltar
              </Button>
              <Button className="flex-1" disabled={!xmlFile || importando} onClick={handleImportarXml}>
                {importando ? (<><Loader2 className="h-4 w-4 animate-spin mr-2 inline" /> Importando…</>) : 'Importar XML'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

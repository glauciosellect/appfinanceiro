'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, FileText, Hash, Building2, Calendar, Tag, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import { findEntradaImportada, type NFeEntradaImportada } from '@/lib/fiscal/nfe-entradas-storage'

export default function NFeEntradaDetalhePage() {
  const params = useParams()
  const id = useMemo(() => {
    const raw = params?.id
    return Array.isArray(raw) ? raw[0] : raw
  }, [params])

  const [nota, setNota] = useState<NFeEntradaImportada | null | undefined>(undefined)

  useEffect(() => {
    if (!id) {
      setNota(null)
      return
    }
    setNota(findEntradaImportada(id))
  }, [id])

  if (nota === undefined) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center text-sm text-gray-500 dark:text-gray-400">
        Carregando…
      </div>
    )
  }

  if (!id || !nota) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-4">
        <FileText className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Nota não encontrada</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Ela pode ter sido registrada em outro navegador ou o link está incorreto.
        </p>
        <Button asChild variant="outline">
          <Link href="/nfe-entradas"><ArrowLeft className="h-4 w-4 mr-2" />Voltar às entradas</Link>
        </Button>
      </div>
    )
  }

  const chFmt = nota.chaveAcesso.replace(/(\d{4})/g, '$1 ').trim()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/nfe-entradas"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">NF-e de entrada</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Série {nota.serie} · Nº {nota.numero}
            {nota.fonte === 'xml' && (
              <span className="ml-2 text-xs font-semibold text-blue-600">Importada por XML</span>
            )}
            {nota.fonte === 'chave' && (
              <span className="ml-2 text-xs font-semibold text-amber-600">Registrada por chave</span>
            )}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Fornecedor (emitente no XML)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p className="font-semibold text-gray-900 dark:text-white">{nota.fornecedorNome}</p>
          <p className="text-gray-600 dark:text-gray-400">CNPJ: {nota.fornecedorCnpj}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Dados da nota
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
          <div className="flex gap-2">
            <Calendar className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500">Data de emissão</p>
              <p className="font-medium text-gray-900 dark:text-white">{formatDate(nota.dataEmissao)}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Tag className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500">Natureza da operação</p>
              <p className="font-medium text-gray-900 dark:text-white">{nota.naturezaOperacao}</p>
            </div>
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Wallet className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500">Valor total</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(nota.valorTotal)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Hash className="h-4 w-4" />
            Chave de acesso (44 dígitos)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-mono text-xs sm:text-sm text-gray-800 dark:text-gray-200 break-all leading-relaxed">{chFmt}</p>
          <p className="text-xs text-gray-500 mt-3">
            Itens e DANFE completos dependerão da integração com leitura completa do XML ou consulta à SEFAZ.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Upload, QrCode, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Modo = 'chave' | 'upload' | null

export default function NovaEntradaPage() {
  const [modo, setModo] = useState<Modo>(null)
  const [chave, setChave] = useState('')
  const [step, setStep] = useState<'form' | 'success'>('form')

  if (step === 'success') {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">NF-e de Entrada registrada!</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">Os produtos foram adicionados ao estoque automaticamente.</p>
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
            Compra de fornecedor — estoque atualizado automaticamente
          </p>
        </div>
      </div>

      {/* Seleção de modo */}
      <Card>
        <CardHeader><CardTitle className="text-base">Como você quer importar a nota?</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { id: 'chave' as Modo, icon: QrCode, title: 'Pela Chave de Acesso', desc: 'Digite a chave de 44 dígitos da NF-e do fornecedor' },
            { id: 'upload' as Modo, icon: Upload, title: 'Upload do XML', desc: 'Importe o arquivo XML da nota fiscal eletrônica' },
          ].map(({ id, icon: Icon, title, desc }) => (
            <button key={id as string} onClick={() => setModo(id)}
              className={cn('p-5 rounded-xl border-2 text-left transition-all', modo === id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600')}>
              <Icon className={cn('h-7 w-7 mb-3', modo === id ? 'text-blue-600' : 'text-gray-400 dark:text-gray-500')} />
              <p className="font-semibold text-gray-800 dark:text-gray-200">{title}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{desc}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Chave de acesso */}
      {modo === 'chave' && (
        <Card>
          <CardHeader><CardTitle className="text-base">Chave de Acesso</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Chave de Acesso (44 dígitos)</label>
              <Input className="font-mono tracking-wider" placeholder="0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000"
                maxLength={47} value={chave} onChange={(e) => setChave(e.target.value.replace(/\s/g, ''))} />
              <p className="text-xs text-gray-400 mt-1">{chave.length}/44 dígitos</p>
            </div>
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300">
              <p className="font-semibold mb-1">Como funciona?</p>
              <p>O sistema consulta a SEFAZ com essa chave, importa todos os dados da nota e atualiza seu estoque automaticamente.</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setModo(null)}>Voltar</Button>
              <Button className="flex-1" disabled={chave.length < 44} onClick={() => setStep('success')}>
                Consultar e Importar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload XML */}
      {modo === 'upload' && (
        <Card>
          <CardHeader><CardTitle className="text-base">Upload do XML</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-blue-400 transition-colors cursor-pointer">
              <Upload className="h-10 w-10 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
              <p className="font-medium text-gray-700 dark:text-gray-300">Arraste o XML aqui</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">ou clique para selecionar o arquivo</p>
              <p className="text-xs text-gray-400 mt-2">Apenas arquivos .xml de NF-e</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setModo(null)}>Voltar</Button>
              <Button className="flex-1" onClick={() => setStep('success')}>Importar XML</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

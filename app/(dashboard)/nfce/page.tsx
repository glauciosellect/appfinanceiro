'use client'

export const dynamic = 'force-dynamic'

import { Receipt, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export default function NfcePage() {
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">NFC-e (Cupom Fiscal)</h1>
        <p className="text-sm text-gray-500">Emissão de Nota Fiscal de Consumidor Eletrônica</p>
      </div>

      <Card>
        <CardContent className="py-16 text-center text-gray-400">
          <div className="relative inline-block mb-4">
            <Receipt className="h-14 w-14 mx-auto opacity-30" />
            <Clock className="h-6 w-6 absolute -bottom-1 -right-1 text-amber-500 bg-white rounded-full p-0.5" />
          </div>
          <p className="font-semibold text-gray-600 text-lg">Em breve</p>
          <p className="text-sm text-gray-400 mt-2 max-w-md mx-auto">
            A emissão de NFC-e (cupom fiscal para vendas do PDV) está em desenvolvimento e
            fará parte do plano Premium assim que disponível.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

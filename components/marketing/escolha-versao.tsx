'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Package, Receipt, ShoppingCart, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// As 3 versões do SyncroMoney e para quem cada uma serve (usado no seletor de "Teste grátis").
export const VERSOES = [
  {
    id: 'intro' as const,
    nome: 'Intro',
    preco: 'R$ 57,90',
    para: 'Para quem tem loja',
    descricao: 'PDV, caixa, estoque e fornecedores em consignação, com acerto e recibo.',
    destaques: ['PDV com leitor de código de barras', 'Consignação com acerto por fornecedor', 'Não emite nota fiscal'],
    icone: Package,
    cor: 'border-[#16A34A] hover:bg-[#F0FDF4]',
    corIcone: 'bg-[#DCFCE7] text-[#16A34A]',
  },
  {
    id: 'pro' as const,
    nome: 'PRO',
    preco: 'R$ 97,00',
    para: 'Para organizar as finanças',
    descricao: 'Contas a pagar e receber, cartões, fluxo de caixa, orçamentos, produtos e estoque.',
    destaques: ['Financeiro completo e relatórios', 'Orçamentos com envio e aceite online', 'Sem PDV e sem nota fiscal'],
    icone: Wallet,
    cor: 'border-[#2563EB] hover:bg-[#EFF6FF]',
    corIcone: 'bg-[#DBEAFE] text-[#2563EB]',
  },
  {
    id: 'premium' as const,
    nome: 'PREMIUM',
    preco: 'R$ 147,00',
    para: 'Para emitir nota fiscal',
    descricao: 'Tudo do PRO, mais PDV, caixa e emissão de NF-e e NFS-e.',
    destaques: ['PDV e controle de caixa', 'Emissão de NF-e e NFS-e', 'Tudo do plano PRO'],
    icone: Receipt,
    cor: 'border-[#F59E0B] hover:bg-[#FFFBEB]',
    corIcone: 'bg-[#FEF3C7] text-[#D97706]',
  },
]

interface Props {
  children: React.ReactNode
  className?: string
  size?: 'default' | 'sm' | 'lg'
  variant?: 'default' | 'outline' | 'ghost'
}

// Botão "Teste grátis" que primeiro pergunta qual versão o cliente quer testar e só então leva ao cadastro
// (/register?plano=...). Evita o cliente cair numa versão diferente da que queria.
export function BotaoTesteGratis({ children, className, size, variant }: Props) {
  const [aberto, setAberto] = useState(false)

  return (
    <>
      <Button type="button" size={size} variant={variant} className={className} onClick={() => setAberto(true)}>
        {children}
      </Button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Qual versão você quer testar?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 -mt-2">
            14 dias grátis em qualquer versão, sem cartão. Escolha a que combina com o seu negócio e siga para o cadastro.
          </p>

          <div className="grid gap-3 md:grid-cols-3">
            {VERSOES.map((v) => (
              <Link
                key={v.id}
                href={`/register?plano=${v.id}`}
                className={`flex flex-col rounded-2xl border-2 bg-white p-4 text-left transition-colors ${v.cor}`}
              >
                <span className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${v.corIcone}`}>
                  <v.icone className="h-5 w-5" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{v.para}</span>
                <span className="mt-0.5 text-lg font-extrabold text-gray-900">{v.nome}</span>
                <span className="text-sm font-semibold text-gray-700">{v.preco}<span className="font-normal text-gray-500">/mês</span></span>
                <span className="mt-2 text-sm leading-snug text-gray-600">{v.descricao}</span>
                <ul className="mt-3 space-y-1.5">
                  {v.destaques.map((d) => (
                    <li key={d} className="flex items-start gap-1.5 text-xs text-gray-700">
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-[#16A34A]" />
                      {d}
                    </li>
                  ))}
                </ul>
                <span className="mt-4 rounded-lg bg-gray-900 px-3 py-2 text-center text-sm font-semibold text-white">
                  Testar o {v.nome === 'PREMIUM' ? 'Premium' : v.nome}
                </span>
              </Link>
            ))}
          </div>

          <p className="flex items-center justify-center gap-1.5 text-xs text-gray-500">
            <ShoppingCart className="h-3.5 w-3.5" />
            Em dúvida? Leve em conta: loja com estoque e PDV = Intro · finanças = PRO · nota fiscal = Premium.
          </p>
        </DialogContent>
      </Dialog>
    </>
  )
}

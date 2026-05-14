'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Landmark,
  Users,
  Building2,
  CreditCard,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  BookOpen,
  CircleDot,
  UserCircle2,
  Package,
  Receipt,
} from 'lucide-react'

/* ── Tipos ── */
interface Step {
  number: number
  title: string
  description: string
  icon: React.ElementType
  color: string
  bg: string
  href: string
  required: boolean
  items: string[]
  tip?: string
}

interface FAQ {
  question: string
  answer: string
}

/* ── Dados dos passos ── */
const steps: Step[] = [
  {
    number: 1,
    title: 'Preencher o Perfil da Empresa',
    description: 'Antes de qualquer cadastro, configure os dados básicos da sua empresa. Esses dados aparecem em relatórios e — se você ativar o módulo fiscal depois — são essenciais para emissão de notas.',
    icon: UserCircle2,
    color: '#0EA5E9',
    bg: '#F0F9FF',
    href: '/configuracoes',
    required: true,
    items: [
      'Acesse Configurações no menu lateral',
      'Selecione "Pessoa Física" ou "Pessoa Jurídica"',
      'Informe o CPF ou CNPJ — os dados serão preenchidos automaticamente',
      'Confirme/ajuste a razão social, nome fantasia, endereço e contato',
      'Selecione o regime tributário (Simples Nacional, Lucro Presumido ou Lucro Real)',
      'Clique em "Salvar Dados da Empresa"',
    ],
    tip: 'Mesmo que você não vá emitir notas fiscais agora, preencha os dados completos — isso evita refazer o cadastro depois e permite ativar o módulo fiscal a qualquer momento.',
  },
  {
    number: 2,
    title: 'Cadastrar Contas Correntes',
    description: 'Cadastre suas contas bancárias. Sem isso, o sistema não consegue registrar recebimentos, pagamentos ou transferências.',
    icon: Landmark,
    color: '#2563EB',
    bg: '#EFF6FF',
    href: '/contas-correntes',
    required: true,
    items: [
      'Clique em "Contas Correntes" no menu lateral',
      'Clique no botão "Nova Conta"',
      'Informe um nome/apelido (ex: "Banco do Brasil - Principal")',
      'Selecione o banco e o tipo de conta',
      'Informe o saldo atual da conta',
      'Salve — repita para cada conta que você possui',
    ],
    tip: 'Cadastre pelo menos 1 conta. Pode ser conta corrente, poupança, caixa físico ou qualquer outra.',
  },
  {
    number: 3,
    title: 'Cadastrar Clientes',
    description: 'Se você presta serviços ou vende produtos e precisa cobrar, cadastre seus clientes. Eles são obrigatórios para criar Contas a Receber.',
    icon: Users,
    color: '#7C3AED',
    bg: '#F5F3FF',
    href: '/clientes',
    required: true,
    items: [
      'Clique em "Clientes" no menu lateral',
      'Clique no botão "Novo Cliente"',
      'Informe o nome do cliente (obrigatório)',
      'Selecione o tipo: Pessoa Física ou Jurídica',
      'Preencha CPF/CNPJ, telefone e email (recomendado)',
      'Salve — repita para cada cliente que você atende',
    ],
    tip: 'Não precisa preencher tudo de uma vez. O mínimo é nome e tipo. Você pode completar depois.',
  },
  {
    number: 4,
    title: 'Cadastrar Fornecedores',
    description: 'Cadastre as empresas ou pessoas de quem você compra produtos ou serviços. Os fornecedores são usados nas Contas a Pagar para organizar suas despesas.',
    icon: Building2,
    color: '#D97706',
    bg: '#FFFBEB',
    href: '/fornecedores',
    required: false,
    items: [
      'Clique em "Fornecedores" no menu lateral',
      'Clique no botão "Novo Fornecedor"',
      'Informe o nome do fornecedor',
      'Selecione a categoria (ex: Aluguel, Serviços, Tecnologia)',
      'Preencha os dados de contato (opcional)',
      'Salve — repita para cada fornecedor',
    ],
    tip: 'O fornecedor é opcional nas Contas a Pagar. Mas cadastrá-los ajuda a organizar e filtrar suas despesas por categoria.',
  },
  {
    number: 5,
    title: 'Cadastrar Cartões de Crédito',
    description: 'Se você paga despesas com cartão de crédito, cadastre seus cartões. Isso permite registrar pagamentos no cartão e controlar o limite e as faturas.',
    icon: CreditCard,
    color: '#0891B2',
    bg: '#ECFEFF',
    href: '/cartoes',
    required: false,
    items: [
      'Clique em "Cartões" no menu lateral',
      'Clique no botão "Novo Cartão"',
      'Selecione o banco e a bandeira (Visa, Mastercard, etc)',
      'Informe o nome do titular e o limite total',
      'Informe o dia de vencimento da fatura',
      'Informe o melhor dia para compras (dia de fechamento)',
      'Vincule a uma conta corrente para pagamento da fatura (opcional)',
    ],
    tip: 'Pule este passo se não usa cartão de crédito para pagar despesas da empresa.',
  },
  {
    number: 6,
    title: 'Criar Contas a Receber',
    description: 'Agora você está pronto para registrar suas cobranças. Cada conta a receber pode ter 1 ou várias parcelas — o sistema gera automaticamente.',
    icon: TrendingUp,
    color: '#16A34A',
    bg: '#F0FDF4',
    href: '/contas-receber',
    required: true,
    items: [
      'Clique em "Contas a Receber" no menu lateral',
      'Clique no botão "Nova Conta a Receber"',
      'Selecione o cliente (obrigatório — cadastre antes no Passo 2)',
      'Informe a descrição do serviço ou produto vendido',
      'Informe o valor total e o número de parcelas',
      'Defina a data da primeira parcela',
      'Se quiser, informe juros, desconto ou valor de entrada',
      'Selecione a conta destino para recebimento',
      'Salve — as parcelas serão geradas automaticamente',
    ],
    tip: 'Para receber em parcela única, deixe "Nº de Parcelas" como 1.',
  },
  {
    number: 7,
    title: 'Criar Contas a Pagar',
    description: 'Registre todas as suas despesas: aluguel, fornecedores, contas fixas, etc. Assim o sistema mostra exatamente quanto você vai precisar pagar e quando.',
    icon: TrendingDown,
    color: '#DC2626',
    bg: '#FEF2F2',
    href: '/contas-pagar',
    required: true,
    items: [
      'Clique em "Contas a Pagar" no menu lateral',
      'Clique no botão "Nova Conta a Pagar"',
      'Selecione o fornecedor (opcional)',
      'Informe a descrição da despesa (ex: "Aluguel Outubro")',
      'Informe o valor total e o número de parcelas',
      'Defina a data da primeira parcela',
      'Escolha se vai pagar via conta corrente ou cartão de crédito',
      'Salve — as parcelas serão geradas automaticamente',
    ],
    tip: 'Contas fixas mensais como aluguel: coloque em "Nº de Parcelas" quantos meses quer lançar de uma vez.',
  },
  {
    number: 8,
    title: 'Controlar Estoque (Opcional)',
    description: 'Se você vende produtos físicos, use o módulo de Estoque para controlar quantidades, entradas e saídas. O estoque é atualizado automaticamente ao emitir NF-e de venda e ao registrar NF-e de entrada do fornecedor.',
    icon: Package,
    color: '#8B5CF6',
    bg: '#F5F3FF',
    href: '/estoque',
    required: false,
    items: [
      'Acesse "Estoque" no menu lateral',
      'Clique em "Novo Produto" para cadastrar os itens',
      'Informe código, descrição, NCM, unidade e preço',
      'Defina o estoque inicial de cada produto',
      'Para reposição: importe NF-e do fornecedor via XML em "NF-e Entradas → Nova"',
      'O sistema dará baixa automática no estoque ao emitir NF-e de saída',
    ],
    tip: 'Use NF-e Entradas para registrar compras com fornecedor. Basta importar o XML da nota e o sistema lança no estoque, na conta a pagar e na movimentação financeira automaticamente.',
  },
  {
    number: 9,
    title: 'Ativar o Módulo Fiscal (Opcional)',
    description: 'Se você emite ou pretende emitir notas fiscais (NFS-e de serviços ou NF-e de produtos), ative o módulo fiscal. Há um tutorial dedicado com o passo a passo completo.',
    icon: Receipt,
    color: '#D97706',
    bg: '#FFFBEB',
    href: '/tutorial-fiscal',
    required: false,
    items: [
      'Confirme que o Perfil da Empresa está 100% preenchido (CNPJ, IE, IM, regime tributário)',
      'Acesse o Tutorial Fiscal pelo menu lateral',
      'Siga os 9 passos: ativação, certificado A1, numeração inicial, cadastro de serviços/produtos, emissão',
      'Você pode emitir NFS-e (serviços) imediatamente — não precisa de certificado digital',
      'Para NF-e (produtos) é necessário um certificado digital A1 válido',
    ],
    tip: 'Migrando de outro emissor? No tutorial fiscal há um passo dedicado para continuar a sequência de numeração de NF-e sem quebrar a contabilidade.',
  },
]

const faqs: FAQ[] = [
  {
    question: 'O que é "registrar recebimento"?',
    answer: 'Quando um cliente paga, você precisa registrar esse recebimento na parcela. Vá em Contas a Receber, encontre a parcela, clique no ícone de receber e informe o valor e a data. O saldo da sua conta será atualizado automaticamente.',
  },
  {
    question: 'O que é "registrar pagamento"?',
    answer: 'Quando você paga uma conta, registre na parcela correspondente. Vá em Contas a Pagar, encontre a parcela, clique no ícone de pagar, escolha se foi via conta corrente ou cartão e informe o valor. O saldo será debitado automaticamente.',
  },
  {
    question: 'O que significa status "Atrasado"?',
    answer: 'Quando uma parcela passa da data de vencimento sem ser recebida ou paga, o sistema muda automaticamente o status para "Atrasado". Isso aparece com destaque no Dashboard e nas listas.',
  },
  {
    question: 'O que é Fluxo de Caixa?',
    answer: 'É o relatório que mostra todas as entradas e saídas de dinheiro num período. O SyncroMoney mostra tanto o que já aconteceu (realizado) quanto o que está previsto (projetado com base nas parcelas futuras).',
  },
  {
    question: 'Como pagar a fatura do cartão?',
    answer: 'Vá em Cartões, clique no cartão desejado para ver as faturas. Localize a fatura do mês e clique em "Pagar Fatura". Selecione a conta corrente que vai debitar e confirme. O saldo da conta será reduzido e a fatura marcada como paga.',
  },
  {
    question: 'Posso cancelar uma conta a receber ou a pagar?',
    answer: 'Sim. Na lista de contas, localize a conta desejada e use a opção de cancelar. Isso marcará todas as parcelas pendentes como canceladas. Parcelas já recebidas ou pagas não são afetadas.',
  },
  {
    question: 'Como exportar os dados?',
    answer: 'Vá em Relatórios no menu lateral. Selecione o tipo de relatório (Recebimentos, Pagamentos, Inadimplência ou Fluxo de Caixa), defina o período e clique em "Exportar CSV" ou "Imprimir".',
  },
  {
    question: 'Posso usar o sistema sem emitir notas fiscais?',
    answer: 'Sim. O módulo fiscal é totalmente opcional. Você pode usar o SyncroMoney só para controle financeiro (contas a pagar, receber, fluxo de caixa) sem ativar a parte de notas. Quando quiser emitir, basta seguir o Tutorial Fiscal.',
  },
  {
    question: 'Como importar uma NF-e de fornecedor?',
    answer: 'Acesse "NF-e Entradas" no menu lateral e clique em "Nova". Você pode importar o XML da NF-e que o fornecedor enviou — o sistema extrai os produtos, preços e impostos automaticamente, atualiza o estoque e gera as contas a pagar correspondentes. Também é possível digitar manualmente se você não tiver o XML.',
  },
  {
    question: 'Como cadastrar uma transferência entre contas?',
    answer: 'Acesse "Contas Correntes", clique na conta de origem e use a opção "Transferir". Informe a conta destino e o valor — o sistema debita uma conta e credita a outra, mantendo o saldo das duas atualizado automaticamente.',
  },
]

/* ── Componente de card do passo ── */
function StepCard({ step, index }: { step: Step; index: number }) {
  const [open, setOpen] = useState(false)
  const Icon = step.icon

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-gray-50 transition-colors"
      >
        {/* Número */}
        <div
          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
          style={{ background: step.color }}
        >
          {step.number}
        </div>

        {/* Ícone */}
        <div
          className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: step.bg }}
        >
          <Icon className="h-5 w-5" style={{ color: step.color }} />
        </div>

        {/* Título */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900">{step.title}</span>
            {step.required ? (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600">Obrigatório</span>
            ) : (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Opcional</span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{step.description}</p>
        </div>

        {/* Seta */}
        {open
          ? <ChevronDown className="shrink-0 h-5 w-5 text-gray-400" />
          : <ChevronRight className="shrink-0 h-5 w-5 text-gray-400" />
        }
      </button>

      {/* Conteúdo expandido */}
      {open && (
        <div className="px-5 pb-5 border-t border-gray-50">
          <p className="text-sm text-gray-600 mt-4 mb-4">{step.description}</p>

          {/* Passo a passo */}
          <div className="space-y-2 mb-4">
            {step.items.map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div
                  className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold mt-0.5"
                  style={{ background: step.color }}
                >
                  {i + 1}
                </div>
                <p className="text-sm text-gray-700">{item}</p>
              </div>
            ))}
          </div>

          {/* Dica */}
          {step.tip && (
            <div
              className="rounded-xl p-3 text-sm mb-4"
              style={{ background: step.bg, color: step.color }}
            >
              <span className="font-semibold">Dica: </span>{step.tip}
            </div>
          )}

          {/* Botão ir para a página */}
          <Link
            href={step.href}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: step.color }}
          >
            Ir para {step.title}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  )
}

/* ── Componente FAQ ── */
function FaqItem({ faq }: { faq: FAQ }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 py-4 text-left"
      >
        <span className="font-medium text-gray-800 text-sm">{faq.question}</span>
        {open
          ? <ChevronDown className="shrink-0 h-4 w-4 text-gray-400" />
          : <ChevronRight className="shrink-0 h-4 w-4 text-gray-400" />
        }
      </button>
      {open && (
        <p className="text-sm text-gray-600 pb-4 leading-relaxed">{faq.answer}</p>
      )}
    </div>
  )
}

/* ── Página principal ── */
export default function TutorialPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">

      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50 mb-4">
          <BookOpen className="h-7 w-7 text-blue-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Como usar o SyncroMoney</h1>
        <p className="text-gray-500 mt-2 text-sm max-w-xl mx-auto">
          Siga os passos abaixo na ordem correta para configurar o sistema e começar a controlar suas finanças hoje mesmo.
        </p>
      </div>

      {/* Resumo visual da ordem */}
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-3">Ordem de cadastro recomendada</p>
        <div className="flex flex-wrap items-center gap-2">
          {steps.map((step, i) => (
            <div key={step.number} className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-white rounded-full px-3 py-1 shadow-sm border border-blue-100">
                <CircleDot className="h-3 w-3" style={{ color: step.color }} />
                <span className="text-xs font-medium text-gray-700">{step.title.replace('Cadastrar ', '').replace('Criar ', '')}</span>
                {!step.required && <span className="text-[9px] text-gray-400">(opcional)</span>}
              </div>
              {i < steps.length - 1 && <ArrowRight className="h-3 w-3 text-blue-300 shrink-0" />}
            </div>
          ))}
        </div>
      </div>

      {/* Passos */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Passo a passo detalhado</h2>
        <p className="text-sm text-gray-500 mb-4">Clique em cada passo para ver as instruções completas.</p>
        <div className="space-y-3">
          {steps.map((step, i) => (
            <StepCard key={step.number} step={step} index={i} />
          ))}
        </div>
      </div>

      {/* Fluxo diário */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Rotina diária recomendada</h2>
        <div className="space-y-3">
          {[
            { icon: CheckCircle2, color: '#16A34A', text: 'Acesse o Dashboard para ver o resumo financeiro do dia' },
            { icon: TrendingUp, color: '#2563EB', text: 'Registre os recebimentos que chegaram (Contas a Receber → clique na parcela → Receber)' },
            { icon: TrendingDown, color: '#DC2626', text: 'Registre os pagamentos realizados (Contas a Pagar → clique na parcela → Pagar)' },
            { icon: CheckCircle2, color: '#7C3AED', text: 'Verifique os vencimentos dos próximos 7 dias no Dashboard para se preparar' },
            { icon: CheckCircle2, color: '#D97706', text: 'Gere relatórios mensais para análise financeira completa' },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <item.icon className="h-4 w-4 mt-0.5 shrink-0" style={{ color: item.color }} />
              <p className="text-sm text-gray-700">{item.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Dúvidas frequentes</h2>
        <p className="text-sm text-gray-500 mb-4">Clique na pergunta para ver a resposta.</p>
        {faqs.map((faq, i) => (
          <FaqItem key={i} faq={faq} />
        ))}
      </div>

      {/* Rodapé */}
      <p className="text-center text-xs text-gray-400 pb-4">
        SyncroMoney — Controle Financeiro Inteligente
      </p>
    </div>
  )
}

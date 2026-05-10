import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Users,
  BarChart3,
  ArrowLeftRight,
  Check,
  ArrowRight,
  Star,
  Shield,
  Zap,
  Clock,
  Sparkles,
} from 'lucide-react'

/* ─────────────────────────────────────────────────────────────
   DASHBOARD MOCKUP — HTML estático, zero JS
──────────────────────────────────────────────────────────────── */
function DashboardMockup() {
  return (
    <div className="pointer-events-none select-none overflow-hidden rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] shadow-2xl shadow-[#2563EB]/10">
      {/* window chrome */}
      <div className="flex items-center gap-1.5 border-b border-[#E5E7EB] bg-white px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
        <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
        <span className="h-3 w-3 rounded-full bg-[#28C840]" />
        <div className="ml-3 flex h-5 max-w-44 flex-1 items-center rounded-md bg-[#F3F4F6] px-3">
          <span className="text-[10px] text-[#9CA3AF]">syncromoney.com.br/dashboard</span>
        </div>
      </div>

      {/* dashboard content */}
      <div className="p-4 space-y-3">
        {/* KPI cards */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'A Receber', value: 'R$ 12.450', color: '#16A34A', bg: '#F0FDF4' },
            { label: 'A Pagar', value: 'R$ 8.230', color: '#DC2626', bg: '#FEF2F2' },
            { label: 'Saldo', value: 'R$ 4.220', color: '#2563EB', bg: '#EFF6FF' },
          ].map((card) => (
            <div key={card.label} className="rounded-xl border border-[#E5E7EB] bg-white p-2.5">
              <p className="text-[9px] font-medium text-[#9CA3AF]">{card.label}</p>
              <p className="mt-1 text-[11px] font-bold" style={{ color: card.color }}>{card.value}</p>
              <div className="mt-1.5 h-1 w-full rounded-full" style={{ background: card.bg }}>
                <div className="h-1 rounded-full w-3/4" style={{ background: card.color, opacity: 0.5 }} />
              </div>
            </div>
          ))}
        </div>

        {/* mini chart bars */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-3">
          <p className="mb-2 text-[9px] font-semibold text-[#374151]">Fluxo de Caixa — últimos 6 meses</p>
          <div className="flex items-end gap-1.5 h-14">
            {[
              { e: 70, s: 45 }, { e: 55, s: 60 }, { e: 80, s: 50 },
              { e: 65, s: 55 }, { e: 90, s: 40 }, { e: 75, s: 48 },
            ].map((bar, i) => (
              <div key={i} className="flex flex-1 items-end gap-0.5">
                <div className="flex-1 rounded-sm bg-[#86EFAC]" style={{ height: `${bar.e}%` }} />
                <div className="flex-1 rounded-sm bg-[#FCA5A5]" style={{ height: `${bar.s}%` }} />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex gap-3">
            <span className="flex items-center gap-1 text-[8px] text-[#6B7280]">
              <span className="inline-block h-1.5 w-1.5 rounded-sm bg-[#16A34A]" />Entradas
            </span>
            <span className="flex items-center gap-1 text-[8px] text-[#6B7280]">
              <span className="inline-block h-1.5 w-1.5 rounded-sm bg-[#DC2626]" />Saídas
            </span>
          </div>
        </div>

        {/* recent transactions */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-3">
          <p className="mb-2 text-[9px] font-semibold text-[#374151]">Contas a Receber</p>
          <div className="space-y-1.5">
            {[
              { name: 'Empresa ABC Ltda', val: 'R$ 3.200', status: 'Recebido', color: '#16A34A', bg: '#F0FDF4' },
              { name: 'João Silva ME', val: 'R$ 1.800', status: 'Vence hoje', color: '#D97706', bg: '#FFFBEB' },
              { name: 'Tech Solutions', val: 'R$ 5.400', status: 'Em aberto', color: '#2563EB', bg: '#EFF6FF' },
            ].map((row) => (
              <div key={row.name} className="flex items-center justify-between">
                <p className="truncate text-[9px] font-medium text-[#111827] max-w-[40%]">{row.name}</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold" style={{ color: row.color }}>{row.val}</span>
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[8px] font-semibold"
                    style={{ color: row.color, background: row.bg }}
                  >
                    {row.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   DATA
──────────────────────────────────────────────────────────────── */
const METRICS = [
  { value: '100%', label: 'Controle financeiro', icon: BarChart3, color: '#2563EB', bg: '#EFF6FF' },
  { value: '−80%', label: 'Inadimplência', icon: TrendingDown, color: '#16A34A', bg: '#F0FDF4' },
  { value: '3×', label: 'Mais produtividade', icon: Zap, color: '#D97706', bg: '#FFFBEB' },
  { value: '500+', label: 'Empresas ativas', icon: Sparkles, color: '#7C3AED', bg: '#F5F3FF' },
]

const FEATURES = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard Financeiro Completo',
    description: 'Visualize saldo, entradas, saídas e alertas em tempo real. KPIs financeiros que mostram exatamente a saúde do seu negócio.',
    color: '#2563EB', bg: '#EFF6FF',
  },
  {
    icon: TrendingUp,
    title: 'Contas a Receber',
    description: 'Cadastre cobranças parceladas, acompanhe vencimentos e registre recebimentos com poucos cliques. Nunca mais perca um recebimento.',
    color: '#16A34A', bg: '#F0FDF4',
  },
  {
    icon: TrendingDown,
    title: 'Contas a Pagar',
    description: 'Controle todas as suas despesas e fornecedores. Parcele pagamentos e receba alertas antes do vencimento.',
    color: '#DC2626', bg: '#FEF2F2',
  },
  {
    icon: CreditCard,
    title: 'Cartões de Crédito',
    description: 'Gerencie múltiplos cartões, faturas e lançamentos parcelados. Saiba exatamente quanto vai sair na próxima fatura.',
    color: '#7C3AED', bg: '#F5F3FF',
  },
  {
    icon: Users,
    title: 'Clientes e Fornecedores',
    description: 'Cadastro completo com histórico financeiro vinculado. Busca por CPF/CNPJ e consulta de CEP automática.',
    color: '#D97706', bg: '#FFFBEB',
  },
  {
    icon: ArrowLeftRight,
    title: 'Fluxo de Caixa',
    description: 'Visualize entradas e saídas realizadas e projetadas. Tome decisões com base em dados, não em achismos.',
    color: '#0891B2', bg: '#ECFEFF',
  },
  {
    icon: BarChart3,
    title: 'Relatórios e Exportação',
    description: 'Relatórios de recebimentos, pagamentos, inadimplência e fluxo de caixa. Exporte em CSV com um clique.',
    color: '#16A34A', bg: '#F0FDF4',
  },
  {
    icon: Clock,
    title: 'Alertas Inteligentes',
    description: 'Notificações de vencimentos, atrasos e faturas próximas. Nunca mais pague juros por esquecer uma conta.',
    color: '#D97706', bg: '#FFFBEB',
  },
  {
    icon: Shield,
    title: 'Seguro e Confiável',
    description: 'Seus dados protegidos com Row Level Security. Cada usuário acessa apenas suas próprias informações. Conformidade com LGPD.',
    color: '#DC2626', bg: '#FEF2F2',
  },
]

const PLANS = [
  {
    name: 'Mensal',
    price: 'R$ 39,90',
    period: '/mês',
    description: 'Acesso completo sem compromisso de longo prazo',
    savings: null,
    features: [
      'Dashboard financeiro completo',
      'Contas a Pagar e Receber',
      'Controle de Cartões de Crédito',
      'Clientes e Fornecedores',
      'Fluxo de Caixa',
      'Relatórios e Exportação CSV',
      'Alertas de vencimento',
      'Suporte por e-mail',
    ],
    cta: 'Começar 14 dias grátis',
    href: '/register',
    highlight: false,
  },
  {
    name: 'Anual',
    price: 'R$ 29,90',
    period: '/mês',
    description: 'Cobrado anualmente — R$ 358,80/ano',
    savings: 'Economize R$ 120,00 por ano',
    features: [
      'Tudo do plano Mensal',
      'Prioridade no suporte',
      'Acesso antecipado a novidades',
      '2 meses grátis por ano',
    ],
    cta: 'Começar 14 dias grátis',
    href: '/register',
    highlight: true,
  },
]

const TESTIMONIALS = [
  {
    name: 'Mariana Costa',
    role: 'Proprietária',
    company: 'MC Estética e Beleza',
    text: 'Antes eu usava planilha e sempre esquecia alguma conta. Com o SyncroMoney, sei exatamente o que entra e sai. Meu fluxo de caixa nunca esteve tão organizado.',
    initial: 'M',
    color: '#7C3AED',
  },
  {
    name: 'Roberto Alves',
    role: 'Contador',
    company: 'Alves Assessoria Contábil',
    text: 'Indico para todos os meus clientes PME. O controle de contas a receber com parcelas economizou horas de trabalho manual toda semana.',
    initial: 'R',
    color: '#2563EB',
  },
  {
    name: 'Patrícia Nunes',
    role: 'Diretora Financeira',
    company: 'Nunes Distribuidora',
    text: 'Os alertas de vencimento me salvaram de vários juros. O relatório de fluxo de caixa é o primeiro que abro toda manhã.',
    initial: 'P',
    color: '#16A34A',
  },
]

/* ─────────────────────────────────────────────────────────────
   PAGE
──────────────────────────────────────────────────────────────── */
export function LandingPageContent() {
  return (
    <>
      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-white py-10 sm:py-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              'linear-gradient(#111827 1px, transparent 1px), linear-gradient(to right, #111827 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-[#2563EB] opacity-[0.06] blur-3xl"
        />

        <div className="relative mx-auto max-w-6xl px-5">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* copy */}
            <div className="text-left">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#DBEAFE] bg-[#EFF6FF] px-3.5 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#2563EB] animate-pulse" />
                <span className="text-xs font-semibold text-[#2563EB]">
                  500+ empresas já controlam suas finanças
                </span>
              </div>

              <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight text-[#111827] sm:text-5xl lg:text-[3.25rem]">
                O controle financeiro que{' '}
                <span className="relative inline-block">
                  <span className="relative z-10 text-[#2563EB]">sua empresa</span>
                  <span
                    aria-hidden
                    className="absolute -bottom-0.5 left-0 right-0 h-2.5 rounded opacity-20"
                    style={{ background: '#2563EB' }}
                  />
                </span>{' '}
                precisa
              </h1>

              <p className="mt-5 max-w-lg text-base leading-relaxed text-[#6B7280] sm:text-lg">
                Contas a pagar e receber, cartões, clientes, fornecedores e fluxo de caixa
                em um só lugar — simples, rápido e sem planilhas.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  size="lg"
                  asChild
                  className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white gap-2 px-7 shadow-md shadow-[#2563EB]/25 w-full sm:w-auto"
                >
                  <Link href="/register">
                    Começar 14 dias grátis
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="border-[#E5E7EB] text-[#374151] w-full sm:w-auto"
                >
                  <Link href="/login">Já tenho conta</Link>
                </Button>
              </div>

              <p className="mt-4 text-xs text-[#9CA3AF]">
                14 dias grátis · Sem cartão de crédito · Cancele quando quiser
              </p>
            </div>

            {/* mockup */}
            <div className="relative hidden md:block">
              <div
                aria-hidden
                className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-[#EFF6FF] via-[#F9FAFB] to-[#F0FDF4]"
              />
              <div className="translate-y-6">
                <DashboardMockup />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── MÉTRICAS ──────────────────────────────────────────────────── */}
      <section className="bg-[#F9FAFB] py-16">
        <div className="mx-auto max-w-6xl px-5">
          <p className="mb-10 text-center text-sm font-semibold uppercase tracking-widest text-[#9CA3AF]">
            Resultados de quem usa o SyncroMoney
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-5">
            {METRICS.map(({ value, label, icon: Icon, color, bg }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white p-5 text-center shadow-sm sm:p-6"
              >
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{ background: bg }}
                >
                  <Icon className="h-5 w-5" style={{ color }} />
                </div>
                <span
                  className="text-2xl font-extrabold leading-none tracking-tight sm:text-3xl"
                  style={{ color }}
                >
                  {value}
                </span>
                <span className="text-xs font-medium leading-tight text-[#6B7280]">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FUNCIONALIDADES ───────────────────────────────────────────── */}
      <section id="features" className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="mb-14 text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-[#2563EB]">
              Funcionalidades
            </p>
            <h2 className="text-3xl font-extrabold tracking-tight text-[#111827] sm:text-4xl">
              Tudo para organizar suas finanças
            </h2>
            <p className="mt-3 text-[#6B7280]">
              Do simples ao completo — sem complexidade, sem treinamento.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, description, color, bg }) => (
              <div
                key={title}
                className="group rounded-2xl border border-[#E5E7EB] bg-white p-6 transition-all duration-200 hover:border-[#DBEAFE] hover:shadow-md hover:-translate-y-0.5"
              >
                <div
                  className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110"
                  style={{ background: bg }}
                >
                  <Icon className="h-5 w-5" style={{ color }} />
                </div>
                <h3 className="mb-2 text-sm font-bold text-[#111827]">{title}</h3>
                <p className="text-sm leading-relaxed text-[#6B7280]">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DEPOIMENTOS ───────────────────────────────────────────────── */}
      <section className="bg-[#F9FAFB] py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="mb-12 text-center">
            <div className="mb-3 flex justify-center gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-[#FBBF24] text-[#FBBF24]" />
              ))}
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-[#111827]">
              Quem já usa o SyncroMoney
            </h2>
          </div>

          <div className="flex flex-col gap-4 sm:grid sm:grid-cols-3">
            <div className="flex flex-col justify-between rounded-2xl border border-[#E5E7EB] bg-white p-7 shadow-sm">
              <div>
                <div className="mb-5 flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-[#FBBF24] text-[#FBBF24]" />
                  ))}
                </div>
                <p className="text-[15px] font-medium leading-relaxed text-[#111827]">
                  &ldquo;{TESTIMONIALS[0].text}&rdquo;
                </p>
              </div>
              <div className="mt-6 flex items-center gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ background: TESTIMONIALS[0].color }}
                >
                  {TESTIMONIALS[0].initial}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#111827]">{TESTIMONIALS[0].name}</p>
                  <p className="text-xs text-[#6B7280]">
                    {TESTIMONIALS[0].role} · {TESTIMONIALS[0].company}
                  </p>
                </div>
              </div>
            </div>

            <div className="col-span-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {TESTIMONIALS.slice(1).map((t) => (
                <div
                  key={t.name}
                  className="flex flex-col justify-between rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm"
                >
                  <div>
                    <div className="mb-4 flex gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-3.5 w-3.5 fill-[#FBBF24] text-[#FBBF24]" />
                      ))}
                    </div>
                    <p className="text-sm leading-relaxed text-[#374151]">
                      &ldquo;{t.text}&rdquo;
                    </p>
                  </div>
                  <div className="mt-5 flex items-center gap-3">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ background: t.color }}
                    >
                      {t.initial}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#111827]">{t.name}</p>
                      <p className="text-xs text-[#6B7280]">
                        {t.role} · {t.company}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#DBEAFE] bg-[#EFF6FF] p-6 text-center">
                <p className="text-4xl font-extrabold text-[#2563EB]">97%</p>
                <p className="mt-1 text-sm font-medium text-[#374151]">de satisfação</p>
                <p className="mt-2 text-xs text-[#6B7280]">
                  em pesquisa com nossos clientes ativos
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PREÇOS ────────────────────────────────────────────────────── */}
      <section id="pricing" className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="mb-14 text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-[#2563EB]">
              Preços
            </p>
            <h2 className="text-3xl font-extrabold tracking-tight text-[#111827] sm:text-4xl">
              Simples e transparente
            </h2>
            <p className="mt-3 text-[#6B7280]">
              14 dias grátis em qualquer plano. Sem cartão de crédito para começar.
            </p>
          </div>

          <div className="mx-auto grid max-w-3xl gap-6 pt-6 sm:grid-cols-2">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-2xl p-7 ${
                  plan.highlight
                    ? 'border-2 border-[#2563EB] bg-white shadow-xl shadow-[#2563EB]/10'
                    : 'border border-[#E5E7EB] bg-[#F9FAFB]'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2563EB] px-4 py-1.5 text-xs font-bold text-white shadow-md">
                      <Zap className="h-3 w-3" />
                      Mais popular
                    </span>
                  </div>
                )}

                <div className="mb-5">
                  <p className="text-sm font-bold uppercase tracking-wider text-[#6B7280]">
                    {plan.name}
                  </p>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold tracking-tight text-[#111827]">
                      {plan.price}
                    </span>
                    <span className="text-sm text-[#6B7280]">{plan.period}</span>
                  </div>
                  <p className="mt-1.5 text-sm text-[#6B7280]">{plan.description}</p>
                  {plan.savings && (
                    <p className="mt-1 text-xs font-semibold text-[#16A34A]">{plan.savings}</p>
                  )}
                </div>

                <ul className="mb-7 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2.5 text-sm text-[#374151]">
                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                          plan.highlight
                            ? 'bg-[#DBEAFE] text-[#2563EB]'
                            : 'bg-[#D1FAE5] text-[#16A34A]'
                        }`}
                      >
                        <Check className="h-3 w-3" />
                      </div>
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button
                  asChild
                  size="lg"
                  className={
                    plan.highlight
                      ? 'w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-md shadow-[#2563EB]/25'
                      : 'w-full'
                  }
                  variant={plan.highlight ? 'default' : 'outline'}
                >
                  <Link href={plan.href}>{plan.cta}</Link>
                </Button>

                <p className="mt-3 text-center text-xs text-[#9CA3AF]">
                  14 dias grátis · Cancele quando quiser
                </p>
              </div>
            ))}
          </div>

          <p className="mt-10 text-center text-sm text-[#9CA3AF]">
            Dúvidas?{' '}
            <a href="mailto:syncromoney@gmail.com" className="font-medium text-[#2563EB] hover:underline">
              Fale com a gente
            </a>{' '}
            — respondemos em menos de 24h.
          </p>
        </div>
      </section>

      {/* ── CTA FINAL ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#2563EB] py-20">
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white opacity-5" />
        <div aria-hidden className="pointer-events-none absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-white opacity-5" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,1) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative mx-auto max-w-3xl px-5 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5">
            <span className="text-xs font-semibold text-white/90">
              500+ empresas já organizaram suas finanças
            </span>
          </div>

          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Pronto para ter controle total do seu dinheiro?
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/75">
            Comece grátis por 14 dias. Sem cartão de crédito, sem contrato.
            Suas finanças organizadas em menos de 5 minutos.
          </p>

          <div className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center">
            <Button
              size="lg"
              asChild
              className="bg-white text-[#2563EB] hover:bg-[#F9FAFB] gap-2 px-8 font-bold shadow-lg"
            >
              <Link href="/register">
                Começar 14 dias grátis
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              asChild
              className="border border-white/40 bg-transparent text-white hover:bg-white/15 hover:text-white"
              variant="outline"
            >
              <Link href="/login">Já tenho conta</Link>
            </Button>
          </div>

          <p className="mt-4 text-xs text-white/50">
            Grátis por 14 dias · Sem cartão · Cancele a qualquer momento
          </p>
        </div>
      </section>
    </>
  )
}

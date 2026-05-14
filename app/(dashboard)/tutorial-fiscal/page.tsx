'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Settings,
  Users,
  FileText,
  Receipt,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  GraduationCap,
  CircleDot,
  FileKey,
  Wrench,
  ShoppingCart,
  Building2,
  Hash,
} from 'lucide-react'

interface Step {
  number: number
  title: string
  description: string
  icon: React.ElementType
  color: string
  bg: string
  href: string
  required: 'sim' | 'nfse' | 'nfe' | 'opcional'
  items: string[]
  tip?: string
}

interface FAQ {
  question: string
  answer: string
}

const steps: Step[] = [
  {
    number: 1,
    title: 'Preencher o Perfil da Empresa',
    description: 'Antes de qualquer nota, o sistema precisa saber quem é o emitente — sua empresa. Esses dados são o cabeçalho de todas as NFS-e e NF-e emitidas.',
    icon: Building2,
    color: '#2563EB',
    bg: '#EFF6FF',
    href: '/configuracoes',
    required: 'sim',
    items: [
      'Acesse Configurações → aba Perfil',
      'Selecione "Pessoa Jurídica" e informe o CNPJ',
      'O sistema preencherá os dados automaticamente ao digitar o CNPJ',
      'Confirme ou ajuste a Razão Social e o Nome Fantasia',
      'Preencha a Inscrição Estadual (IE) e a Inscrição Municipal (IM)',
      'Selecione o Regime Tributário (Simples Nacional, Lucro Presumido ou Lucro Real)',
      'Informe o CEP — o endereço será preenchido automaticamente',
      'Confirme número, complemento e bairro',
      'Clique em "Salvar Dados da Empresa"',
    ],
    tip: 'A Inscrição Municipal (IM) é obrigatória para emitir NFS-e. Consulte o alvará da prefeitura ou o cadastro mobiliário da sua cidade.',
  },
  {
    number: 2,
    title: 'Ativar o Módulo Fiscal',
    description: 'Com o perfil completo, ative a emissão fiscal. O SyncroMoney registra automaticamente seus dados na nuvem fiscal e habilita a comunicação com a Prefeitura (NFS-e) e/ou a SEFAZ (NF-e). Tudo sem você precisar acessar portais externos.',
    icon: Settings,
    color: '#7C3AED',
    bg: '#F5F3FF',
    href: '/configuracoes',
    required: 'sim',
    items: [
      'Acesse Configurações → aba Fiscal',
      'Marque os tipos de nota que pretende emitir: NFS-e (serviços) e/ou NF-e (produtos)',
      'Clique em "Ativar Emissão Fiscal"',
      'O sistema sincroniza automaticamente seu CNPJ, IE, regime tributário e endereço com a nuvem fiscal',
      'Aguarde 2-3 segundos — um banner verde aparecerá indicando "Módulo fiscal ativo"',
      'Se algum dado estiver inválido, a mensagem de erro aparecerá em vermelho — corrija no Perfil e ative novamente',
    ],
    tip: 'A ativação registra sua empresa no integrador automaticamente — você NÃO precisa se cadastrar em nenhum site externo. Toda a comunicação com SEFAZ e Prefeitura passa pelo SyncroMoney.',
  },
  {
    number: 3,
    title: 'Enviar o Certificado Digital (NF-e)',
    description: 'Para emitir NF-e de produtos, o certificado digital A1 é obrigatório. Ele identifica sua empresa digitalmente para a SEFAZ. Para NFS-e de serviços, pule este passo.',
    icon: FileKey,
    color: '#0891B2',
    bg: '#ECFEFF',
    href: '/configuracoes',
    required: 'nfe',
    items: [
      'Ainda na aba Fiscal, certifique-se de que o toggle "NF-e — Nota Fiscal de Produtos" está ligado',
      'Role a página até a seção "Certificado Digital A1"',
      'Clique na área tracejada e selecione seu arquivo .pfx ou .p12',
      'Informe a senha do certificado no campo "Senha do Certificado"',
      'Clique em "Enviar Certificado"',
      'Aguarde a confirmação — o status mudará para "Certificado ativo"',
    ],
    tip: 'O certificado A1 é gerado por uma Autoridade Certificadora (AC) como Serasa, Certisign, Valid ou Soluti. Tem validade de 1 ou 3 anos. Guarde a senha em local seguro.',
  },
  {
    number: 4,
    title: 'Configurar Numeração Inicial (Migração)',
    description: 'Se você vem de outro sistema (Gestão Click, Nfe.io, emissor da contabilidade etc.), continue a sequência de numeração de onde parou. Esse passo é OBRIGATÓRIO em migrações — se a numeração começar errada, o SEFAZ vai rejeitar a nota.',
    icon: Hash,
    color: '#9333EA',
    bg: '#FAF5FF',
    href: '/configuracoes',
    required: 'opcional',
    items: [
      'Acesse Configurações → aba Fiscal',
      'Role até a seção "Numeração da NF-e"',
      'Em "Próximo número da NF-e", informe o número da próxima nota a ser emitida (ex: se já emitiu até a 109, coloque 110)',
      'Em "Série", mantenha 1 — exceto se você usa série diferente em outro sistema',
      'Clique em "Salvar Numeração"',
      'A configuração é sincronizada com a nuvem fiscal automaticamente',
      'Confira no painel da Focus NFe se "Próximo número (Produção)" mostra o valor que você definiu',
    ],
    tip: 'NÃO precisa se preocupar se está começando do zero — o sistema já parte da nota nº 1 por padrão. Esse passo só é necessário se você TINHA outro sistema e quer manter a sequência fiscal continua para a contabilidade.',
  },
  {
    number: 5,
    title: 'Cadastrar Serviços Fiscais (NFS-e)',
    description: 'Crie o catálogo dos serviços que você presta. Cada serviço tem um código da LC 116/2003 e uma alíquota de ISS definida pela prefeitura. Esses dados são obrigatórios na nota.',
    icon: Wrench,
    color: '#D97706',
    bg: '#FFFBEB',
    href: '/fiscal-servicos',
    required: 'nfse',
    items: [
      'Acesse Fiscal → Serviços no menu lateral',
      'Clique em "Novo Serviço"',
      'Informe o nome do serviço (ex: "Desenvolvimento de Software")',
      'Selecione o Código LC 116 correspondente (ex: 1.02 — Programação)',
      'Informe a alíquota ISS — consulte a legislação do seu município',
      'Salve — cadastre um serviço para cada tipo que você presta',
    ],
    tip: 'A alíquota ISS varia por município e tipo de serviço. Em Juiz de Fora, serviços de TI geralmente têm 2%. Consulte a tabela ISS da Prefeitura de JF para confirmar.',
  },
  {
    number: 6,
    title: 'Cadastrar Produtos (NF-e)',
    description: 'Para emitir NF-e, cadastre os produtos que você vende com os dados fiscais obrigatórios: código NCM, CFOP e unidade de medida. Pule este passo se só emite NFS-e.',
    icon: ShoppingCart,
    color: '#16A34A',
    bg: '#F0FDF4',
    href: '/fiscal-produtos',
    required: 'nfe',
    items: [
      'Acesse Fiscal → Produtos no menu lateral',
      'Clique em "Novo Produto"',
      'Informe o código e a descrição do produto',
      'Informe o NCM (Nomenclatura Comum do Mercosul) — 8 dígitos',
      'Informe o CFOP (Código Fiscal de Operações) — ex: 5102 para venda no estado',
      'Selecione a unidade de medida (UN, KG, CX, etc.)',
      'Informe o preço unitário e o estoque inicial',
      'Salve — repita para cada produto',
    ],
    tip: 'O NCM de cada produto pode ser consultado na tabela TIPI (Tabela de Incidência do IPI) disponível no site da Receita Federal.',
  },
  {
    number: 7,
    title: 'Cadastrar Clientes (Tomadores / Destinatários)',
    description: 'O destinatário (NF-e) ou tomador (NFS-e) é quem recebe a nota. Antes de emitir, o cliente precisa estar cadastrado com CNPJ/CPF e endereço corretos — esses dados vão impressos na nota.',
    icon: Users,
    color: '#DC2626',
    bg: '#FEF2F2',
    href: '/clientes',
    required: 'sim',
    items: [
      'Acesse Clientes no menu lateral',
      'Clique em "Novo Cliente"',
      'Selecione Pessoa Física ou Jurídica',
      'Informe o CNPJ — o sistema preencherá os dados automaticamente',
      'Confirme o nome, endereço e e-mail',
      'Salve — o cliente estará disponível na emissão da nota',
    ],
    tip: 'Clientes com CNPJ têm os dados preenchidos automaticamente via BrasilAPI ao digitar o CNPJ. Para pessoa física, preencha o CPF e os dados manualmente.',
  },
  {
    number: 8,
    title: 'Emitir a NFS-e (Nota de Serviços)',
    description: 'Com tudo configurado, você está pronto para emitir sua primeira Nota Fiscal de Serviços eletrônica, integrada diretamente à prefeitura — sem acessar portal separado.',
    icon: Receipt,
    color: '#16A34A',
    bg: '#F0FDF4',
    href: '/nfse/nova',
    required: 'nfse',
    items: [
      'Acesse Fiscal → NFS-e no menu lateral',
      'Clique em "Emitir NFS-e"',
      'Informe o CNPJ ou CPF do tomador — selecione o cliente cadastrado',
      'Informe a data de competência (mês a que o serviço se refere)',
      'Selecione o código LC 116 do serviço prestado',
      'Preencha a discriminação (descrição detalhada do serviço)',
      'Informe a quantidade e o valor unitário',
      'Defina a alíquota ISS e se o ISS é retido na fonte pelo tomador',
      'Revise o resumo fiscal e clique em "Transmitir à Prefeitura"',
      'A nota será autorizada em instantes — você pode baixar o PDF',
    ],
    tip: 'Se o tomador for uma empresa que retém ISS, marque "ISS retido na fonte". O sistema calculará o valor líquido que você receberá descontado o ISS.',
  },
  {
    number: 9,
    title: 'Emitir a NF-e (Nota de Produtos)',
    description: 'Para venda de produtos, emita a NF-e com os itens, quantidades, valores e dados fiscais. A nota é transmitida automaticamente à SEFAZ e autorizada em segundos. O DANFE em PDF fica disponível para baixar e enviar ao cliente.',
    icon: FileText,
    color: '#0891B2',
    bg: '#ECFEFF',
    href: '/nfe/nova',
    required: 'nfe',
    items: [
      'Acesse Fiscal → NF-e no menu lateral',
      'Clique em "Nova NF-e"',
      'Selecione a natureza da operação (ex: Venda de Mercadoria)',
      'Informe o destinatário (cliente cadastrado) e confira o endereço',
      'Adicione os itens: selecione o produto, informe quantidade, valor e desconto se houver',
      'Confira os totais de ICMS, PIS, COFINS — calculados automaticamente conforme o regime tributário',
      'Informe os dados de transporte (modalidade do frete, transportadora, placa)',
      'Revise o resumo e clique em "Transmitir à SEFAZ"',
      'Em poucos segundos a nota retorna AUTORIZADA — o DANFE fica disponível para download',
      'Se o SEFAZ rejeitar (ex: dado incorreto do destinatário), aparece a mensagem do erro — corrija e reenvie',
    ],
    tip: 'Notas rejeitadas pelo SEFAZ NÃO existem legalmente — você pode simplesmente corrigir os dados e emitir novamente com o mesmo número. Não há multa nem cancelamento envolvido.',
  },
]

const faqs: FAQ[] = [
  {
    question: 'Qual a diferença entre NFS-e e NF-e?',
    answer: 'NFS-e (Nota Fiscal de Serviços Eletrônica) é emitida por empresas prestadoras de serviço e é administrada pela prefeitura municipal — o ISS é o imposto principal. NF-e (Nota Fiscal Eletrônica) é emitida para venda de produtos e é administrada pela Receita Federal e SEFAZ estadual — ICMS, PIS e COFINS são os impostos principais.',
  },
  {
    question: 'Preciso de certificado digital para emitir NFS-e?',
    answer: 'Não. Para NFS-e, o SyncroMoney se comunica diretamente com a prefeitura via integrador Focus NFe, sem necessidade de certificado digital. O certificado só é exigido para emissão de NF-e (produtos).',
  },
  {
    question: 'O que é ISS retido na fonte?',
    answer: 'Quando uma empresa contrata seus serviços, em alguns casos ela é obrigada a reter o ISS do seu pagamento e recolher diretamente à prefeitura. Isso acontece normalmente quando o tomador é uma empresa de médio/grande porte. Nesse caso, marque "ISS retido na fonte" na emissão da NFS-e e você receberá o valor líquido (sem o ISS).',
  },
  {
    question: 'O que é o código LC 116?',
    answer: 'É o código que classifica o tipo de serviço conforme a Lei Complementar 116/2003, que regulamenta o ISS em todo o Brasil. Cada tipo de serviço tem um código (ex: 1.02 = Programação, 17.01 = Consultoria). A alíquota ISS pode variar por município para cada código.',
  },
  {
    question: 'O que é NCM?',
    answer: 'NCM (Nomenclatura Comum do Mercosul) é o código de 8 dígitos que classifica cada produto para fins fiscais. Ele é obrigatório na NF-e. Consulte o site da Receita Federal (tabela TIPI) para encontrar o NCM do seu produto.',
  },
  {
    question: 'O que é CFOP?',
    answer: 'CFOP (Código Fiscal de Operações e Prestações) indica a natureza da operação fiscal. Os mais comuns: 5102 (venda de mercadoria para o mesmo estado), 6102 (venda interestadual), 5405 (venda de produto com substituição tributária). Seu contador pode confirmar o CFOP correto para cada tipo de venda.',
  },
  {
    question: 'Posso cancelar uma nota já emitida?',
    answer: 'Sim, dentro do prazo legal. Para NFS-e, vá em Fiscal → NFS-e, localize a nota e clique no ícone de cancelamento. Para NF-e, o prazo de cancelamento é de 24h após a autorização (ou antes da circulação da mercadoria). Após esse prazo, é necessário emitir uma Carta de Correção (CC-e) ou NF-e de devolução.',
  },
  {
    question: 'Onde encontro o PDF da nota emitida?',
    answer: 'Vá em Fiscal → NFS-e (ou NF-e), localize a nota com status "Autorizada" e clique no ícone de download (seta para baixo). Para NF-e, o arquivo gerado é o DANFE (Documento Auxiliar da NF-e).',
  },
  {
    question: 'Estou migrando de outro sistema. Como mantenho a sequência de notas?',
    answer: 'No SyncroMoney você configura o próximo número da NF-e em Configurações → Fiscal → seção "Numeração da NF-e". Se você emitiu até a nota 109 no sistema anterior, coloque "110" como próximo número e salve. O sistema sincroniza automaticamente com a nuvem fiscal e a próxima nota emitida será a 110. Isso vale para NF-e — a NFS-e tem numeração controlada pela própria prefeitura.',
  },
  {
    question: 'O SEFAZ rejeitou minha NF-e. O que fazer?',
    answer: 'A nota rejeitada NÃO existe legalmente — ou seja, não há multa, cancelamento nem qualquer obrigação fiscal envolvida. Basta clicar em "Editar/Reenviar" na lista de NF-e, corrigir o dado apontado na mensagem do SEFAZ e transmitir de novo. A nota nova vai usar o mesmo número da rejeitada. Erros comuns: CNPJ do destinatário inválido, NCM incorreto, regime tributário do emitente errado.',
  },
  {
    question: 'Posso editar uma NF-e já autorizada?',
    answer: 'Não. Após o SEFAZ autorizar, a nota é imutável. Para corrigir, você tem duas opções: 1) Carta de Correção Eletrônica (CC-e) — para erros que NÃO mudam valores, destinatário, datas ou produtos; 2) Cancelamento dentro de 24h e emissão de uma nova nota. Após 24h, é necessário emitir uma NF-e de devolução ou substituição.',
  },
  {
    question: 'Preciso enviar o certificado de novo a cada renovação?',
    answer: 'Sim. O certificado A1 tem validade de 1 ou 3 anos. Ao renovar, acesse Configurações → Fiscal → Certificado Digital e envie o novo .pfx com a nova senha. O sistema substitui automaticamente o anterior, sem precisar cadastrar tudo novamente.',
  },
  {
    question: 'O que é o DANFE?',
    answer: 'DANFE (Documento Auxiliar da NF-e) é o "espelho" em PDF da NF-e que acompanha a mercadoria durante o transporte. Ele tem o número da nota, a chave de acesso (44 dígitos) e o código de barras. Não é a nota fiscal em si — a NF-e propriamente dita é o arquivo XML autorizado pelo SEFAZ. O DANFE serve para conferência visual e fiscalização nos postos.',
  },
]

function StepCard({ step }: { step: Step }) {
  const [open, setOpen] = useState(false)
  const Icon = step.icon

  const badgeMap = {
    sim:      { label: 'Obrigatório',   cls: 'bg-red-50 text-red-600' },
    nfse:     { label: 'NFS-e',         cls: 'bg-green-50 text-green-700' },
    nfe:      { label: 'NF-e',          cls: 'bg-blue-50 text-blue-700' },
    opcional: { label: 'Opcional',      cls: 'bg-gray-100 text-gray-500' },
  }
  const badge = badgeMap[step.required]

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ background: step.color }}>
          {step.number}
        </div>
        <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: step.bg }}>
          <Icon className="h-5 w-5" style={{ color: step.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900">{step.title}</span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{step.description}</p>
        </div>
        {open ? <ChevronDown className="shrink-0 h-5 w-5 text-gray-400" /> : <ChevronRight className="shrink-0 h-5 w-5 text-gray-400" />}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-gray-50">
          <p className="text-sm text-gray-600 mt-4 mb-4">{step.description}</p>
          <div className="space-y-2 mb-4">
            {step.items.map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold mt-0.5" style={{ background: step.color }}>
                  {i + 1}
                </div>
                <p className="text-sm text-gray-700">{item}</p>
              </div>
            ))}
          </div>
          {step.tip && (
            <div className="rounded-xl p-3 text-sm mb-4" style={{ background: step.bg, color: step.color }}>
              <span className="font-semibold">Dica: </span>{step.tip}
            </div>
          )}
          <Link
            href={step.href}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: step.color }}
          >
            Ir para {step.title.replace('Preencher o ', '').replace('Ativar o ', '').replace('Enviar o ', '').replace('Cadastrar ', '').replace('Emitir a ', '')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  )
}

function FaqItem({ faq }: { faq: FAQ }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-4 py-4 text-left">
        <span className="font-medium text-gray-800 text-sm">{faq.question}</span>
        {open ? <ChevronDown className="shrink-0 h-4 w-4 text-gray-400" /> : <ChevronRight className="shrink-0 h-4 w-4 text-gray-400" />}
      </button>
      {open && <p className="text-sm text-gray-600 pb-4 leading-relaxed">{faq.answer}</p>}
    </div>
  )
}

export default function TutorialFiscalPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">

      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-50 mb-4">
          <GraduationCap className="h-7 w-7 text-amber-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Tutorial — Módulo Fiscal</h1>
        <p className="text-gray-500 mt-2 text-sm max-w-xl mx-auto">
          Siga a ordem abaixo para configurar o módulo fiscal e emitir suas primeiras notas fiscais de serviço (NFS-e) e/ou produto (NF-e).
        </p>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-3 justify-center">
        {[
          { cls: 'bg-red-50 text-red-600',     label: 'Obrigatório — todos' },
          { cls: 'bg-green-50 text-green-700',  label: 'Necessário para NFS-e' },
          { cls: 'bg-blue-50 text-blue-700',    label: 'Necessário para NF-e' },
          { cls: 'bg-gray-100 text-gray-500',   label: 'Opcional' },
        ].map(b => (
          <span key={b.label} className={`text-[11px] font-semibold px-3 py-1 rounded-full ${b.cls}`}>{b.label}</span>
        ))}
      </div>

      {/* Resumo visual */}
      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
        <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-3">Ordem correta de configuração</p>
        <div className="flex flex-wrap items-center gap-2">
          {steps.map((step, i) => (
            <div key={step.number} className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-white rounded-full px-3 py-1 shadow-sm border border-amber-100">
                <CircleDot className="h-3 w-3" style={{ color: step.color }} />
                <span className="text-xs font-medium text-gray-700">
                  {step.title.replace('Preencher o ', '').replace('Ativar o ', '').replace('Enviar o ', '').replace('Cadastrar ', '').replace('Emitir a ', '')}
                </span>
              </div>
              {i < steps.length - 1 && <ArrowRight className="h-3 w-3 text-amber-300 shrink-0" />}
            </div>
          ))}
        </div>
      </div>

      {/* Passos */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Passo a passo detalhado</h2>
        <p className="text-sm text-gray-500 mb-4">Clique em cada passo para ver as instruções completas.</p>
        <div className="space-y-3">
          {steps.map(step => <StepCard key={step.number} step={step} />)}
        </div>
      </div>

      {/* Fluxo de emissão */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Fluxo de emissão — NFS-e (dia a dia)</h2>
        <div className="space-y-3">
          {[
            { icon: CheckCircle2, color: '#2563EB', text: 'Prestou o serviço? Acesse Fiscal → NFS-e → Emitir NFS-e' },
            { icon: CheckCircle2, color: '#7C3AED', text: 'Selecione o tomador (cliente) e o serviço prestado' },
            { icon: CheckCircle2, color: '#16A34A', text: 'Informe o valor, competência e clique em Transmitir — a nota é autorizada na hora' },
            { icon: CheckCircle2, color: '#D97706', text: 'Baixe o PDF da nota e envie ao cliente pelo e-mail' },
            { icon: CheckCircle2, color: '#0891B2', text: 'O SyncroMoney registra tudo — consulte o histórico em Fiscal → NFS-e' },
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
        <h2 className="text-base font-semibold text-gray-900 mb-1">Dúvidas frequentes — Fiscal</h2>
        <p className="text-sm text-gray-500 mb-4">Clique na pergunta para ver a resposta.</p>
        {faqs.map((faq, i) => <FaqItem key={i} faq={faq} />)}
      </div>

      <p className="text-center text-xs text-gray-400 pb-4">
        SyncroMoney — Módulo Fiscal Premium
      </p>
    </div>
  )
}

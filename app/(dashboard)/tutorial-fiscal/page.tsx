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
  Wallet,
  Clock,
} from 'lucide-react'

interface Step {
  number: number
  title: string
  description: string
  icon: React.ElementType
  color: string
  bg: string
  href: string
  required: 'sim' | 'nfse' | 'nfe' | 'pdv' | 'opcional'
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
    description: 'Antes de qualquer nota, o sistema precisa saber quem é o emitente — sua empresa. Esses dados são o cabeçalho de todas as NFS-e e NF-e emitidas, e também aparecem nos recibos do PDV.',
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
    title: 'Ativar o Plano Premium',
    description: 'Uma única assinatura Premium libera PDV, Caixa, NF-e, NFS-e e NFC-e juntos. Diferente do plano PRO, o Premium não tem período de teste — é cobrado desde a ativação.',
    icon: Settings,
    color: '#7C3AED',
    bg: '#F5F3FF',
    href: '/assinar',
    required: 'sim',
    items: [
      'Acesse "Assinar" (ou o aviso de upgrade que aparece nas seções PREMIUM do menu)',
      'Escolha o plano PREMIUM (R$ 147/mês)',
      'Confirme o pagamento — a assinatura é ativada imediatamente, sem trial',
      'Após ativar, as seções "PDV & CAIXA" e "FISCAL" aparecem liberadas no menu lateral',
      'Volte em Configurações → aba Fiscal para marcar os tipos de nota que pretende emitir: NFS-e (serviços) e/ou NF-e (produtos)',
      'Clique em "Ativar Emissão Fiscal" — o sistema sincroniza automaticamente seu CNPJ, IE, regime tributário e endereço com a nuvem fiscal',
    ],
    tip: 'É uma assinatura só: você não ativa PDV/Caixa separado do módulo fiscal. A mesma assinatura Premium libera tudo de uma vez.',
  },
  {
    number: 3,
    title: 'Enviar o Certificado Digital A1 (NF-e)',
    description: 'Para emitir NF-e de produtos, o certificado digital A1 é obrigatório. Ele identifica sua empresa digitalmente para a SEFAZ. Para NFS-e de serviços ou para operar o PDV, esse certificado NÃO é necessário.',
    icon: FileKey,
    color: '#0891B2',
    bg: '#ECFEFF',
    href: '/configuracoes',
    required: 'nfe',
    items: [
      'Em Configurações → aba Fiscal, certifique-se de que o toggle "NF-e — Nota Fiscal de Produtos" está ligado',
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
    tip: 'NÃO precisa se preocupar se está começando do zero — o sistema já parte da nota nº 1 por padrão. Esse passo só é necessário se você TINHA outro sistema e quer manter a sequência fiscal contínua para a contabilidade.',
  },
  {
    number: 5,
    title: 'Cadastrar Produtos e Serviços',
    description: 'O catálogo de Produtos e Serviços é único e compartilhado — o mesmo cadastro usado em Orçamentos e no PDV serve para emitir NF-e (produtos) e NFS-e (serviços). Se você já cadastrou produtos ou serviços no plano PRO, não precisa recadastrar nada aqui.',
    icon: Wrench,
    color: '#D97706',
    bg: '#FFFBEB',
    href: '/servicos',
    required: 'opcional',
    items: [
      'Acesse "Produtos" no menu lateral (seção VENDAS) para os itens físicos vendidos por NF-e',
      'Confirme os dados fiscais de cada produto: NCM, CFOP e unidade de medida, além de preço e código de barras/PLU',
      'Acesse "Serviços" no menu lateral para os itens usados na NFS-e',
      'Informe o Código LC 116/2003 correspondente ao serviço (ex: 1.02 — Programação) e a alíquota de ISS do seu município',
      'Salve — o item já fica disponível tanto para emissão de notas quanto para Orçamentos e PDV',
    ],
    tip: 'A alíquota ISS varia por município e tipo de serviço. Consulte a tabela ISS da sua Prefeitura para confirmar o valor correto de cada serviço.',
  },
  {
    number: 6,
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
    number: 7,
    title: 'Emitir a NFS-e (Nota de Serviços)',
    description: 'Com tudo configurado, você está pronto para emitir sua primeira Nota Fiscal de Serviços eletrônica, integrada diretamente à prefeitura — sem acessar portal separado.',
    icon: Receipt,
    color: '#16A34A',
    bg: '#F0FDF4',
    href: '/nfse/nova',
    required: 'nfse',
    items: [
      'Acesse NFS-e no menu lateral (seção FISCAL — PREMIUM)',
      'Clique em "Emitir NFS-e"',
      'Informe o CNPJ ou CPF do tomador — selecione o cliente cadastrado',
      'Informe a data de competência (mês a que o serviço se refere)',
      'Selecione o serviço prestado (do catálogo cadastrado no Passo 5), com seu código LC 116',
      'Preencha a discriminação (descrição detalhada do serviço)',
      'Informe a quantidade e o valor unitário',
      'Defina a alíquota ISS e se o ISS é retido na fonte pelo tomador',
      'Revise o resumo fiscal e clique em "Transmitir à Prefeitura"',
      'A nota será autorizada em instantes — você pode baixar o PDF',
    ],
    tip: 'Se o tomador for uma empresa que retém ISS, marque "ISS retido na fonte". O sistema calculará o valor líquido que você receberá descontado o ISS.',
  },
  {
    number: 8,
    title: 'Emitir a NF-e (Nota de Produtos)',
    description: 'Para venda de produtos, emita a NF-e com os itens, quantidades, valores e dados fiscais. A nota é transmitida automaticamente à SEFAZ e autorizada em segundos. O DANFE em PDF fica disponível para baixar e enviar ao cliente.',
    icon: FileText,
    color: '#0891B2',
    bg: '#ECFEFF',
    href: '/nfe/nova',
    required: 'nfe',
    items: [
      'Acesse NF-e no menu lateral (seção FISCAL — PREMIUM)',
      'Clique em "Nova NF-e"',
      'Selecione a natureza da operação (ex: Venda de Mercadoria)',
      'Informe o destinatário (cliente cadastrado) e confira o endereço',
      'Adicione os itens: selecione o produto do catálogo, informe quantidade, valor e desconto se houver',
      'Confira os totais de ICMS, PIS, COFINS — calculados automaticamente conforme o regime tributário',
      'Informe os dados de transporte (modalidade do frete, transportadora, placa)',
      'Revise o resumo e clique em "Transmitir à SEFAZ"',
      'Em poucos segundos a nota retorna AUTORIZADA — o DANFE fica disponível para download',
      'Se o SEFAZ rejeitar (ex: dado incorreto do destinatário), aparece a mensagem do erro — corrija e reenvie',
    ],
    tip: 'Notas rejeitadas pelo SEFAZ NÃO existem legalmente — você pode simplesmente corrigir os dados e emitir novamente com o mesmo número. Não há multa nem cancelamento envolvido.',
  },
  {
    number: 9,
    title: 'Abrir o Caixa e Usar o PDV',
    description: 'O PDV é a frente de caixa para vender no balcão. Antes de vender, é preciso abrir um Caixa. Ao final do turno, o fechamento gera um relatório e já lança as vendas automaticamente em Contas a Receber.',
    icon: ShoppingCart,
    color: '#7C3AED',
    bg: '#F5F3FF',
    href: '/pdv',
    required: 'pdv',
    items: [
      'Acesse PDV no menu lateral (seção PDV & CAIXA — PREMIUM)',
      'Na primeira venda do turno, o sistema pede a abertura do Caixa: informe o operador, o fundo de troco inicial e, opcionalmente, vincule uma conta corrente para receber os valores em dinheiro/PIX/débito automaticamente',
      'Busque produtos pelo nome, código de barras ou PLU — inclusive com leitor de código de barras via teclado; use as setas para navegar nos resultados e Enter para adicionar ao carrinho',
      'Finalize a venda escolhendo a forma de pagamento: Dinheiro (com cálculo de troco), Cartão de Crédito/Débito (bandeira e parcelas), PIX (QR Code gerado na hora com a chave PIX da empresa) ou "Outras formas" (TED/DOC/Boleto/Cheque)',
      'Use Sangria/Suprimento durante o turno para retiradas ou reforços de caixa, se necessário',
      'No fim do turno, clique em "Fechar Caixa" — o sistema gera um relatório de fechamento imprimível ("Imprimir Relatório")',
      'Vendas à vista (Dinheiro/PIX/Débito) entram automaticamente como já recebidas em Contas a Receber; vendas no crédito parcelado geram as parcelas futuras (~30 dias entre elas) automaticamente',
    ],
    tip: 'Você também pode acompanhar o turno aberto, vendas em andamento e histórico de fechamentos pela tela "Caixa" no menu — as ações de sangria/suprimento/fechar caixa estão disponíveis nos dois lugares.',
  },
  {
    number: 10,
    title: 'NFC-e (Cupom Fiscal) — Em breve',
    description: 'A emissão de NFC-e (Cupom Fiscal eletrônico para venda direta ao consumidor) já tem um espaço reservado no menu, mas ainda está em desenvolvimento.',
    icon: Clock,
    color: '#9CA3AF',
    bg: '#F9FAFB',
    href: '/nfce',
    required: 'opcional',
    items: [
      'A página "NFC-e" aparece no menu lateral com o selo "Em breve"',
      'Ainda não há passo a passo de uso, pois a emissão não está disponível nesta versão',
      'Assim que a funcionalidade for liberada, este tutorial será atualizado com o fluxo completo',
    ],
    tip: 'Por enquanto, use NFS-e ou NF-e conforme o tipo de venda, ou registre a venda pelo PDV normalmente — o cupom fiscal eletrônico chegará em uma atualização futura.',
  },
]

const faqs: FAQ[] = [
  {
    question: 'Qual a diferença entre NFS-e e NF-e?',
    answer: 'NFS-e (Nota Fiscal de Serviços Eletrônica) é emitida por empresas prestadoras de serviço e é administrada pela prefeitura municipal — o ISS é o imposto principal. NF-e (Nota Fiscal Eletrônica) é emitida para venda de produtos e é administrada pela Receita Federal e SEFAZ estadual — ICMS, PIS e COFINS são os impostos principais.',
  },
  {
    question: 'PDV e Caixa fazem parte do Fiscal ou é outra coisa?',
    answer: 'Ambos fazem parte do plano Premium junto com o módulo fiscal — a mesma assinatura libera os dois. Não são módulos separados: quem assina o Premium ganha PDV, Caixa, NF-e, NFS-e e NFC-e ao mesmo tempo.',
  },
  {
    question: 'Preciso ativar o módulo fiscal separado do PDV?',
    answer: 'Não. É uma assinatura única do plano Premium que libera tudo de uma vez — não existe uma ativação separada para PDV/Caixa e outra para o módulo fiscal.',
  },
  {
    question: 'O estoque do PDV é o mesmo do módulo fiscal?',
    answer: 'Sim, é o mesmo cadastro de produtos e o mesmo controle de estoque — uma venda no PDV e uma emissão de NF-e usam a mesma base de produtos e dão baixa no mesmo estoque.',
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
    answer: 'Sim, dentro do prazo legal. Para NFS-e, vá em NFS-e, localize a nota e clique no ícone de cancelamento. Para NF-e, o prazo de cancelamento é de 24h após a autorização (ou antes da circulação da mercadoria). Após esse prazo, é necessário emitir uma Carta de Correção (CC-e) ou NF-e de devolução.',
  },
  {
    question: 'Onde encontro o PDF da nota emitida?',
    answer: 'Vá em NFS-e (ou NF-e), localize a nota com status "Autorizada" e clique no ícone de download (seta para baixo). Para NF-e, o arquivo gerado é o DANFE (Documento Auxiliar da NF-e).',
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
  {
    question: 'Como funciona o pagamento parcelado no PDV?',
    answer: 'Ao escolher Cartão de Crédito no PDV, você seleciona a bandeira e o número de parcelas. O sistema gera automaticamente as parcelas em Contas a Receber, espaçadas em aproximadamente 30 dias, para que apareçam corretamente no Fluxo de Caixa e no Dashboard sem lançamento manual.',
  },
]

function StepCard({ step }: { step: Step }) {
  const [open, setOpen] = useState(false)
  const Icon = step.icon

  const badgeMap = {
    sim:      { label: 'Obrigatório',   cls: 'bg-red-50 text-red-600' },
    nfse:     { label: 'NFS-e',         cls: 'bg-green-50 text-green-700' },
    nfe:      { label: 'NF-e',          cls: 'bg-blue-50 text-blue-700' },
    pdv:      { label: 'PDV / Caixa',   cls: 'bg-purple-50 text-purple-700' },
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
            Ir para {step.title.replace('Preencher o ', '').replace('Ativar o ', '').replace('Enviar o ', '').replace('Cadastrar ', '').replace('Emitir a ', '').replace('Configurar ', '').replace('Abrir o ', '')}
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
        <h1 className="text-2xl font-bold text-gray-900">Tutorial — Plano Premium (PDV, Caixa e Fiscal)</h1>
        <p className="text-gray-500 mt-2 text-sm max-w-xl mx-auto">
          Siga a ordem abaixo para configurar o plano Premium, vender no PDV com Caixa e emitir suas primeiras notas fiscais de serviço (NFS-e) e/ou produto (NF-e).
        </p>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-3 justify-center">
        {[
          { cls: 'bg-red-50 text-red-600',      label: 'Obrigatório — todos' },
          { cls: 'bg-green-50 text-green-700',  label: 'Necessário para NFS-e' },
          { cls: 'bg-blue-50 text-blue-700',    label: 'Necessário para NF-e' },
          { cls: 'bg-purple-50 text-purple-700', label: 'PDV / Caixa' },
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
                  {step.title.replace('Preencher o ', '').replace('Ativar o ', '').replace('Enviar o ', '').replace('Cadastrar ', '').replace('Emitir a ', '').replace('Configurar ', '').replace('Abrir o ', '')}
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
            { icon: CheckCircle2, color: '#2563EB', text: 'Prestou o serviço? Acesse NFS-e → Emitir NFS-e' },
            { icon: CheckCircle2, color: '#7C3AED', text: 'Selecione o tomador (cliente) e o serviço prestado' },
            { icon: CheckCircle2, color: '#16A34A', text: 'Informe o valor, competência e clique em Transmitir — a nota é autorizada na hora' },
            { icon: CheckCircle2, color: '#D97706', text: 'Baixe o PDF da nota e envie ao cliente pelo e-mail' },
            { icon: CheckCircle2, color: '#0891B2', text: 'O SyncroMoney registra tudo — consulte o histórico em NFS-e' },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <item.icon className="h-4 w-4 mt-0.5 shrink-0" style={{ color: item.color }} />
              <p className="text-sm text-gray-700">{item.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Fluxo do PDV */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Wallet className="h-4 w-4 text-purple-600" />
          Fluxo do PDV — dia a dia
        </h2>
        <div className="space-y-3">
          {[
            { icon: CheckCircle2, color: '#7C3AED', text: 'Início do turno? Acesse PDV → abra o Caixa informando operador e fundo de troco' },
            { icon: CheckCircle2, color: '#2563EB', text: 'Busque o produto (nome, código de barras ou PLU) e adicione ao carrinho com Enter' },
            { icon: CheckCircle2, color: '#16A34A', text: 'Finalize com Dinheiro, Cartão ou PIX — o pagamento já lança em Contas a Receber automaticamente' },
            { icon: CheckCircle2, color: '#D97706', text: 'Precisa retirar ou reforçar o caixa? Use Sangria/Suprimento a qualquer momento' },
            { icon: CheckCircle2, color: '#0891B2', text: 'Fim do turno: clique em "Fechar Caixa" e imprima o relatório de fechamento' },
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
        <h2 className="text-base font-semibold text-gray-900 mb-1">Dúvidas frequentes — Premium</h2>
        <p className="text-sm text-gray-500 mb-4">Clique na pergunta para ver a resposta.</p>
        {faqs.map((faq, i) => <FaqItem key={i} faq={faq} />)}
      </div>

      <p className="text-center text-xs text-gray-400 pb-4">
        SyncroMoney — Plano Premium
      </p>
    </div>
  )
}

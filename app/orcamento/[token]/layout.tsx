import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'

// Pré-visualização do link (WhatsApp, e-mail, redes) e título da aba: mostram a marca da EMPRESA
// que enviou o orçamento, não o SyncroMoney. Vem da RPC get_orcamento_marca; se ela ainda não
// existir no banco, cai no título genérico "Orçamento" (também sem SyncroMoney).
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params
  const genericoNeutro: Metadata = {
    title: { absolute: 'Orçamento' },
    description: 'Abra para ver os detalhes do orçamento e aprovar.',
    robots: { index: false, follow: false },
    alternates: { canonical: `/orcamento/${token}` },
    openGraph: { title: 'Orçamento', description: 'Abra para ver os detalhes do orçamento e aprovar.', siteName: 'Orçamento', type: 'website' },
  }

  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { data } = await supabase.rpc('get_orcamento_marca', { p_token: token })
    const marca = data as { nome?: string; logo_url?: string; numero?: string; total?: number } | null
    if (!marca?.nome) return genericoNeutro

    const titulo = `Orçamento Nº ${marca.numero ?? ''} — ${marca.nome}`.replace('Nº  —', '—')
    const total = typeof marca.total === 'number'
      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(marca.total)
      : ''
    const descricao = total
      ? `Orçamento no valor de ${total}. Abra para ver os detalhes e aprovar.`
      : 'Abra para ver os detalhes do orçamento e aprovar.'
    // O WhatsApp só aceita imagem por endereço público (https), nunca por arquivo embutido
    const logo = marca.logo_url && /^https:\/\//i.test(marca.logo_url) ? marca.logo_url : undefined

    return {
      title: { absolute: titulo },
      description: descricao,
      authors: [{ name: marca.nome }],
      creator: marca.nome,
      robots: { index: false, follow: false },
      alternates: { canonical: `/orcamento/${token}` },
      openGraph: {
        title: titulo,
        description: descricao,
        siteName: marca.nome,
        type: 'website',
        ...(logo ? { images: [{ url: logo, alt: marca.nome }] } : {}),
      },
      twitter: { card: logo ? 'summary' : 'summary', title: titulo, description: descricao, ...(logo ? { images: [logo] } : {}) },
    }
  } catch {
    return genericoNeutro
  }
}

export default function OrcamentoPublicoLayout({ children }: { children: React.ReactNode }) {
  return children
}

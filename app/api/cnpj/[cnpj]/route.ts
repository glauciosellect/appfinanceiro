import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Resultado = {
  razaoSocial: string
  nomeFantasia: string
  cnpj: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  municipio: string
  uf: string
  cep: string
  telefone: string
  email: string
  situacao: string
}

async function fetchJson(url: string): Promise<{ status: number; data: any } | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SyncroMoney/1.0' },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 86400 },
    })
    if (!res.ok) return { status: res.status, data: null }
    return { status: res.status, data: await res.json() }
  } catch {
    return null
  }
}

async function brasilApi(digits: string): Promise<Resultado | null> {
  const r = await fetchJson(`https://brasilapi.com.br/api/cnpj/v1/${digits}`)
  const d = r?.data
  if (!d) return null
  return {
    razaoSocial: d.razao_social ?? '',
    nomeFantasia: d.nome_fantasia ?? '',
    cnpj: digits,
    logradouro: d.logradouro ?? '',
    numero: d.numero ?? '',
    complemento: d.complemento ?? '',
    bairro: d.bairro ?? '',
    municipio: d.municipio ?? '',
    uf: d.uf ?? '',
    cep: (d.cep ?? '').replace(/\D/g, ''),
    telefone: d.ddd_telefone_1 ?? '',
    email: d.email ?? '',
    situacao: d.descricao_situacao_cadastral ?? '',
  }
}

// Fallback: CNPJ.ws (API pública) — cobre CNPJs que a BrasilAPI não tem.
async function cnpjWs(digits: string): Promise<Resultado | null> {
  const r = await fetchJson(`https://publica.cnpj.ws/cnpj/${digits}`)
  const d = r?.data
  if (!d) return null
  const e = d.estabelecimento ?? {}
  return {
    razaoSocial: d.razao_social ?? '',
    nomeFantasia: e.nome_fantasia ?? '',
    cnpj: digits,
    logradouro: [e.tipo_logradouro, e.logradouro].filter(Boolean).join(' '),
    numero: e.numero ?? '',
    complemento: e.complemento ?? '',
    bairro: e.bairro ?? '',
    municipio: e.cidade?.nome ?? '',
    uf: e.estado?.sigla ?? '',
    cep: (e.cep ?? '').replace(/\D/g, ''),
    telefone: `${e.ddd1 ?? ''}${e.telefone1 ?? ''}`,
    email: e.email ?? '',
    situacao: e.situacao_cadastral ?? '',
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ cnpj: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { cnpj } = await params
  const digits = cnpj.replace(/\D/g, '')
  if (digits.length !== 14) return NextResponse.json({ error: 'CNPJ inválido' }, { status: 400 })

  const resultado = (await brasilApi(digits)) ?? (await cnpjWs(digits))
  if (!resultado) {
    return NextResponse.json({ error: 'CNPJ não encontrado na Receita Federal' }, { status: 404 })
  }
  return NextResponse.json(resultado)
}

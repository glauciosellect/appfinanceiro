import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ cnpj: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { cnpj } = await params
  const digits = cnpj.replace(/\D/g, '')
  if (digits.length !== 14) return NextResponse.json({ error: 'CNPJ inválido' }, { status: 400 })

  const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
    headers: { 'User-Agent': 'SyncroMoney/1.0' },
    next: { revalidate: 86400 },
  })

  if (!res.ok) return NextResponse.json({ error: 'CNPJ não encontrado na Receita Federal' }, { status: 404 })

  const data = await res.json() as {
    razao_social?: string
    nome_fantasia?: string
    cnpj?: string
    logradouro?: string
    numero?: string
    complemento?: string
    bairro?: string
    municipio?: string
    uf?: string
    cep?: string
    ddd_telefone_1?: string
    email?: string
    descricao_situacao_cadastral?: string
  }

  return NextResponse.json({
    razaoSocial: data.razao_social ?? '',
    nomeFantasia: data.nome_fantasia ?? '',
    cnpj: digits,
    logradouro: data.logradouro ?? '',
    numero: data.numero ?? '',
    complemento: data.complemento ?? '',
    bairro: data.bairro ?? '',
    municipio: data.municipio ?? '',
    uf: data.uf ?? '',
    cep: (data.cep ?? '').replace(/\D/g, ''),
    telefone: data.ddd_telefone_1 ?? '',
    email: data.email ?? '',
    situacao: data.descricao_situacao_cadastral ?? '',
  })
}

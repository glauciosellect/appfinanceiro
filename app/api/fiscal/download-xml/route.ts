import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  const filename = request.nextUrl.searchParams.get('filename') || 'nota_fiscal.xml'

  if (!url) {
    return NextResponse.json({ error: 'URL não informada' }, { status: 400 })
  }

  const allowed =
    url.startsWith('https://api.focusnfe.com.br') ||
    url.startsWith('https://homologacao.focusnfe.com.br')

  if (!allowed) {
    return NextResponse.json({ error: 'URL não permitida' }, { status: 403 })
  }

  const ambiente = process.env.FOCUSNFE_AMBIENTE ?? 'homologacao'
  const token =
    ambiente === 'producao'
      ? (process.env.FOCUSNFE_TOKEN_PRODUCAO ?? '')
      : (process.env.FOCUSNFE_TOKEN_HOMOLOGACAO ?? '')

  const encoded = Buffer.from(`${token}:`).toString('base64')

  const response = await fetch(url, {
    headers: { Authorization: `Basic ${encoded}` },
  })

  if (!response.ok) {
    return NextResponse.json({ error: 'Erro ao buscar XML' }, { status: response.status })
  }

  const xml = await response.arrayBuffer()

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

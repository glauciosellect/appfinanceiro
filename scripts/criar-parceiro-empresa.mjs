/**
 * Provisiona uma `parceiro_empresas` (ex: um escritório cliente do
 * GestorBIM) e gera a chave de API — a chave em texto puro só aparece UMA
 * VEZ neste output, o banco guarda só o hash SHA-256.
 *
 * Uso: node scripts/criar-parceiro-empresa.mjs
 * Edite os dados abaixo (ou passe via variáveis de ambiente) antes de rodar.
 *
 * Requer no .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { randomBytes, createHash } from 'crypto'
import { createClient } from '@supabase/supabase-js'

const envPath = resolve(process.cwd(), '.env.local')
const envLines = readFileSync(envPath, 'utf-8').split('\n')
for (const line of envLines) {
  const [key, ...rest] = line.split('=')
  if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não definidos no .env.local')
  process.exit(1)
}

// ————— Edite aqui os dados do parceiro/empresa antes de rodar —————
const NOME_PARCEIRO = process.env.PARCEIRO_NOME ?? 'GestorBIM'
const DADOS_EMPRESA = {
  referencia_externa: process.env.PARCEIRO_REF_EXTERNA ?? '',   // ex: escritorioId do GestorBIM
  nome_exibicao: process.env.PARCEIRO_NOME_EXIBICAO ?? '',      // ex: "Escritório Fulano — GestorBIM"
  webhook_url: process.env.PARCEIRO_WEBHOOK_URL ?? '',
  cnpj: process.env.PARCEIRO_CNPJ ?? '',
  razao_social: process.env.PARCEIRO_RAZAO_SOCIAL ?? '',
  inscricao_municipal: process.env.PARCEIRO_INSCRICAO_MUNICIPAL ?? '',
  municipio: process.env.PARCEIRO_MUNICIPIO ?? '',
  uf: process.env.PARCEIRO_UF ?? '',
  codigo_municipio: process.env.PARCEIRO_CODIGO_MUNICIPIO ?? '',
  ambiente: process.env.PARCEIRO_AMBIENTE ?? 'homologacao',
}
// ———————————————————————————————————————————————————————————

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

async function main() {
  let { data: parceiro } = await supabase
    .from('parceiros')
    .select('id')
    .eq('nome', NOME_PARCEIRO)
    .single()

  if (!parceiro) {
    const { data: novoParceiro, error } = await supabase
      .from('parceiros')
      .insert({ nome: NOME_PARCEIRO })
      .select('id')
      .single()
    if (error) throw error
    parceiro = novoParceiro
    console.log(`✅ Parceiro criado: ${NOME_PARCEIRO} (${parceiro.id})`)
  } else {
    console.log(`ℹ️  Parceiro já existe: ${NOME_PARCEIRO} (${parceiro.id})`)
  }

  const chave = `money_${DADOS_EMPRESA.ambiente === 'producao' ? 'live' : 'test'}_${randomBytes(24).toString('hex')}`
  const apiKeyHash = createHash('sha256').update(chave).digest('hex')

  const { data: empresa, error: empresaErro } = await supabase
    .from('parceiro_empresas')
    .insert({
      parceiro_id: parceiro.id,
      api_key_hash: apiKeyHash,
      ...DADOS_EMPRESA,
    })
    .select('id')
    .single()

  if (empresaErro) throw empresaErro

  console.log('\n========================================')
  console.log('✅ Empresa parceira criada:', empresa.id)
  console.log('🔑 Chave de API (copie agora — não será mostrada de novo):')
  console.log('   ' + chave)
  console.log('========================================\n')
}

main().catch((err) => {
  console.error('❌ Erro:', err)
  process.exit(1)
})

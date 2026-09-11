/**
 * Teste local de conexão com a Fiscal Contora — valida token + cadastro de
 * empresa de homologação, sem precisar de certificado real ainda.
 * Uso: node scripts/test-contora-conexao.mjs
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

const envPath = resolve(process.cwd(), '.env.local')
const envLines = readFileSync(envPath, 'utf-8').split('\n')
for (const line of envLines) {
  const [key, ...rest] = line.split('=')
  if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
}

const TOKEN = process.env.CONTORA_API_TOKEN_HOMOLOGACAO
if (!TOKEN) {
  console.error('❌ CONTORA_API_TOKEN_HOMOLOGACAO não definido no .env.local')
  process.exit(1)
}

const BASE_URL = 'https://fiscal.contora.com.br/api/v1'
const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/json' }

// CNPJ com dígitos verificadores válidos (gerado só pra teste de conectividade)
const CNPJ_TESTE = '11122234000128'

console.log('\n1) Cadastrando/atualizando empresa de homologação...')
const empresaRes = await fetch(`${BASE_URL}/companies/by-document/${CNPJ_TESTE}`, {
  method: 'PUT',
  headers,
  body: JSON.stringify({
    legal_name: 'Empresa de Homologacao Ltda',
    trade_name: 'Empresa Homologacao',
    document: CNPJ_TESTE,
    state_registration: '123456789',
    state_code: 'PR',
    city_code: '4106902',
    street: 'Rua de Testes',
    number: '100',
    district: 'Centro',
    city_name: 'Curitiba',
    postal_code: '80000000',
    tax_regime: 'simples',
    default_environment: 'homologacao',
    settings: { municipal_registration: '180369008' },
  }),
})
const empresaJson = await empresaRes.json()
console.log('Status HTTP:', empresaRes.status)
console.log(JSON.stringify(empresaJson, null, 2))

if (!empresaRes.ok) {
  console.error('\n❌ Falhou no cadastro da empresa — provável problema de token/autenticação.')
  process.exit(1)
}

const companyId = empresaJson?.data?.id
console.log('\n✅ Token válido e empresa cadastrada. company_id:', companyId)

console.log('\n2) Consultando empresa cadastrada...')
const getRes = await fetch(`${BASE_URL}/companies/${companyId}`, { headers })
console.log('Status HTTP:', getRes.status)
console.log(JSON.stringify(await getRes.json(), null, 2))

console.log('\n3) Criando draft de NFS-e (sem certificado ainda — só valida o payload)...')
const draftRes = await fetch(`${BASE_URL}/companies/${companyId}/nfse/drafts`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    environment: 'homologacao',
    payload: {
      service: {
        description: 'Servico de teste de conectividade',
        national_tax_code: '140101', // exemplo citado na doc oficial pra 14.01
        municipal_tax_code: '140',
        cnae: '6201-5/00',
        iss_rate: 2,
      },
      taker: {
        name: 'Cliente Teste',
        document: '04063171000110',
      },
      amounts: { service_amount: 100 },
    },
  }),
})
const draftJson = await draftRes.json()
console.log('Status HTTP:', draftRes.status)
console.log(JSON.stringify(draftJson, null, 2))

const documentId = draftJson?.data?.id
if (documentId) {
  console.log('\n4) Despachando (submit) — deve falhar por falta de certificado, o que já confirma o resto do fluxo...')
  const dispatchRes = await fetch(`${BASE_URL}/companies/${companyId}/nfse/drafts/${documentId}/dispatch`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'submit' }),
  })
  console.log('Status HTTP:', dispatchRes.status)
  console.log(JSON.stringify(await dispatchRes.json(), null, 2))
}

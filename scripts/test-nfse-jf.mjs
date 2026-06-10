/**
 * Teste local de emissão NFS-e JF — roda sem Vercel
 * Uso: node scripts/test-nfse-jf.mjs
 *
 * Requer no .env.local:
 *   FOCUSNFE_TOKEN_HOMOLOGACAO=xxx
 *   EMITENTE_CNPJ=37815890000108
 *   EMITENTE_CODIGO_MUNICIPIO=3136702
 *   EMITENTE_INSCRICAO_MUNICIPAL=180369008
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

// Carrega .env.local manualmente
const envPath = resolve(process.cwd(), '.env.local')
const envLines = readFileSync(envPath, 'utf-8').split('\n')
for (const line of envLines) {
  const [key, ...rest] = line.split('=')
  if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
}

const TOKEN = process.env.FOCUSNFE_TOKEN_HOMOLOGACAO
const CNPJ  = process.env.EMITENTE_CNPJ?.replace(/\D/g, '') ?? '37815890000108'
const COD_MUN = process.env.EMITENTE_CODIGO_MUNICIPIO ?? '3136702'
const INSC_MUN = process.env.EMITENTE_INSCRICAO_MUNICIPAL ?? '180369008'

if (!TOKEN) {
  console.error('❌ FOCUSNFE_TOKEN_HOMOLOGACAO não definido no .env.local')
  process.exit(1)
}

const ref = `test_nfse_jf_${Date.now()}`
const now = new Date().toISOString()

// Serviço 14.06 — cClassTrib=000001 → CST=000
const body = {
  data_emissao: now,
  data_competencia: now.slice(0, 10),
  prestador: {
    cnpj: CNPJ,
    codigo_municipio: COD_MUN,
    inscricao_municipal: INSC_MUN,
  },
  optante_simples_nacional: '1',
  // campos obrigatórios JF — ordem: finNFSe → indFinal → cIndOp → indDest
  finalidade_emissao: '0',
  consumidor_final: '0',
  codigo_indicador_operacao: '050101',
  indicador_destinatario: '0',
  tomador: {
    razao_social: 'EMPRESA TESTE LTDA',
    cnpj: '04063171000110',
    telefone: '3222001234',
    endereco: {
      logradouro: 'RUA TESTE',
      numero: '100',
      bairro: 'CENTRO',
      codigo_municipio: COD_MUN,
      uf: 'MG',
      cep: '36010001',
    },
  },
  servico: {
    valor_servicos: 100.00,
    iss_retido: '2',
    item_lista_servico: '14.06',
    codigo_tributario_municipio: '140600100',   // campo correto JF (gera <CodigoServico>)
    codigo_municipio: COD_MUN,
    discriminacao: 'Teste de emissao NFS-e JF',
    aliquota: 2,
    codigo_cnae: '4321500',
    codigo_nbs: '101061200',                    // NBS 9 dígitos obrigatório JF
    ibs_cbs_situacao_tributaria: '000',         // CST = primeiros 3 dígitos de cClassTrib
    ibs_cbs_classificacao_tributaria: '000001', // tributado integralmente
  },
  numero_rps: String(Date.now()).slice(-6),
  serie_rps: 'RPS',
  tipo_rps: '1',
}

console.log('\n📤 Payload enviado:\n', JSON.stringify(body, null, 2))

const encoded = Buffer.from(`${TOKEN}:`).toString('base64')
const url = `https://homologacao.focusnfe.com.br/v2/nfse?ref=${ref}`

const res = await fetch(url, {
  method: 'POST',
  headers: { Authorization: `Basic ${encoded}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

const text = await res.text()
console.log('\n📥 Resposta Focus NFe (status', res.status, '):\n', text)

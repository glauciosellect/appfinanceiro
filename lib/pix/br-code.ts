// ============================================================
// PIX BR Code (EMV QR Code estático) — geração de payload "Copia e Cola"
// ============================================================
// Implementação pura (sem dependência de Supabase) do padrão Banco Central
// do Brasil para QR Code estático de Pix, usado por todos os geradores de
// Pix "Copia e Cola" do mercado. TLV (Tag-Length-Value) + CRC16-CCITT ao
// final. Referência: manual "BR Code" do Bacen / arranjo Pix.
// ============================================================

function tlv(id: string, value: string): string {
  const length = String(value.length).padStart(2, '0')
  return `${id}${length}${value}`
}

// Remove acentos e qualquer caractere fora do ASCII imprimível básico,
// exigido pelo spec Pix para nome do recebedor e cidade.
function sanitizarAscii(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove diacríticos
    .replace(/[^\x20-\x7E]/g, '') // mantém só ASCII imprimível
    .toUpperCase()
}

// CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF) — variante
// "CRC-16/CCITT-FALSE", a exigida pelo spec EMV/Pix para o campo final `63`.
function crc16ccitt(payload: string): string {
  let crc = 0xffff
  const polinomio = 0x1021

  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ polinomio) & 0xffff
      } else {
        crc = (crc << 1) & 0xffff
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0')
}

// Sanity check de conformidade do CRC16-CCITT-FALSE: o vetor de teste
// padrão da indústria para essa variante é a string ASCII "123456789",
// cujo CRC16 correto é 0x29B1. Verificado em tempo de import — se este
// assert falhar, a implementação do CRC16 está incorreta.
const CRC16_TESTE_CONFORMIDADE = crc16ccitt('123456789')
if (CRC16_TESTE_CONFORMIDADE !== '29B1') {
  throw new Error(
    `CRC16-CCITT-FALSE fora de conformidade: esperado 29B1, obtido ${CRC16_TESTE_CONFORMIDADE}`
  )
}

export interface GerarPixParams {
  /** Chave Pix (email, telefone, CPF/CNPJ ou chave aleatória). */
  chavePix: string
  /** Nome do recebedor/comerciante — truncado para 25 chars, ASCII, maiúsculo. */
  nomeRecebedor: string
  /** Cidade do recebedor — truncada para 15 chars, ASCII, maiúsculo. */
  cidade: string
  /** Valor da transação (2 casas decimais). Omitir gera um código de "qualquer valor". */
  valor?: number
  /** Identificador da transação (txid), alfanumérico, até 25 chars. Padrão "***". */
  identificador?: string
}

export function gerarPixCopiaECola(params: GerarPixParams): string {
  const { chavePix, nomeRecebedor, cidade, valor, identificador } = params

  const nome = sanitizarAscii(nomeRecebedor).slice(0, 25)
  const cidadeSanitizada = sanitizarAscii(cidade).slice(0, 15)
  const txid = (identificador ?? '***').slice(0, 25)

  // 00 — Payload Format Indicator (fixo "01")
  const payloadFormatIndicator = tlv('00', '01')

  // 26 — Merchant Account Information (Pix): sub-tag 00 = GUI, 01 = chave
  const gui = tlv('00', 'br.gov.bcb.pix')
  const chave = tlv('01', chavePix)
  const merchantAccountInfo = tlv('26', gui + chave)

  // 52 — Merchant Category Code (0000 = não informado)
  const merchantCategoryCode = tlv('52', '0000')

  // 53 — Transaction Currency (986 = BRL)
  const transactionCurrency = tlv('53', '986')

  // 54 — Transaction Amount (opcional — omitido gera código de valor livre)
  const transactionAmount = valor !== undefined ? tlv('54', valor.toFixed(2)) : ''

  // 58 — Country Code
  const countryCode = tlv('58', 'BR')

  // 59 — Merchant Name
  const merchantName = tlv('59', nome)

  // 60 — Merchant City
  const merchantCity = tlv('60', cidadeSanitizada)

  // 62 — Additional Data Field Template: sub-tag 05 = txid
  const additionalDataField = tlv('62', tlv('05', txid))

  const payloadSemCrc =
    payloadFormatIndicator +
    merchantAccountInfo +
    merchantCategoryCode +
    transactionCurrency +
    transactionAmount +
    countryCode +
    merchantName +
    merchantCity +
    additionalDataField +
    '6304' // tag+length do CRC, incluído no cálculo antes do valor

  const crc = crc16ccitt(payloadSemCrc)

  return payloadSemCrc + crc
}

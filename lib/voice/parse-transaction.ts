import type { TransactionType } from '@/types'

export interface ParsedTransaction {
  type: TransactionType
  amount: number
  description: string
  category: string
  date: string
}

const EXPENSE_VERBS = ['paguei', 'comprei', 'gastei', 'usei']
const INCOME_VERBS = ['recebi', 'ganhei', 'faturei']
const ALL_VERBS = [...EXPENSE_VERBS, ...INCOME_VERBS]

function extractAmount(text: string): number | null {
  // Matches: 3.000,00 | 3000,00 | 3000.00 | 3000 | R$ 500
  const match = text.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/i)
  if (!match) return null

  let raw = match[1]
  if (/\d\.\d{3}/.test(raw)) {
    raw = raw.replace(/\./g, '').replace(',', '.')
  } else if (raw.includes(',')) {
    raw = raw.replace(',', '.')
  }

  const val = parseFloat(raw)
  return isNaN(val) || val <= 0 ? null : val
}

function extractDate(text: string): string {
  const today = new Date()
  if (/ontem/.test(text)) {
    const d = new Date(today)
    d.setDate(today.getDate() - 1)
    return d.toISOString().split('T')[0]
  }
  return today.toISOString().split('T')[0]
}

function cleanDescription(text: string, type: TransactionType): string {
  const d = text
    .replace(new RegExp(`\\b(${ALL_VERBS.join('|')})\\b`, 'gi'), '')
    .replace(/(?:r\$\s*)?(?:\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/g, '')
    .replace(/\b(?:no|na|em|de|do|da|pelo|pela|por|hj|hoje|ontem|reais)\b/gi, '')
    .replace(/[,;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!d) return type === 'income' ? 'Receita' : 'Despesa'
  return d.charAt(0).toUpperCase() + d.slice(1)
}

function detectCategory(description: string, type: TransactionType): string {
  const lower = description.toLowerCase()

  if (type === 'income') {
    if (/salário|salario/.test(lower)) return 'salary'
    if (/honorário|honorario|freela|freelance|consultor/.test(lower)) return 'freelance'
    if (/investimento|dividendo|rendimento/.test(lower)) return 'investment'
    return 'other_income'
  }

  if (/mercado|supermercado|padaria|restaurante|lanche|comida|pizza|açougue|refeição/.test(lower)) return 'food'
  if (/farmácia|farmacia|médico|medico|hospital|saúde|saude|remédio|remedio|clínica/.test(lower)) return 'health'
  if (/uber|taxi|ônibus|gasolina|combustível|combustivel|estacionamento|metrô|metro/.test(lower)) return 'transport'
  if (/energia|luz|água|agua|internet|gás|gas|condomínio|condominio|conta|aluguel/.test(lower)) return 'bills'
  if (/roupa|tênis|tenis|calçado|calcado|camisa|calça/.test(lower)) return 'clothing'
  if (/academia|cinema|netflix|spotify|lazer|diversão|diversao|show/.test(lower)) return 'entertainment'
  if (/escola|faculdade|curso|livro|educação|educacao/.test(lower)) return 'education'
  if (/shopping|loja/.test(lower)) return 'shopping'

  return 'other_expense'
}

export function parseVoiceTransactions(rawText: string): ParsedTransaction[] {
  const text = rawText.toLowerCase().trim()
  const results: ParsedTransaction[] = []

  // Detect default type from wake word
  let defaultType: TransactionType = 'expense'
  let workingText = text

  if (/^receita\b/.test(text)) {
    defaultType = 'income'
    workingText = text.replace(/^receita[,\s]*/, '')
  } else if (/^despesa\b/.test(text)) {
    defaultType = 'expense'
    workingText = text.replace(/^despesa[,\s]*/, '')
  }

  // Split into segments by transaction verbs
  const verbPattern = new RegExp(`(?=\\b(?:${ALL_VERBS.join('|')})\\b)`)
  const segments = workingText.split(verbPattern).filter((s) => s.trim())

  if (segments.length === 0) {
    const amount = extractAmount(workingText)
    if (amount) {
      const description = cleanDescription(workingText, defaultType)
      results.push({
        type: defaultType,
        amount,
        description,
        category: detectCategory(description, defaultType),
        date: extractDate(workingText),
      })
    }
    return results
  }

  for (const segment of segments) {
    const seg = segment.trim()
    if (!seg) continue

    let segType = defaultType
    if (new RegExp(`^(?:${EXPENSE_VERBS.join('|')})\\b`).test(seg)) segType = 'expense'
    if (new RegExp(`^(?:${INCOME_VERBS.join('|')})\\b`).test(seg)) segType = 'income'

    const amount = extractAmount(seg)
    if (!amount) continue

    const description = cleanDescription(seg, segType)

    results.push({
      type: segType,
      amount,
      description,
      category: detectCategory(description, segType),
      date: extractDate(seg),
    })
  }

  return results
}

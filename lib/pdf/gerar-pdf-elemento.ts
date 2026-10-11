// html2canvas-pro: o html2canvas original quebra com as cores oklch()/lab() do Tailwind 4
// ("unsupported color function"), o que fazia o PDF falhar sempre.
import html2canvas from 'html2canvas-pro'
import { jsPDF } from 'jspdf'

const LARGURA_A4 = 210 // mm
const ALTURA_A4 = 297 // mm
const MARGEM = 10 // mm, em volta de todo o conteúdo

/**
 * Gera um arquivo PDF real a partir de um elemento DOM, tirando um "screenshot"
 * (html2canvas) e embutindo a imagem num documento jsPDF em A4, com margem em volta.
 * Conteúdo mais alto que uma página é dividido em várias páginas.
 *
 * Usa "screenshot-to-PDF" em vez de redesenhar o layout na API do jsPDF para não
 * duplicar a manutenção do layout HTML/Tailwind já existente.
 */
export async function gerarPdfDeElemento(elementId: string, nomeArquivo: string): Promise<File> {
  const elemento = document.getElementById(elementId)
  if (!elemento) {
    throw new Error(`Elemento #${elementId} não encontrado`)
  }

  // windowWidth fixo: o documento é capturado sempre no layout de tela larga (breakpoints sm/md),
  // mesmo que o PDF seja gerado de uma janela estreita ou do celular. Sem isso o cabeçalho saía
  // espremido e cortado à direita.
  const opcoes = { scale: 2, backgroundColor: '#ffffff', windowWidth: 1100 }

  let canvas: HTMLCanvasElement
  try {
    // useCORS evita logo em branco quando a imagem vem de outro host com CORS liberado
    canvas = await html2canvas(elemento, { ...opcoes, useCORS: true })
  } catch {
    // A logo pode vir de um host sem CORS: tenta de novo ignorando a imagem da logo,
    // para não travar o PDF inteiro por ela.
    canvas = await html2canvas(elemento, {
      ...opcoes,
      useCORS: false,
      ignoreElements: (el) => el.tagName === 'IMG' && (el as HTMLImageElement).id === 'orcamento-logo',
    })
  }

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const larguraUtil = LARGURA_A4 - 2 * MARGEM
  const alturaUtil = ALTURA_A4 - 2 * MARGEM
  const mmPorPixel = larguraUtil / canvas.width
  const alturaTotal = canvas.height * mmPorPixel

  if (alturaTotal <= alturaUtil) {
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', MARGEM, MARGEM, larguraUtil, alturaTotal)
  } else {
    // Fatia o canvas em blocos do tamanho útil de uma página
    const pixelsPorPagina = Math.floor(alturaUtil / mmPorPixel)
    for (let y = 0, pagina = 0; y < canvas.height; y += pixelsPorPagina, pagina++) {
      const altura = Math.min(pixelsPorPagina, canvas.height - y)
      const fatia = document.createElement('canvas')
      fatia.width = canvas.width
      fatia.height = altura
      const ctx = fatia.getContext('2d')
      if (!ctx) throw new Error('Não foi possível montar a página do PDF')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, fatia.width, fatia.height)
      ctx.drawImage(canvas, 0, y, canvas.width, altura, 0, 0, canvas.width, altura)
      if (pagina > 0) pdf.addPage()
      pdf.addImage(fatia.toDataURL('image/png'), 'PNG', MARGEM, MARGEM, larguraUtil, altura * mmPorPixel)
    }
  }

  const blob = pdf.output('blob')
  return new File([blob], nomeArquivo, { type: 'application/pdf' })
}

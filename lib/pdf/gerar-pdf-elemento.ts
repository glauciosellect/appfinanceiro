import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

/**
 * Gera um arquivo PDF real a partir de um elemento DOM, tirando um "screenshot"
 * (html2canvas) e embutindo a imagem resultante num documento jsPDF em A4.
 *
 * Usa a abordagem "screenshot-to-PDF" em vez de redesenhar o layout na API de
 * desenho do jsPDF, para não duplicar a manutenção do layout HTML/Tailwind já
 * existente (risco de divergência visual entre a visualização de impressão e
 * o PDF "de verdade").
 *
 * TODO: só suporta paginação de página única — se o conteúdo do elemento for
 * mais alto que uma página A4, a imagem é comprimida (scale down) para caber
 * inteira numa única página, ao invés de ser dividida em múltiplas páginas.
 * Para o documento de orçamento (tipicamente 1 página) isso é aceitável, mas
 * se este utilitário for reaproveitado para documentos maiores, implementar
 * paginação real (fatiar o canvas em blocos do tamanho de uma página A4).
 */
export async function gerarPdfDeElemento(elementId: string, nomeArquivo: string): Promise<File> {
  const elemento = document.getElementById(elementId)
  if (!elemento) {
    throw new Error(`Elemento #${elementId} não encontrado`)
  }

  const canvas = await html2canvas(elemento, {
    scale: 2,
    backgroundColor: '#ffffff',
    // Defensivo: logo_url em fiscal_config pode ser uma URL externa (o usuário
    // cola o link de uma imagem já hospedada). useCORS não tem custo quando a
    // imagem é local/data URL, mas evita um logo em branco silencioso quando a
    // imagem vem de fora e o servidor de origem envia cabeçalhos CORS corretos.
    useCORS: true,
  })

  const imgData = canvas.toDataURL('image/png')

  const larguraA4 = 210 // mm
  const alturaA4 = 297 // mm

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const larguraImagem = larguraA4
  const alturaImagem = (canvas.height * larguraImagem) / canvas.width

  if (alturaImagem <= alturaA4) {
    // Conteúdo cabe em uma página — adiciona a imagem no tamanho natural.
    pdf.addImage(imgData, 'PNG', 0, 0, larguraImagem, alturaImagem)
  } else {
    // Conteúdo mais alto que uma página A4: encolhe para caber inteiro em
    // uma única página, centralizado verticalmente. (Ver TODO acima sobre
    // paginação multi-página real.)
    const escala = alturaA4 / alturaImagem
    const larguraFinal = larguraImagem * escala
    const alturaFinal = alturaA4
    const offsetX = (larguraA4 - larguraFinal) / 2
    pdf.addImage(imgData, 'PNG', offsetX, 0, larguraFinal, alturaFinal)
  }

  const blob = pdf.output('blob')
  return new File([blob], nomeArquivo, { type: 'application/pdf' })
}

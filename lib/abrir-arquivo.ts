// Abre um PDF (ou outro arquivo) em outra aba/janela, sem tirar o usuário do sistema.
//
// Links do próprio sistema (/api/...) são buscados e abertos como blob: no app instalado
// (PWA) um simples target="_blank" para a mesma origem abre o arquivo NA MESMA janela,
// sem botão de voltar. Abrir a janela vazia no clique (antes do fetch) evita o bloqueio
// de pop-up do navegador.
export async function abrirArquivoEmNovaAba(url: string, nomeArquivo = 'documento.pdf'): Promise<void> {
  if (/^https?:\/\//i.test(url)) {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }

  const aba = window.open('', '_blank')
  if (aba) {
    aba.document.write('<p style="font-family:sans-serif;color:#555;padding:24px">Carregando documento...</p>')
  }
  try {
    const res = await fetch(url)
    if (!res.ok) {
      let motivo = 'Não foi possível abrir o documento.'
      try { motivo = ((await res.json()) as { error?: string }).error ?? motivo } catch { /* corpo não é JSON */ }
      throw new Error(motivo)
    }
    const blobUrl = URL.createObjectURL(await res.blob())
    if (aba) {
      aba.location.href = blobUrl
    } else {
      // Pop-up bloqueado: baixa o arquivo em vez de navegar para fora do sistema
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = nomeArquivo
      link.click()
    }
    setTimeout(() => URL.revokeObjectURL(blobUrl), 120_000)
  } catch (e) {
    aba?.close()
    throw e
  }
}

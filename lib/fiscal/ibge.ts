// Resolve nome de município + UF para o código IBGE de 7 dígitos exigido
// pela Contora (city_code) — API pública do governo, sem chave/autenticação.
// Usado porque os formulários de NF-e/NFS-e hoje só coletam o nome da
// cidade, não o código IBGE.

function normalizar(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
}

export async function buscarCodigoMunicipio(nomeCidade: string, uf: string): Promise<string | null> {
  if (!nomeCidade || !uf) return null
  try {
    const res = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf.toUpperCase()}/municipios`,
      { next: { revalidate: 60 * 60 * 24 * 30 } } // lista de municípios de uma UF não muda — cache de 30 dias
    )
    if (!res.ok) return null
    const municipios = (await res.json()) as Array<{ id: number; nome: string }>
    const alvo = normalizar(nomeCidade)
    const encontrado = municipios.find((m) => normalizar(m.nome) === alvo)
    return encontrado ? String(encontrado.id) : null
  } catch {
    return null
  }
}

// Link público do orçamento: /orcamento/<empresa>-<número>-<token>.
// O texto antes do token é só para o cliente reconhecer a origem do link; quem manda é o token (UUID,
// sempre os últimos 36 caracteres). Links antigos (só o token) continuam funcionando.
const UUID_FIM = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function slugOrcamento(empresa: string, numero: string): string {
  return `${empresa} ${numero}`
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
}

export function montarLinkOrcamento(origin: string, empresa: string, numero: string, token: string): string {
  const slug = slugOrcamento(empresa, numero)
  return `${origin}/orcamento/${slug ? slug + '-' : ''}${token}`
}

export function extrairTokenOrcamento(param: string): string {
  const decodificado = decodeURIComponent(param)
  return decodificado.match(UUID_FIM)?.[0] ?? decodificado
}

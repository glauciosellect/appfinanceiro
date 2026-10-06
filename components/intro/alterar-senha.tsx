'use client'

import { useEffect, useState } from 'react'
import { KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

const rotulo = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

// Traduz as mensagens de erro mais comuns do Supabase Auth
function traduzirErro(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('different from the old password')) return 'A nova senha precisa ser diferente da senha atual.'
  if (m.includes('at least')) return 'A nova senha deve ter pelo menos 6 caracteres.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'
  if (m.includes('weak')) return 'Essa senha é fraca ou muito comum. Escolha outra.'
  return `Não foi possível alterar a senha: ${msg}`
}

// Troca de senha do usuário logado. Pede a senha atual antes (confirma que é a própria pessoa).
export function AlterarSenhaCard() {
  const [email, setEmail] = useState('')
  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [mostrar, setMostrar] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ''))
  }, [])

  async function alterar(e: React.SyntheticEvent) {
    e.preventDefault()
    setMsg(null)
    if (!atual) { setMsg({ tipo: 'erro', texto: 'Informe a senha atual.' }); return }
    if (nova.length < 6) { setMsg({ tipo: 'erro', texto: 'A nova senha deve ter pelo menos 6 caracteres.' }); return }
    if (nova !== confirmar) { setMsg({ tipo: 'erro', texto: 'A confirmação não é igual à nova senha.' }); return }
    if (nova === atual) { setMsg({ tipo: 'erro', texto: 'A nova senha precisa ser diferente da senha atual.' }); return }
    if (!email) { setMsg({ tipo: 'erro', texto: 'Não foi possível identificar o seu usuário. Entre de novo no sistema.' }); return }

    setSalvando(true)
    const supabase = createClient()
    // 1) confere a senha atual
    const { error: erroAtual } = await supabase.auth.signInWithPassword({ email, password: atual })
    if (erroAtual) {
      setSalvando(false)
      setMsg({ tipo: 'erro', texto: 'A senha atual está incorreta.' })
      return
    }
    // 2) grava a nova
    const { error } = await supabase.auth.updateUser({ password: nova })
    setSalvando(false)
    if (error) { setMsg({ tipo: 'erro', texto: traduzirErro(error.message) }); return }

    setAtual('')
    setNova('')
    setConfirmar('')
    setMsg({ tipo: 'ok', texto: 'Senha alterada com sucesso. Use a nova senha no próximo acesso.' })
  }

  const tipo = mostrar ? 'text' : 'password'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><KeyRound className="h-4 w-4 text-gray-400" />Alterar senha</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={alterar} className="space-y-4 max-w-sm">
          {email && <p className="text-xs text-gray-500">Usuário: <strong>{email}</strong></p>}
          <div>
            <label className={rotulo}>Senha atual</label>
            <Input type={tipo} value={atual} onChange={(e) => setAtual(e.target.value)} autoComplete="current-password" />
          </div>
          <div>
            <label className={rotulo}>Nova senha</label>
            <Input type={tipo} value={nova} onChange={(e) => setNova(e.target.value)} placeholder="Mínimo 6 caracteres" autoComplete="new-password" />
          </div>
          <div>
            <label className={rotulo}>Confirmar nova senha</label>
            <Input type={tipo} value={confirmar} onChange={(e) => setConfirmar(e.target.value)} placeholder="Repita a nova senha" autoComplete="new-password" />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input type="checkbox" checked={mostrar} onChange={(e) => setMostrar(e.target.checked)} />
            Mostrar as senhas
          </label>
          {msg && <p className={msg.tipo === 'ok' ? 'text-sm text-green-600' : 'text-sm text-red-600'}>{msg.texto}</p>}
          <Button type="submit" disabled={salvando}>{salvando ? 'Alterando...' : 'Alterar senha'}</Button>
        </form>
      </CardContent>
    </Card>
  )
}

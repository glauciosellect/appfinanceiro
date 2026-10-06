'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { VERSOES } from '@/components/marketing/escolha-versao'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [planoEscolhido, setPlanoEscolhido] = useState<'intro' | 'pro' | 'premium' | null>(null)

  useEffect(() => {
    const plano = new URLSearchParams(window.location.search).get('plano')
    if (plano === 'intro' || plano === 'pro' || plano === 'premium') {
      sessionStorage.setItem('plano_selecionado', plano)
      setPlanoEscolhido(plano)
    }
  }, [])

  function escolherVersao(id: 'intro' | 'pro' | 'premium') {
    setPlanoEscolhido(id)
    sessionStorage.setItem('plano_selecionado', id)
    setError('')
  }

  async function handleRegister(e: React.SyntheticEvent) {
    e.preventDefault()
    setError('')

    if (!planoEscolhido) {
      setError('Escolha a versão que você quer testar.')
      return
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    // Preferência de plano (só decide qual sistema abre durante o trial; o
    // acesso pago vem sempre da tabela `assinaturas`).
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: planoEscolhido ? { data: { plano_escolhido: planoEscolhido } } : undefined,
    })

    if (error) {
      setError(`Erro ao criar conta: ${error.message}`)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8 gap-3">
          <Logo size="lg" />
        </div>
        <Card className="shadow-xl border-0">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="text-5xl">✅</div>
            <h2 className="text-xl font-semibold text-gray-900">Conta criada com sucesso!</h2>
            <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-4 text-left space-y-2">
              <p className="text-blue-800 font-semibold text-sm">📧 Confirme seu e-mail para continuar</p>
              <p className="text-blue-700 text-sm">
                Enviamos um link de confirmação para <strong>{email}</strong>.
                Abra sua caixa de entrada e clique no link antes de fazer login.
              </p>
              <p className="text-blue-600 text-xs">
                Não encontrou? Verifique a pasta de <strong>Spam</strong> ou <strong>Lixo eletrônico</strong>.
              </p>
            </div>
            <Button asChild className="w-full mt-4">
              <Link href="/login">Ir para o login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      <div className="flex flex-col items-center mb-8 gap-3">
        <Logo size="lg" />
      </div>

      <Card className="shadow-xl border-0">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-2xl text-center">Criar conta</CardTitle>
          <CardDescription className="text-center">
            Comece a controlar suas finanças gratuitamente
          </CardDescription>
          <div className="mt-3 space-y-2">
            <p className="text-center text-sm font-medium text-gray-700">Qual versão você quer testar por 14 dias?</p>
            <div className="grid grid-cols-3 gap-2">
              {VERSOES.map((v) => {
                const ativa = planoEscolhido === v.id
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => escolherVersao(v.id)}
                    className={cn(
                      'rounded-lg border-2 px-2 py-2 text-center transition-colors',
                      ativa ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <p className="text-sm font-bold text-gray-900">{v.nome}</p>
                    <p className="text-[11px] text-gray-500">{v.preco}/mês</p>
                  </button>
                )
              })}
            </div>
            {planoEscolhido ? (
              <p className="text-center text-xs text-gray-500">
                {VERSOES.find((v) => v.id === planoEscolhido)?.descricao} Teste grátis, sem cartão.
              </p>
            ) : (
              <p className="text-center text-xs text-amber-700">Escolha uma versão para continuar.</p>
            )}
          </div>
        </CardHeader>

        <form onSubmit={handleRegister}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                placeholder="Repita sua senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Criando conta...' : 'Criar conta'}
            </Button>

            <p className="text-xs text-center text-gray-400 leading-relaxed">
              Ao criar sua conta, você concorda com os{' '}
              <Link href="/termos" className="text-blue-600 hover:underline">Termos de Uso</Link>
              {' '}e a{' '}
              <Link href="/privacidade" className="text-blue-600 hover:underline">Política de Privacidade</Link>.
            </p>

            <p className="text-sm text-center text-gray-500">
              Já tem uma conta?{' '}
              <Link href="/login" className="text-blue-600 font-medium hover:underline">
                Entrar
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

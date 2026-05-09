import Link from 'next/link'
import { Logo } from '@/components/logo'

export default function BemVindoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="flex items-center gap-3">
            <Logo size="lg" />
            <span className="text-3xl font-bold tracking-tight">
              <span className="text-gray-900">Syncro</span>
              <span className="text-blue-600">Money</span>
            </span>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-br from-blue-600 to-green-500 p-8 text-center">
            <div className="text-6xl mb-3">🎉</div>
            <h1 className="text-2xl font-bold text-white">E-mail confirmado!</h1>
            <p className="text-white/80 text-sm mt-2">Sua conta está pronta para uso</p>
          </div>

          <div className="p-6 space-y-5">
            <div className="text-center space-y-2">
              <h2 className="text-lg font-semibold text-gray-900">Bem-vindo ao SyncroMoney!</h2>
              <p className="text-sm text-gray-500">
                Agora você tem acesso completo ao seu painel de controle financeiro.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 bg-blue-50 rounded-2xl p-3">
                <span className="text-2xl">📊</span>
                <div>
                  <p className="text-sm font-semibold text-blue-800">Dashboard completo</p>
                  <p className="text-xs text-blue-600">Visualize receitas, despesas e fluxo de caixa</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-green-50 rounded-2xl p-3">
                <span className="text-2xl">💳</span>
                <div>
                  <p className="text-sm font-semibold text-green-800">Contas e cartões</p>
                  <p className="text-xs text-green-600">Gerencie todas as suas contas em um só lugar</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-purple-50 rounded-2xl p-3">
                <span className="text-2xl">📱</span>
                <div>
                  <p className="text-sm font-semibold text-purple-800">Instale no celular</p>
                  <p className="text-xs text-purple-600">Acesse como um app nativo, sem abrir o navegador</p>
                </div>
              </div>
            </div>

            <Link
              href="/dashboard"
              className="block w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold py-4 rounded-2xl text-center text-base transition-colors"
            >
              Acessar meu painel →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

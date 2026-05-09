import Link from 'next/link'
import { Logo } from '@/components/logo'

export default function ErroConfirmacaoPage() {
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
          <div className="p-8 text-center space-y-4">
            <div className="text-5xl">⚠️</div>
            <h2 className="text-xl font-bold text-gray-900">Link expirado ou inválido</h2>
            <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-4 text-left space-y-2">
              <p className="text-amber-800 font-semibold text-sm">O que fazer agora?</p>
              <ul className="text-amber-700 text-sm space-y-1 list-disc list-inside">
                <li>Links de confirmação expiram em 24 horas</li>
                <li>Tente fazer login — pode já estar confirmado</li>
                <li>Se não funcionar, cadastre-se novamente</li>
              </ul>
            </div>
            <div className="flex flex-col gap-3 pt-2">
              <Link
                href="/login"
                className="block w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-2xl text-center text-sm transition-colors"
              >
                Tentar fazer login
              </Link>
              <Link
                href="/register"
                className="block w-full text-sm text-gray-500 hover:text-gray-700 py-2 text-center transition-colors"
              >
                Criar nova conta
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

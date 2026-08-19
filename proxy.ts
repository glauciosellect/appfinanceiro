import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  const PUBLIC_PATHS = [
    '/',
    '/login',
    '/register',
    '/instalar',
    '/assinar',
    '/privacidade',
    '/termos',
    '/cookies',
    '/auth/confirm',
    '/auth/bem-vindo',
    '/auth/erro-confirmacao',
    '/api/stripe/webhook',
    '/api/asaas/webhook',
    '/api/fiscal/diagnostico',
  ]

  // Rotas de API retornam JSON em vez de redirecionar para a home
  if (!user && pathname.startsWith('/api/') && !PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  if (!user && !PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  if (user && (pathname === '/login' || pathname === '/register')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (user && pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json)$).*)'],
}

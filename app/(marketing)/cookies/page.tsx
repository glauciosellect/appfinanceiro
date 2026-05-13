import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Cookies — SyncroMoney',
  description: 'Como o SyncroMoney utiliza cookies e tecnologias de rastreamento.',
}

export default function CookiesPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="mb-2 text-3xl font-bold text-[#111827]">Política de Cookies</h1>
      <p className="mb-10 text-sm text-[#6B7280]">Última atualização: 12 de maio de 2026</p>

      <Section title="1. O que são cookies?">
        <p>
          Cookies são pequenos arquivos de texto armazenados no seu dispositivo quando você visita
          um site. Eles permitem que o site lembre suas preferências e ações entre visitas,
          melhorando sua experiência de uso.
        </p>
        <p className="mt-3">
          Além de cookies, também utilizamos tecnologias similares como <em>localStorage</em> e
          tokens de sessão para manter você autenticado na plataforma.
        </p>
      </Section>

      <Section title="2. Cookies que utilizamos">
        <p className="mb-3">
          O SyncroMoney utiliza apenas cookies <strong>estritamente necessários</strong> e{' '}
          <strong>funcionais</strong>. Não utilizamos cookies de rastreamento publicitário de
          terceiros (como Google Ads ou Meta Pixel).
        </p>

        <div className="space-y-4">
          <CookieCard
            tipo="Estritamente necessários"
            cor="green"
            descricao="Essenciais para o funcionamento da plataforma. Não podem ser desativados."
            cookies={[
              { nome: 'sb-*-auth-token', finalidade: 'Mantém sua sessão autenticada (Supabase Auth)', duracao: 'Sessão / 1 semana (lembrar login)' },
              { nome: 'sb-*-auth-token-code-verifier', finalidade: 'PKCE para fluxo OAuth seguro', duracao: 'Sessão' },
            ]}
          />

          <CookieCard
            tipo="Funcionais"
            cor="blue"
            descricao="Lembram suas preferências de uso para uma experiência melhor."
            cookies={[
              { nome: 'theme', finalidade: 'Preferência de tema (claro/escuro)', duracao: '1 ano' },
              { nome: 'sidebar-collapsed', finalidade: 'Estado do menu lateral', duracao: '1 ano' },
            ]}
          />

          <CookieCard
            tipo="Analytics (opcionais)"
            cor="gray"
            descricao="Usados para entender como a plataforma é utilizada. Nenhum dado é compartilhado com redes publicitárias."
            cookies={[
              { nome: 'N/A', finalidade: 'No momento, não utilizamos ferramentas de analytics com cookies.', duracao: '—' },
            ]}
          />
        </div>
      </Section>

      <Section title="3. Cookies de terceiros">
        <p className="mb-3">
          Algumas funcionalidades integram serviços externos que podem definir seus próprios cookies:
        </p>
        <div className="overflow-x-auto rounded-lg border border-[#E5E7EB]">
          <table className="w-full text-sm">
            <thead className="bg-[#F3F4F6]">
              <tr>
                {['Serviço', 'Finalidade', 'Política'].map((h) => (
                  <th key={h} className="px-4 py-2 text-left font-semibold text-[#111827]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['Stripe', 'Processar pagamentos de assinatura com segurança', 'stripe.com/cookies-policy'],
                ['Supabase', 'Gerenciar sessão de autenticação', 'supabase.com/privacy'],
              ].map(([servico, finalidade, politica], i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F9FAFB]'}>
                  <td className="px-4 py-2 font-medium">{servico}</td>
                  <td className="px-4 py-2 text-[#374151]">{finalidade}</td>
                  <td className="px-4 py-2 text-[#6B7280]">{politica}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="4. Como gerenciar cookies">
        <p className="mb-3">
          Você pode controlar e excluir cookies nas configurações do seu navegador:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Chrome:</strong> Configurações → Privacidade e segurança → Cookies e outros
            dados do site
          </li>
          <li>
            <strong>Firefox:</strong> Configurações → Privacidade e Segurança → Cookies e dados
            do site
          </li>
          <li>
            <strong>Safari:</strong> Preferências → Privacidade → Gerenciar Dados do Site
          </li>
          <li>
            <strong>Edge:</strong> Configurações → Privacidade, pesquisa e serviços → Cookies
          </li>
        </ul>
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Atenção:</strong> Bloquear os cookies <em>estritamente necessários</em> impedirá
          o funcionamento do login e da sessão autenticada, tornando a plataforma inutilizável.
        </div>
      </Section>

      <Section title="5. Base legal">
        <p>
          O uso de cookies estritamente necessários é baseado no nosso <strong>interesse legítimo</strong>{' '}
          em fornecer o serviço contratado (Art. 7º, IX da LGPD e Art. 7º do Marco Civil da Internet).
          Os cookies funcionais e opcionais dependem do seu <strong>consentimento</strong> (Art. 7º, I
          da LGPD), que pode ser revogado a qualquer momento nas configurações do navegador.
        </p>
      </Section>

      <Section title="6. Alterações nesta política">
        <p>
          Esta política pode ser atualizada para refletir mudanças nas tecnologias usadas ou
          exigências legais. A data de atualização no topo da página sempre refletirá a versão atual.
        </p>
      </Section>

      <Section title="7. Contato">
        <p>
          Dúvidas sobre nossa política de cookies:{' '}
          <a href="mailto:glaucio.sellect@gmail.com" className="text-blue-600 hover:underline">
            glaucio.sellect@gmail.com
          </a>
        </p>
      </Section>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xl font-semibold text-[#111827]">{title}</h2>
      <div className="text-sm leading-relaxed text-[#374151]">{children}</div>
    </section>
  )
}

const COR_MAP = {
  green: 'border-green-200 bg-green-50 text-green-800',
  blue: 'border-blue-200 bg-blue-50 text-blue-800',
  gray: 'border-[#E5E7EB] bg-[#F9FAFB] text-[#374151]',
}

function CookieCard({
  tipo,
  cor,
  descricao,
  cookies,
}: {
  tipo: string
  cor: 'green' | 'blue' | 'gray'
  descricao: string
  cookies: { nome: string; finalidade: string; duracao: string }[]
}) {
  return (
    <div className={`rounded-lg border p-4 ${COR_MAP[cor]}`}>
      <p className="mb-1 font-semibold">{tipo}</p>
      <p className="mb-3 text-xs opacity-80">{descricao}</p>
      <div className="overflow-x-auto rounded border border-current/20 bg-white/60">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-current/20">
              {['Nome', 'Finalidade', 'Duração'].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cookies.map((c, i) => (
              <tr key={i}>
                <td className="px-3 py-2 font-mono">{c.nome}</td>
                <td className="px-3 py-2">{c.finalidade}</td>
                <td className="px-3 py-2 whitespace-nowrap">{c.duracao}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

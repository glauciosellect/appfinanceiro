import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Política de Privacidade — SyncroMoney',
  description: 'Como o SyncroMoney coleta, usa e protege seus dados pessoais.',
}

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-white">
      <LegalHeader />
      <main className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="mb-2 text-3xl font-bold text-[#111827]">Política de Privacidade</h1>
      <p className="mb-10 text-sm text-[#6B7280]">Última atualização: 12 de maio de 2026</p>

      <Section title="1. Quem somos">
        <p>
          O <strong>SyncroMoney</strong> é um serviço de gestão financeira e emissão de notas fiscais
          eletrônicas operado por <strong>Syncro Soluções Digitais</strong>, CNPJ&nbsp;37.815.890/0001-08,
          com sede em Juiz de Fora – MG, Brasil. Neste documento, "nós", "nosso" e "SyncroMoney"
          referem-se a esta empresa.
        </p>
        <p className="mt-3">
          Para dúvidas sobre esta política ou sobre seus dados, entre em contato pelo e-mail{' '}
          <a href="mailto:glaucio.sellect@gmail.com" className="text-blue-600 hover:underline">
            glaucio.sellect@gmail.com
          </a>
          .
        </p>
      </Section>

      <Section title="2. Dados que coletamos">
        <p>Coletamos apenas os dados necessários para prestar nossos serviços:</p>
        <Table
          rows={[
            ['Dados de cadastro', 'Nome, e-mail, senha (hash), CNPJ/CPF'],
            ['Dados da empresa', 'Razão social, endereço, regime tributário, inscrições estadual/municipal'],
            ['Dados financeiros', 'Lançamentos, contas, cartões, fluxo de caixa inseridos por você'],
            ['Dados fiscais', 'Tomadores, serviços/produtos, notas emitidas (NFS-e / NF-e)'],
            ['Dados de pagamento', 'Plano ativo e histórico de cobranças (via Asaas — não armazenamos número do cartão)'],
            ['Dados de uso', 'Endereço IP, navegador, páginas acessadas, data/hora das ações'],
            ['Cookies e rastreamento', 'Sessão autenticada, preferências de interface (ver Política de Cookies)'],
          ]}
        />
      </Section>

      <Section title="3. Como usamos seus dados">
        <ul className="list-disc space-y-2 pl-5">
          <li>Criar e manter sua conta;</li>
          <li>Processar pagamentos de assinatura;</li>
          <li>Emitir NFS-e e NF-e junto às autoridades fiscais competentes via Focus NFe;</li>
          <li>Enviar comunicações transacionais (confirmação de e-mail, recibo de cobrança, alertas da conta);</li>
          <li>Enviar novidades e melhorias do produto — você pode cancelar a qualquer momento;</li>
          <li>Detectar e prevenir fraudes e uso indevido da plataforma;</li>
          <li>Cumprir obrigações legais e regulatórias.</li>
        </ul>
      </Section>

      <Section title="4. Base legal (LGPD)">
        <Table
          rows={[
            ['Execução de contrato', 'Dados necessários para entregar o serviço contratado (Art. 7º, V)'],
            ['Obrigação legal', 'Emissão e armazenamento de documentos fiscais exigidos por lei (Art. 7º, II)'],
            ['Interesse legítimo', 'Segurança da plataforma, prevenção a fraudes (Art. 7º, IX)'],
            ['Consentimento', 'Comunicações de marketing (Art. 7º, I — revogável a qualquer momento)'],
          ]}
        />
      </Section>

      <Section title="5. Compartilhamento com terceiros">
        <p className="mb-3">Não vendemos seus dados. Compartilhamos apenas com fornecedores essenciais ao serviço:</p>
        <Table
          rows={[
            ['Asaas', 'Processamento de pagamentos e assinaturas', 'asaas.com'],
            ['Supabase', 'Banco de dados e autenticação (infraestrutura em nuvem)', 'supabase.com/privacy'],
            ['Focus NFe', 'Transmissão de NFS-e e NF-e às prefeituras e SEFAZ', 'focusnfe.com.br'],
            ['Vercel', 'Hospedagem da aplicação web', 'vercel.com/legal/privacy-policy'],
          ]}
          headers={['Fornecedor', 'Finalidade', 'Política']}
        />
        <p className="mt-3 text-sm text-[#6B7280]">
          Todos os fornecedores são contratualmente obrigados a tratar os dados somente para as finalidades
          acima e a adotar medidas de segurança adequadas.
        </p>
      </Section>

      <Section title="6. Armazenamento e segurança">
        <p>
          Seus dados são armazenados em servidores seguros da Supabase (região us-east-1). Adotamos as
          seguintes medidas de proteção:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Criptografia em trânsito (TLS 1.2+) e em repouso (AES-256);</li>
          <li>Controle de acesso baseado em funções (RLS no Supabase);</li>
          <li>Senhas armazenadas com hash bcrypt via Supabase Auth;</li>
          <li>Tokens de API fiscais armazenados como variáveis de ambiente, nunca no banco.</li>
        </ul>
      </Section>

      <Section title="7. Retenção de dados">
        <Table
          rows={[
            ['Dados da conta ativa', 'Enquanto a conta existir'],
            ['Dados financeiros e fiscais', '5 anos após encerramento (obrigação fiscal — Lei 9.784/99)'],
            ['Logs de acesso', '6 meses (Marco Civil da Internet, Art. 15)'],
            ['Dados de marketing', 'Até revogação do consentimento'],
          ]}
        />
      </Section>

      <Section title="8. Seus direitos (LGPD, Art. 18)">
        <p className="mb-3">
          Você pode exercer os seguintes direitos a qualquer momento pelo e-mail{' '}
          <a href="mailto:glaucio.sellect@gmail.com" className="text-blue-600 hover:underline">
            glaucio.sellect@gmail.com
          </a>
          :
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Confirmação e acesso</strong> — saber quais dados temos sobre você;</li>
          <li><strong>Correção</strong> — corrigir dados incompletos ou desatualizados;</li>
          <li><strong>Eliminação</strong> — excluir dados desnecessários (salvo obrigação legal);</li>
          <li><strong>Portabilidade</strong> — receber seus dados em formato estruturado;</li>
          <li><strong>Revogação do consentimento</strong> — retirar o consentimento para marketing;</li>
          <li><strong>Oposição</strong> — se opor a tratamento realizado com base em interesse legítimo;</li>
          <li><strong>Informação sobre compartilhamento</strong> — saber com quem compartilhamos seus dados.</li>
        </ul>
        <p className="mt-3 text-sm text-[#6B7280]">
          Responderemos em até 15 dias úteis. Você também pode apresentar reclamação à{' '}
          <strong>ANPD (Autoridade Nacional de Proteção de Dados)</strong> — gov.br/anpd.
        </p>
      </Section>

      <Section title="9. Transferência internacional">
        <p>
          Alguns fornecedores (Supabase, Vercel) processam dados nos EUA. As transferências são
          realizadas com garantias contratuais adequadas (cláusulas-padrão ou certificações equivalentes),
          conforme Art. 33 da LGPD.
        </p>
      </Section>

      <Section title="10. Menores de idade">
        <p>
          O SyncroMoney é destinado exclusivamente a pessoas jurídicas e pessoas físicas maiores de 18 anos.
          Não coletamos intencionalmente dados de menores.
        </p>
      </Section>

      <Section title="11. Alterações nesta política">
        <p>
          Podemos atualizar esta política periodicamente. Quando houver mudanças relevantes, notificaremos
          por e-mail e/ou banner dentro da plataforma. O uso continuado após a notificação constitui
          aceitação das alterações.
        </p>
      </Section>
    </main>
      <LegalFooter />
    </div>
  )
}

function LegalHeader() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
        <Link href="/" className="text-lg font-bold text-gray-900">SyncroMoney</Link>
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">← Voltar</Link>
      </div>
    </header>
  )
}

function LegalFooter() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50 mt-8">
      <div className="mx-auto max-w-3xl px-5 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs text-gray-500">© {new Date().getFullYear()} SyncroMoney.</p>
        <div className="flex gap-4 text-xs">
          <Link href="/privacidade" className="text-gray-500 hover:text-gray-900">Privacidade</Link>
          <Link href="/termos" className="text-gray-500 hover:text-gray-900">Termos</Link>
          <Link href="/cookies" className="text-gray-500 hover:text-gray-900">Cookies</Link>
        </div>
      </div>
    </footer>
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

function Table({
  rows,
  headers,
}: {
  rows: string[][]
  headers?: string[]
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[#E5E7EB]">
      <table className="w-full text-sm">
        {headers && (
          <thead className="bg-[#F3F4F6]">
            <tr>
              {headers.map((h) => (
                <th key={h} className="px-4 py-2 text-left font-semibold text-[#111827]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F9FAFB]'}>
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2 align-top text-[#374151]">
                  {j === 0 ? <strong>{cell}</strong> : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

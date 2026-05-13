import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Termos de Uso — SyncroMoney',
  description: 'Condições gerais de uso da plataforma SyncroMoney.',
}

export default function TermosPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="mb-2 text-3xl font-bold text-[#111827]">Termos de Uso</h1>
      <p className="mb-10 text-sm text-[#6B7280]">Última atualização: 12 de maio de 2026</p>

      <Section title="1. Aceitação dos termos">
        <p>
          Ao criar uma conta ou utilizar qualquer recurso do <strong>SyncroMoney</strong>, você concorda
          com estes Termos de Uso e com nossa{' '}
          <a href="/privacidade" className="text-blue-600 hover:underline">
            Política de Privacidade
          </a>
          . Se você representa uma empresa, declara ter autoridade para vinculá-la a estes termos.
        </p>
        <p className="mt-3">
          Caso não concorde com alguma cláusula, não utilize o serviço.
        </p>
      </Section>

      <Section title="2. Descrição do serviço">
        <p>
          O SyncroMoney é uma plataforma SaaS (<em>Software as a Service</em>) de gestão financeira e
          fiscal que oferece:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Controle de receitas, despesas e fluxo de caixa;</li>
          <li>Gestão de contas bancárias, cartões e fornecedores;</li>
          <li>Emissão de NFS-e (Nota Fiscal de Serviço Eletrônica) e NF-e (Nota Fiscal Eletrônica);</li>
          <li>Controle de estoque e relatórios financeiros;</li>
          <li>Outras funcionalidades descritas em syncromoney.com.br.</li>
        </ul>
        <p className="mt-3">
          O serviço é prestado via internet e pode ser acessado por navegadores web e aplicativo PWA.
          Reservamo-nos o direito de adicionar, modificar ou remover funcionalidades a qualquer momento,
          comunicando alterações relevantes com antecedência razoável.
        </p>
      </Section>

      <Section title="3. Cadastro e segurança da conta">
        <ul className="list-disc space-y-2 pl-5">
          <li>Você deve fornecer informações verdadeiras, completas e atualizadas no cadastro.</li>
          <li>
            Você é responsável por manter a confidencialidade de sua senha. Notifique-nos imediatamente
            em caso de acesso não autorizado.
          </li>
          <li>
            Uma conta é de uso pessoal ou da empresa cadastrada. É vedado compartilhar credenciais entre
            empresas distintas.
          </li>
          <li>
            Podemos suspender ou encerrar contas que violem estes termos, com aviso prévio sempre que
            possível.
          </li>
        </ul>
      </Section>

      <Section title="4. Planos e pagamentos">
        <p className="mb-3">
          O SyncroMoney oferece planos gratuitos e pagos. Os planos pagos são cobrados via cartão de
          crédito processado pelo Stripe.
        </p>
        <Highlight>
          <strong>Renovação automática:</strong> Planos pagos renovam automaticamente no período
          contratado (mensal ou anual) até cancelamento.
        </Highlight>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            <strong>Preços:</strong> os valores são os exibidos na página de planos no momento da
            assinatura. Reajustes serão comunicados com 30 dias de antecedência.
          </li>
          <li>
            <strong>Impostos:</strong> os preços podem não incluir tributos aplicáveis em sua
            jurisdição.
          </li>
          <li>
            <strong>Inadimplência:</strong> em caso de falha no pagamento, o acesso a recursos pagos
            será suspenso após notificação e período de carência de 3 dias.
          </li>
        </ul>
      </Section>

      <Section title="5. Cancelamento e reembolso">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Cancelamento:</strong> você pode cancelar sua assinatura a qualquer momento nas
            Configurações da conta. O acesso se mantém até o fim do período já pago.
          </li>
          <li>
            <strong>Direito de arrependimento (CDC, Art. 49):</strong> para assinaturas contratadas
            online, você tem 7 dias corridos a partir da contratação para solicitar reembolso integral
            pelo e-mail{' '}
            <a href="mailto:glaucio.sellect@gmail.com" className="text-blue-600 hover:underline">
              glaucio.sellect@gmail.com
            </a>
            .
          </li>
          <li>
            <strong>Demais casos:</strong> não há reembolso proporcional por cancelamentos após o prazo
            de arrependimento, salvo falha comprovada do serviço.
          </li>
          <li>
            <strong>Exclusão de dados:</strong> ao encerrar a conta, seus dados serão retidos pelo prazo
            legal fiscal (5 anos) e depois excluídos permanentemente.
          </li>
        </ul>
      </Section>

      <Section title="6. Módulo Fiscal (NFS-e / NF-e)">
        <p className="mb-3">
          A emissão de documentos fiscais está disponível nos planos <strong>Premium Fiscal</strong> e
          superiores.
        </p>
        <Highlight>
          <strong>Importante:</strong> O SyncroMoney é uma ferramenta de automação fiscal. A
          responsabilidade pela veracidade das informações tributárias (alíquotas, NCM, CFOP, regime
          tributário etc.) é inteiramente do usuário emissor. Consulte sempre seu contador.
        </Highlight>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            A transmissão é realizada via <strong>Focus NFe</strong>, sujeita à disponibilidade dos
            sistemas das prefeituras e da SEFAZ.
          </li>
          <li>
            O usuário é responsável por manter o certificado digital válido e instalado na plataforma.
          </li>
          <li>
            Não nos responsabilizamos por rejeições de documentos causadas por dados incorretos
            fornecidos pelo usuário ou por indisponibilidade dos órgãos públicos.
          </li>
          <li>
            Cada CNPJ emitente ocupa um slot de licença Focus NFe. O número de CNPJs disponíveis
            depende do plano contratado.
          </li>
        </ul>
      </Section>

      <Section title="7. Uso aceitável">
        <p className="mb-2">É <strong>proibido</strong> usar o SyncroMoney para:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Emitir documentos fiscais com informações falsas ou fraudulentas;</li>
          <li>Realizar engenharia reversa, descompilar ou extrair o código-fonte da plataforma;</li>
          <li>Sobrecarregar intencionalmente a infraestrutura (ataques DoS);</li>
          <li>Tentar acessar dados de outros usuários;</li>
          <li>Revender, sublicenciar ou ceder o acesso a terceiros sem autorização;</li>
          <li>Qualquer atividade ilegal conforme a legislação brasileira.</li>
        </ul>
        <p className="mt-3">
          O descumprimento pode resultar em suspensão imediata e, se aplicável, comunicação às
          autoridades competentes.
        </p>
      </Section>

      <Section title="8. Propriedade intelectual">
        <p>
          Todo o conteúdo, código, marcas, logotipos e interfaces do SyncroMoney são de propriedade
          exclusiva da Syncro Soluções Digitais ou de seus licenciantes. É concedida uma licença
          limitada, não exclusiva e intransferível de uso da plataforma durante a vigência da
          assinatura.
        </p>
        <p className="mt-3">
          Seus dados financeiros e fiscais permanecem de sua propriedade. Ao usar o serviço, você
          nos concede licença para processá-los exclusivamente para a prestação do serviço contratado.
        </p>
      </Section>

      <Section title="9. Disponibilidade e SLA">
        <p>
          Nos esforçamos para manter o serviço disponível 24/7. No entanto, não garantimos
          disponibilidade ininterrupta. Manutenções programadas serão comunicadas com antecedência
          sempre que possível via e-mail ou banner na plataforma.
        </p>
        <p className="mt-3 text-[#6B7280]">
          Meta de disponibilidade: 99,5% ao mês, excluídas manutenções programadas e indisponibilidades
          de terceiros (prefeituras, SEFAZ, Stripe).
        </p>
      </Section>

      <Section title="10. Limitação de responsabilidade">
        <p>
          Na extensão máxima permitida por lei, o SyncroMoney não se responsabiliza por:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Perdas financeiras decorrentes de erros nos dados inseridos pelo usuário;</li>
          <li>Multas ou autuações fiscais por informações incorretas na emissão de NF;</li>
          <li>Danos indiretos, lucros cessantes ou perda de dados por falhas de terceiros;</li>
          <li>Indisponibilidade dos sistemas da Receita Federal, prefeituras ou SEFAZ.</li>
        </ul>
        <p className="mt-3">
          Nossa responsabilidade total, em qualquer hipótese, fica limitada ao valor pago pelo usuário
          nos últimos 3 meses.
        </p>
      </Section>

      <Section title="11. Alterações nos termos">
        <p>
          Podemos modificar estes termos a qualquer momento. Notificaremos por e-mail com 15 dias de
          antecedência para alterações substanciais. O uso continuado após a vigência das novas
          condições implica aceitação.
        </p>
      </Section>

      <Section title="12. Foro e legislação aplicável">
        <p>
          Estes termos são regidos pelas leis da República Federativa do Brasil. Para dirimir
          controvérsias, fica eleito o foro da Comarca de{' '}
          <strong>Juiz de Fora – Minas Gerais</strong>, com renúncia expressa a qualquer outro,
          por mais privilegiado que seja.
        </p>
      </Section>

      <Section title="13. Contato">
        <p>
          Dúvidas sobre estes termos:{' '}
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

function Highlight({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      {children}
    </div>
  )
}

import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/legal-page";
import { env } from "@/lib/env";
import { formatBRL } from "@/lib/format";

export const metadata: Metadata = { title: "Termos de uso", robots: { index: true, follow: true } };

/* Modelo de termos alinhado ao funcionamento do app. Revise com um advogado antes de publicar. */
export default function TermsPage() {
  const minSale = formatBRL(env().RANKING_MIN_SALE_CENTS);
  const fee = env().PLATFORM_FEE_PERCENT;
  return (
    <LegalPage title="Termos de uso" updated="26 de setembro de 2026">
      <p>Ao criar uma conta no LeadScan você concorda com estes termos. Se algo não estiver claro, fale com a gente antes de usar.</p>

      <h2>O que o LeadScan faz</h2>
      <p>
        Ferramenta de prospecção para quem vende sites: busca de empresas com dados públicos, análise de oportunidade, geração de protótipos, mensagens de abordagem,
        cobranças e uma comunidade com ranking. O score é uma estimativa de potencial, não uma garantia de venda.
      </p>

      <h2>Uso responsável</h2>
      <ul>
        <li>Aborde empresas de forma individual e respeitosa. É proibido usar a plataforma para spam, disparo em massa ou mensagens enganosas.</li>
        <li>Respeite pedidos de remoção: empresas que pedirem para não ser contatadas saem das buscas.</li>
        <li>Não publique foto de perfil ou imagem de site com nudez, conteúdo sexual, violência ou material de terceiros sem autorização.</li>
        <li>Não tente burlar limites, acessar dados de outras contas ou manipular o ranking (por exemplo, pagando a si mesmo).</li>
      </ul>

      <h2>Pagamentos</h2>
      <p>
        Os pagamentos dos seus clientes são processados pelo provedor que você conectar (Mercado Pago ou Stripe), sob os termos dele. O valor cai na sua conta no provedor.
        {fee > 0 ? ` A plataforma retém ${fee}% de cada cobrança paga.` : " A plataforma não retém comissão sobre as cobranças."} Estornos e disputas seguem as regras do provedor.
      </p>

      <h2>Ranking, níveis e títulos</h2>
      <p>
        Participar é opcional. Contam apenas vendas pagas pela plataforma, confirmadas pelo provedor, a partir de {minSale}. Vendas estornadas saem da contagem. Podemos
        remover do ranking contas com indício de manipulação. As regras de pontuação estão descritas na página da Comunidade.
      </p>

      <h2>Integrações de IA</h2>
      <p>Ao conectar uma IA com a sua chave, o uso é cobrado pelo provedor da IA na sua conta. Você é responsável por revisar os textos gerados antes de enviar a clientes.</p>

      <h2>Conteúdo</h2>
      <p>Protótipos, textos e imagens que você cria são seus. Você nos autoriza a armazená-los e exibi-los nos links que você compartilhar.</p>

      <h2>Encerramento</h2>
      <p>
        Você pode excluir sua conta a qualquer momento. Podemos suspender contas que violem estes termos. Detalhes sobre dados pessoais estão na{" "}
        <Link href="/privacidade" className="underline underline-offset-4">
          Política de privacidade
        </Link>
        .
      </p>
    </LegalPage>
  );
}

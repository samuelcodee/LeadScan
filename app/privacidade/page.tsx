import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Política de privacidade", robots: { index: true, follow: true } };

/*
 * Modelo de política escrito para o funcionamento real do app. Antes de abrir ao público,
 * revise com um advogado e preencha CONTACT_EMAIL (encarregado de dados — art. 41 da LGPD).
 */
export default function PrivacyPage() {
  const contact = env().CONTACT_EMAIL;
  return (
    <LegalPage title="Política de privacidade" updated="26 de setembro de 2026">
      <p>Esta política explica quais dados o LeadScan trata, por quê e como você controla cada um deles, nos termos da Lei Geral de Proteção de Dados (Lei 13.709/2018).</p>

      <h2>Dados da sua conta</h2>
      <ul>
        <li>E-mail ou celular (para entrar com código), ou identificação da sua conta Google (nome, e-mail e id). Não pedimos nem guardamos senha.</li>
        <li>Perfil: nome, @, bio, Instagram e foto — você escolhe o que preencher. A foto passa por verificação automática para bloquear conteúdo adulto.</li>
        <li>Uso do produto: buscas, leads salvos, protótipos, mensagens e cobranças que você cria.</li>
      </ul>

      <h2>Dados de empresas (leads)</h2>
      <p>
        Mostramos somente informações comerciais públicas de empresas (nome, endereço comercial, telefone publicado, site, redes, avaliações), vindas de fontes como Google
        Maps (Places API) e OpenStreetMap. Não inventamos dados. Qualquer empresa pode pedir para não ser mais exibida pela página da proposta ou pelo contato abaixo; o pedido
        vale para toda a plataforma.
      </p>

      <h2>Pagamentos</h2>
      <p>
        Cobranças são processadas pelo Mercado Pago ou pela Stripe, na página deles. Nós nunca recebemos número de cartão. Guardamos valor, status, meio de pagamento e data
        da venda para montar o seu financeiro. Os tokens de acesso às suas contas de recebimento ficam criptografados.
      </p>

      <h2>Comunidade, ranking e faturamento</h2>
      <p>
        Seu perfil pode ficar aberto ou fechado para a comunidade. O ranking e o painel de faturamento por conta são opcionais e só mostram suas vendas e valores se você
        ativar essa opção (consentimento, art. 7º, I). Você pode retirar o consentimento a qualquer momento em Perfil → Privacidade. Totais da plataforma são exibidos de forma
        agregada, sem identificar ninguém.
      </p>

      <h2>Inteligência artificial</h2>
      <p>
        Quando você usa IA (sua chave ou a da plataforma), enviamos só o necessário para gerar o texto: nome e segmento do negócio, cidade/bairro, serviços e sinais públicos.
        Telefone, endereço completo e suas anotações não são enviados. As chaves de API que você conecta ficam criptografadas e nunca são exibidas de volta.
      </p>

      <h2>Com quem compartilhamos</h2>
      <ul>
        <li>Provedores de infraestrutura (hospedagem e banco de dados).</li>
        <li>Envio de códigos: serviço de e-mail e de SMS.</li>
        <li>Pagamentos: Mercado Pago ou Stripe, conforme a conta que você conectar.</li>
        <li>IAs que você mesmo conectar (Anthropic, OpenAI, Google e outras).</li>
      </ul>
      <p>Não vendemos dados pessoais.</p>

      <h2>Seus direitos</h2>
      <p>
        Você pode acessar, corrigir, exportar (Configurações → Exportar dados) e excluir sua conta (Perfil → Conta) a qualquer momento. A exclusão apaga perfil, leads,
        protótipos, cobranças e vendas.
      </p>

      <h2>Segurança</h2>
      <p>Sessões assinadas, códigos de acesso com validade curta e limite de tentativas, segredos criptografados (AES-256-GCM) e limites de uso contra abuso.</p>

      <h2>Contato</h2>
      <p>{contact ? <>Encarregado de dados: {contact}</> : "Fale com a equipe responsável por esta instalação pelo canal de suporte informado no site."}</p>
    </LegalPage>
  );
}

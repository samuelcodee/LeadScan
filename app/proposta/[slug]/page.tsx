import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowUpRight, MessageCircle } from "lucide-react";
import { CtaLink, OptOut, ProposalPreview, ViewTracker } from "@/components/proposal/proposal-client";
import { articles } from "@/lib/domain/grammar";
import { formatBRL } from "@/lib/format";
import { getPublicProposal } from "@/lib/prototypes/public";
import { buildWhatsAppLink } from "@/lib/whatsapp/link";
import { normalizeBrazilPhone } from "@/lib/whatsapp/phone";

export async function generateMetadata(props: PageProps<"/proposta/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const p = await getPublicProposal(slug);
  if (!p) return { title: "Proposta não encontrada", robots: { index: false } };
  return {
    title: `Uma ideia de site para ${p.spec.business.name}`,
    description: "Prévia de site preparada para a sua empresa.",
    robots: { index: false, follow: false },
  };
}

/**
 * Página que o CLIENTE FINAL vê. Pública, sem login, sem dados de CRM.
 * Estrutura em blocos para, no futuro, virar proposta comercial
 * (escopo, investimento, prazo, aceite) sem refazer a página.
 */
export default async function ProposalPage(props: PageProps<"/proposta/[slug]">) {
  const { slug } = await props.params;
  const p = await getPublicProposal(slug);
  if (!p) notFound();
  const b = p.spec.business;
  const a = articles(b.name);
  const author = p.author.agency ?? p.author.name;
  const phone = normalizeBrazilPhone(p.author.whatsapp);
  const cta = phone ? buildWhatsAppLink(phone.e164, `Olá! Vi a proposta de site para ${a.o} e quero conversar sobre o projeto.`) : null;

  return (
    <div className="min-h-dvh bg-background">
      <ViewTracker slug={slug} />
      {p.spec.demo && (
        <div className="bg-demo-soft px-4 py-2 text-center text-xs font-medium text-demo">
          Demonstração: empresa e dados fictícios.
        </div>
      )}
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <p className="truncate text-sm font-semibold">{author ?? "Proposta de site"}</p>
          {cta && (
            <CtaLink slug={slug} href={cta} className="inline-flex h-9 items-center gap-2 rounded-md bg-whatsapp px-3 text-sm font-semibold text-whatsapp-foreground">
              <MessageCircle className="size-4" /> <span className="hidden sm:inline">Quero conversar</span>
            </CtaLink>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-ink">Proposta · {b.name}</p>
            <h1 className="mt-3 text-3xl font-semibold leading-[1.1] tracking-tight text-balance sm:text-5xl">
              Preparamos uma ideia de site para {a.o}.
            </h1>
          </div>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            É um primeiro rascunho, montado com as informações públicas de vocês. Textos, fotos e cores mudam do jeito que preferirem. Dá uma olhada no
            computador e no celular.
          </p>
        </div>

        <div className="mt-10">
          <ProposalPreview spec={p.spec} />
          <p className="mt-3 text-center text-xs text-muted-foreground">
            <a href={`/proposta/${slug}/site`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground">
              Abrir o site em tela cheia <ArrowUpRight className="size-3" />
            </a>
          </p>
        </div>

        <section className="mt-16 grid gap-10 border-t pt-12 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">O que já está pensado aqui</h2>
            <p className="mt-2 text-sm text-muted-foreground">Nada disso depende de vocês criarem conteúdo novo agora.</p>
          </div>
          <ul className="grid gap-5 text-[15px]">
            <li>
              <p className="font-semibold">Botão direto para o WhatsApp</p>
              <p className="text-muted-foreground">Quem visita chama vocês em um toque, com a mensagem já escrita.</p>
            </li>
            <li>
              <p className="font-semibold">Feito primeiro para o celular</p>
              <p className="text-muted-foreground">É de onde vem a maior parte das visitas de negócios locais.</p>
            </li>
            <li>
              <p className="font-semibold">Endereço, horários e serviços num lugar só</p>
              <p className="text-muted-foreground">
                {b.reviewCount ? `As ${b.reviewCount.toLocaleString("pt-BR")} avaliações de vocês no Google ganham um lugar de destaque.` : "Menos perguntas repetidas no direct."}
              </p>
            </li>
          </ul>
        </section>

        <section className="mt-16 rounded-2xl bg-foreground px-6 py-12 text-background sm:px-12">
          <div className="grid gap-6 sm:grid-cols-[1.5fr_auto] sm:items-center">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Gostou da ideia?</h2>
              <p className="mt-2 text-sm opacity-75">Sem compromisso. A gente ajusta o que precisar antes de qualquer decisão.</p>
            </div>
            <div className="grid gap-2">
              {p.charge && (
                <a
                  href={`/pagar/${p.charge.slug}`}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-background px-6 font-semibold text-foreground"
                >
                  Fechar o projeto · {formatBRL(p.charge.amountCents)}
                </a>
              )}
              {cta ? (
                <CtaLink slug={slug} href={cta} className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-whatsapp px-6 font-semibold text-whatsapp-foreground">
                  <MessageCircle className="size-5" /> Quero conversar sobre este projeto
                </CtaLink>
              ) : (
                <p className="text-sm opacity-80">Responda a mensagem em que você recebeu este link.</p>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>Protótipo conceitual feito com dados comerciais públicos{author ? ` por ${author}` : ""}.</p>
          <OptOut slug={slug} />
        </div>
      </footer>
    </div>
  );
}

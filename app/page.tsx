import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, MapPin, MessageCircle, MessageSquare, Search, Star, Zap } from "lucide-react";
import { Logo } from "@/components/app-shell/logo";
import { ScaledSite } from "@/components/prototypes/scaled-site";
import { LevelBadge } from "@/components/profile/identity";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { CATEGORIES } from "@/lib/domain/categories";
import { municipalityCount } from "@/lib/domain/municipalities";
import { isDemoMode } from "@/lib/env";
import { LEVELS } from "@/lib/gamification/levels";
import { generateMockBusiness } from "@/lib/providers/mock";
import { scoreLead } from "@/lib/scoring";
import { buildSiteSpec } from "@/lib/templates/build";
import { previewSpec } from "@/lib/templates/preview";
import { TEMPLATE_LIST } from "@/lib/templates/registry";

export const metadata: Metadata = {
  title: "LeadScan — encontre clientes para os seus sites",
  description: "Busque negócios por cidade, veja quem precisa de site, mostre o protótipo pronto e receba pelo Pix.",
  robots: { index: true, follow: true },
};

const TOOLS = ["Claude", "ChatGPT", "Gemini", "Nano Banana", "Lovable", "Bolt", "v0", "Cursor", "Claude Code", "Google Flow", "OpenRouter", "Groq", "DeepSeek", "Mistral", "Grok", "Perplexity"];

const FAQ = [
  {
    q: "Os dados das empresas são reais?",
    a: "Vêm do Google Maps (com a sua chave da Places API) ou do OpenStreetMap, que é gratuito. Nada é inventado: se a fonte não informa o Instagram, aparece “Não encontrado”.",
  },
  { q: "Preciso pagar alguma IA?", a: "Não. Busca, score, protótipo e mensagens funcionam sem IA. Se quiser, conecte sua conta do Claude, ChatGPT ou Gemini e use com a sua chave." },
  {
    q: "Como eu recebo dos meus clientes?",
    a: "Conectando o seu Mercado Pago ou a sua Stripe. O cliente paga com Pix ou cartão na página do provedor e o dinheiro cai direto na sua conta.",
  },
  { q: "Meu faturamento fica público?", a: "Só se você quiser. O ranking é opcional e você entra ou sai quando quiser, em Perfil → Privacidade." },
];

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect(user.onboardedAt ? "/dashboard" : "/onboarding");

  // Vitrine real: o mesmo gerador de protótipos do produto, com um negócio de exemplo
  const b = generateMockBusiness({ category: "clinica-estetica", city: "Fortaleza", uf: "CE" }, 7);
  const spec = buildSiteSpec({ id: "home-demo", ...b, category: "clinica-estetica", isDemo: true, photos: [] });
  const score = scoreLead({ ...b, category: "clinica-estetica" });
  const why = score.reasons.filter((r) => r.kind === "positive").slice(0, 2).map((r) => r.label);
  const demo = isDemoMode();

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-ink text-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
          <Logo tagline className="min-w-0" taglineClassName="max-[419px]:hidden" />
          <nav className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Link href="#como-funciona" className="hidden px-3 text-sm text-white/70 transition-colors hover:text-white md:inline">
              Como funciona
            </Link>
            <Link href="#comunidade" className="hidden px-3 text-sm text-white/70 transition-colors hover:text-white md:inline">
              Comunidade
            </Link>
            <Button asChild variant="ghost" className="px-2.5 text-white hover:bg-white/10 hover:text-white sm:px-4">
              <Link href="/login">Entrar</Link>
            </Button>
            <Button asChild className="px-3 sm:px-4">
              <Link href="/login?criar=1">Criar conta</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        {/* Área escura da marca: preto + branco + a "luz" lima */}
        <div className="relative overflow-hidden bg-ink text-white">
          <div className="pointer-events-none absolute -left-16 -top-16 size-56 bg-lime [clip-path:polygon(0_0,100%_0,0_100%)]" aria-hidden />
          <div className="pointer-events-none absolute -right-10 top-0 size-40 bg-lime/90 [clip-path:polygon(100%_0,100%_100%,30%_0)]" aria-hidden />
        <section className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:pt-24">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/60">Prospecção · Sites · Vendas</p>
            <h1 className="mt-5 text-[38px] font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-[56px]">
              Encontre os clientes certos.
              <br />
              Crie o site ideal.
              <br />
              <span className="text-lime">Venda mais.</span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-white/70 sm:text-lg">
              A plataforma que conecta você a empresas que realmente precisam de um site, gera protótipos personalizados e facilita todo o processo de venda.
            </p>
            <ul className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
              {[
                { icon: Search, label: "Prospecção inteligente" },
                { icon: Zap, label: "Sites personalizados" },
                { icon: MessageSquare, label: "Abordagens prontas" },
                { icon: MessageCircle, label: "WhatsApp direto", whatsapp: true },
              ].map((f) => (
                <li key={f.label} className="text-sm leading-snug text-white/85">
                  <f.icon className={f.whatsapp ? "mb-2 size-5 text-whatsapp" : "mb-2 size-5 text-lime"} strokeWidth={1.75} aria-hidden />
                  {f.label}
                </li>
              ))}
            </ul>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-12 px-6 text-base">
                <Link href="/login">
                  Comece agora <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="h-12 border border-white/20 px-6 text-base text-white hover:bg-white/10 hover:text-white">
                <Link href="#como-funciona">Ver como funciona</Link>
              </Button>
              {demo && (
                <Button asChild size="lg" variant="ghost" className="h-12 px-4 text-base text-white/70 hover:bg-white/10 hover:text-white">
                  <Link href="/api/auth/demo" prefetch={false}>
                    Explorar a demonstração
                  </Link>
                </Button>
              )}
            </div>
            <p className="mt-8 text-xs text-white/50">
              {municipalityCount().toLocaleString("pt-BR")} cidades · {CATEGORIES.length} tipos de negócio · {TEMPLATE_LIST.length} modelos de site · entre com Google, e-mail ou celular
            </p>
          </div>

          {/* Assinatura da página: um protótipo de verdade, gerado pelo produto */}
          <div className="relative">
            <div className="overflow-hidden rounded-xl border border-white/10 bg-card text-card-foreground shadow-premium">
              <div className="flex items-center gap-1.5 border-b px-3 py-2">
                <span className="size-2.5 rounded-full bg-muted-foreground/30" />
                <span className="size-2.5 rounded-full bg-muted-foreground/30" />
                <span className="size-2.5 rounded-full bg-muted-foreground/30" />
                <span className="ml-3 truncate text-xs text-muted-foreground">prévia gerada em 2 segundos · {spec.business.name}</span>
              </div>
              <ScaledSite spec={previewSpec(spec, 2, 800)} sections={2} eager />
            </div>
            <div className="absolute -bottom-6 left-4 w-64 rotate-[-1.5deg] rounded-lg border bg-card p-3 text-card-foreground shadow-premium sm:-left-6">
              <div className="flex items-center justify-between">
                <p className="truncate text-sm font-semibold">{spec.business.name}</p>
                <span className="rounded-sm bg-success-soft px-1.5 py-0.5 text-[11px] font-bold text-success">{score.score}/100</span>
              </div>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="size-3" /> {spec.business.city} - {spec.business.state}
                {spec.business.rating !== null && (
                  <>
                    <Star className="ml-2 size-3 fill-warning text-warning" /> {spec.business.rating.toLocaleString("pt-BR")}
                  </>
                )}
              </p>
              <ul className="mt-2 grid gap-0.5 text-xs">
                {why.map((w) => (
                  <li key={w} className="truncate">
                    ✓ {w}
                  </li>
                ))}
              </ul>
              <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium">
                <MessageCircle className="size-3.5 text-whatsapp" /> Mensagem pronta para o WhatsApp
              </p>
            </div>
          </div>
        </section>
        </div>

        <section id="como-funciona" className="scroll-mt-20 border-t bg-muted/40">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight">Da busca ao Pix, sem trocar de aba</h2>
            <div className="mt-8 grid gap-6 md:grid-cols-4">
              {[
                ["Buscar", "“Dentistas em Recife sem site, com Instagram”. A frase vira filtro sozinha."],
                ["Qualificar", "Score de 0 a 100 com o motivo escrito: sem site, 300 avaliações, WhatsApp ativo."],
                ["Mostrar", "Protótipo com o nome, as fotos e o bairro do cliente. Link público para ele abrir no celular."],
                ["Receber", "Link de pagamento com Pix ou cartão. Quando pagam, a venda entra no seu financeiro na hora."],
              ].map(([t, d]) => (
                <div key={t}>
                  <p className="font-semibold">{t}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="comunidade" className="scroll-mt-20">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Uma comunidade que mede venda, não curtida</h2>
              <p className="mt-3 text-muted-foreground">
                Ranking semanal que zera toda segunda às 00:00, top 3 do mês e dez níveis que só sobem com venda paga pela plataforma. Quem participa decide; o faturamento
                de ninguém aparece sem consentimento.
              </p>
            </div>
            <ol className="grid gap-1.5 sm:grid-cols-2">
              {LEVELS.map((l) => (
                <li key={l.n} className="flex items-center gap-2.5 rounded-md border px-3 py-2 text-sm">
                  <LevelBadge level={l.n} />
                  <span className="font-medium">{l.name}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-t bg-muted/40">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight">Funciona com as IAs que você já usa</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">Conecte a sua conta ou leve o briefing do site pronto para a ferramenta que preferir.</p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {TOOLS.map((t) => (
                <li key={t} className="rounded-full border bg-background px-3 py-1.5 text-sm">
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">Perguntas frequentes</h2>
          <div className="mt-6 divide-y rounded-lg border">
            {FAQ.map((f) => (
              <details key={f.q} className="group p-4">
                <summary className="cursor-pointer list-none font-medium">{f.q}</summary>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Button asChild size="lg" className="h-12 px-6 text-base">
              <Link href="/login">
                Começar agora <ArrowRight />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:px-6">
          <p>© {new Date().getFullYear()} LeadScan</p>
          <nav className="flex gap-4">
            <Link href="/termos" className="hover:text-foreground">
              Termos de uso
            </Link>
            <Link href="/privacidade" className="hover:text-foreground">
              Privacidade
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

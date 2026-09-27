import { MessageCircle } from "lucide-react";
import { Instagram } from "@/components/icons";
import { About, Benefits, Contact, Cta, Faq, Gallery, Hero, Location, Services, Testimonials, type Ctx } from "@/components/site/sections";
import { themeVars } from "@/components/site/theme";
import type { Section, SiteSpec } from "@/lib/templates/types";
import { cn } from "@/lib/utils";
import { buildWhatsAppLink } from "@/lib/whatsapp/link";
import { normalizeBrazilPhone } from "@/lib/whatsapp/phone";

/**
 * Renderiza um SiteSpec. Sem estado e sem hooks: funciona no editor (cliente)
 * e na página pública da proposta (servidor).
 *
 * Responsividade via container queries (@3xl = 768px, @5xl = 1024px): o layout
 * reage à largura do QUADRO, então a prévia Desktop/Tablet/Mobile é fiel sem iframe.
 */
export function SiteRenderer({
  spec,
  mode = "page",
  selectedId,
  className,
}: {
  spec: SiteSpec;
  /** embedded: dentro do editor/miniatura (links inertes). page: página real. */
  mode?: "page" | "embedded";
  selectedId?: string | null;
  className?: string;
}) {
  const b = spec.business;
  const whats = spec.demo ? null : (normalizeBrazilPhone(b.whatsapp) ?? normalizeBrazilPhone(b.phone));
  const heroSection = spec.sections.find((s) => s.type === "hero" && s.visible);
  const cta = heroSection?.type === "hero" ? heroSection.data.ctaLabel.toLowerCase() : "mais informações";
  const waHref = buildWhatsAppLink(whats?.e164 ?? null, `Olá! Vim pelo site e gostaria de ${cta}.`);
  const mapsQuery = [b.name, b.address, b.city, b.state].filter(Boolean).join(", ");
  const mapsHref = b.mapsUrl ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`;
  const ctx: Ctx = { spec, waHref, mapsHref };
  const overlayHero = heroSection?.type === "hero" && heroSection.data.layout === "overlay" && spec.sections[0]?.id === heroSection.id;

  return (
    <div
      style={themeVars(spec.theme)}
      className={cn(
        "@container relative bg-site-bg font-site-body text-site-fg antialiased",
        mode === "embedded" && "[&_a]:pointer-events-none [&_summary]:pointer-events-auto",
        className,
      )}
    >
      <header
        className={cn(
          "top-0 z-20 w-full",
          overlayHero ? "absolute text-white" : "sticky border-b border-site-line bg-site-bg/95",
        )}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 @3xl:px-8">
          <span className="truncate font-site-heading text-lg font-semibold tracking-tight [text-transform:var(--site-heading-case)]">{b.name}</span>
          <nav className="hidden items-center gap-7 text-sm font-medium @3xl:flex" aria-label="Seções">
            {spec.sections.some((s) => s.type === "services" && s.visible) && <a href="#servicos">Serviços</a>}
            {spec.sections.some((s) => s.type === "about" && s.visible) && <a href="#sobre">Sobre</a>}
            <a href="#contato">Contato</a>
          </nav>
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-site px-4 text-sm font-semibold",
              overlayHero ? "bg-white text-black" : "bg-site-primary text-site-on-primary",
            )}
          >
            <MessageCircle className="size-4" aria-hidden />
            <span className="hidden @md:inline">WhatsApp</span>
          </a>
        </div>
      </header>

      <main>
        {spec.sections
          .filter((s) => s.visible)
          .map((s) => (
            <div
              key={s.id}
              data-section-id={s.id}
              className={cn(
                mode === "embedded" && "relative outline-offset-[-2px] transition-[outline-color] duration-150",
                mode === "embedded" && selectedId === s.id && "outline-2 outline-dashed outline-[var(--site-primary-text)]",
              )}
            >
              <SectionView s={s} ctx={ctx} />
            </div>
          ))}
      </main>

      <footer className="border-t border-site-line py-10 text-sm text-site-muted">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 @3xl:px-8">
          <p>
            © {new Date().getFullYear()} {b.name} · {b.city} - {b.state}
          </p>
          {spec.credits?.length ? <p className="w-full text-xs opacity-80">Fotos: Google Maps · {spec.credits.join(", ")}</p> : null}
          {b.instagram && (
            <a href={`https://instagram.com/${b.instagram}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-site-fg">
              <Instagram className="size-4" aria-hidden /> @{b.instagram}
            </a>
          )}
        </div>
      </footer>

      {/* Botão flutuante: sticky no fim do fluxo = fica no rodapé da área visível, no editor e na página */}
      <div className="pointer-events-none sticky bottom-4 z-30 -mt-16 flex h-16 justify-end px-4">
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Conversar no WhatsApp"
          className="pointer-events-auto grid size-14 place-items-center rounded-full bg-[#1f9e55] text-white shadow-lg ring-4 ring-black/5 transition-transform duration-150 hover:scale-105"
        >
          <MessageCircle className="size-6" aria-hidden />
        </a>
      </div>
    </div>
  );
}

function SectionView({ s, ctx }: { s: Section; ctx: Ctx }) {
  switch (s.type) {
    case "hero":
      return <Hero s={s} ctx={ctx} />;
    case "services":
      return <Services s={s} />;
    case "about":
      return <About s={s} ctx={ctx} />;
    case "benefits":
      return <Benefits s={s} />;
    case "gallery":
      return <Gallery s={s} ctx={ctx} />;
    case "testimonials":
      return <Testimonials s={s} ctx={ctx} />;
    case "faq":
      return <Faq s={s} />;
    case "location":
      return <Location s={s} ctx={ctx} />;
    case "contact":
      return <Contact s={s} ctx={ctx} />;
    case "cta":
      return <Cta s={s} ctx={ctx} />;
  }
}

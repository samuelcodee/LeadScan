/* eslint-disable @next/next/no-img-element -- o site gerado usa <img> puro: é portátil (exportável como HTML estático) */
import { ArrowRight, Check, ChevronDown, Clock, MapPin, MessageCircle, Phone, Star } from "lucide-react";
import { Instagram } from "@/components/icons";
import type { ReactNode } from "react";
import { formatInt, formatRating } from "@/lib/format";
import type { SectionOf, SiteSpec } from "@/lib/templates/types";
import { cn } from "@/lib/utils";
import { formatPhone } from "@/lib/whatsapp/phone";

export type Ctx = { spec: SiteSpec; waHref: string; mapsHref: string };

/* Classes de domínio: títulos usam a fonte e a caixa do tema. */
const heading = "font-site-heading [text-transform:var(--site-heading-case)] tracking-tight text-balance";
const shell = "mx-auto w-full max-w-6xl px-5 @3xl:px-8";

export function WaButton({ href, children, variant = "primary", className }: { href: string; children: ReactNode; variant?: "primary" | "light" | "outline"; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-site px-6 text-[15px] font-semibold transition-[filter,background-color] duration-150 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current",
        variant === "primary" && "bg-site-primary text-site-on-primary",
        variant === "light" && "bg-site-on-primary text-site-primary",
        variant === "outline" && "border border-site-line text-site-fg hover:bg-site-tint",
        className,
      )}
    >
      {children}
    </a>
  );
}

function SectionTitle({ eyebrow, title, subtitle, center }: { eyebrow?: string; title: string; subtitle?: string; center?: boolean }) {
  return (
    <div className={cn("max-w-2xl", center && "mx-auto text-center")}>
      {eyebrow && <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--site-primary-text)]">{eyebrow}</p>}
      <h2 className={cn(heading, "text-3xl leading-[1.08] @3xl:text-4xl")}>{title}</h2>
      {subtitle && <p className="mt-4 text-[15px] leading-relaxed text-site-muted @3xl:text-base">{subtitle}</p>}
    </div>
  );
}

function Rating({ spec, className }: { spec: SiteSpec; className?: string }) {
  const { rating, reviewCount } = spec.business;
  if (rating === null || !reviewCount) return null;
  return (
    <p className={cn("flex items-center gap-1.5 text-sm", className)}>
      <Star className="size-4 fill-site-accent text-site-accent" aria-hidden />
      <span className="font-semibold">{formatRating(rating)}</span>
      <span className="opacity-75">· {formatInt(reviewCount)} avaliações no Google</span>
    </p>
  );
}

export function Hero({ s, ctx }: { s: SectionOf<"hero">; ctx: Ctx }) {
  const d = s.data;
  const alt = `${ctx.spec.business.categoryLabel} ${ctx.spec.business.name}`;

  if (d.layout === "overlay") {
    return (
      <section className="relative isolate flex min-h-[560px] items-end overflow-hidden @5xl:min-h-[640px]">
        {d.image && <img src={d.image} alt={alt} className="absolute inset-0 -z-10 size-full object-cover" width={1600} height={900} />}
        {/* scrim sólido: garante contraste do texto sem depender da foto */}
        <div className="absolute inset-0 -z-10 bg-black/50" />
        <div className={cn(shell, "pb-14 pt-32 text-white @3xl:pb-20")}>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-white/80">{d.eyebrow}</p>
          <h1 className={cn(heading, "max-w-3xl text-[2.6rem] leading-[1.02] @3xl:text-6xl @5xl:text-7xl")}>{d.title}</h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/85 @3xl:text-lg">{d.subtitle}</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <WaButton href={ctx.waHref}>
              <MessageCircle className="size-5" aria-hidden />
              {d.ctaLabel}
            </WaButton>
            <a href="#servicos" className="inline-flex min-h-12 items-center gap-1.5 px-2 text-[15px] font-medium text-white/90 underline-offset-4 hover:underline">
              {d.secondaryLabel} <ArrowRight className="size-4" aria-hidden />
            </a>
          </div>
          <Rating spec={ctx.spec} className="mt-8 text-white" />
        </div>
      </section>
    );
  }

  if (d.layout === "stacked") {
    return (
      <section className="pt-12 @3xl:pt-20">
        <div className={shell}>
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--site-primary-text)]">{d.eyebrow}</p>
          <h1 className={cn(heading, "text-[3rem] leading-[0.95] @3xl:text-7xl @5xl:text-[6.5rem]")}>{d.title}</h1>
          <div className="mt-8 grid gap-6 @3xl:grid-cols-[1fr_auto] @3xl:items-end">
            <p className="max-w-xl text-base leading-relaxed text-site-muted @3xl:text-lg">{d.subtitle}</p>
            <div className="flex flex-wrap gap-3">
              <WaButton href={ctx.waHref}>
                <MessageCircle className="size-5" aria-hidden />
                {d.ctaLabel}
              </WaButton>
              <WaButton href="#servicos" variant="outline">
                {d.secondaryLabel}
              </WaButton>
            </div>
          </div>
          <Rating spec={ctx.spec} className="mt-6" />
        </div>
        {d.image && (
          <div className="mt-10 @3xl:mt-14">
            <img src={d.image} alt={alt} className="aspect-[4/3] w-full object-cover @3xl:aspect-[21/9]" width={1600} height={686} />
          </div>
        )}
      </section>
    );
  }

  // split — imagem sangra na borda direita no desktop (assimetria intencional)
  return (
    <section className="overflow-hidden pt-10 @3xl:pt-16">
      <div className={cn(shell, "grid items-center gap-10 @3xl:grid-cols-[1.05fr_1fr] @5xl:gap-16")}>
        <div className="pb-4 @3xl:pb-16">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--site-primary-text)]">{d.eyebrow}</p>
          <h1 className={cn(heading, "text-[2.5rem] leading-[1.04] @3xl:text-5xl @5xl:text-[4rem]")}>{d.title}</h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-site-muted @3xl:text-lg">{d.subtitle}</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <WaButton href={ctx.waHref}>
              <MessageCircle className="size-5" aria-hidden />
              {d.ctaLabel}
            </WaButton>
            <a href="#servicos" className="inline-flex min-h-12 items-center gap-1.5 px-2 text-[15px] font-medium underline-offset-4 hover:underline">
              {d.secondaryLabel} <ArrowRight className="size-4" aria-hidden />
            </a>
          </div>
          <Rating spec={ctx.spec} className="mt-8" />
        </div>
        {d.image && (
          <div className="relative @5xl:-mr-24">
            <img
              src={d.image}
              alt={alt}
              className="aspect-[4/5] w-full rounded-site object-cover @3xl:aspect-[4/5] @5xl:rounded-r-none"
              width={1000}
              height={1250}
            />
            <div className="absolute -bottom-4 -left-4 -z-10 hidden size-40 rounded-site bg-site-accent/60 @3xl:block" aria-hidden />
          </div>
        )}
      </div>
    </section>
  );
}

export function Services({ s }: { s: SectionOf<"services"> }) {
  return (
    <section id="servicos" className="py-16 @3xl:py-24">
      <div className={shell}>
        <SectionTitle title={s.data.title} subtitle={s.data.subtitle} />
        <ul className="mt-10 grid gap-x-10 @3xl:grid-cols-2 @5xl:grid-cols-3">
          {s.data.items.map((it) => (
            <li key={it.title} className="border-t border-site-line py-6">
              <h3 className="flex items-start justify-between gap-4 text-lg font-semibold leading-snug">
                {it.title}
                <span className="mt-2 h-px w-6 shrink-0 bg-site-accent" aria-hidden />
              </h3>
              {it.description && <p className="mt-2 text-[15px] leading-relaxed text-site-muted">{it.description}</p>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function About({ s, ctx }: { s: SectionOf<"about">; ctx: Ctx }) {
  return (
    <section id="sobre" className="py-16 @3xl:py-24">
      <div className={cn(shell, "grid items-center gap-10 @3xl:grid-cols-2 @5xl:gap-20")}>
        {s.data.image && (
          <img src={s.data.image} alt={`Espaço de ${ctx.spec.business.name}`} className="aspect-[5/4] w-full rounded-site object-cover" width={1000} height={800} loading="lazy" />
        )}
        <div>
          <SectionTitle title={s.data.title} />
          <p className="mt-5 whitespace-pre-line text-base leading-relaxed text-site-muted">{s.data.body}</p>
          {s.data.highlights.length > 0 && (
            <ul className="mt-7 grid gap-3 @md:grid-cols-2">
              {s.data.highlights.map((h) => (
                <li key={h} className="flex items-center gap-2.5 text-[15px] font-medium">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-site-tint text-[var(--site-primary-text)]">
                    <Check className="size-3.5" aria-hidden />
                  </span>
                  {h}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

export function Benefits({ s }: { s: SectionOf<"benefits"> }) {
  return (
    <section className="bg-site-tint py-16 @3xl:py-20">
      <div className={shell}>
        <SectionTitle title={s.data.title} />
        <div className="mt-10 grid gap-8 @3xl:grid-cols-3">
          {s.data.items.map((it) => (
            <div key={it.title}>
              <h3 className="text-lg font-semibold">{it.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-site-muted">{it.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Gallery({ s, ctx }: { s: SectionOf<"gallery">; ctx: Ctx }) {
  const imgs = s.data.images.filter(Boolean);
  if (!imgs.length) return null;
  return (
    <section className="py-16 @3xl:py-24">
      <div className={shell}>
        <SectionTitle title={s.data.title} />
        <div className="mt-10 grid grid-cols-2 gap-3 @3xl:grid-cols-3 @3xl:gap-4">
          {imgs.map((src, i) => (
            <img
              key={src + i}
              src={src}
              alt={`Foto ${i + 1} de ${ctx.spec.business.name}`}
              loading="lazy"
              width={900}
              height={900}
              className={cn("aspect-square size-full rounded-site object-cover", i === 0 && "col-span-2 aspect-[2/1] @3xl:col-span-2 @3xl:row-span-2 @3xl:aspect-auto")}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export function Testimonials({ s, ctx }: { s: SectionOf<"testimonials">; ctx: Ctx }) {
  return (
    <section className="py-16 @3xl:py-24">
      <div className={shell}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionTitle title={s.data.title} />
          <Rating spec={ctx.spec} />
        </div>
        <div className="mt-10 grid gap-4 @3xl:grid-cols-3">
          {s.data.items.map((t, i) => (
            <figure key={t.name + i} className={cn("rounded-site bg-site-card p-6", i === 1 && "@3xl:translate-y-6")}>
              <blockquote className="text-[15px] leading-relaxed">“{t.text}”</blockquote>
              <figcaption className="mt-4 text-sm font-semibold">{t.name}</figcaption>
            </figure>
          ))}
        </div>
        {s.data.illustrative && (
          <p className="mt-10 text-xs text-site-muted">Depoimentos ilustrativos no protótipo. Na versão final entram as avaliações reais dos clientes.</p>
        )}
      </div>
    </section>
  );
}

export function Faq({ s }: { s: SectionOf<"faq"> }) {
  return (
    <section className="py-16 @3xl:py-24">
      <div className={cn(shell, "grid gap-10 @5xl:grid-cols-[1fr_1.4fr]")}>
        <SectionTitle title={s.data.title} />
        <div className="divide-y divide-site-line border-y border-site-line">
          {s.data.items.map((q) => (
            <details key={q.question} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold [&::-webkit-details-marker]:hidden">
                {q.question}
                <ChevronDown className="size-5 shrink-0 transition-transform duration-200 group-open:rotate-180" aria-hidden />
              </summary>
              <p className="mt-3 text-[15px] leading-relaxed text-site-muted">{q.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Location({ s, ctx }: { s: SectionOf<"location">; ctx: Ctx }) {
  const b = ctx.spec.business;
  return (
    <section id="contato" className="py-16 @3xl:py-24">
      <div className={cn(shell, "grid gap-8 @3xl:grid-cols-2")}>
        <div>
          <SectionTitle title={s.data.title} />
          <div className="mt-8 space-y-6 text-[15px]">
            <div className="flex gap-3">
              <MapPin className="mt-0.5 size-5 shrink-0 text-[var(--site-primary-text)]" aria-hidden />
              <div>
                <p className="font-semibold">{b.address ?? [b.neighborhood, b.city].filter(Boolean).join(", ")}</p>
                <p className="text-site-muted">
                  {b.city} - {b.state}
                </p>
                {s.data.note && <p className="mt-1 text-site-muted">{s.data.note}</p>}
              </div>
            </div>
            {b.hours.length > 0 && (
              <div className="flex gap-3">
                <Clock className="mt-0.5 size-5 shrink-0 text-[var(--site-primary-text)]" aria-hidden />
                <ul className="space-y-1">
                  {b.hours.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </div>
            )}
            {b.phone && (
              <div className="flex gap-3">
                <Phone className="mt-0.5 size-5 shrink-0 text-[var(--site-primary-text)]" aria-hidden />
                <p>{formatPhone(b.phone)}</p>
              </div>
            )}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <WaButton href={ctx.mapsHref} variant="outline">
              <MapPin className="size-4" aria-hidden /> Ver no mapa
            </WaButton>
          </div>
        </div>
        {/* Bloco de "mapa" sem iframe de terceiros: leve e sem cookies (LGPD) */}
        <a
          href={ctx.mapsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="relative flex min-h-64 flex-col justify-end overflow-hidden rounded-site bg-site-tint p-6"
          aria-label={`Abrir ${b.name} no mapa`}
        >
          <svg className="absolute inset-0 size-full text-site-line" aria-hidden>
            <defs>
              <pattern id="ruas" width="46" height="46" patternUnits="userSpaceOnUse" patternTransform="rotate(-12)">
                <path d="M0 23h46M23 0v46" stroke="currentColor" strokeWidth="6" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#ruas)" />
          </svg>
          <span className="absolute left-1/2 top-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-site-primary text-site-on-primary shadow-lg">
            <MapPin className="size-6" aria-hidden />
          </span>
          <span className={cn(heading, "relative text-2xl")}>{b.neighborhood ?? b.city}</span>
          <span className="relative text-sm text-site-muted">{b.city} - {b.state}</span>
        </a>
      </div>
    </section>
  );
}

export function Contact({ s, ctx }: { s: SectionOf<"contact">; ctx: Ctx }) {
  const b = ctx.spec.business;
  return (
    <section className="py-16 @3xl:py-24">
      <div className={cn(shell, "text-center")}>
        <SectionTitle title={s.data.title} subtitle={s.data.subtitle} center />
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <WaButton href={ctx.waHref}>
            <MessageCircle className="size-5" aria-hidden />
            {s.data.ctaLabel}
          </WaButton>
          {b.instagram && (
            <WaButton href={`https://instagram.com/${b.instagram}`} variant="outline">
              <Instagram className="size-4" aria-hidden />@{b.instagram}
            </WaButton>
          )}
        </div>
      </div>
    </section>
  );
}

export function Cta({ s, ctx }: { s: SectionOf<"cta">; ctx: Ctx }) {
  return (
    <section className="px-3 py-10 @3xl:px-6">
      <div className="mx-auto max-w-6xl rounded-site bg-site-primary px-6 py-14 text-site-on-primary @3xl:px-14 @3xl:py-16">
        <div className="grid items-center gap-8 @3xl:grid-cols-[1.4fr_auto]">
          <div>
            <h2 className={cn(heading, "text-3xl leading-[1.08] @3xl:text-4xl")}>{s.data.title}</h2>
            {s.data.subtitle && <p className="mt-3 text-base opacity-85">{s.data.subtitle}</p>}
          </div>
          <WaButton href={ctx.waHref} variant="light">
            <MessageCircle className="size-5" aria-hidden />
            {s.data.ctaLabel}
          </WaButton>
        </div>
      </div>
    </section>
  );
}

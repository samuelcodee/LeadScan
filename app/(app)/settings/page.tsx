import type { Metadata } from "next";
import { Check, CircleDashed } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { DataActions, ProfileForm, SuppressionForm } from "@/components/settings/settings-forms";
import { aiUsageSummary } from "@/lib/ai";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { integrationStatus } from "@/lib/env";
import { formatInt } from "@/lib/format";
import { DEMO_USER_NAME } from "@/lib/outreach/service";
import { listProviders } from "@/lib/providers";
import { cn } from "@/lib/utils";
import { formatPhone } from "@/lib/whatsapp/phone";

export const metadata: Metadata = { title: "Configurações" };

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-6 border-t py-8 lg:grid-cols-[260px_minmax(0,1fr)]">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function Status({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", on ? "text-success" : "text-muted-foreground")}>
      {on ? <Check className="size-3.5" /> : <CircleDashed className="size-3.5" />}
      {children}
    </span>
  );
}

export default async function SettingsPage() {
  const user = await requireUser();
  const status = integrationStatus();
  const providers = listProviders();
  const [usage, suppressed] = await Promise.all([aiUsageSummary(), db.suppression.count()]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader title="Configurações" description="Perfil, fontes de dados, IA e privacidade." />
      <div className="mt-6">
        <Section title="Dados comerciais" description="Usados nas mensagens e na página de proposta que o cliente vê. Foto, bio e @ ficam em Perfil.">
          <ProfileForm
            initial={{
              name: user.isDemo && user.name === DEMO_USER_NAME ? "" : user.name,
              agencyName: user.agencyName ?? "",
              whatsapp: formatPhone(user.whatsapp) ?? "",
              defaultTicketReais: user.defaultTicket / 100,
            }}
          />
        </Section>

        <Section title="Fontes de dados" description="De onde vêm as empresas. Configure as chaves no arquivo .env (nunca no navegador).">
          <ul className="divide-y rounded-lg border bg-card">
            {providers.map((p) => (
              <li key={p.id} className="grid gap-1 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <p className="font-medium">
                    {p.label}
                    {status.dataProvider === p.id && <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[11px] font-medium">padrão</span>}
                  </p>
                  <p className="text-sm text-muted-foreground">{p.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Avaliações: {p.capabilities.reviews ? "sim" : "não"} · Instagram: {p.capabilities.instagram ? "quando mapeado" : "não"} · até{" "}
                    {formatInt(p.capabilities.maxResults)} por consulta
                  </p>
                </div>
                <Status on={p.configured}>{p.configured ? "Pronto" : p.id === "google" ? "Defina MAPS_API_KEY" : "Indisponível"}</Status>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Padrão atual: <code className="font-mono">DATA_PROVIDER={status.dataProvider}</code>. Para adicionar outra API, implemente a interface DataProvider em
            lib/providers.
          </p>
        </Section>

        <Section title="Plataforma" description="Serviços configurados por quem administra esta instalação (arquivo .env). Nada disso aparece para o navegador.">
          <ul className="divide-y rounded-lg border bg-card text-sm">
            {[
              ["Login com Google", status.googleLogin, "AUTH_GOOGLE_ID e AUTH_GOOGLE_SECRET"],
              ["Códigos por e-mail", Boolean(status.emailSender), "RESEND_API_KEY (sem ela, só em desenvolvimento)"],
              ["Códigos por SMS", Boolean(status.smsSender), "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN e TWILIO_FROM"],
              ["Moderação de fotos (+18)", status.moderation !== "none", "MODERATION_PROVIDER=openai + MODERATION_API_KEY"],
              ["Mercado Pago (Pix e cartão)", status.mercadopago, "MP_CLIENT_ID, MP_CLIENT_SECRET e MP_WEBHOOK_SECRET"],
              ["Stripe", status.stripe, "STRIPE_SECRET_KEY e STRIPE_WEBHOOK_SECRET"],
              ["Pagamentos de teste", status.mockPayments, "PAYMENTS_MOCK (ligado no modo demo)"],
              ["Google Maps (Places)", status.googleConfigured, "MAPS_API_KEY"],
            ].map(([label, on, hint]) => (
              <li key={label as string} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span className="font-medium">{label as string}</span>
                <Status on={on as boolean}>{on ? "Ativo" : (hint as string)}</Status>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Suas IAs pessoais (Claude, ChatGPT, Gemini…) ficam em{" "}
            <a href="/integracoes" className="underline underline-offset-4">
              Integrações de IA
            </a>
            ; contas de recebimento, em{" "}
            <a href="/financeiro#contas" className="underline underline-offset-4">
              Financeiro
            </a>
            .
          </p>
        </Section>

        <Section title="Inteligência artificial" description="Opcional. Sem IA, abordagens e sites saem dos templates, com custo zero.">
          <div className="rounded-lg border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{status.aiConfigured ? `Provedor: ${status.aiProvider}` : "IA desligada"}</p>
              <Status on={status.aiConfigured}>{status.aiConfigured ? `Modelo ${status.aiModel ?? "padrão"}` : "Defina AI_PROVIDER e AI_API_KEY"}</Status>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              {[
                ["Gerações", usage.generations],
                ["Reaproveitadas do cache", usage.cacheHits],
                ["Tokens de entrada", usage.inputTokens],
                ["Tokens de saída", usage.outputTokens],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-0.5 font-mono text-lg font-semibold tabular">{formatInt(value as number)}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-muted-foreground">
              Score, filtros, links, templates e a primeira versão das mensagens são calculados por código. A IA só entra quando você liga “Personalizar com IA”, recebe
              o mínimo de contexto (sem telefone nem endereço) e cada resposta fica em cache.
            </p>
          </div>
        </Section>

        <Section title="Privacidade e LGPD" description="Só dados comerciais públicos. Empresas podem pedir remoção pela página da proposta ou por aqui.">
          <div className="grid gap-6">
            <div>
              <p className="text-sm font-medium">Registrar pedido de remoção</p>
              <p className="mb-3 text-xs text-muted-foreground">
                A empresa deixa de aparecer em buscas futuras (na plataforma toda). {formatInt(suppressed)} pedido(s) registrado(s).
              </p>
              <SuppressionForm />
            </div>
            <div className="border-t pt-6">
              <p className="mb-3 text-sm font-medium">Seus dados</p>
              <DataActions isDemo={user.isDemo} />
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Terminal } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { AiProviderCards } from "@/components/integrations/ai-cards";
import { HANDOFF_TOOLS } from "@/lib/ai/catalog";
import { availableProviders, listConnections } from "@/lib/ai/connections";
import { requireUser } from "@/lib/auth/session";
import { integrationStatus } from "@/lib/env";

export const metadata: Metadata = { title: "Integrações de IA" };

const KIND_LABEL = { site: "Cria o site", chat: "Chat", video: "Vídeo", code: "Código" } as const;

export default async function IntegrationsPage() {
  const user = await requireUser();
  const connections = await listConnections(user.id);
  const status = integrationStatus();

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        title="Integrações de IA"
        description="Conecte a sua conta nas IAs que você já usa. O site nasce aqui com um clique e pode ser levado para a ferramenta que preferir."
      />

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-semibold">Com a sua chave</h2>
            <p className="text-sm text-muted-foreground">
              Usadas dentro da plataforma: reescrever o site inteiro, gerar mensagens e criar imagens de capa. Você paga só o que usar, direto no provedor.
            </p>
          </div>
          {status.aiConfigured && (
            <p className="text-xs text-muted-foreground">Sem conexão própria, a plataforma usa a IA da instalação ({status.aiProvider}).</p>
          )}
        </div>
        <AiProviderCards providers={availableProviders()} connections={connections} defaultId={user.aiDefault} />
      </section>

      <section className="mt-10">
        <h2 className="font-semibold">Levar o site para outras ferramentas</h2>
        <p className="text-sm text-muted-foreground">
          Sem chave e sem configurar nada: no estúdio do protótipo, em <span className="font-medium text-foreground">IA → Levar para…</span>, o briefing completo do site
          (textos, cores, fotos e dados reais do cliente) abre na ferramenta escolhida e também vai para a área de transferência.
        </p>
        <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {HANDOFF_TOOLS.map((t) => (
            <li key={t.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{t.name}</p>
                <span className="text-[11px] text-muted-foreground">{KIND_LABEL[t.kind]}</span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
              <p className="mt-1.5 text-[11px] text-muted-foreground">{t.prefill ? "Abre com o pedido preenchido" : "Abre a ferramenta; o briefing vai copiado"}</p>
            </li>
          ))}
          <li className="rounded-lg border p-3 sm:col-span-2 lg:col-span-3">
            <div className="flex items-center gap-2">
              <Terminal className="size-4" />
              <p className="text-sm font-medium">Claude Code</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              No estúdio, “Baixar briefing para Claude Code” gera um arquivo .md com o site inteiro (inclusive o JSON). Numa pasta vazia, rode:
            </p>
            <pre className="mt-2 overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs">claude &quot;Leia briefing-site.md e construa este site. Rode e confira no celular.&quot;</pre>
          </li>
        </ul>
        <Link href="/prototypes" className="mt-4 inline-flex items-center gap-1 text-sm font-medium hover:underline">
          Ir para os protótipos <ArrowRight className="size-4" />
        </Link>
      </section>

      <section className="mt-10 rounded-lg border border-dashed p-4 text-xs leading-relaxed text-muted-foreground">
        <p className="font-medium text-foreground">O que vai para a IA</p>
        <p className="mt-1">
          Só o necessário para escrever: nome e segmento do negócio, cidade/bairro, serviços e sinais públicos (tem site? nota no Google?). Telefone, endereço completo, suas
          notas e dados de CRM nunca são enviados. Cada resposta fica em cache: o mesmo pedido não é cobrado duas vezes.
        </p>
      </section>
    </div>
  );
}

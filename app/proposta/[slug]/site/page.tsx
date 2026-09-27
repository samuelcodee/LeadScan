import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteRenderer } from "@/components/site/site-renderer";
import { getPublicProposal } from "@/lib/prototypes/public";

export async function generateMetadata(props: PageProps<"/proposta/[slug]/site">): Promise<Metadata> {
  const { slug } = await props.params;
  const p = await getPublicProposal(slug);
  return p ? { title: p.spec.seo.title, description: p.spec.seo.description, robots: { index: false } } : { title: "Não encontrado" };
}

/** O protótipo em tela cheia, como um site de verdade (para abrir no celular do cliente). */
export default async function ProposalSitePage(props: PageProps<"/proposta/[slug]/site">) {
  const { slug } = await props.params;
  const p = await getPublicProposal(slug);
  if (!p) notFound();
  return <SiteRenderer spec={p.spec} mode="page" className="min-h-dvh" />;
}

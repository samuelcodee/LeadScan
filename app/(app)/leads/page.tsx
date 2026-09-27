import type { Metadata } from "next";
import { LeadsPage } from "@/components/leads/leads-page";

export const metadata: Metadata = { title: "Meus leads" };

export default async function Page(props: PageProps<"/leads">) {
  return <LeadsPage searchParams={await props.searchParams} />;
}

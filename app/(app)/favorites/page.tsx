import type { Metadata } from "next";
import { LeadsPage } from "@/components/leads/leads-page";

export const metadata: Metadata = { title: "Favoritos" };

export default async function Page(props: PageProps<"/favorites">) {
  return <LeadsPage searchParams={await props.searchParams} favorites />;
}

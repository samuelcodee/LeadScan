import { NextResponse, type NextRequest } from "next/server";
import { citiesOfState, resolveMunicipality, suggestMunicipalities } from "@/lib/domain/municipalities";

/**
 * Municípios do IBGE para o formulário de busca.
 *   ?uf=CE           → todas as cidades do estado
 *   ?q=quixa         → sugestões em todo o Brasil
 *   ?resolve=Quixadá → município + UF (ou opções, se o nome se repete)
 * Dados públicos e estáticos: cache longo.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const uf = sp.get("uf");
  const headers = { "Cache-Control": "private, max-age=86400" };
  if (sp.get("resolve")) return NextResponse.json(resolveMunicipality(sp.get("resolve")!, uf), { headers });
  if (sp.get("q")) return NextResponse.json({ cities: suggestMunicipalities(sp.get("q")!) }, { headers });
  if (uf && /^[A-Za-z]{2}$/.test(uf)) return NextResponse.json({ uf: uf.toUpperCase(), cities: citiesOfState(uf) }, { headers });
  return NextResponse.json({ error: "Informe uf, q ou resolve." }, { status: 400 });
}

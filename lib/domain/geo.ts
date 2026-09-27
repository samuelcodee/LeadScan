import { fold } from "@/lib/format";

export type State = { uf: string; name: string; ddd: string };
export type City = { name: string; uf: string; ddd: string; neighborhoods?: string[] };

export const STATES: State[] = [
  { uf: "AC", name: "Acre", ddd: "68" },
  { uf: "AL", name: "Alagoas", ddd: "82" },
  { uf: "AP", name: "Amapá", ddd: "96" },
  { uf: "AM", name: "Amazonas", ddd: "92" },
  { uf: "BA", name: "Bahia", ddd: "71" },
  { uf: "CE", name: "Ceará", ddd: "85" },
  { uf: "DF", name: "Distrito Federal", ddd: "61" },
  { uf: "ES", name: "Espírito Santo", ddd: "27" },
  { uf: "GO", name: "Goiás", ddd: "62" },
  { uf: "MA", name: "Maranhão", ddd: "98" },
  { uf: "MT", name: "Mato Grosso", ddd: "65" },
  { uf: "MS", name: "Mato Grosso do Sul", ddd: "67" },
  { uf: "MG", name: "Minas Gerais", ddd: "31" },
  { uf: "PA", name: "Pará", ddd: "91" },
  { uf: "PB", name: "Paraíba", ddd: "83" },
  { uf: "PR", name: "Paraná", ddd: "41" },
  { uf: "PE", name: "Pernambuco", ddd: "81" },
  { uf: "PI", name: "Piauí", ddd: "86" },
  { uf: "RJ", name: "Rio de Janeiro", ddd: "21" },
  { uf: "RN", name: "Rio Grande do Norte", ddd: "84" },
  { uf: "RS", name: "Rio Grande do Sul", ddd: "51" },
  { uf: "RO", name: "Rondônia", ddd: "69" },
  { uf: "RR", name: "Roraima", ddd: "95" },
  { uf: "SC", name: "Santa Catarina", ddd: "48" },
  { uf: "SP", name: "São Paulo", ddd: "11" },
  { uf: "SE", name: "Sergipe", ddd: "79" },
  { uf: "TO", name: "Tocantins", ddd: "63" },
];

/** Capitais e principais cidades. Qualquer outra cidade pode ser digitada livremente. */
export const CITIES: City[] = [
  { name: "Fortaleza", uf: "CE", ddd: "85", neighborhoods: ["Aldeota", "Meireles", "Cocó", "Varjota", "Papicu", "Benfica", "Centro", "Messejana"] },
  { name: "Caucaia", uf: "CE", ddd: "85", neighborhoods: ["Centro", "Icaraí", "Jurema", "Cumbuco"] },
  { name: "Maracanaú", uf: "CE", ddd: "85", neighborhoods: ["Centro", "Jereissati", "Pajuçara"] },
  { name: "Juazeiro do Norte", uf: "CE", ddd: "88", neighborhoods: ["Centro", "Lagoa Seca", "Triângulo"] },
  { name: "Sobral", uf: "CE", ddd: "88", neighborhoods: ["Centro", "Derby", "Campo dos Velhos"] },
  { name: "São Paulo", uf: "SP", ddd: "11", neighborhoods: ["Pinheiros", "Moema", "Vila Mariana", "Tatuapé", "Santana", "Itaim Bibi", "Perdizes", "Mooca"] },
  { name: "Campinas", uf: "SP", ddd: "19", neighborhoods: ["Cambuí", "Taquaral", "Barão Geraldo", "Centro"] },
  { name: "Santos", uf: "SP", ddd: "13", neighborhoods: ["Gonzaga", "Boqueirão", "Ponta da Praia", "Aparecida"] },
  { name: "Ribeirão Preto", uf: "SP", ddd: "16", neighborhoods: ["Jardim Botânico", "Centro", "Ribeirânia"] },
  { name: "Guarulhos", uf: "SP", ddd: "11", neighborhoods: ["Centro", "Vila Galvão", "Macedo"] },
  { name: "Santo André", uf: "SP", ddd: "11", neighborhoods: ["Centro", "Jardim", "Vila Assunção"] },
  { name: "Sorocaba", uf: "SP", ddd: "15", neighborhoods: ["Campolim", "Centro", "Jardim Europa"] },
  { name: "Rio de Janeiro", uf: "RJ", ddd: "21", neighborhoods: ["Botafogo", "Copacabana", "Tijuca", "Barra da Tijuca", "Leblon", "Flamengo", "Méier"] },
  { name: "Niterói", uf: "RJ", ddd: "21", neighborhoods: ["Icaraí", "Santa Rosa", "Centro", "São Francisco"] },
  { name: "Recife", uf: "PE", ddd: "81", neighborhoods: ["Boa Viagem", "Casa Forte", "Espinheiro", "Graças", "Pina", "Madalena"] },
  { name: "Olinda", uf: "PE", ddd: "81", neighborhoods: ["Casa Caiada", "Bairro Novo", "Carmo"] },
  { name: "Jaboatão dos Guararapes", uf: "PE", ddd: "81", neighborhoods: ["Piedade", "Candeias", "Prazeres"] },
  { name: "Salvador", uf: "BA", ddd: "71", neighborhoods: ["Pituba", "Barra", "Rio Vermelho", "Itaigara", "Graça", "Caminho das Árvores"] },
  { name: "Feira de Santana", uf: "BA", ddd: "75", neighborhoods: ["Centro", "Santa Mônica", "Capuchinhos"] },
  { name: "Belo Horizonte", uf: "MG", ddd: "31", neighborhoods: ["Savassi", "Funcionários", "Lourdes", "Pampulha", "Buritis", "Sion"] },
  { name: "Uberlândia", uf: "MG", ddd: "34", neighborhoods: ["Centro", "Santa Mônica", "Jardim Karaíba"] },
  { name: "Juiz de Fora", uf: "MG", ddd: "32", neighborhoods: ["Centro", "São Mateus", "Cascatinha"] },
  { name: "Contagem", uf: "MG", ddd: "31", neighborhoods: ["Eldorado", "Centro", "Riacho"] },
  { name: "Curitiba", uf: "PR", ddd: "41", neighborhoods: ["Batel", "Água Verde", "Bigorrilho", "Centro", "Ecoville"] },
  { name: "Londrina", uf: "PR", ddd: "43", neighborhoods: ["Gleba Palhano", "Centro", "Jardim Higienópolis"] },
  { name: "Maringá", uf: "PR", ddd: "44", neighborhoods: ["Zona 7", "Centro", "Novo Centro"] },
  { name: "Porto Alegre", uf: "RS", ddd: "51", neighborhoods: ["Moinhos de Vento", "Bela Vista", "Cidade Baixa", "Menino Deus", "Petrópolis"] },
  { name: "Caxias do Sul", uf: "RS", ddd: "54", neighborhoods: ["Centro", "Exposição", "São Pelegrino"] },
  { name: "Florianópolis", uf: "SC", ddd: "48", neighborhoods: ["Centro", "Trindade", "Lagoa da Conceição", "Jurerê", "Itacorubi"] },
  { name: "Joinville", uf: "SC", ddd: "47", neighborhoods: ["Centro", "América", "Glória"] },
  { name: "Balneário Camboriú", uf: "SC", ddd: "47", neighborhoods: ["Centro", "Pioneiros", "Barra Sul"] },
  { name: "Brasília", uf: "DF", ddd: "61", neighborhoods: ["Asa Sul", "Asa Norte", "Lago Sul", "Águas Claras", "Sudoeste"] },
  { name: "Goiânia", uf: "GO", ddd: "62", neighborhoods: ["Setor Bueno", "Setor Marista", "Setor Oeste", "Jardim Goiás"] },
  { name: "Manaus", uf: "AM", ddd: "92", neighborhoods: ["Adrianópolis", "Vieiralves", "Ponta Negra", "Centro"] },
  { name: "Belém", uf: "PA", ddd: "91", neighborhoods: ["Umarizal", "Nazaré", "Batista Campos", "Marco"] },
  { name: "São Luís", uf: "MA", ddd: "98", neighborhoods: ["Renascença", "Ponta d'Areia", "Calhau", "Cohama"] },
  { name: "Teresina", uf: "PI", ddd: "86", neighborhoods: ["Jóquei", "Fátima", "Centro", "Ininga"] },
  { name: "Natal", uf: "RN", ddd: "84", neighborhoods: ["Ponta Negra", "Tirol", "Petrópolis", "Lagoa Nova"] },
  { name: "João Pessoa", uf: "PB", ddd: "83", neighborhoods: ["Manaíra", "Tambaú", "Cabo Branco", "Bessa"] },
  { name: "Campina Grande", uf: "PB", ddd: "83", neighborhoods: ["Centro", "Catolé", "Alto Branco"] },
  { name: "Maceió", uf: "AL", ddd: "82", neighborhoods: ["Ponta Verde", "Pajuçara", "Jatiúca", "Farol"] },
  { name: "Aracaju", uf: "SE", ddd: "79", neighborhoods: ["Jardins", "Atalaia", "Treze de Julho", "Grageru"] },
  { name: "Vitória", uf: "ES", ddd: "27", neighborhoods: ["Praia do Canto", "Jardim da Penha", "Centro", "Enseada do Suá"] },
  { name: "Vila Velha", uf: "ES", ddd: "27", neighborhoods: ["Praia da Costa", "Itapuã", "Centro"] },
  { name: "Cuiabá", uf: "MT", ddd: "65", neighborhoods: ["Centro", "Goiabeiras", "Jardim das Américas"] },
  { name: "Campo Grande", uf: "MS", ddd: "67", neighborhoods: ["Centro", "Jardim dos Estados", "Chácara Cachoeira"] },
  { name: "Porto Velho", uf: "RO", ddd: "69", neighborhoods: ["Centro", "Olaria", "Embratel"] },
  { name: "Rio Branco", uf: "AC", ddd: "68", neighborhoods: ["Centro", "Bosque", "Jardim Europa"] },
  { name: "Macapá", uf: "AP", ddd: "96", neighborhoods: ["Centro", "Trem", "Jesus de Nazaré"] },
  { name: "Boa Vista", uf: "RR", ddd: "95", neighborhoods: ["Centro", "Aparecida", "Canarinho"] },
  { name: "Palmas", uf: "TO", ddd: "63", neighborhoods: ["Plano Diretor Sul", "Plano Diretor Norte", "Centro"] },
];

const GENERIC_NEIGHBORHOODS = ["Centro", "Jardim América", "Vila Nova", "São José", "Santa Cruz"];

export function getState(uf: string) {
  return STATES.find((s) => s.uf === uf.toUpperCase());
}

export function findCity(name: string, uf?: string): City | undefined {
  const n = fold(name);
  return CITIES.find((c) => fold(c.name) === n && (!uf || c.uf === uf.toUpperCase()));
}

export function neighborhoodsFor(city: string, uf: string) {
  return findCity(city, uf)?.neighborhoods ?? GENERIC_NEIGHBORHOODS;
}

export function dddFor(city: string, uf: string) {
  return findCity(city, uf)?.ddd ?? getState(uf)?.ddd ?? "11";
}

export function formatLocation(city: string, uf: string) {
  return `${city} - ${uf}`;
}

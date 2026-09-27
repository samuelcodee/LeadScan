/**
 * npm run db:seed — cria o usuário de demonstração com dados fictícios (marcados como DEMO).
 * Roda com a condição "react-server" para poder importar os módulos server-only do app.
 */
import "dotenv/config";
import { seedCommunityDemo, seedDemoFinance } from "@/lib/demo/community";
import { ensureDemoUser, seedDemoData } from "@/lib/demo/seed";

async function main() {
  const user = await ensureDemoUser();
  const result = await seedDemoData(user.id);
  console.log(result.skipped ? "Demo já populada — nada a fazer." : `Demo populada: ${result.leads} leads.`);
  const community = await seedCommunityDemo();
  console.log(community.skipped ? "Comunidade demo já existe." : `Comunidade demo: ${community.members} membros.`);
  const finance = await seedDemoFinance(user.id);
  console.log(finance.skipped ? "Financeiro demo já existe." : "Financeiro demo criado.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

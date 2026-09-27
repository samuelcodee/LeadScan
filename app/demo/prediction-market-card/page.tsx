"use client";

import { PredictionMarketCard } from "@/components/ui/prediction-market-card";

// O logo padrão do componente (Wikimedia) responde 400; aqui usamos uma foto do Unsplash.
const TEAM_LOGO = "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=128&h=128&q=70";

export default function Page() {
  return (
    <div className="min-h-screen p-4 bg-background flex items-center justify-center">
      <PredictionMarketCard teamLogo={TEAM_LOGO} />
    </div>
  );
}

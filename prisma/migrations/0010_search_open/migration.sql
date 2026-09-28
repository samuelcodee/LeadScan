-- Busca aberta: "Buscar leads" volta para a última busca aberta até a pessoa fechar.

-- AlterTable
ALTER TABLE "Search" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Buscas antigas: aberta = quando foi feita
UPDATE "Search" SET "openedAt" = "createdAt";

-- CreateIndex
CREATE INDEX "Search_userId_openedAt_idx" ON "Search"("userId", "openedAt" DESC);

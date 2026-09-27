-- Contador mensal de requisições a APIs pagas (trava da cota grátis do Google Maps).

-- CreateTable
CREATE TABLE "ApiUsage" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiUsage_pkey" PRIMARY KEY ("key")
);


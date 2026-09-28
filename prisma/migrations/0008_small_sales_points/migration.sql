-- Vendas pagas pela plataforma abaixo do mínimo passam a pontuar (1 ponto a cada R$ 10, mínimo 1),
-- sem o bônus de 100. Antes ficavam com 0 e não apareciam no ranking nem no perfil.
UPDATE "Sale"
SET "points" = GREATEST(1, LEAST(1000, FLOOR("amountCents" / 1000)))
WHERE "verified" = true AND "source" = 'PLATFORM' AND "points" = 0 AND "amountCents" > 0;

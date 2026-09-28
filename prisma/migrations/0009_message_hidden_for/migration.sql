-- "Apagar para mim": a mensagem some só para quem pediu (remetente ou destinatário)
ALTER TABLE "Message" ADD COLUMN "hiddenFor" TEXT[] DEFAULT ARRAY[]::TEXT[];

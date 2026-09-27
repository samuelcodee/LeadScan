-- Busca em varredura (SearchSweep), amizades e pedidos de mensagem, dados bancários/Pix e Arquivos.

-- CreateEnum
CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "InboxStatus" AS ENUM ('ACCEPTED', 'REQUEST', 'DECLINED');

-- CreateEnum
CREATE TYPE "MessagePolicy" AS ENUM ('EVERYONE', 'FRIENDS');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MediaKind" ADD VALUE 'FILE_VIDEO';
ALTER TYPE "MediaKind" ADD VALUE 'FILE_AUDIO';

-- DropIndex
DROP INDEX "ConversationMember_userId_idx";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "messagesFrom" "MessagePolicy" NOT NULL DEFAULT 'EVERYONE';

-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "name" TEXT;

-- AlterTable
ALTER TABLE "Charge" ADD COLUMN     "bankAccountId" TEXT,
ADD COLUMN     "pixCode" TEXT;

-- AlterTable
ALTER TABLE "ConversationMember" ADD COLUMN     "inbox" "InboxStatus" NOT NULL DEFAULT 'ACCEPTED';

-- CreateTable
CREATE TABLE "Friendship" (
    "id" TEXT NOT NULL,
    "pairKey" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "addresseeId" TEXT NOT NULL,
    "status" "FriendshipStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchSweep" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "cursor" JSONB,
    "found" INTEGER NOT NULL DEFAULT 0,
    "exhausted" BOOLEAN NOT NULL DEFAULT false,
    "exhaustedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchSweep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "accountEnc" TEXT NOT NULL,
    "accountLast4" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "holderName" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT '',
    "documentEnc" TEXT NOT NULL,
    "documentHint" TEXT NOT NULL,
    "pixKeyType" TEXT,
    "pixKeyEnc" TEXT,
    "pixKeyHint" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_pairKey_key" ON "Friendship"("pairKey");

-- CreateIndex
CREATE INDEX "Friendship_addresseeId_status_idx" ON "Friendship"("addresseeId", "status");

-- CreateIndex
CREATE INDEX "Friendship_requesterId_status_idx" ON "Friendship"("requesterId", "status");

-- CreateIndex
CREATE INDEX "SearchSweep_userId_provider_exhausted_idx" ON "SearchSweep"("userId", "provider", "exhausted");

-- CreateIndex
CREATE UNIQUE INDEX "SearchSweep_userId_provider_category_city_state_key" ON "SearchSweep"("userId", "provider", "category", "city", "state");

-- CreateIndex
CREATE INDEX "BankAccount_userId_idx" ON "BankAccount"("userId");

-- CreateIndex
CREATE INDEX "ConversationMember_userId_inbox_idx" ON "ConversationMember"("userId", "inbox");

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_addresseeId_fkey" FOREIGN KEY ("addresseeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchSweep" ADD CONSTRAINT "SearchSweep_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


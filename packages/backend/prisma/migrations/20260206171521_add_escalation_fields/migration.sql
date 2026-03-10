-- AlterTable
ALTER TABLE "Call" ADD COLUMN     "agentJoinedAt" TIMESTAMP(3),
ADD COLUMN     "escalatedAt" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "outcome" TEXT;

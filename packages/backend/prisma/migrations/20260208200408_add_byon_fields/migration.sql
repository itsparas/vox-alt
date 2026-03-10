-- AlterTable
ALTER TABLE "PhoneNumber" ADD COLUMN     "businessNumber" TEXT,
ADD COLUMN     "forwardingSetup" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "numberType" TEXT NOT NULL DEFAULT 'twilio';

-- AlterTable
ALTER TABLE "Message" ADD COLUMN "attachmentName" TEXT;
ALTER TABLE "Message" ADD COLUMN "attachmentSize" INTEGER;
ALTER TABLE "Message" ADD COLUMN "attachmentType" TEXT;
ALTER TABLE "Message" ADD COLUMN "attachmentUrl" TEXT;
ALTER TABLE "Message" ADD COLUMN "editedAt" DATETIME;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "avatarEmoji" TEXT;
ALTER TABLE "User" ADD COLUMN "lastSeenAt" DATETIME;

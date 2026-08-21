ALTER TABLE "MediaAsset" ADD COLUMN "messageId" TEXT;

CREATE INDEX "MediaAsset_messageId_createdAt_idx" ON "MediaAsset"("messageId", "createdAt");

ALTER TABLE "MediaAsset"
ADD CONSTRAINT "MediaAsset_messageId_fkey"
FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Keep a stable source reference for idempotent notifications. Nullable values
-- preserve the existing notifications that predate this migration.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CALL_INVITE';

ALTER TABLE "Notification"
  ADD COLUMN IF NOT EXISTS "sourceKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Notification_recipientId_sourceKey_key"
  ON "Notification"("recipientId", "sourceKey");

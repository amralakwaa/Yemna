ALTER TABLE "UserSettings"
  ADD COLUMN "locale" VARCHAR(8) NOT NULL DEFAULT 'ar',
  ADD COLUMN "region" VARCHAR(2) NOT NULL DEFAULT 'YE';

ALTER TABLE "User"
  ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "twoFactorSecretEncrypted" TEXT,
  ADD COLUMN "twoFactorPendingSecretEncrypted" TEXT,
  ADD COLUMN "twoFactorPendingExpiresAt" TIMESTAMP(3);

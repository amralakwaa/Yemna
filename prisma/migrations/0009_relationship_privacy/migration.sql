-- Add Facebook-like privacy controls for relationship actions.
DO $$
BEGIN
  CREATE TYPE "RelationPermission" AS ENUM ('EVERYONE', 'FRIENDS', 'NOBODY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "UserSettings"
  ADD COLUMN IF NOT EXISTS "friendRequestPermission" "RelationPermission" NOT NULL DEFAULT 'EVERYONE',
  ADD COLUMN IF NOT EXISTS "followPermission" "RelationPermission" NOT NULL DEFAULT 'EVERYONE';

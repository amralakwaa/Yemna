CREATE TABLE "FriendSuggestionDismissal" (
    "id" TEXT NOT NULL,
    "dismissingUserId" TEXT NOT NULL,
    "dismissedUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FriendSuggestionDismissal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FriendSuggestionDismissal_dismissingUserId_dismissedUserId_key"
ON "FriendSuggestionDismissal"("dismissingUserId", "dismissedUserId");

CREATE INDEX "FriendSuggestionDismissal_dismissingUserId_createdAt_idx"
ON "FriendSuggestionDismissal"("dismissingUserId", "createdAt");

ALTER TABLE "FriendSuggestionDismissal"
ADD CONSTRAINT "FriendSuggestionDismissal_dismissingUserId_fkey"
FOREIGN KEY ("dismissingUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FriendSuggestionDismissal"
ADD CONSTRAINT "FriendSuggestionDismissal_dismissedUserId_fkey"
FOREIGN KEY ("dismissedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

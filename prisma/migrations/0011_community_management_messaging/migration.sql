-- Link each community to one durable GROUP conversation. Existing communities
-- remain valid until their conversation is initialized on the first membership
-- or messaging operation.
ALTER TABLE "Community" ADD COLUMN "conversationId" TEXT;

CREATE UNIQUE INDEX "Community_conversationId_key" ON "Community"("conversationId");

ALTER TABLE "Community"
ADD CONSTRAINT "Community_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

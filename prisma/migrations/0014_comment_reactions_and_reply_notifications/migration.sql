ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'COMMENT_REPLY';

CREATE TABLE IF NOT EXISTS "CommentReaction" (
  "id" TEXT NOT NULL,
  "commentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "ReactionType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommentReaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CommentReaction_userId_commentId_key"
  ON "CommentReaction"("userId", "commentId");

CREATE INDEX IF NOT EXISTS "CommentReaction_commentId_createdAt_idx"
  ON "CommentReaction"("commentId", "createdAt");

ALTER TABLE "CommentReaction"
  ADD CONSTRAINT "CommentReaction_commentId_fkey"
  FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommentReaction"
  ADD CONSTRAINT "CommentReaction_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

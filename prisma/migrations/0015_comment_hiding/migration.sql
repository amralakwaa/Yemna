-- Store a viewer's personal decision to hide a comment without altering the original comment.
CREATE TABLE "CommentHide" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentHide_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommentHide_userId_commentId_key" ON "CommentHide"("userId", "commentId");
CREATE INDEX "CommentHide_commentId_createdAt_idx" ON "CommentHide"("commentId", "createdAt");

ALTER TABLE "CommentHide" ADD CONSTRAINT "CommentHide_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommentHide" ADD CONSTRAINT "CommentHide_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add construction issues fields to PublicPin
ALTER TABLE "PublicPin" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'feedback';
ALTER TABLE "PublicPin" ADD COLUMN "urgency" TEXT;
ALTER TABLE "PublicPin" ADD COLUMN "resolved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PublicPin" ADD COLUMN "resolvedAt" TIMESTAMP(3);
ALTER TABLE "PublicPin" ADD COLUMN "resolvedNotes" TEXT;

-- Add issues settings to Project
ALTER TABLE "Project" ADD COLUMN "issuesEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Project" ADD COLUMN "issueNotifyEmails" TEXT;

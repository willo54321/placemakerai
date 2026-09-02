# Enquiries Phase 0 — Database Migration Guide

> **STATUS: APPLIED to production on 2026-09-02** via `prisma db execute` against
> the live Supabase DB, and verified (columns, table, indexes, FK all present;
> 8 existing enquiry rows intact and defaulted; the list-route query runs). This
> doc is now a **record + a reusable runbook** for any other environment or a
> re-run — the idempotent SQL is safe to apply again (it no-ops).

**Audience:** Claude running in a browser (claude.ai with a Supabase/Postgres
connector, or a human driving the Supabase dashboard). This applies the one
schema change Phase 0 of the enquiry desk needs.

**Companion docs:** `ENQUIRIES_SYSTEM.md` (the full design), `CLAUDE.md` (project
guide). Code already merged locally: `prisma/schema.prisma`,
`src/app/api/projects/[id]/enquiries/*`, `src/app/projects/[id]/enquiries.tsx`.

---

## 1. What this migration does — and why it's safe

It brings the live database in line with the updated Prisma schema so the new
**Enquiries** tab and its API stop 500ing. It is **purely additive**:

| Change | Object | Risk |
|--------|--------|------|
| Add `status` (default `'new'`) | `Enquiry` column | none — defaulted |
| Add `read` (default `false`) | `Enquiry` column | none — defaulted |
| Add `assigneeId` (nullable) | `Enquiry` column | none — nullable |
| Add `threadToken` (nullable, unique) | `Enquiry` column | none — nullable |
| Create `EnquiryMessage` | new table | none — new |
| Add 2 indexes + 1 FK | indexes / constraint | none |

- **No column is dropped or altered in a lossy way.** Existing enquiry rows keep
  every value they have.
- **No `NOT NULL` without a default** on existing rows (`status`/`read` are
  defaulted; `assigneeId`/`threadToken` are nullable), so there is nothing to
  backfill.
- The originating enquiry submission is **not** copied into `EnquiryMessage` —
  the app synthesises it as the thread's first message at read time. So old
  enquiries render a full conversation with zero data migration.
- The SQL below is **idempotent** (guarded with `IF NOT EXISTS` / a constraint
  check), so re-running it is harmless.

This is the exact set of changes `npx prisma db:push` would make. Both
`DATABASE_URL` and `DIRECT_URL` point at the Supabase pooler
(`aws-0-eu-central-1.pooler.supabase.com`) on **port 5432 = session mode**,
which handles DDL fine — this migration was in fact applied straight through it
with `prisma db execute` and no pooler issues. (The transaction-mode pooler,
port 6543, is the one to avoid for schema changes; that is *not* what this
project uses.) The Supabase SQL editor remains a perfectly good alternative if
you'd rather run the SQL by hand.

---

## 2. Before you start

1. **Confirm the target.** This is production: the DB behind
   `platform.placemakerai.io` (Supabase project, region `eu-central-1`). There
   is no separate staging DB. Proceed only with the owner's explicit go-ahead.
2. **Take a snapshot (recommended).** Supabase dashboard → *Database* →
   *Backups*. A daily backup usually exists; a manual one before a schema change
   is cheap insurance. (The migration is additive, so a full restore should
   never be needed — see Rollback for the targeted undo.)
3. **Know where to run SQL.** Supabase dashboard → **SQL Editor** → *New query*.

---

## 3. The migration

Paste this whole block into the Supabase SQL Editor and run it. It is wrapped in
a transaction, so it either fully applies or fully rolls back.

```sql
BEGIN;

-- Enquiry: desk state columns (all defaulted or nullable — no backfill)
ALTER TABLE "Enquiry"
  ADD COLUMN IF NOT EXISTS "status"      TEXT    NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS "read"        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "assigneeId"  TEXT,
  ADD COLUMN IF NOT EXISTS "threadToken" TEXT;

-- Conversation thread table
CREATE TABLE IF NOT EXISTS "EnquiryMessage" (
  "id"             TEXT NOT NULL,
  "enquiryId"      TEXT NOT NULL,
  "direction"      TEXT NOT NULL,
  "body"           TEXT NOT NULL,
  "authorName"     TEXT,
  "authorEmail"    TEXT,
  "deliveryStatus" TEXT NOT NULL DEFAULT 'stored',
  "attachments"    JSONB,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EnquiryMessage_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX        IF NOT EXISTS "EnquiryMessage_enquiryId_createdAt_idx"
  ON "EnquiryMessage" ("enquiryId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "Enquiry_threadToken_key"
  ON "Enquiry" ("threadToken");
CREATE INDEX        IF NOT EXISTS "Enquiry_projectId_status_idx"
  ON "Enquiry" ("projectId", "status");

-- Foreign key (no IF NOT EXISTS for constraints — guard by name)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EnquiryMessage_enquiryId_fkey'
  ) THEN
    ALTER TABLE "EnquiryMessage"
      ADD CONSTRAINT "EnquiryMessage_enquiryId_fkey"
      FOREIGN KEY ("enquiryId") REFERENCES "Enquiry" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
```

Expect: `Success. No rows returned`.

---

## 4. Verify it applied

Run each and check the result.

```sql
-- (a) New Enquiry columns exist with the right types/defaults
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'Enquiry'
  AND column_name IN ('status', 'read', 'assigneeId', 'threadToken')
ORDER BY column_name;
-- Expect 4 rows: assigneeId (nullable), read (default false),
-- status (default 'new'), threadToken (nullable).

-- (b) New table exists
SELECT to_regclass('public."EnquiryMessage"') AS enquiry_message_table;
-- Expect: "EnquiryMessage" (not NULL)

-- (c) Indexes + FK present
SELECT indexname FROM pg_indexes
WHERE tablename IN ('Enquiry', 'EnquiryMessage')
  AND indexname IN (
    'Enquiry_threadToken_key',
    'Enquiry_projectId_status_idx',
    'EnquiryMessage_enquiryId_createdAt_idx'
  );
-- Expect 3 rows.

SELECT conname FROM pg_constraint WHERE conname = 'EnquiryMessage_enquiryId_fkey';
-- Expect 1 row.

-- (d) Existing enquiries were left intact and got sane defaults
SELECT count(*) AS total,
       count(*) FILTER (WHERE status = 'new') AS status_new,
       count(*) FILTER (WHERE read = false)   AS unread
FROM "Enquiry";
-- total should match your existing enquiry count; every row status_new + unread.
```

---

## 5. After the migration

1. **Prisma client** — already regenerated locally (`prisma generate`, client
   v5 with `EnquiryMessage`). If applying from a fresh checkout, run
   `npx prisma generate` before building.
2. **Deploy the app code** that references the new columns (the Enquiries tab +
   its API routes). Order doesn't strictly matter because the migration is
   additive — the *old* app keeps working against the new schema, and the *new*
   app needs the new columns. Safest sequence: **migrate first, then deploy.**
3. **Smoke test** once deployed:
   - Open a project → **Enquiries** tab. The inbox loads (no 500).
   - Click an enquiry → the thread shows the original submission as the first
     message; it flips to *read*.
   - As an admin, change status New → Open → Closed; the badge updates and an
     `enquiry.update` row appears in the audit log.
   - Run **AI Analytics** → the analysed count now includes enquiries
     (`bySource.enquiries` is no longer always zero). *(This part needs no
     migration — it only reads existing columns.)*

---

## 6. Rollback (targeted undo)

Only if you need to reverse it. This drops exactly what section 3 added; it
deletes any `EnquiryMessage` rows created since (none exist at Phase 0) and the
new `Enquiry` columns. Existing enquiry content is untouched.

```sql
BEGIN;
DROP TABLE IF EXISTS "EnquiryMessage";      -- also drops its FK + index
DROP INDEX IF EXISTS "Enquiry_threadToken_key";
DROP INDEX IF EXISTS "Enquiry_projectId_status_idx";
ALTER TABLE "Enquiry"
  DROP COLUMN IF EXISTS "status",
  DROP COLUMN IF EXISTS "read",
  DROP COLUMN IF EXISTS "assigneeId",
  DROP COLUMN IF EXISTS "threadToken";
COMMIT;
```

After a rollback, redeploy the previous app build (without the Enquiries tab),
or the tab will 500 again.

---

## 7. Troubleshooting

- **"permission denied for table Enquiry"** — you're on a restricted role. Use
  the Supabase SQL Editor (runs as the project owner) rather than an app
  connection string.
- **"column already exists" / "relation already exists"** — you've already run
  it; the `IF NOT EXISTS` guards make this a no-op. Safe to ignore.
- **App still 500s after migrating** — the running build predates the schema and
  its Prisma client. Redeploy so the client includes `EnquiryMessage`.
- **Pooler mode:** DDL is safe over the *session*-mode pooler (port 5432, what
  this project uses) — `prisma db execute` / `db:push` work directly. Only the
  *transaction*-mode pooler (port 6543) is unsuitable for schema changes; if a
  URL ever uses 6543, run DDL via the dashboard SQL editor instead.

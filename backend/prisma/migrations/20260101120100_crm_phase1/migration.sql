-- Phase 1: CRM lifecycle, subtypes, archive and staff authentication.
--
-- Additive only. The existing `property` columns are never dropped or renamed,
-- because the public website still reads them. New columns are nullable or have
-- defaults, so the website's own queries keep working unchanged.

-- ---------------------------------------------------------------------------
-- Enums (guarded so the migration is re-runnable)
-- ---------------------------------------------------------------------------

DO $$ BEGIN
    CREATE TYPE "ListingType" AS ENUM ('SALE', 'RENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "PublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "AvailabilityStatus" AS ENUM ('AVAILABLE', 'ON_HOLD', 'SOLD', 'RENTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "CrmModule" AS ENUM ('all', 'lead', 'property');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "StaffRole" AS ENUM ('admin', 'data_user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Extend the existing property master record
-- ---------------------------------------------------------------------------

ALTER TABLE "property" ADD COLUMN IF NOT EXISTS "listing_type" "ListingType";
ALTER TABLE "property" ADD COLUMN IF NOT EXISTS "publication_status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "property" ADD COLUMN IF NOT EXISTS "availability_status" "AvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE';
ALTER TABLE "property" ADD COLUMN IF NOT EXISTS "project_id" BIGINT;
ALTER TABLE "property" ADD COLUMN IF NOT EXISTS "unit_identifier" VARCHAR;
ALTER TABLE "property" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "property" ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMPTZ(6);

-- ---------------------------------------------------------------------------
-- Subtypes: primary key is also the foreign key to the master record
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "sale_property" (
    "property_id" BIGINT NOT NULL,
    "price_negotiable" BOOLEAN,
    "ownership_type" VARCHAR,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_property_pkey" PRIMARY KEY ("property_id")
);

CREATE TABLE IF NOT EXISTS "rent_property" (
    "property_id" BIGINT NOT NULL,
    "deposit_amount" DECIMAL,
    "maintenance_amount" DECIMAL,
    "furnishing" VARCHAR,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rent_property_pkey" PRIMARY KEY ("property_id")
);

-- ---------------------------------------------------------------------------
-- Archive: append-only event log
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "property_archive" (
    "id" BIGSERIAL NOT NULL,
    "property_id" BIGINT NOT NULL,
    "listing_type" "ListingType",
    "previous_status" "PublicationStatus" NOT NULL,
    "previous_availability" "AvailabilityStatus" NOT NULL,
    "snapshot" JSONB NOT NULL,
    "reason" TEXT,
    "archived_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_by" TEXT,

    CONSTRAINT "property_archive_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- Staff
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "Crm_User" (
    "id" TEXT NOT NULL,
    "name" VARCHAR NOT NULL,
    "email" VARCHAR NOT NULL,
    "module" "CrmModule" NOT NULL,
    "role" "StaffRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Crm_User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Crm_UserCredential" (
    "crm_user_id" TEXT NOT NULL,
    "password_hash" VARCHAR NOT NULL,
    "password_updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Crm_UserCredential_pkey" PRIMARY KEY ("crm_user_id")
);

CREATE TABLE IF NOT EXISTS "Crm_Session" (
    "id" TEXT NOT NULL,
    "crm_user_id" TEXT NOT NULL,
    "token_hash" VARCHAR NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "last_used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Crm_Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Crm_PasswordResetToken" (
    "id" TEXT NOT NULL,
    "crm_user_id" TEXT NOT NULL,
    "token_hash" VARCHAR NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Crm_PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS "property_project_id_unit_identifier_key" ON "property"("project_id", "unit_identifier");
CREATE INDEX IF NOT EXISTS "property_publication_status_listing_type_availability_statu_idx" ON "property"("publication_status", "listing_type", "availability_status");
CREATE INDEX IF NOT EXISTS "property_project_id_idx" ON "property"("project_id");
CREATE INDEX IF NOT EXISTS "property_created_at_idx" ON "property"("created_at");

CREATE INDEX IF NOT EXISTS "property_archive_property_id_archived_at_idx" ON "property_archive"("property_id", "archived_at");

CREATE UNIQUE INDEX IF NOT EXISTS "Crm_User_email_key" ON "Crm_User"("email");

CREATE UNIQUE INDEX IF NOT EXISTS "Crm_Session_token_hash_key" ON "Crm_Session"("token_hash");
CREATE INDEX IF NOT EXISTS "Crm_Session_crm_user_id_idx" ON "Crm_Session"("crm_user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "Crm_PasswordResetToken_token_hash_key" ON "Crm_PasswordResetToken"("token_hash");
CREATE INDEX IF NOT EXISTS "Crm_PasswordResetToken_crm_user_id_idx" ON "Crm_PasswordResetToken"("crm_user_id");

-- ---------------------------------------------------------------------------
-- Foreign keys (guarded: some target tables already exist)
-- ---------------------------------------------------------------------------

DO $$ BEGIN
    ALTER TABLE "property" ADD CONSTRAINT "property_project_id_fkey"
        FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "sale_property" ADD CONSTRAINT "sale_property_property_id_fkey"
        FOREIGN KEY ("property_id") REFERENCES "property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "rent_property" ADD CONSTRAINT "rent_property_property_id_fkey"
        FOREIGN KEY ("property_id") REFERENCES "property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "property_archive" ADD CONSTRAINT "property_archive_property_id_fkey"
        FOREIGN KEY ("property_id") REFERENCES "property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "property_archive" ADD CONSTRAINT "property_archive_archived_by_fkey"
        FOREIGN KEY ("archived_by") REFERENCES "Crm_User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Crm_UserCredential" ADD CONSTRAINT "Crm_UserCredential_crm_user_id_fkey"
        FOREIGN KEY ("crm_user_id") REFERENCES "Crm_User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Crm_Session" ADD CONSTRAINT "Crm_Session_crm_user_id_fkey"
        FOREIGN KEY ("crm_user_id") REFERENCES "Crm_User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Crm_PasswordResetToken" ADD CONSTRAINT "Crm_PasswordResetToken_crm_user_id_fkey"
        FOREIGN KEY ("crm_user_id") REFERENCES "Crm_User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Backfill of existing website records
--
-- Existing rows are live listings, so they are brought into the new model
-- without changing their IDs and without inventing business data:
--   * listing_type is derived only from unambiguous legacy values
--     ('buy'/'sale' -> SALE, 'rent'/'tenant' -> RENT).
--   * Recognised rows keep their live visibility (PUBLISHED); rows whose
--     legacy value is unknown stay DRAFT and are left for manual review.
--   * Every subtype column is nullable, so the derived subtype rows carry no
--     invented values.
-- ---------------------------------------------------------------------------

UPDATE "property" SET "listing_type" = 'SALE'
 WHERE "listing_type" IS NULL AND lower("listing") IN ('sale', 'buy');

UPDATE "property" SET "listing_type" = 'RENT'
 WHERE "listing_type" IS NULL AND lower("listing") IN ('rent', 'tenant');

UPDATE "property"
   SET "publication_status" = 'PUBLISHED',
       "published_at" = COALESCE("published_at", "created_at")
 WHERE "listing_type" IS NOT NULL
   AND "publication_status" = 'DRAFT';

INSERT INTO "sale_property" ("property_id")
SELECT "id" FROM "property" WHERE "listing_type" = 'SALE'
ON CONFLICT ("property_id") DO NOTHING;

INSERT INTO "rent_property" ("property_id")
SELECT "id" FROM "property" WHERE "listing_type" = 'RENT'
ON CONFLICT ("property_id") DO NOTHING;

-- Phase 3: project administration and administrative change history.
-- Additive only; the existing `projects` table keeps every column the website
-- reads and gains only nullable or defaulted fields.

ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ(6);
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "crm_change_history" (
    "id" BIGSERIAL NOT NULL,
    "entity_type" VARCHAR NOT NULL,
    "entity_id" VARCHAR NOT NULL,
    "action" VARCHAR NOT NULL,
    "summary" TEXT NOT NULL,
    "changes" JSONB,
    "actor_id" VARCHAR,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_change_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "crm_change_history_entity_type_entity_id_created_at_idx"
    ON "crm_change_history"("entity_type", "entity_id", "created_at");
CREATE INDEX IF NOT EXISTS "crm_change_history_created_at_idx"
    ON "crm_change_history"("created_at");

CREATE TABLE IF NOT EXISTS "crm_import_run" (
    "id" BIGSERIAL NOT NULL,
    "entity_type" VARCHAR NOT NULL,
    "imported" INTEGER NOT NULL,
    "skipped" INTEGER NOT NULL,
    "failed" INTEGER NOT NULL,
    "actor_id" VARCHAR,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_import_run_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "crm_import_run_created_at_idx" ON "crm_import_run"("created_at");

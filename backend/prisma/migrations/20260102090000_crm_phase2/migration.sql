-- Phase 2: CRM modules.
--
-- Additive only. `Lead` already exists in the shared database and is used by
-- the public website; it is reproduced below as an idempotent baseline and then
-- extended with new, nullable or defaulted columns so the website keeps working.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ContactCategory" AS ENUM ('BUYER', 'SELLER', 'LANDLORD', 'TENANT', 'BUILDER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "LeadStage" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'SITE_VISIT', 'NEGOTIATION', 'ON_HOLD', 'WON', 'LOST');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "LeadPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "RequirementIntent" AS ENUM ('BUY', 'SELL', 'RENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "InteractionType" AS ENUM ('CALL', 'MEETING', 'MESSAGE', 'EMAIL', 'NOTE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "SiteVisitStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ClosureOutcome" AS ENUM ('SALE', 'RENT', 'LOST');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- CreateTable

-- ---------------------------------------------------------------------------
-- Existing Lead table (baseline) and additive extension
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "Lead" (
    "id" BIGSERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "who" VARCHAR NOT NULL,
    "intent" VARCHAR NOT NULL,
    "property_type" VARCHAR,
    "agent" VARCHAR,
    "status" VARCHAR,
    "name" VARCHAR,
    "phone" VARCHAR NOT NULL,
    "email_id" VARCHAR NOT NULL,
    "location" VARCHAR NOT NULL,
    "message" TEXT,
    "budget" VARCHAR,
    "pin_no" VARCHAR,
    "address" VARCHAR,
    "bedrooms" VARCHAR,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "contact_id" BIGINT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "assigned_to" VARCHAR;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "source" VARCHAR;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "priority" "LeadPriority" NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "stage" "LeadStage" NOT NULL DEFAULT 'NEW';
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "on_hold_reason" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "selected_property_id" BIGINT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "closed_at" TIMESTAMPTZ(6);
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "closure_outcome" "ClosureOutcome";
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "loss_reason" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "reopen_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ---------------------------------------------------------------------------
-- New CRM tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "crm_contact" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR NOT NULL,
    "email" VARCHAR,
    "phone" VARCHAR,
    "category" "ContactCategory" NOT NULL,
    "company" VARCHAR,
    "city" VARCHAR,
    "address" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" VARCHAR,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "crm_requirement" (
    "id" BIGSERIAL NOT NULL,
    "lead_id" BIGINT NOT NULL,
    "intent" "RequirementIntent" NOT NULL,
    "budget_min" DECIMAL,
    "budget_max" DECIMAL,
    "locations" VARCHAR,
    "property_type" VARCHAR,
    "bedrooms" VARCHAR,
    "timeframe" VARCHAR,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" VARCHAR,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_requirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "crm_requirement_property" (
    "requirement_id" BIGINT NOT NULL,
    "property_id" BIGINT NOT NULL,
    "added_by" VARCHAR,
    "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_requirement_property_pkey" PRIMARY KEY ("requirement_id","property_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "crm_interaction" (
    "id" BIGSERIAL NOT NULL,
    "lead_id" BIGINT,
    "contact_id" BIGINT,
    "type" "InteractionType" NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summary" TEXT NOT NULL,
    "outcome" TEXT,
    "next_action" TEXT,
    "created_by" VARCHAR,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_interaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "crm_follow_up_task" (
    "id" BIGSERIAL NOT NULL,
    "title" VARCHAR NOT NULL,
    "description" TEXT,
    "lead_id" BIGINT,
    "contact_id" BIGINT,
    "assigned_to" VARCHAR,
    "due_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "completed_at" TIMESTAMPTZ(6),
    "completion_notes" TEXT,
    "next_action" TEXT,
    "created_by" VARCHAR,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_follow_up_task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "crm_site_visit" (
    "id" BIGSERIAL NOT NULL,
    "lead_id" BIGINT NOT NULL,
    "property_id" BIGINT NOT NULL,
    "assigned_to" VARCHAR,
    "scheduled_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "SiteVisitStatus" NOT NULL DEFAULT 'SCHEDULED',
    "feedback" TEXT,
    "next_steps" TEXT,
    "rescheduled_from" TIMESTAMPTZ(6),
    "reschedule_count" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMPTZ(6),
    "created_by" VARCHAR,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_site_visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "crm_lead_stage_history" (
    "id" BIGSERIAL NOT NULL,
    "lead_id" BIGINT NOT NULL,
    "from_stage" "LeadStage",
    "to_stage" "LeadStage" NOT NULL,
    "reason" TEXT,
    "changed_by" VARCHAR,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_lead_stage_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "crm_lead_assignment" (
    "id" BIGSERIAL NOT NULL,
    "lead_id" BIGINT NOT NULL,
    "assigned_to" VARCHAR NOT NULL,
    "assigned_by" VARCHAR,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(6),

    CONSTRAINT "crm_lead_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Lead_stage_idx" ON "Lead"("stage");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Lead_assigned_to_idx" ON "Lead"("assigned_to");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Lead_created_at_idx" ON "Lead"("created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Lead_contact_id_idx" ON "Lead"("contact_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_contact_category_idx" ON "crm_contact"("category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_contact_name_idx" ON "crm_contact"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_contact_phone_idx" ON "crm_contact"("phone");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_requirement_lead_id_idx" ON "crm_requirement"("lead_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_requirement_property_property_id_idx" ON "crm_requirement_property"("property_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_interaction_lead_id_occurred_at_idx" ON "crm_interaction"("lead_id", "occurred_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_interaction_contact_id_occurred_at_idx" ON "crm_interaction"("contact_id", "occurred_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_follow_up_task_status_due_at_idx" ON "crm_follow_up_task"("status", "due_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_follow_up_task_assigned_to_idx" ON "crm_follow_up_task"("assigned_to");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_follow_up_task_lead_id_idx" ON "crm_follow_up_task"("lead_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_site_visit_status_scheduled_at_idx" ON "crm_site_visit"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_site_visit_lead_id_idx" ON "crm_site_visit"("lead_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_site_visit_property_id_idx" ON "crm_site_visit"("property_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_lead_stage_history_lead_id_changed_at_idx" ON "crm_lead_stage_history"("lead_id", "changed_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_lead_assignment_lead_id_assigned_at_idx" ON "crm_lead_assignment"("lead_id", "assigned_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_lead_assignment_assigned_to_idx" ON "crm_lead_assignment"("assigned_to");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Lead" ADD CONSTRAINT "Lead_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm_contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Lead" ADD CONSTRAINT "Lead_selected_property_id_fkey" FOREIGN KEY ("selected_property_id") REFERENCES "property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "crm_requirement" ADD CONSTRAINT "crm_requirement_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "crm_requirement_property" ADD CONSTRAINT "crm_requirement_property_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "crm_requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "crm_requirement_property" ADD CONSTRAINT "crm_requirement_property_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "crm_interaction" ADD CONSTRAINT "crm_interaction_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "crm_interaction" ADD CONSTRAINT "crm_interaction_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm_contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "crm_follow_up_task" ADD CONSTRAINT "crm_follow_up_task_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "crm_follow_up_task" ADD CONSTRAINT "crm_follow_up_task_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm_contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "crm_site_visit" ADD CONSTRAINT "crm_site_visit_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "crm_site_visit" ADD CONSTRAINT "crm_site_visit_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "crm_lead_stage_history" ADD CONSTRAINT "crm_lead_stage_history_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "crm_lead_assignment" ADD CONSTRAINT "crm_lead_assignment_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

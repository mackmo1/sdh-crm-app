-- Baseline: tables that already exist in the shared Step360D database.
--
-- These tables are owned by the public website and are reproduced here only so
-- that the migration history starts from the real schema. Every statement is
-- idempotent, so this migration is a no-op on a database where the website has
-- already created them, and is safe to run on a fresh local development
-- database.

CREATE SCHEMA IF NOT EXISTS "public";

CREATE TABLE IF NOT EXISTS "projects" (
    "id" BIGSERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" VARCHAR,
    "address" VARCHAR,
    "city" VARCHAR,
    "google_location" VARCHAR,
    "overview_area" VARCHAR,
    "near_by" TEXT,
    "overview_floors" VARCHAR,
    "overview_rem1" VARCHAR,
    "overview_rem2" VARCHAR,
    "rooms" VARCHAR,
    "area_sqft" VARCHAR,
    "price_range" VARCHAR,
    "usp" TEXT,
    "external_id" VARCHAR,
    "pricing_tiers" JSONB,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "property" (
    "id" BIGSERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "listing" VARCHAR NOT NULL,
    "type" VARCHAR,
    "city" VARCHAR NOT NULL,
    "project" VARCHAR,
    "address" VARCHAR NOT NULL,
    "pin_code" VARCHAR,
    "rooms" VARCHAR NOT NULL,
    "parking" BOOLEAN,
    "price" DECIMAL NOT NULL,
    "facing" VARCHAR,
    "starting_dt" DATE,
    "user_id" BIGINT,
    "area" BIGINT,
    "status" VARCHAR,
    "message" TEXT,
    "external_id" VARCHAR,
    "coverImagePath" VARCHAR,
    "bathrooms" SMALLINT,

    CONSTRAINT "property_pkey" PRIMARY KEY ("id")
);

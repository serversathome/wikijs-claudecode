/**
 * This file was created by Claude Code
 * Migration to add 'draft' status to pageSubmissions table
 *
 * Only PostgreSQL needs this. Early builds of 2.6.0 created the status check constraint
 * without 'draft'; 2.6.0 has since been corrected, and on the other engines the constraint
 * is either a native ENUM (MySQL/MariaDB) or auto-named (MSSQL), so the raw SQL below
 * would fail (MySQL has no DROP CONSTRAINT IF EXISTS and rejects double-quoted identifiers)
 * and abort startup.
 */

/* global WIKI */

const isPostgres = () => WIKI.config.db.type === 'postgres'

exports.up = async knex => {
  if (!isPostgres()) { return }

  await knex.raw(`
    ALTER TABLE "pageSubmissions"
    DROP CONSTRAINT IF EXISTS "pageSubmissions_status_check"
  `)

  await knex.raw(`
    ALTER TABLE "pageSubmissions"
    ADD CONSTRAINT "pageSubmissions_status_check"
    CHECK (status IN ('draft', 'pending', 'approved', 'rejected'))
  `)
}

exports.down = async knex => {
  if (!isPostgres()) { return }

  // Revert to original constraint (without draft)
  await knex.raw(`
    ALTER TABLE "pageSubmissions"
    DROP CONSTRAINT IF EXISTS "pageSubmissions_status_check"
  `)

  await knex.raw(`
    ALTER TABLE "pageSubmissions"
    ADD CONSTRAINT "pageSubmissions_status_check"
    CHECK (status IN ('pending', 'approved', 'rejected'))
  `)
}

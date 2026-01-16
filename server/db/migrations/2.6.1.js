/**
 * This file was created by Claude Code
 * Migration to add 'draft' status to pageSubmissions table
 */

exports.up = async knex => {
  // For PostgreSQL, we need to drop and recreate the check constraint
  // to add 'draft' to the allowed status values
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

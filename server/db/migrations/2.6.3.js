/**
 * This file was created by Claude Code
 * Ensure the pageSubmissions status column accepts 'draft' on MySQL/MariaDB and MSSQL.
 *
 * The first builds of 2.6.0 created the status column without 'draft'. PostgreSQL installs are
 * fixed by 2.6.1, but on the other engines that table shape is different (a native ENUM on
 * MySQL/MariaDB, an auto-named CHECK constraint on MSSQL), so saving drafts and withdrawing
 * submissions failed there. Idempotent: running it on a table that already allows 'draft' is a
 * no-op in effect. SQLite has its own migrations and always created the column with 'draft'.
 */

/* global WIKI */

const STATUSES = ['draft', 'pending', 'approved', 'rejected']

exports.up = async knex => {
  switch (WIKI.config.db.type) {
    case 'mysql':
    case 'mariadb': {
      const list = STATUSES.map(s => `'${s}'`).join(', ')
      await knex.raw(`ALTER TABLE \`pageSubmissions\` MODIFY \`status\` ENUM(${list}) NOT NULL DEFAULT 'pending'`)
      break
    }
    case 'mssql': {
      // Drop whatever CHECK constraint(s) knex generated on the status column, then add a
      // named one that includes 'draft'
      const constraints = await knex.raw(`
        SELECT cc.name AS name
        FROM sys.check_constraints cc
        INNER JOIN sys.columns c ON c.object_id = cc.parent_object_id AND c.column_id = cc.parent_column_id
        WHERE cc.parent_object_id = OBJECT_ID('pageSubmissions') AND c.name = 'status'
      `)
      for (const row of constraints) {
        await knex.raw('ALTER TABLE [pageSubmissions] DROP CONSTRAINT ??', [row.name])
      }
      const list = STATUSES.map(s => `N'${s}'`).join(', ')
      await knex.raw(`ALTER TABLE [pageSubmissions] ADD CONSTRAINT [pageSubmissions_status_check] CHECK ([status] IN (${list}))`)
      break
    }
  }
}

exports.down = async knex => { }

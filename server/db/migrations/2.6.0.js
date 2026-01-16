/**
 * This file was created by Claude Code
 * Migration to add pageSubmissions table for the review workflow feature
 */

exports.up = async knex => {
  // Create pageSubmissions table for tracking edit submissions pending review
  await knex.schema.createTable('pageSubmissions', table => {
    table.increments('id').primary()
    table.integer('pageId').unsigned().references('id').inTable('pages').onDelete('CASCADE')
    table.integer('submitterId').unsigned().notNullable().references('id').inTable('users')
    table.string('path').notNullable()
    table.string('hash').notNullable()
    table.string('title').notNullable()
    table.text('description')
    table.text('content').notNullable()
    table.string('contentType').notNullable()
    table.string('editorKey').notNullable()
    table.string('localeCode', 5).notNullable()
    table.boolean('isPrivate').notNullable().defaultTo(false)
    table.text('extra')
    table.text('tags')
    table.enu('status', ['draft', 'pending', 'approved', 'rejected']).notNullable().defaultTo('pending')
    table.integer('reviewerId').unsigned().references('id').inTable('users')
    table.string('reviewComment')
    table.string('createdAt').notNullable()
    table.string('updatedAt').notNullable()
    table.string('reviewedAt')
  })

  // Add index for faster queries
  await knex.schema.table('pageSubmissions', table => {
    table.index(['status'], 'pageSubmissions_status_idx')
    table.index(['submitterId'], 'pageSubmissions_submitter_idx')
    table.index(['pageId'], 'pageSubmissions_page_idx')
  })
}

exports.down = async knex => {
  await knex.schema.dropTable('pageSubmissions')
}

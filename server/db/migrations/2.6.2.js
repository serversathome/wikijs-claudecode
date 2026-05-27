exports.up = async knex => {
  await knex.schema.alterTable('pageSubmissions', table => {
    table.text('reviewComment').alter()
  })
}

exports.down = async knex => {
  await knex.schema.alterTable('pageSubmissions', table => {
    table.string('reviewComment').alter()
  })
}

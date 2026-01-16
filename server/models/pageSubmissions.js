/**
 * This file was created by Claude Code
 * Page Submissions model for the review workflow feature
 */

const Model = require('objection').Model

/**
 * Page Submissions model - tracks edits pending review
 */
module.exports = class PageSubmission extends Model {
  static get tableName() { return 'pageSubmissions' }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['path', 'title', 'content', 'contentType', 'editorKey', 'localeCode', 'submitterId'],

      properties: {
        id: { type: 'integer' },
        pageId: { type: ['integer', 'null'] },
        submitterId: { type: 'integer' },
        path: { type: 'string' },
        hash: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        content: { type: 'string' },
        contentType: { type: 'string' },
        editorKey: { type: 'string' },
        localeCode: { type: 'string' },
        isPrivate: { type: 'boolean' },
        extra: { type: 'string' },
        tags: { type: 'string' },
        status: { type: 'string', enum: ['draft', 'pending', 'approved', 'rejected'] },
        reviewerId: { type: ['integer', 'null'] },
        reviewComment: { type: ['string', 'null'] },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' },
        reviewedAt: { type: ['string', 'null'] }
      }
    }
  }

  static get relationMappings() {
    return {
      submitter: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./users'),
        join: {
          from: 'pageSubmissions.submitterId',
          to: 'users.id'
        }
      },
      reviewer: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./users'),
        join: {
          from: 'pageSubmissions.reviewerId',
          to: 'users.id'
        }
      },
      page: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./pages'),
        join: {
          from: 'pageSubmissions.pageId',
          to: 'pages.id'
        }
      }
    }
  }

  $beforeUpdate() {
    this.updatedAt = new Date().toISOString()
  }

  $beforeInsert() {
    this.createdAt = new Date().toISOString()
    this.updatedAt = new Date().toISOString()
  }

  /**
   * Get pending submissions count
   */
  static async getPendingCount() {
    const result = await this.query().where('status', 'pending').count('id as count').first()
    return parseInt(result.count, 10)
  }

  /**
   * Get submissions list with filters
   */
  static async getSubmissions({ status, submitterId, limit, offset }) {
    let query = this.query()
      .select([
        'pageSubmissions.id',
        'pageSubmissions.pageId',
        'pageSubmissions.path',
        'pageSubmissions.title',
        'pageSubmissions.description',
        'pageSubmissions.localeCode',
        'pageSubmissions.status',
        'pageSubmissions.reviewComment',
        'pageSubmissions.createdAt',
        'pageSubmissions.updatedAt',
        'pageSubmissions.reviewedAt',
        {
          submitterName: 'submitter.name',
          submitterEmail: 'submitter.email',
          reviewerName: 'reviewer.name'
        }
      ])
      .leftJoinRelated('submitter')
      .leftJoinRelated('reviewer')
      .orderBy('pageSubmissions.createdAt', 'desc')

    if (status) {
      query = query.where('pageSubmissions.status', status)
    }

    if (submitterId) {
      query = query.where('pageSubmissions.submitterId', submitterId)
    }

    if (limit) {
      query = query.limit(limit)
    }

    if (offset) {
      query = query.offset(offset)
    }

    return query
  }

  /**
   * Get a single submission with full details
   */
  static async getSubmission(id) {
    return this.query()
      .findById(id)
      .select([
        'pageSubmissions.*',
        {
          submitterName: 'submitter.name',
          submitterEmail: 'submitter.email',
          reviewerName: 'reviewer.name'
        }
      ])
      .leftJoinRelated('submitter')
      .leftJoinRelated('reviewer')
  }
}

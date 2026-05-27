/**
 * This file was created by Claude Code
 * GraphQL resolvers for the page submissions review workflow
 */

const _ = require('lodash')
const graphHelper = require('../../helpers/graph')
const pageHelper = require('../../helpers/page')
const CleanCSS = require('clean-css')
const TurndownService = require('turndown')
const turndownPluginGfm = require('turndown-plugin-gfm').gfm

/* global WIKI */

function safeJsonParse(str, fallback) {
  if (!str) return fallback
  try {
    return JSON.parse(str)
  } catch (err) {
    WIKI.logger.warn(`Failed to parse JSON: ${err.message}`)
    return fallback
  }
}

/**
 * Convert HTML content to Markdown
 */
function htmlToMarkdown(htmlContent) {
  const td = new TurndownService({
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    fence: '```',
    headingStyle: 'atx',
    hr: '---',
    linkStyle: 'inlined',
    preformattedCode: true,
    strongDelimiter: '**'
  })

  td.use(turndownPluginGfm)
  td.keep(['kbd'])

  td.addRule('subscript', {
    filter: ['sub'],
    replacement: c => `~${c}~`
  })

  td.addRule('superscript', {
    filter: ['sup'],
    replacement: c => `^${c}^`
  })

  td.addRule('underline', {
    filter: ['u'],
    replacement: c => `_${c}_`
  })

  td.addRule('taskList', {
    filter: (n, o) => {
      return n.nodeName === 'INPUT' && n.getAttribute('type') === 'checkbox'
    },
    replacement: (c, n) => {
      return n.getAttribute('checked') ? '[x] ' : '[ ] '
    }
  })

  td.addRule('removeTocAnchors', {
    filter: (n, o) => {
      return n.nodeName === 'A' && n.classList.contains('toc-anchor')
    },
    replacement: c => ''
  })

  return td.turndown(htmlContent)
}

module.exports = {
  Query: {
    async submissions() { return {} }
  },
  Mutation: {
    async submissions() { return {} }
  },
  SubmissionQuery: {
    /**
     * LIST SUBMISSIONS
     */
    async list(obj, args, context) {
      const submissions = await WIKI.models.pageSubmissions.getSubmissions({
        status: args.status,
        submitterId: args.submitterId,
        limit: args.limit || 50,
        offset: args.offset || 0
      })

      return submissions.map(s => ({
        ...s,
        localeCode: s.localeCode
      }))
    },

    /**
     * GET PENDING COUNT
     */
    async pendingCount(obj, args, context) {
      return WIKI.models.pageSubmissions.getPendingCount()
    },

    /**
     * GET SINGLE SUBMISSION
     */
    async single(obj, args, context) {
      const submission = await WIKI.models.pageSubmissions.getSubmission(args.id)
      if (!submission) {
        throw new Error('Submission not found')
      }

      // Convert content to markdown if it's HTML (from WYSIWYG editors)
      let contentForEdit = submission.content
      if (submission.contentType === 'html') {
        try {
          contentForEdit = htmlToMarkdown(submission.content)
        } catch (err) {
          WIKI.logger.warn(`Failed to convert submission ${args.id} content to markdown: ${err.message}`)
          // Keep original content if conversion fails
        }
      }

      return {
        ...submission,
        tags: safeJsonParse(submission.tags, []),
        contentMarkdown: contentForEdit
      }
    },

    /**
     * GET MY SUBMISSIONS (for current user)
     */
    async mySubmissions(obj, args, context) {
      const submissions = await WIKI.models.pageSubmissions.getSubmissions({
        status: args.status,
        submitterId: context.req.user.id,
        limit: args.limit || 50,
        offset: args.offset || 0
      })

      return submissions.map(s => ({
        ...s,
        localeCode: s.localeCode
      }))
    },

    /**
     * GET SINGLE SUBMISSION FOR CURRENT USER (full content)
     */
    async mySingle(obj, args, context) {
      const submission = await WIKI.models.pageSubmissions.getSubmission(args.id)
      if (!submission) {
        throw new Error('Submission not found')
      }

      // Verify the submission belongs to the current user
      if (submission.submitterId !== context.req.user.id) {
        throw new Error('You can only view your own submissions')
      }

      // Convert content to markdown if it's HTML (from WYSIWYG editors)
      let contentForEdit = submission.content
      if (submission.contentType === 'html') {
        try {
          contentForEdit = htmlToMarkdown(submission.content)
        } catch (err) {
          WIKI.logger.warn(`Failed to convert submission ${args.id} content to markdown: ${err.message}`)
        }
      }

      return {
        ...submission,
        tags: safeJsonParse(submission.tags, []),
        contentMarkdown: contentForEdit
      }
    }
  },
  SubmissionMutation: {
    /**
     * SUBMIT PAGE FOR REVIEW
     */
    async submit(obj, args, context) {
      try {
        // Validate path
        if (args.path.includes('.') || args.path.includes(' ') || args.path.includes('\\') || args.path.includes('//')) {
          throw new WIKI.Error.PageIllegalPath()
        }

        // Validate input lengths
        if (args.title && args.title.length > 500) {
          throw new Error('Title must be 500 characters or less.')
        }
        if (args.description && args.description.length > 2000) {
          throw new Error('Description must be 2000 characters or less.')
        }
        if (args.path && args.path.length > 500) {
          throw new Error('Path must be 500 characters or less.')
        }
        if (args.tags && args.tags.length > 20) {
          throw new Error('Maximum of 20 tags allowed.')
        }

        // Remove trailing/leading slashes
        let path = args.path
        if (path.endsWith('/')) {
          path = path.slice(0, -1)
        }
        if (path.startsWith('/')) {
          path = path.slice(1)
        }

        // Check for page access
        if (!WIKI.auth.checkAccess(context.req.user, ['write:pages'], {
          locale: args.locale,
          path: path
        })) {
          throw new WIKI.Error.PageUpdateForbidden()
        }

        // Check for empty content
        if (!args.content || _.trim(args.content).length < 1) {
          throw new WIKI.Error.PageEmptyContent()
        }

        // Format CSS Scripts
        let scriptCss = ''
        if (WIKI.auth.checkAccess(context.req.user, ['write:styles'], {
          locale: args.locale,
          path: path
        })) {
          if (!_.isEmpty(args.scriptCss)) {
            scriptCss = new CleanCSS({ inline: false }).minify(args.scriptCss).styles
          }
        }

        // Format JS Scripts
        let scriptJs = ''
        if (WIKI.auth.checkAccess(context.req.user, ['write:scripts'], {
          locale: args.locale,
          path: path
        })) {
          scriptJs = args.scriptJs || ''
        }

        // Check for existing submission to prevent duplicates (within a transaction to avoid races)
        let submission = await WIKI.models.pageSubmissions.transaction(async trx => {
          let existingSubmission = null

          if (args.pageId) {
            existingSubmission = await WIKI.models.pageSubmissions.query(trx)
              .where('pageId', args.pageId)
              .where('submitterId', context.req.user.id)
              .whereIn('status', ['draft', 'pending', 'rejected'])
              .forUpdate()
              .first()
          }

          if (!existingSubmission) {
            existingSubmission = await WIKI.models.pageSubmissions.query(trx)
              .where('path', path)
              .where('localeCode', args.locale)
              .where('submitterId', context.req.user.id)
              .whereIn('status', ['draft', 'pending', 'rejected'])
              .forUpdate()
              .first()
          }

          if (existingSubmission) {
            await WIKI.models.pageSubmissions.query(trx).findById(existingSubmission.id).patch({
              pageId: args.pageId || existingSubmission.pageId || null,
              path: path,
              hash: pageHelper.generateHash({ path: path, locale: args.locale, privateNS: args.isPrivate ? 'TODO' : '' }),
              title: args.title,
              description: args.description,
              content: args.content,
              contentType: _.get(_.find(WIKI.data.editors, ['key', args.editor]), 'contentType', 'text'),
              editorKey: args.editor,
              localeCode: args.locale,
              isPrivate: args.isPrivate,
              extra: JSON.stringify({
                js: scriptJs,
                css: scriptCss
              }),
              tags: JSON.stringify(args.tags || []),
              status: 'pending',
              reviewerId: null,
              reviewComment: null,
              reviewedAt: null
            })
            return existingSubmission
          } else {
            return WIKI.models.pageSubmissions.query(trx).insert({
              pageId: args.pageId || null,
              submitterId: context.req.user.id,
              path: path,
              hash: pageHelper.generateHash({ path: path, locale: args.locale, privateNS: args.isPrivate ? 'TODO' : '' }),
              title: args.title,
              description: args.description,
              content: args.content,
              contentType: _.get(_.find(WIKI.data.editors, ['key', args.editor]), 'contentType', 'text'),
              editorKey: args.editor,
              localeCode: args.locale,
              isPrivate: args.isPrivate,
              extra: JSON.stringify({
                js: scriptJs,
                css: scriptCss
              }),
              tags: JSON.stringify(args.tags || []),
              status: 'pending'
            })
          }
        })

        const fullSubmission = await WIKI.models.pageSubmissions.getSubmission(submission.id)

        WIKI.logger.info(`Page submission created by ${context.req.user.email} for path: ${path}`)

        // This section was modified by Claude Code - Send notification for new submission
        try {
          await WIKI.notification.notifyPageSubmitted(fullSubmission, context.req.user)
        } catch (err) {
          WIKI.logger.warn('Failed to send submission notification: ' + err.message)
        }

        return {
          responseResult: graphHelper.generateSuccess('Page submitted for review successfully.'),
          submission: {
            ...fullSubmission,
            tags: safeJsonParse(fullSubmission.tags, [])
          }
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },

    /**
     * APPROVE SUBMISSION
     */
    async approve(obj, args, context) {
      try {
        const submission = await WIKI.models.pageSubmissions.query().findById(args.id)
        if (!submission) {
          throw new Error('Submission not found')
        }

        if (submission.status !== 'pending') {
          throw new Error('Submission has already been reviewed')
        }

        // Parse stored data
        const tags = safeJsonParse(submission.tags, [])
        const extra = safeJsonParse(submission.extra, {})

        let page
        if (submission.pageId) {
          // Update existing page
          page = await WIKI.models.pages.updatePage({
            id: submission.pageId,
            content: submission.content,
            description: submission.description,
            title: submission.title,
            locale: submission.localeCode,
            tags: tags,
            isPublished: true,
            scriptCss: extra.css,
            scriptJs: extra.js,
            action: 'approved',
            user: context.req.user
          })
        } else {
          // Create new page
          page = await WIKI.models.pages.createPage({
            path: submission.path,
            locale: submission.localeCode,
            title: submission.title,
            description: submission.description,
            content: submission.content,
            editor: submission.editorKey,
            isPublished: true,
            isPrivate: submission.isPrivate,
            tags: tags,
            scriptCss: extra.css,
            scriptJs: extra.js,
            user: context.req.user
          })
        }

        // Update submission status
        await WIKI.models.pageSubmissions.query().findById(args.id).patch({
          status: 'approved',
          reviewerId: context.req.user.id,
          reviewComment: args.comment || '',
          reviewedAt: new Date().toISOString()
        })

        const fullSubmission = await WIKI.models.pageSubmissions.getSubmission(args.id)

        WIKI.logger.info(`Submission ${args.id} approved by ${context.req.user.email}`)

        try {
          await WIKI.notification.notifyPageApproved(fullSubmission, context.req.user)
        } catch (err) {
          WIKI.logger.warn('Failed to send approval notification: ' + err.message)
        }

        try {
          const submitter = await WIKI.models.users.query().findById(submission.submitterId)
          if (submitter && submitter.email) {
            const reviewerName = context.req.user.name || context.req.user.email
            const pageUrl = `${WIKI.config.host || 'http://localhost'}/${submission.localeCode}/${submission.path}`
            await WIKI.mail.send({
              to: submitter.email,
              subject: `Your page submission "${fullSubmission.title}" was approved`,
              text: `Hello ${submitter.name || 'there'},\n\nYour page submission "${fullSubmission.title}" has been approved and published.\n\nReviewed by: ${reviewerName}\n\nView the page: ${pageUrl}\n\nThank you.`
            })
            WIKI.logger.info(`Approval email sent to ${submitter.email} for submission ${args.id}`)
          }
        } catch (err) {
          WIKI.logger.warn('Failed to send approval email to submitter: ' + err.message)
        }

        return {
          responseResult: graphHelper.generateSuccess('Submission approved and page published successfully.'),
          submission: {
            ...fullSubmission,
            tags: safeJsonParse(fullSubmission.tags, [])
          }
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },

    /**
     * REJECT SUBMISSION
     */
    async reject(obj, args, context) {
      try {
        const submission = await WIKI.models.pageSubmissions.query().findById(args.id)
        if (!submission) {
          throw new Error('Submission not found')
        }

        if (submission.status !== 'pending') {
          throw new Error('Submission has already been reviewed')
        }

        if (!args.comment || _.trim(args.comment).length < 1) {
          throw new Error('A comment is required when rejecting a submission')
        }

        // Update submission status
        await WIKI.models.pageSubmissions.query().findById(args.id).patch({
          status: 'rejected',
          reviewerId: context.req.user.id,
          reviewComment: args.comment,
          reviewedAt: new Date().toISOString()
        })

        const fullSubmission = await WIKI.models.pageSubmissions.getSubmission(args.id)

        WIKI.logger.info(`Submission ${args.id} rejected by ${context.req.user.email}`)

        // This section was modified by Claude Code - Send notification for rejected submission
        try {
          await WIKI.notification.notifyPageRejected(fullSubmission, context.req.user, args.comment)
        } catch (err) {
          WIKI.logger.warn('Failed to send rejection notification: ' + err.message)
        }

        // This section was modified by Claude Code - Send email to submitter about rejection
        try {
          const submitter = await WIKI.models.users.query().findById(submission.submitterId)
          if (submitter && submitter.email) {
            const reviewerName = context.req.user.name || context.req.user.email
            const mySubmissionsUrl = `${WIKI.config.host || 'http://localhost'}/my-submissions`
            await WIKI.mail.send({
              to: submitter.email,
              subject: `Your page submission "${fullSubmission.title}" was rejected`,
              text: `Hello ${submitter.name || 'there'},\n\nYour page submission "${fullSubmission.title}" has been rejected.\n\nReason: ${args.comment}\n\nReviewed by: ${reviewerName}\n\nYou can view your submissions and make edits at: ${mySubmissionsUrl}\n\nThank you.`
            })
            WIKI.logger.info(`Rejection email sent to ${submitter.email} for submission ${args.id}`)
          }
        } catch (err) {
          WIKI.logger.warn('Failed to send rejection email to submitter: ' + err.message)
        }

        return {
          responseResult: graphHelper.generateSuccess('Submission rejected.'),
          submission: {
            ...fullSubmission,
            tags: safeJsonParse(fullSubmission.tags, [])
          }
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },

    /**
     * UPDATE SUBMISSION (edit content before approval)
     */
    async update(obj, args, context) {
      try {
        const submission = await WIKI.models.pageSubmissions.query().findById(args.id)
        if (!submission) {
          throw new Error('Submission not found')
        }

        if (submission.status !== 'pending') {
          throw new Error('Cannot edit a submission that has already been reviewed')
        }

        // Build update object
        const updateData = {
          content: args.content,
          contentType: 'markdown',
          editorKey: 'markdown'
        }

        if (args.title) {
          updateData.title = args.title
        }

        if (args.description !== undefined) {
          updateData.description = args.description
        }

        // Update the submission
        await WIKI.models.pageSubmissions.query().findById(args.id).patch(updateData)

        const fullSubmission = await WIKI.models.pageSubmissions.getSubmission(args.id)

        WIKI.logger.info(`Submission ${args.id} updated by ${context.req.user.email}`)

        return {
          responseResult: graphHelper.generateSuccess('Submission updated successfully.'),
          submission: {
            ...fullSubmission,
            tags: safeJsonParse(fullSubmission.tags, [])
          }
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },

    /**
     * DELETE SUBMISSION
     */
    async delete(obj, args, context) {
      try {
        const submission = await WIKI.models.pageSubmissions.query().findById(args.id)
        if (!submission) {
          throw new Error('Submission not found')
        }

        // Only allow deletion by submitter if draft or pending, or by reviewers
        const isSubmitter = submission.submitterId === context.req.user.id
        const canReview = WIKI.auth.checkAccess(context.req.user, ['review:pages', 'manage:system'])

        if (!isSubmitter && !canReview) {
          throw new Error('You do not have permission to delete this submission')
        }

        // This section was modified by Claude Code - Allow deletion of drafts
        if (isSubmitter && !canReview && submission.status !== 'pending' && submission.status !== 'draft') {
          throw new Error('You can only delete your own draft or pending submissions')
        }

        await WIKI.models.pageSubmissions.query().deleteById(args.id)

        WIKI.logger.info(`Submission ${args.id} deleted by ${context.req.user.email}`)

        return {
          responseResult: graphHelper.generateSuccess('Submission deleted successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },

    /**
     * SAVE DRAFT - This section was created by Claude Code
     * Save a submission as draft (create or update)
     */
    async saveDraft(obj, args, context) {
      try {
        // Validate path
        if (args.path.includes('.') || args.path.includes(' ') || args.path.includes('\\') || args.path.includes('//')) {
          throw new WIKI.Error.PageIllegalPath()
        }

        // Validate input lengths
        if (args.title && args.title.length > 500) {
          throw new Error('Title must be 500 characters or less.')
        }
        if (args.description && args.description.length > 2000) {
          throw new Error('Description must be 2000 characters or less.')
        }
        if (args.path && args.path.length > 500) {
          throw new Error('Path must be 500 characters or less.')
        }
        if (args.tags && args.tags.length > 20) {
          throw new Error('Maximum of 20 tags allowed.')
        }

        // Remove trailing/leading slashes
        let path = args.path
        if (path.endsWith('/')) {
          path = path.slice(0, -1)
        }
        if (path.startsWith('/')) {
          path = path.slice(1)
        }

        // Check for page access
        if (!WIKI.auth.checkAccess(context.req.user, ['write:pages'], {
          locale: args.locale,
          path: path
        })) {
          throw new WIKI.Error.PageUpdateForbidden()
        }

        // Format CSS Scripts
        let scriptCss = ''
        if (WIKI.auth.checkAccess(context.req.user, ['write:styles'], {
          locale: args.locale,
          path: path
        })) {
          if (!_.isEmpty(args.scriptCss)) {
            scriptCss = new CleanCSS({ inline: false }).minify(args.scriptCss).styles
          }
        }

        // Format JS Scripts
        let scriptJs = ''
        if (WIKI.auth.checkAccess(context.req.user, ['write:scripts'], {
          locale: args.locale,
          path: path
        })) {
          scriptJs = args.scriptJs || ''
        }

        // Find or create submission within a transaction to avoid races
        const submissionId = await WIKI.models.pageSubmissions.transaction(async trx => {
          let existingSubmission = null

          if (args.id) {
            existingSubmission = await WIKI.models.pageSubmissions.query(trx).findById(args.id).forUpdate()
          }

          if (!existingSubmission && args.pageId) {
            existingSubmission = await WIKI.models.pageSubmissions.query(trx)
              .where('pageId', args.pageId)
              .where('submitterId', context.req.user.id)
              .whereIn('status', ['draft', 'pending', 'rejected'])
              .forUpdate()
              .first()
          }

          if (!existingSubmission) {
            existingSubmission = await WIKI.models.pageSubmissions.query(trx)
              .where('path', path)
              .where('localeCode', args.locale)
              .where('submitterId', context.req.user.id)
              .whereIn('status', ['draft', 'pending', 'rejected'])
              .forUpdate()
              .first()
          }

          if (existingSubmission) {
            if (existingSubmission.submitterId !== context.req.user.id) {
              throw new Error('You can only edit your own drafts')
            }

            if (existingSubmission.status !== 'draft' && existingSubmission.status !== 'rejected' && existingSubmission.status !== 'pending') {
              throw new Error('You can only edit draft, pending, or rejected submissions')
            }

            await WIKI.models.pageSubmissions.query(trx).findById(existingSubmission.id).patch({
              pageId: args.pageId || existingSubmission.pageId || null,
              path: path,
              hash: pageHelper.generateHash({ path: path, locale: args.locale, privateNS: args.isPrivate ? 'TODO' : '' }),
              title: args.title,
              description: args.description,
              content: args.content,
              contentType: _.get(_.find(WIKI.data.editors, ['key', args.editor]), 'contentType', 'text'),
              editorKey: args.editor,
              localeCode: args.locale,
              isPrivate: args.isPrivate,
              extra: JSON.stringify({
                js: scriptJs,
                css: scriptCss
              }),
              tags: JSON.stringify(args.tags || []),
              status: 'draft'
            })

            return existingSubmission.id
          } else {
            const newSubmission = await WIKI.models.pageSubmissions.query(trx).insert({
              pageId: args.pageId || null,
              submitterId: context.req.user.id,
              path: path,
              hash: pageHelper.generateHash({ path: path, locale: args.locale, privateNS: args.isPrivate ? 'TODO' : '' }),
              title: args.title,
              description: args.description,
              content: args.content,
              contentType: _.get(_.find(WIKI.data.editors, ['key', args.editor]), 'contentType', 'text'),
              editorKey: args.editor,
              localeCode: args.locale,
              isPrivate: args.isPrivate,
              extra: JSON.stringify({
                js: scriptJs,
                css: scriptCss
              }),
              tags: JSON.stringify(args.tags || []),
              status: 'draft'
            })

            return newSubmission.id
          }
        })

        const submission = await WIKI.models.pageSubmissions.getSubmission(submissionId)

        WIKI.logger.info(`Draft saved by ${context.req.user.email} for path: ${path}`)

        return {
          responseResult: graphHelper.generateSuccess('Draft saved successfully.'),
          submission: {
            ...submission,
            tags: safeJsonParse(submission.tags, [])
          }
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },

    /**
     * RESUBMIT - This section was created by Claude Code
     * Resubmit a draft or rejected submission for review
     */
    async resubmit(obj, args, context) {
      try {
        const submission = await WIKI.models.pageSubmissions.query().findById(args.id)
        if (!submission) {
          throw new Error('Submission not found')
        }

        if (submission.submitterId !== context.req.user.id) {
          throw new Error('You can only resubmit your own submissions')
        }

        if (submission.status !== 'draft' && submission.status !== 'rejected') {
          throw new Error('You can only resubmit draft or rejected submissions')
        }

        // Update submission status to pending
        await WIKI.models.pageSubmissions.query().findById(args.id).patch({
          status: 'pending',
          reviewerId: null,
          reviewComment: null,
          reviewedAt: null
        })

        const fullSubmission = await WIKI.models.pageSubmissions.getSubmission(args.id)

        WIKI.logger.info(`Submission ${args.id} resubmitted by ${context.req.user.email}`)

        // Send notification for resubmission
        try {
          await WIKI.notification.notifyPageSubmitted(fullSubmission, context.req.user)
        } catch (err) {
          WIKI.logger.warn('Failed to send resubmission notification: ' + err.message)
        }

        return {
          responseResult: graphHelper.generateSuccess('Submission resubmitted for review.'),
          submission: {
            ...fullSubmission,
            tags: safeJsonParse(fullSubmission.tags, [])
          }
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },

    /**
     * UNSUBMIT - This section was created by Claude Code
     * Withdraw a pending submission back to draft
     */
    async unsubmit(obj, args, context) {
      try {
        const submission = await WIKI.models.pageSubmissions.query().findById(args.id)
        if (!submission) {
          throw new Error('Submission not found')
        }

        if (submission.submitterId !== context.req.user.id) {
          throw new Error('You can only withdraw your own submissions')
        }

        if (submission.status !== 'pending') {
          throw new Error('You can only withdraw pending submissions')
        }

        // Update submission status to draft
        await WIKI.models.pageSubmissions.query().findById(args.id).patch({
          status: 'draft'
        })

        const fullSubmission = await WIKI.models.pageSubmissions.getSubmission(args.id)

        WIKI.logger.info(`Submission ${args.id} withdrawn by ${context.req.user.email}`)

        return {
          responseResult: graphHelper.generateSuccess('Submission withdrawn. It is now a draft.'),
          submission: {
            ...fullSubmission,
            tags: safeJsonParse(fullSubmission.tags, [])
          }
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}

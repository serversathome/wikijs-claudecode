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
        tags: submission.tags ? JSON.parse(submission.tags) : [],
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

        // Create submission
        const submission = await WIKI.models.pageSubmissions.query().insert({
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
            tags: fullSubmission.tags ? JSON.parse(fullSubmission.tags) : []
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
        const tags = submission.tags ? JSON.parse(submission.tags) : []
        const extra = submission.extra ? JSON.parse(submission.extra) : {}

        let page
        if (submission.pageId) {
          // Update existing page
          page = await WIKI.models.pages.updatePage({
            id: submission.pageId,
            content: submission.content,
            description: submission.description,
            title: submission.title,
            tags: tags,
            isPublished: true,
            scriptCss: extra.css,
            scriptJs: extra.js,
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

        // This section was modified by Claude Code - Send notification for approved submission
        try {
          await WIKI.notification.notifyPageApproved(fullSubmission, context.req.user)
        } catch (err) {
          WIKI.logger.warn('Failed to send approval notification: ' + err.message)
        }

        return {
          responseResult: graphHelper.generateSuccess('Submission approved and page published successfully.'),
          submission: {
            ...fullSubmission,
            tags: fullSubmission.tags ? JSON.parse(fullSubmission.tags) : []
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
          await WIKI.notification.notifyPageRejected(fullSubmission, context.req.user)
        } catch (err) {
          WIKI.logger.warn('Failed to send rejection notification: ' + err.message)
        }

        return {
          responseResult: graphHelper.generateSuccess('Submission rejected.'),
          submission: {
            ...fullSubmission,
            tags: fullSubmission.tags ? JSON.parse(fullSubmission.tags) : []
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
            tags: fullSubmission.tags ? JSON.parse(fullSubmission.tags) : []
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

        // Only allow deletion by submitter if still pending, or by reviewers
        const isSubmitter = submission.submitterId === context.req.user.id
        const canReview = WIKI.auth.checkAccess(context.req.user, ['review:pages', 'manage:system'])

        if (!isSubmitter && !canReview) {
          throw new Error('You do not have permission to delete this submission')
        }

        if (isSubmitter && !canReview && submission.status !== 'pending') {
          throw new Error('You can only delete your own pending submissions')
        }

        await WIKI.models.pageSubmissions.query().deleteById(args.id)

        WIKI.logger.info(`Submission ${args.id} deleted by ${context.req.user.email}`)

        return {
          responseResult: graphHelper.generateSuccess('Submission deleted successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}

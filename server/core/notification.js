/**
 * This file was created by Claude Code
 * Apprise Notification Service for Wiki.js
 */

const { exec } = require('child_process')
const { promisify } = require('util')
const execAsync = promisify(exec)
const _ = require('lodash')

/* global WIKI */

module.exports = {
  /**
   * Initialize the notification service
   */
  init() {
    if (_.get(WIKI.config, 'notification.appriseUrls', '').length > 0) {
      WIKI.logger.info('Notification service initialized with Apprise')
    } else {
      WIKI.logger.info('Notification service initialized (no Apprise URLs configured)')
    }
    return this
  },

  /**
   * Send a notification via Apprise CLI
   * @param {string} title - Notification title
   * @param {string} body - Notification body/message
   * @param {string} [urls] - Optional override for Apprise URLs
   * @returns {Promise<boolean>} - True if notification sent successfully
   */
  async send(title, body, urls = null) {
    const appriseUrls = urls || _.get(WIKI.config, 'notification.appriseUrls', '')

    if (!appriseUrls || appriseUrls.trim().length === 0) {
      WIKI.logger.debug('Notification skipped: No Apprise URLs configured')
      return false
    }

    try {
      // Escape special characters for shell safety
      const safeTitle = title.replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$')
      const safeBody = body.replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$')

      // Build the apprise command
      const cmd = `apprise -t "${safeTitle}" -b "${safeBody}" ${appriseUrls}`

      await execAsync(cmd, { timeout: 30000 })
      WIKI.logger.info(`Notification sent: ${title}`)
      return true
    } catch (err) {
      WIKI.logger.warn(`Failed to send notification: ${err.message}`)
      return false
    }
  },

  /**
   * Send a test notification
   * @param {string} [urls] - Optional override for Apprise URLs
   * @returns {Promise<boolean>} - True if test notification sent successfully
   */
  async sendTest(urls = null) {
    return this.send(
      'Wiki.js Test Notification',
      'This is a test notification from Wiki.js. If you received this, your Apprise configuration is working correctly!',
      urls
    )
  },

  /**
   * Build a full URL to a page
   * @param {string} localeCode - Locale code (e.g., 'en')
   * @param {string} path - Page path
   * @param {string} [hash] - Optional URL hash/anchor
   * @returns {string} - Full URL
   */
  buildPageUrl(localeCode, path, hash = '') {
    const host = WIKI.config.host || 'http://localhost'
    const hashPart = hash ? `#${hash}` : ''
    return `${host}/${localeCode}/${path}${hashPart}`
  },

  /**
   * Notify about a new comment
   * @param {Object} page - Page object
   * @param {Object} author - Comment author
   */
  async notifyNewComment(page, author) {
    if (!_.get(WIKI.config, 'notification.onNewComment', false)) {
      return
    }
    const authorName = author ? (author.name || author.email || 'Anonymous') : 'Anonymous'
    const pageUrl = this.buildPageUrl(page.localeCode, page.path, 'comments')
    await this.send(
      'New Comment',
      `A new comment was posted by ${authorName} on page "${page.title}"\n\n${pageUrl}`
    )
  },

  /**
   * Build a URL to the admin submissions page
   * @returns {string} - Full URL to submissions admin
   */
  buildSubmissionsUrl() {
    const host = WIKI.config.host || 'http://localhost'
    return `${host}/a/submissions`
  },

  /**
   * Notify about a page submitted for review
   * @param {Object} submission - Submission object
   */
  async notifyPageSubmitted(submission) {
    if (!_.get(WIKI.config, 'notification.onPageSubmitted', false)) {
      return
    }
    const submissionsUrl = this.buildSubmissionsUrl()
    await this.send(
      'Page Submitted for Review',
      `A new page "${submission.title}" was submitted for review by ${submission.submitterName || 'Unknown'}\n\nReview it here: ${submissionsUrl}`
    )
  },

  /**
   * Notify about a page submission being approved
   * @param {Object} submission - Submission object
   * @param {Object} reviewer - Reviewer user object
   */
  async notifyPageApproved(submission, reviewer) {
    if (!_.get(WIKI.config, 'notification.onPageApproved', false)) {
      return
    }
    const reviewerName = reviewer ? (reviewer.name || reviewer.email || 'Admin') : 'Admin'
    const pageUrl = this.buildPageUrl(submission.localeCode, submission.path)
    await this.send(
      'Page Approved',
      `The page "${submission.title}" was approved by ${reviewerName}\n\nView it here: ${pageUrl}`
    )
  },

  /**
   * Notify about a page submission being rejected
   * @param {Object} submission - Submission object
   * @param {Object} reviewer - Reviewer user object
   * @param {string} reason - Rejection reason
   */
  async notifyPageRejected(submission, reviewer, reason) {
    if (!_.get(WIKI.config, 'notification.onPageRejected', false)) {
      return
    }
    const reviewerName = reviewer ? (reviewer.name || reviewer.email || 'Admin') : 'Admin'
    const reasonText = reason ? `\nReason: ${reason}` : ''
    const submissionsUrl = this.buildSubmissionsUrl()
    await this.send(
      'Page Rejected',
      `The page "${submission.title}" was rejected by ${reviewerName}${reasonText}\n\nView details: ${submissionsUrl}`
    )
  },

  /**
   * Build a URL to the admin users page
   * @returns {string} - Full URL to users admin
   */
  buildUsersUrl() {
    const host = WIKI.config.host || 'http://localhost'
    return `${host}/a/users`
  },

  /**
   * Notify about a new user signup
   * @param {Object} user - User object with name and email
   */
  async notifyNewUser(user) {
    if (!_.get(WIKI.config, 'notification.onNewUser', false)) {
      return
    }
    const userName = user.name || 'Unknown'
    const userEmail = user.email || 'No email'
    const usersUrl = this.buildUsersUrl()
    await this.send(
      'New User Registered',
      `A new user has registered:\n\nName: ${userName}\nEmail: ${userEmail}\n\nManage users: ${usersUrl}`
    )
  }
}

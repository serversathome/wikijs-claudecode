/**
 * This file was created by Claude Code
 * GraphQL Resolver for Notification settings
 */

const _ = require('lodash')
const graphHelper = require('../../helpers/graph')

/* global WIKI */

module.exports = {
  Query: {
    async notification() { return {} }
  },
  Mutation: {
    async notification() { return {} }
  },
  NotificationQuery: {
    async config(obj, args, context, info) {
      return {
        appriseUrls: _.get(WIKI.config, 'notification.appriseUrls', ''),
        onNewComment: _.get(WIKI.config, 'notification.onNewComment', false),
        onNewUser: _.get(WIKI.config, 'notification.onNewUser', false),
        onPageSubmitted: _.get(WIKI.config, 'notification.onPageSubmitted', false),
        onPageApproved: _.get(WIKI.config, 'notification.onPageApproved', false),
        onPageRejected: _.get(WIKI.config, 'notification.onPageRejected', false)
      }
    }
  },
  NotificationMutation: {
    async sendTest(obj, args, context) {
      try {
        const success = await WIKI.notification.sendTest()

        if (success) {
          return {
            responseResult: graphHelper.generateSuccess('Test notification sent successfully.')
          }
        } else {
          throw new Error('Failed to send test notification. Check that Apprise URLs are configured and valid.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async updateConfig(obj, args, context) {
      try {
        WIKI.config.notification = {
          appriseUrls: args.appriseUrls,
          onNewComment: args.onNewComment,
          onNewUser: args.onNewUser,
          onPageSubmitted: args.onPageSubmitted,
          onPageApproved: args.onPageApproved,
          onPageRejected: args.onPageRejected
        }
        await WIKI.configSvc.saveToDb(['notification'])

        // Reinitialize notification service
        WIKI.notification.init()

        return {
          responseResult: graphHelper.generateSuccess('Notification configuration updated successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}

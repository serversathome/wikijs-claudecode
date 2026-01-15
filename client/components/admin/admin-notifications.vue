<!-- This file was created by Claude Code - Admin page for Apprise notification settings -->
<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/_assets/svg/icon-new-post.svg', alt='Notifications', style='width: 80px;')
          .admin-header-title
            .headline.primary--text.animated.fadeInLeft Notifications
            .subtitle-1.grey--text.animated.fadeInLeft.wait-p4s Configure Apprise notifications for wiki events
          v-spacer
          v-btn.animated.fadeInDown(color='success', depressed, @click='save', large)
            v-icon(left) mdi-check
            span Apply
        v-form.pt-3
          v-layout(row wrap)
            v-flex(lg6 xs12)
              v-card.animated.fadeInUp
                v-toolbar(color='primary', dark, dense, flat)
                  v-toolbar-title.subtitle-1 Apprise Configuration
                v-card-info
                  span Enter your Apprise notification URLs. Supports Discord, Slack, Telegram, Email, and many more services.
                  a.ml-1(href='https://github.com/caronc/apprise/wiki' target='_blank') Learn more about Apprise URLs
                .pa-4
                  v-textarea(
                    outlined
                    v-model='config.appriseUrls'
                    label='Apprise URLs'
                    placeholder='discord://webhook_id/webhook_token'
                    prepend-icon='mdi-bell-ring'
                    persistent-hint
                    hint='Enter one or more Apprise URLs, separated by spaces. Example: discord://... slack://... telegram://...'
                    rows='4'
                    )

              v-card.mt-3.animated.fadeInUp.wait-p2s
                v-toolbar(color='primary', dark, dense, flat)
                  v-toolbar-title.subtitle-1 Notification Events
                v-card-info
                  span Select which events should trigger notifications.
                .pa-4
                  v-switch(
                    v-model='config.onNewComment'
                    label='New Comment Posted'
                    color='primary'
                    prepend-icon='mdi-comment'
                    persistent-hint
                    hint='Send notification when a new comment is posted on any page'
                    inset
                    )
                  v-switch(
                    v-model='config.onNewUser'
                    label='New User Registered'
                    color='primary'
                    prepend-icon='mdi-account-plus'
                    persistent-hint
                    hint='Send notification when a new user registers or is created'
                    inset
                    )
                  v-switch(
                    v-model='config.onPageSubmitted'
                    label='Page Submitted for Review'
                    color='primary'
                    prepend-icon='mdi-file-document-edit'
                    persistent-hint
                    hint='Send notification when a page is submitted for review'
                    inset
                    )
                  v-switch(
                    v-model='config.onPageApproved'
                    label='Page Approved'
                    color='primary'
                    prepend-icon='mdi-check-circle'
                    persistent-hint
                    hint='Send notification when a page submission is approved'
                    inset
                    )
                  v-switch(
                    v-model='config.onPageRejected'
                    label='Page Rejected'
                    color='primary'
                    prepend-icon='mdi-close-circle'
                    persistent-hint
                    hint='Send notification when a page submission is rejected'
                    inset
                    )

            v-flex(lg6 xs12)
              v-card.animated.fadeInUp.wait-p3s
                v-toolbar(color='teal', dark, dense, flat)
                  v-toolbar-title.subtitle-1 Test Notification
                .pa-4
                  .body-2.grey--text.text--darken-2 Send a test notification to verify your Apprise configuration is working correctly.
                v-card-chin
                  v-spacer
                  v-btn.px-4(color='teal', dark, @click='sendTest', :loading='testLoading', :disabled='!config.appriseUrls')
                    v-icon(left) mdi-send
                    span Send Test

              v-card.mt-3.animated.fadeInUp.wait-p4s
                v-toolbar(color='grey darken-1', dark, dense, flat)
                  v-toolbar-title.subtitle-1 Supported Services
                .pa-4
                  .body-2.grey--text.text--darken-2 Apprise supports 80+ notification services including:
                  v-chip.ma-1(small) Discord
                  v-chip.ma-1(small) Slack
                  v-chip.ma-1(small) Telegram
                  v-chip.ma-1(small) Email
                  v-chip.ma-1(small) Pushover
                  v-chip.ma-1(small) Gotify
                  v-chip.ma-1(small) ntfy
                  v-chip.ma-1(small) Matrix
                  v-chip.ma-1(small) Mattermost
                  v-chip.ma-1(small) Microsoft Teams
                  v-chip.ma-1(small) And many more...
                  .mt-3
                    a(href='https://github.com/caronc/apprise/wiki#notification-services' target='_blank') View full list of supported services

</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'

export default {
  data() {
    return {
      config: {
        appriseUrls: '',
        onNewComment: false,
        onNewUser: false,
        onPageSubmitted: false,
        onPageApproved: false,
        onPageRejected: false
      },
      testLoading: false
    }
  },
  methods: {
    async save () {
      try {
        await this.$apollo.mutate({
          mutation: gql`
            mutation (
              $appriseUrls: String!
              $onNewComment: Boolean!
              $onNewUser: Boolean!
              $onPageSubmitted: Boolean!
              $onPageApproved: Boolean!
              $onPageRejected: Boolean!
            ) {
              notification {
                updateConfig(
                  appriseUrls: $appriseUrls
                  onNewComment: $onNewComment
                  onNewUser: $onNewUser
                  onPageSubmitted: $onPageSubmitted
                  onPageApproved: $onPageApproved
                  onPageRejected: $onPageRejected
                ) {
                  responseResult {
                    succeeded
                    errorCode
                    slug
                    message
                  }
                }
              }
            }
          `,
          variables: {
            appriseUrls: this.config.appriseUrls || '',
            onNewComment: this.config.onNewComment || false,
            onNewUser: this.config.onNewUser || false,
            onPageSubmitted: this.config.onPageSubmitted || false,
            onPageApproved: this.config.onPageApproved || false,
            onPageRejected: this.config.onPageRejected || false
          },
          watchLoading (isLoading) {
            this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-notification-update')
          }
        })
        this.$store.commit('showNotification', {
          style: 'success',
          message: 'Notification configuration updated successfully.',
          icon: 'check'
        })
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
    },
    async sendTest () {
      this.testLoading = true
      try {
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation {
              notification {
                sendTest {
                  responseResult {
                    succeeded
                    errorCode
                    slug
                    message
                  }
                }
              }
            }
          `
        })
        if (!_.get(resp, 'data.notification.sendTest.responseResult.succeeded', false)) {
          throw new Error(_.get(resp, 'data.notification.sendTest.responseResult.message', 'An unexpected error occurred.'))
        }

        this.$store.commit('showNotification', {
          style: 'success',
          message: 'Test notification sent successfully!',
          icon: 'check'
        })
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.testLoading = false
    }
  },
  apollo: {
    config: {
      query: gql`
        {
          notification {
            config {
              appriseUrls
              onNewComment
              onNewUser
              onPageSubmitted
              onPageApproved
              onPageRejected
            }
          }
        }
      `,
      fetchPolicy: 'network-only',
      update: (data) => _.cloneDeep(data.notification.config),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-notification-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>

</style>

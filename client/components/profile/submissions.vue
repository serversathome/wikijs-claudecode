<!-- This file was created by Claude Code - My Submissions page for review workflow -->
<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .profile-header
          img.animated.fadeInUp(src='/_assets/svg/icon-file.svg', alt='Submissions', style='width: 80px;')
          .profile-header-title
            .headline.primary--text.animated.fadeInLeft {{ $t('admin:submissions.mySubmissions') }}
            .subheading.grey--text.animated.fadeInLeft {{ $t('admin:submissions.mySubmissionsSubtitle') }}
          v-spacer
          v-btn.animated.fadeInDown.wait-p1s(color='grey', outlined, @click='refresh', large)
            v-icon.grey--text mdi-refresh
      v-flex(xs12)
        v-card.animated.fadeInUp
          .pa-2.d-flex.align-center(:class='$vuetify.theme.dark ? `grey darken-3-d5` : `grey lighten-3`')
            v-select(
              solo
              flat
              hide-details
              dense
              label='Filter by Status'
              :items='statusOptions'
              v-model='selectedStatus'
              style='max-width: 200px;'
            )
          v-divider
          v-data-table(
            :items='submissions'
            :headers='headers'
            :page.sync='pagination'
            :items-per-page='15'
            :loading='loading'
            must-sort,
            sort-by='createdAt',
            sort-desc,
            hide-default-footer
            @page-count="pageTotal = $event"
          )
            template(v-slot:item='{ item }')
              tr
                td
                  .body-2: strong {{ item.title }}
                  .caption.grey--text /{{ item.path }}
                td
                  v-chip(
                    small
                    :color='getStatusColor(item.status)'
                    text-color='white'
                  ) {{ getStatusLabel(item.status) }}
                td {{ item.createdAt | moment('calendar') }}
                td.text-right
                  //- Draft actions
                  template(v-if='item.status === "draft"')
                    v-tooltip(bottom)
                      template(v-slot:activator='{ on }')
                        v-btn.mr-1(
                          v-on='on'
                          icon
                          small
                          color='purple'
                          @click='editDraft(item)'
                        )
                          v-icon(small) mdi-pencil
                      span {{ $t('admin:submissions.edit') }}
                    v-tooltip(bottom)
                      template(v-slot:activator='{ on }')
                        v-btn.mr-1(
                          v-on='on'
                          icon
                          small
                          color='orange'
                          @click='submitDraft(item)'
                        )
                          v-icon(small) mdi-file-send
                      span {{ $t('admin:submissions.submitDraft') }}
                    v-tooltip(bottom)
                      template(v-slot:activator='{ on }')
                        v-btn(
                          v-on='on'
                          icon
                          small
                          color='red'
                          @click='openDeleteDialog(item)'
                        )
                          v-icon(small) mdi-delete
                      span {{ $t('admin:submissions.delete') }}
                  //- Pending actions
                  template(v-if='item.status === "pending"')
                    v-tooltip(bottom)
                      template(v-slot:activator='{ on }')
                        v-btn.mr-1(
                          v-on='on'
                          icon
                          small
                          color='grey'
                          @click='withdrawSubmission(item)'
                        )
                          v-icon(small) mdi-undo
                      span {{ $t('admin:submissions.withdraw') }}
                  //- Rejected actions
                  template(v-if='item.status === "rejected"')
                    v-tooltip(bottom)
                      template(v-slot:activator='{ on }')
                        v-btn.mr-1(
                          v-on='on'
                          icon
                          small
                          color='purple'
                          @click='editDraft(item)'
                        )
                          v-icon(small) mdi-pencil
                      span {{ $t('admin:submissions.edit') }}
                    v-tooltip(bottom)
                      template(v-slot:activator='{ on }')
                        v-btn.mr-1(
                          v-on='on'
                          icon
                          small
                          color='orange'
                          @click='resubmit(item)'
                        )
                          v-icon(small) mdi-refresh
                      span {{ $t('admin:submissions.resubmit') }}
                  //- View details for all
                  v-tooltip(bottom)
                    template(v-slot:activator='{ on }')
                      v-btn(
                        v-on='on'
                        icon
                        small
                        color='blue'
                        @click='viewSubmission(item)'
                      )
                        v-icon(small) mdi-eye
                    span {{ $t('admin:submissions.viewDetails') }}
            template(v-slot:no-data)
              v-alert.ma-3(icon='mdi-check-circle', :value='true', outlined, color='grey') {{ $t('admin:submissions.noDrafts') }}
          .text-center.py-2.animated.fadeInDown(v-if='pageTotal > 1')
            v-pagination(v-model='pagination', :length='pageTotal')

    //- View Content Dialog
    v-dialog(v-model='viewDialog', max-width='800', scrollable)
      v-card(v-if='selectedSubmission')
        v-toolbar(flat, :color='getStatusColor(selectedSubmission.status)', dark)
          v-toolbar-title {{ selectedSubmission.title }}
          v-spacer
          v-chip.ml-2(small, outlined) {{ getStatusLabel(selectedSubmission.status) }}
        v-card-text.pa-0
          v-container(fluid)
            v-row
              v-col(cols='12')
                v-card(outlined)
                  v-card-title.subtitle-2 Submission Details
                  v-card-text
                    .d-flex.mb-2
                      v-icon.mr-2(small) mdi-calendar
                      span.grey--text Submitted:&nbsp;
                      strong {{ selectedSubmission.createdAt | moment('LLLL') }}
                    .d-flex.mb-2
                      v-icon.mr-2(small) mdi-link
                      span.grey--text Path:&nbsp;
                      strong /{{ selectedSubmission.path }}
                    .d-flex.mb-2(v-if='selectedSubmission.description')
                      v-icon.mr-2(small) mdi-text
                      span.grey--text Description:&nbsp;
                      span {{ selectedSubmission.description }}
                    .mt-3(v-if='selectedSubmission.reviewComment')
                      v-alert(
                        :type='selectedSubmission.status === "approved" ? "success" : "error"'
                        dense
                        outlined
                      )
                        .caption Review Comment:
                        | {{ selectedSubmission.reviewComment }}
        v-card-actions
          v-spacer
          v-btn(text, @click='viewDialog = false') {{ $t('common:actions.close') }}

    //- Delete Dialog
    v-dialog(v-model='deleteDialog', max-width='400')
      v-card
        v-card-title.headline.red--text
          v-icon.mr-2(color='red') mdi-delete
          | {{ $t('admin:submissions.delete') }}
        v-card-text
          p Are you sure you want to delete this draft?
          p.font-weight-bold "{{ selectedSubmission ? selectedSubmission.title : '' }}"
        v-card-actions
          v-spacer
          v-btn(text, @click='deleteDialog = false') {{ $t('common:actions.cancel') }}
          v-btn(color='red', dark, @click='deleteSubmission')
            v-icon(left) mdi-delete
            | {{ $t('admin:submissions.delete') }}

    notify
</template>

<script>
import gql from 'graphql-tag'

export default {
  data() {
    return {
      submissions: [],
      pagination: 1,
      pageTotal: 0,
      loading: false,
      selectedStatus: null,
      viewDialog: false,
      deleteDialog: false,
      selectedSubmission: null,
      statusOptions: [
        { text: 'All', value: null },
        { text: 'Drafts', value: 'draft' },
        { text: 'Pending Review', value: 'pending' },
        { text: 'Rejected', value: 'rejected' }
      ],
      headers: [
        { text: 'Title / Path', value: 'title' },
        { text: 'Status', value: 'status', width: 120 },
        { text: 'Created', value: 'createdAt', width: 180 },
        { text: 'Actions', value: 'actions', sortable: false, width: 150, align: 'right' }
      ]
    }
  },
  watch: {
    selectedStatus() {
      this.refresh()
    }
  },
  methods: {
    async refresh() {
      this.loading = true
      try {
        const resp = await this.$apollo.query({
          query: gql`
            query ($status: SubmissionStatus) {
              submissions {
                mySubmissions(status: $status) {
                  id
                  pageId
                  path
                  title
                  description
                  localeCode
                  status
                  createdAt
                  updatedAt
                  reviewedAt
                }
              }
            }
          `,
          variables: {
            status: this.selectedStatus
          },
          fetchPolicy: 'network-only'
        })
        this.submissions = resp.data.submissions.mySubmissions
      } catch (err) {
        this.$store.commit('showNotification', {
          message: err.message,
          style: 'error',
          icon: 'warning'
        })
      }
      this.loading = false
    },
    getStatusColor(status) {
      switch (status) {
        case 'draft': return 'grey'
        case 'pending': return 'orange'
        case 'approved': return 'green'
        case 'rejected': return 'red'
        default: return 'grey'
      }
    },
    getStatusLabel(status) {
      switch (status) {
        case 'draft': return this.$t('admin:submissions.draft')
        case 'pending': return this.$t('admin:submissions.pending')
        case 'approved': return this.$t('admin:submissions.approved')
        case 'rejected': return this.$t('admin:submissions.rejected')
        default: return status
      }
    },
    async viewSubmission(item) {
      this.loading = true
      try {
        // Fetch full submission details - use mySubmissions to get the item
        // For now, use the list item data which should be sufficient
        this.selectedSubmission = item
        this.viewDialog = true
      } catch (err) {
        this.$store.commit('showNotification', {
          message: err.message,
          style: 'error',
          icon: 'warning'
        })
      }
      this.loading = false
    },
    editDraft(item) {
      // Navigate to editor with the draft loaded
      // For now, we'll redirect to the page editor path
      if (item.pageId) {
        window.location.assign(`/e/${item.localeCode}/${item.path}`)
      } else {
        // For new page drafts, redirect to create page with the path
        window.location.assign(`/e/${item.localeCode}/${item.path}`)
      }
    },
    async submitDraft(item) {
      this.loading = true
      try {
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation ($id: Int!) {
              submissions {
                resubmit(id: $id) {
                  responseResult {
                    succeeded
                    message
                  }
                }
              }
            }
          `,
          variables: { id: item.id }
        })
        if (resp.data.submissions.resubmit.responseResult.succeeded) {
          this.$store.commit('showNotification', {
            message: this.$t('admin:submissions.resubmitSuccess'),
            style: 'success',
            icon: 'check'
          })
          this.refresh()
        } else {
          throw new Error(resp.data.submissions.resubmit.responseResult.message)
        }
      } catch (err) {
        this.$store.commit('showNotification', {
          message: err.message,
          style: 'error',
          icon: 'warning'
        })
      }
      this.loading = false
    },
    async resubmit(item) {
      this.loading = true
      try {
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation ($id: Int!) {
              submissions {
                resubmit(id: $id) {
                  responseResult {
                    succeeded
                    message
                  }
                }
              }
            }
          `,
          variables: { id: item.id }
        })
        if (resp.data.submissions.resubmit.responseResult.succeeded) {
          this.$store.commit('showNotification', {
            message: this.$t('admin:submissions.resubmitSuccess'),
            style: 'success',
            icon: 'check'
          })
          this.refresh()
        } else {
          throw new Error(resp.data.submissions.resubmit.responseResult.message)
        }
      } catch (err) {
        this.$store.commit('showNotification', {
          message: err.message,
          style: 'error',
          icon: 'warning'
        })
      }
      this.loading = false
    },
    async withdrawSubmission(item) {
      this.loading = true
      try {
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation ($id: Int!) {
              submissions {
                unsubmit(id: $id) {
                  responseResult {
                    succeeded
                    message
                  }
                }
              }
            }
          `,
          variables: { id: item.id }
        })
        if (resp.data.submissions.unsubmit.responseResult.succeeded) {
          this.$store.commit('showNotification', {
            message: this.$t('admin:submissions.withdrawSuccess'),
            style: 'success',
            icon: 'check'
          })
          this.refresh()
        } else {
          throw new Error(resp.data.submissions.unsubmit.responseResult.message)
        }
      } catch (err) {
        this.$store.commit('showNotification', {
          message: err.message,
          style: 'error',
          icon: 'warning'
        })
      }
      this.loading = false
    },
    openDeleteDialog(item) {
      this.selectedSubmission = item
      this.deleteDialog = true
    },
    async deleteSubmission() {
      this.loading = true
      this.deleteDialog = false
      try {
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation ($id: Int!) {
              submissions {
                delete(id: $id) {
                  responseResult {
                    succeeded
                    message
                  }
                }
              }
            }
          `,
          variables: { id: this.selectedSubmission.id }
        })
        if (resp.data.submissions.delete.responseResult.succeeded) {
          this.$store.commit('showNotification', {
            message: this.$t('admin:submissions.draftDeleted'),
            style: 'success',
            icon: 'check'
          })
          this.refresh()
        } else {
          throw new Error(resp.data.submissions.delete.responseResult.message)
        }
      } catch (err) {
        this.$store.commit('showNotification', {
          message: err.message,
          style: 'error',
          icon: 'warning'
        })
      }
      this.loading = false
    }
  },
  mounted() {
    this.refresh()
  }
}
</script>

<style lang='scss'>

</style>

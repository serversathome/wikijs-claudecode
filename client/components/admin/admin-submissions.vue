<!-- This file was created by Claude Code - Admin page for reviewing page submissions -->
<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/_assets/svg/icon-file.svg', alt='Submissions', style='width: 80px;')
          .admin-header-title
            .headline.orange--text.text--darken-2.animated.fadeInLeft Page Submissions
            .subtitle-1.grey--text.animated.fadeInLeft.wait-p2s Review pending page submissions
          v-spacer
          v-chip.mr-3.animated.fadeInDown(
            v-if='pendingCount > 0'
            color='orange'
            text-color='white'
            small
          )
            v-avatar(left)
              v-icon(small) mdi-alert-circle
            | {{ pendingCount }} pending
          v-btn.animated.fadeInDown(icon, color='grey', outlined, @click='refresh')
            v-icon.grey--text mdi-refresh
        v-card.mt-3.animated.fadeInUp
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
                td {{ item.id }}
                td
                  .body-2: strong {{ item.title }}
                  .caption.grey--text /{{ item.path }}
                td
                  v-chip(
                    small
                    :color='getStatusColor(item.status)'
                    text-color='white'
                  ) {{ item.status.charAt(0).toUpperCase() + item.status.slice(1) }}
                td {{ item.submitterName }}
                td {{ item.createdAt | moment('calendar') }}
                td.text-right
                  v-tooltip(bottom, v-if='item.status === "pending"')
                    template(v-slot:activator='{ on }')
                      v-btn.mr-1(
                        v-on='on'
                        icon
                        small
                        color='purple'
                        @click='openEditDialog(item)'
                      )
                        v-icon(small) mdi-pencil
                    span Edit
                  v-tooltip(bottom, v-if='item.status === "pending"')
                    template(v-slot:activator='{ on }')
                      v-btn.mr-1(
                        v-on='on'
                        icon
                        small
                        color='green'
                        @click='openApproveDialog(item)'
                      )
                        v-icon(small) mdi-check
                    span Approve
                  v-tooltip(bottom, v-if='item.status === "pending"')
                    template(v-slot:activator='{ on }')
                      v-btn.mr-1(
                        v-on='on'
                        icon
                        small
                        color='red'
                        @click='openRejectDialog(item)'
                      )
                        v-icon(small) mdi-close
                    span Reject
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
                    span View Details
            template(v-slot:no-data)
              v-alert.ma-3(icon='mdi-check-circle', :value='true', outlined, color='green') No pending submissions
          .text-center.py-2.animated.fadeInDown(v-if='pageTotal > 1')
            v-pagination(v-model='pagination', :length='pageTotal')

    //- Approve Dialog
    v-dialog(v-model='approveDialog', max-width='500')
      v-card
        v-card-title.headline.green--text
          v-icon.mr-2(color='green') mdi-check-circle
          | Approve Submission
        v-card-text
          p Are you sure you want to approve this submission?
          p.font-weight-bold The page "{{ selectedSubmission ? selectedSubmission.title : '' }}" will be published immediately.
        v-card-actions
          v-spacer
          v-btn(text, @click='approveDialog = false') Cancel
          v-btn(color='green', dark, @click='approveSubmission')
            v-icon(left) mdi-check
            | Approve

    //- Reject Dialog
    v-dialog(v-model='rejectDialog', max-width='500')
      v-card
        v-card-title.headline.red--text
          v-icon.mr-2(color='red') mdi-close-circle
          | Reject Submission
        v-card-text
          p Please provide a reason for rejecting this submission. This will be sent to the submitter.
          v-textarea(
            v-model='rejectComment'
            label='Rejection Reason'
            placeholder='Enter the reason for rejection...'
            outlined
            rows='3'
            :rules='[v => !!v || "A reason is required"]'
          )
        v-card-actions
          v-spacer
          v-btn(text, @click='rejectDialog = false') Cancel
          v-btn(color='red', dark, @click='rejectSubmission', :disabled='!rejectComment.trim()')
            v-icon(left) mdi-close
            | Reject

    //- Edit Dialog
    v-dialog(v-model='editDialog', max-width='1200', persistent, scrollable)
      v-card(v-if='selectedSubmission')
        v-toolbar(flat, color='purple', dark)
          v-icon.mr-2 mdi-pencil
          v-toolbar-title Edit Submission
          v-spacer
          v-btn(icon, @click='editDialog = false')
            v-icon mdi-close
        v-card-text.pa-0
          v-container(fluid)
            v-row
              v-col(cols='12')
                v-text-field(
                  v-model='editTitle'
                  label='Title'
                  outlined
                  dense
                  hide-details
                )
              v-col(cols='12')
                v-text-field(
                  v-model='editDescription'
                  label='Description'
                  outlined
                  dense
                  hide-details
                )
              v-col(cols='12')
                .d-flex.align-center.mb-2
                  v-icon.mr-2(small) mdi-language-markdown
                  span.subtitle-2 Markdown Content
                  v-spacer
                  v-chip(small, outlined, v-if='selectedSubmission.contentType !== "markdown"')
                    v-icon(small, left) mdi-swap-horizontal
                    | Converted from {{ selectedSubmission.editorKey }}
                v-textarea(
                  v-model='editContent'
                  outlined
                  rows='20'
                  class='markdown-editor'
                  placeholder='Enter markdown content...'
                  hide-details
                  :style='{ fontFamily: "Roboto Mono, monospace", fontSize: "14px" }'
                )
        v-card-actions
          v-btn(text, color='grey', @click='editDialog = false') Cancel
          v-spacer
          v-btn(color='purple', dark, @click='saveEdit', :loading='saving')
            v-icon(left) mdi-content-save
            | Save
          v-btn(color='green', dark, @click='saveAndApprove', :loading='saving')
            v-icon(left) mdi-check
            | Save & Approve

    //- View Content Dialog
    v-dialog(v-model='viewDialog', max-width='1000', scrollable)
      v-card(v-if='selectedSubmission')
        v-toolbar(flat, :color='getStatusColor(selectedSubmission.status)', dark)
          v-toolbar-title {{ selectedSubmission.title }}
          v-spacer
          v-chip.ml-2(small, outlined) {{ selectedSubmission.status.charAt(0).toUpperCase() + selectedSubmission.status.slice(1) }}
        v-card-text.pa-0
          v-container(fluid)
            v-row
              v-col(cols='12', md='4')
                v-card(outlined)
                  v-card-title.subtitle-2 Submission Details
                  v-card-text
                    .d-flex.mb-2
                      v-icon.mr-2(small) mdi-account
                      span.grey--text Submitted by:&nbsp;
                      strong {{ selectedSubmission.submitterName }}
                    .d-flex.mb-2
                      v-icon.mr-2(small) mdi-calendar
                      span.grey--text Submitted:&nbsp;
                      strong {{ selectedSubmission.createdAt | moment('LLLL') }}
                    .d-flex.mb-2
                      v-icon.mr-2(small) mdi-link
                      span.grey--text Path:&nbsp;
                      strong /{{ selectedSubmission.path }}
                    .d-flex.mb-2
                      v-icon.mr-2(small) mdi-file-document
                      span.grey--text Editor:&nbsp;
                      strong {{ selectedSubmission.editorKey }}
                    .d-flex.mb-2(v-if='selectedSubmission.description')
                      v-icon.mr-2(small) mdi-text
                      span.grey--text Description:&nbsp;
                      span {{ selectedSubmission.description }}
                    .d-flex(v-if='selectedSubmission.reviewerName')
                      v-icon.mr-2(small) mdi-account-check
                      span.grey--text Reviewed by:&nbsp;
                      strong {{ selectedSubmission.reviewerName }}
                    .mt-3(v-if='selectedSubmission.reviewComment')
                      v-alert(
                        :type='selectedSubmission.status === "approved" ? "success" : "error"'
                        dense
                        outlined
                      )
                        .caption Review Comment:
                        | {{ selectedSubmission.reviewComment }}
              v-col(cols='12', md='8')
                v-card(outlined)
                  v-tabs(v-model='contentTab', background-color='grey lighten-4')
                    v-tab Preview
                    v-tab Source
                  v-tabs-items(v-model='contentTab')
                    v-tab-item
                      .submission-preview.pa-4(v-html='renderedContent')
                    v-tab-item
                      pre.submission-source.pa-4 {{ selectedSubmission.contentMarkdown || selectedSubmission.content }}
        v-card-actions
          v-spacer
          v-btn(text, @click='viewDialog = false') Close
          v-btn(
            v-if='selectedSubmission.status === "pending"'
            color='purple'
            dark
            @click='viewDialog = false; openEditDialog(selectedSubmission)'
          )
            v-icon(left) mdi-pencil
            | Edit
          v-btn(
            v-if='selectedSubmission.status === "pending"'
            color='green'
            dark
            @click='viewDialog = false; openApproveDialog(selectedSubmission)'
          )
            v-icon(left) mdi-check
            | Approve
          v-btn(
            v-if='selectedSubmission.status === "pending"'
            color='red'
            dark
            @click='viewDialog = false; openRejectDialog(selectedSubmission)'
          )
            v-icon(left) mdi-close
            | Reject

    notify
</template>

<script>
import gql from 'graphql-tag'
import markdownit from 'markdown-it'

const md = markdownit({
  html: true,
  linkify: true,
  typographer: true,
  breaks: true
})

export default {
  data() {
    return {
      submissions: [],
      pendingCount: 0,
      pagination: 1,
      pageTotal: 0,
      loading: false,
      saving: false,
      selectedStatus: 'pending',
      contentTab: 0,
      statusOptions: [
        { text: 'All Submissions', value: null },
        { text: 'Drafts', value: 'draft' },
        { text: 'Pending Review', value: 'pending' },
        { text: 'Approved', value: 'approved' },
        { text: 'Rejected', value: 'rejected' }
      ],
      headers: [
        { text: 'ID', value: 'id', width: 80 },
        { text: 'Title / Path', value: 'title' },
        { text: 'Status', value: 'status', width: 120 },
        { text: 'Author', value: 'submitterName', width: 150 },
        { text: 'Submitted', value: 'createdAt', width: 180 },
        { text: 'Actions', value: 'actions', sortable: false, width: 180, align: 'right' }
      ],
      approveDialog: false,
      rejectDialog: false,
      editDialog: false,
      viewDialog: false,
      selectedSubmission: null,
      rejectComment: '',
      editTitle: '',
      editDescription: '',
      editContent: ''
    }
  },
  computed: {
    renderedContent() {
      if (!this.selectedSubmission) {
        return ''
      }
      // Use contentMarkdown if available, otherwise use content
      const content = this.selectedSubmission.contentMarkdown || this.selectedSubmission.content
      if (!content) {
        return ''
      }
      // Render markdown to HTML
      try {
        return md.render(content)
      } catch (e) {
        return '<pre>' + content + '</pre>'
      }
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
                list(status: $status) {
                  id
                  pageId
                  path
                  title
                  description
                  localeCode
                  status
                  submitterName
                  submitterEmail
                  reviewerName
                  createdAt
                  updatedAt
                  reviewedAt
                }
                pendingCount
              }
            }
          `,
          variables: {
            status: this.selectedStatus
          },
          fetchPolicy: 'network-only'
        })
        this.submissions = resp.data.submissions.list
        this.pendingCount = resp.data.submissions.pendingCount
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
        case 'pending': return 'orange'
        case 'approved': return 'green'
        case 'rejected': return 'red'
        default: return 'grey'
      }
    },
    openApproveDialog(item) {
      this.selectedSubmission = item
      this.approveDialog = true
    },
    openRejectDialog(item) {
      this.selectedSubmission = item
      this.rejectComment = ''
      this.rejectDialog = true
    },
    async openEditDialog(item) {
      this.loading = true
      try {
        const resp = await this.$apollo.query({
          query: gql`
            query ($id: Int!) {
              submissions {
                single(id: $id) {
                  id
                  pageId
                  path
                  title
                  description
                  content
                  contentMarkdown
                  contentType
                  editorKey
                  localeCode
                  status
                  submitterName
                  submitterEmail
                }
              }
            }
          `,
          variables: { id: item.id },
          fetchPolicy: 'network-only'
        })
        this.selectedSubmission = resp.data.submissions.single
        // Use converted markdown content for editing
        this.editTitle = this.selectedSubmission.title
        this.editDescription = this.selectedSubmission.description || ''
        this.editContent = this.selectedSubmission.contentMarkdown || this.selectedSubmission.content
        this.editDialog = true
      } catch (err) {
        this.$store.commit('showNotification', {
          message: err.message,
          style: 'error',
          icon: 'warning'
        })
      }
      this.loading = false
    },
    async viewSubmission(item) {
      this.loading = true
      try {
        const resp = await this.$apollo.query({
          query: gql`
            query ($id: Int!) {
              submissions {
                single(id: $id) {
                  id
                  pageId
                  path
                  title
                  description
                  content
                  contentMarkdown
                  contentType
                  editorKey
                  localeCode
                  status
                  submitterName
                  submitterEmail
                  reviewerName
                  reviewComment
                  createdAt
                  reviewedAt
                }
              }
            }
          `,
          variables: { id: item.id },
          fetchPolicy: 'network-only'
        })
        this.selectedSubmission = resp.data.submissions.single
        this.contentTab = 0
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
    async saveEdit() {
      this.saving = true
      try {
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation ($id: Int!, $content: String!, $title: String, $description: String) {
              submissions {
                update(id: $id, content: $content, title: $title, description: $description) {
                  responseResult {
                    succeeded
                    message
                  }
                }
              }
            }
          `,
          variables: {
            id: this.selectedSubmission.id,
            content: this.editContent,
            title: this.editTitle,
            description: this.editDescription
          }
        })
        if (resp.data.submissions.update.responseResult.succeeded) {
          this.$store.commit('showNotification', {
            message: 'Submission updated successfully',
            style: 'success',
            icon: 'check'
          })
          this.editDialog = false
          this.refresh()
        } else {
          throw new Error(resp.data.submissions.update.responseResult.message)
        }
      } catch (err) {
        this.$store.commit('showNotification', {
          message: err.message,
          style: 'error',
          icon: 'warning'
        })
      }
      this.saving = false
    },
    async saveAndApprove() {
      this.saving = true
      try {
        // First save the edit
        const updateResp = await this.$apollo.mutate({
          mutation: gql`
            mutation ($id: Int!, $content: String!, $title: String, $description: String) {
              submissions {
                update(id: $id, content: $content, title: $title, description: $description) {
                  responseResult {
                    succeeded
                    message
                  }
                }
              }
            }
          `,
          variables: {
            id: this.selectedSubmission.id,
            content: this.editContent,
            title: this.editTitle,
            description: this.editDescription
          }
        })
        if (!updateResp.data.submissions.update.responseResult.succeeded) {
          throw new Error(updateResp.data.submissions.update.responseResult.message)
        }

        // Then approve
        const approveResp = await this.$apollo.mutate({
          mutation: gql`
            mutation ($id: Int!, $comment: String) {
              submissions {
                approve(id: $id, comment: $comment) {
                  responseResult {
                    succeeded
                    message
                  }
                }
              }
            }
          `,
          variables: {
            id: this.selectedSubmission.id,
            comment: 'Edited and approved'
          }
        })
        if (approveResp.data.submissions.approve.responseResult.succeeded) {
          this.$store.commit('showNotification', {
            message: 'Submission saved and approved! Page published successfully.',
            style: 'success',
            icon: 'check'
          })
          // Update sidebar counter
          this.updateSidebarCount()
          this.editDialog = false
          this.refresh()
        } else {
          throw new Error(approveResp.data.submissions.approve.responseResult.message)
        }
      } catch (err) {
        this.$store.commit('showNotification', {
          message: err.message,
          style: 'error',
          icon: 'warning'
        })
      }
      this.saving = false
    },
    async approveSubmission() {
      this.loading = true
      this.approveDialog = false
      try {
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation ($id: Int!, $comment: String) {
              submissions {
                approve(id: $id, comment: $comment) {
                  responseResult {
                    succeeded
                    message
                  }
                }
              }
            }
          `,
          variables: {
            id: this.selectedSubmission.id,
            comment: ''
          }
        })
        if (resp.data.submissions.approve.responseResult.succeeded) {
          this.$store.commit('showNotification', {
            message: 'Submission approved and page published successfully',
            style: 'success',
            icon: 'check'
          })
          // Update sidebar counter
          this.updateSidebarCount()
          this.refresh()
        } else {
          throw new Error(resp.data.submissions.approve.responseResult.message)
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
    async rejectSubmission() {
      this.loading = true
      this.rejectDialog = false
      try {
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation ($id: Int!, $comment: String!) {
              submissions {
                reject(id: $id, comment: $comment) {
                  responseResult {
                    succeeded
                    message
                  }
                }
              }
            }
          `,
          variables: {
            id: this.selectedSubmission.id,
            comment: this.rejectComment
          }
        })
        if (resp.data.submissions.reject.responseResult.succeeded) {
          this.$store.commit('showNotification', {
            message: 'Submission rejected',
            style: 'success',
            icon: 'check'
          })
          // Update sidebar counter
          this.updateSidebarCount()
          this.refresh()
        } else {
          throw new Error(resp.data.submissions.reject.responseResult.message)
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
    updateSidebarCount() {
      // Update the sidebar counter in Vuex store
      const info = this.$store.state.admin.info
      if (info && typeof info.submissionsTotal === 'number' && info.submissionsTotal > 0) {
        this.$store.set('admin/info', {
          ...info,
          submissionsTotal: info.submissionsTotal - 1
        })
      }
    }
  },
  mounted() {
    this.refresh()
  }
}
</script>

<style lang='scss'>
.submission-preview {
  min-height: 300px;
  max-height: 500px;
  overflow-y: auto;

  h1, h2, h3, h4, h5, h6 {
    margin-top: 1em;
    margin-bottom: 0.5em;
    font-weight: 600;
  }

  h1 { font-size: 2em; }
  h2 { font-size: 1.5em; }
  h3 { font-size: 1.25em; }

  p {
    margin-bottom: 1em;
    line-height: 1.6;
  }

  ul, ol {
    margin-bottom: 1em;
    padding-left: 2em;
  }

  code {
    background-color: rgba(0, 0, 0, 0.05);
    padding: 2px 6px;
    border-radius: 3px;
    font-family: 'Roboto Mono', monospace;
    font-size: 0.9em;
  }

  pre {
    background-color: rgba(0, 0, 0, 0.05);
    padding: 16px;
    border-radius: 4px;
    overflow-x: auto;
    margin-bottom: 1em;

    code {
      background: none;
      padding: 0;
    }
  }

  blockquote {
    border-left: 4px solid #ccc;
    margin: 1em 0;
    padding-left: 1em;
    color: #666;
  }

  table {
    border-collapse: collapse;
    width: 100%;
    margin-bottom: 1em;

    th, td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }

    th {
      background-color: #f5f5f5;
    }
  }

  img {
    max-width: 100%;
    height: auto;
  }

  a {
    color: #1976d2;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}

.submission-source {
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: 'Roboto Mono', monospace;
  font-size: 13px;
  background-color: rgba(0, 0, 0, 0.03);
  margin: 0;
  min-height: 300px;
  max-height: 500px;
  overflow-y: auto;
}

.markdown-editor textarea {
  font-family: 'Roboto Mono', monospace !important;
  font-size: 14px !important;
  line-height: 1.5 !important;
}
</style>

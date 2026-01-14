# Wiki.js Fork - Code Changes

This document lists all modifications made to the original Wiki.js codebase.

## Summary of Changes

| Category | Files Modified |
|----------|---------------|
| Page Submission Review Workflow | 7 files |
| Built-in Video Embeds | 2 files |
| Custom Favicon from Logo | 1 file |
| Docker Development Setup | 2 files |
| Documentation | 3 files |
| Bug Fixes & Minor Changes | 8 files |

---

## Files Changed

 CLAUDE.md                                          | 147 ++++
 Dockerfile.dev                                     |  25 +
 README.md                                          |  72 ++
 client/client-setup.js                             |   2 +-
 client/components/admin.vue                        |   9 +
 client/components/admin/admin-submissions.vue      | 827 +++++++++++++++++++++
 client/components/common/nav-header.vue            |   6 -
 client/components/editor.vue                       | 121 +++
 client/components/editor/common/katex.js           |   4 +-
 .../admin/dashboard/dashboard-query-stats.gql      |   2 +
 client/scss/base/base.scss                         |  29 +
 context.md                                         |  43 ++
 dev/templates/master.pug                           |  97 ++-
 docker-compose.dev.yml                             |  37 +
 package.json                                       |  37 +-
 server/core/auth.js                                |   4 +-
 server/db/migrations/2.6.0.js                      |  41 +
 server/graph/resolvers/page.js                     |   4 +-
 server/graph/resolvers/submission.js               | 432 +++++++++++
 server/graph/resolvers/system.js                   |   5 +
 server/graph/schemas/submission.graphql            | 162 ++++
 server/graph/schemas/system.graphql                |   2 +
 server/models/pageSubmissions.js                   | 152 ++++
 .../modules/authentication/azure/authentication.js |   8 +-
 .../authentication/github/authentication.js        |   4 +-
 .../authentication/google/authentication.js        |   4 +-
 .../rendering/html-mediaplayers/definition.yml     |   8 -
 .../rendering/html-mediaplayers/renderer.js        |   5 -
 server/modules/rendering/html-security/renderer.js |   2 +-
 yarn.lock                                          | Bin 929308 -> 896666 bytes
 30 files changed, 2234 insertions(+), 57 deletions(-)

---

## Detailed Changes


### 1. Page Submission Review Workflow

New feature allowing pages to be submitted for review before publishing.

**New Files:**
- `server/models/pageSubmissions.js` - Database model for page submissions
- `server/graph/schemas/submission.graphql` - GraphQL schema for submissions API
- `server/graph/resolvers/submission.js` - GraphQL resolvers for submissions
- `client/components/admin/admin-submissions.vue` - Admin UI for managing submissions
- `server/db/migrations/2.6.0.js` - Database migration for submissions table

**Modified Files:**
- `client/components/admin.vue` - Added submissions link to admin navigation
- `client/components/editor.vue` - Added "Submit for Review" button in editor

diff --git a/client/components/admin/admin-submissions.vue b/client/components/admin/admin-submissions.vue
new file mode 100644
index 00000000..a6d2ac21
--- /dev/null
+++ b/client/components/admin/admin-submissions.vue
@@ -0,0 +1,827 @@
+<!-- This file was created by Claude Code - Admin page for reviewing page submissions -->
+<template lang='pug'>
+  v-container(fluid, grid-list-lg)
+    v-layout(row wrap)
+      v-flex(xs12)
+        .admin-header
+          img.animated.fadeInUp(src='/_assets/svg/icon-file.svg', alt='Submissions', style='width: 80px;')
+          .admin-header-title
+            .headline.orange--text.text--darken-2.animated.fadeInLeft Page Submissions
+            .subtitle-1.grey--text.animated.fadeInLeft.wait-p2s Review pending page submissions from editors
+          v-spacer
+          v-chip.mr-3.animated.fadeInDown(
+            v-if='pendingCount > 0'
+            color='orange'
+            text-color='white'
+            small
+          )
+            v-avatar(left)
+              v-icon(small) mdi-alert-circle
+            | {{ pendingCount }} pending
+          v-btn.animated.fadeInDown(icon, color='grey', outlined, @click='refresh')
+            v-icon.grey--text mdi-refresh
+        v-card.mt-3.animated.fadeInUp
+          .pa-2.d-flex.align-center(:class='$vuetify.theme.dark ? `grey darken-3-d5` : `grey lighten-3`')
+            v-select(
+              solo
+              flat
+              hide-details
+              dense
+              label='Filter by Status'
+              :items='statusOptions'
+              v-model='selectedStatus'
+              style='max-width: 200px;'
+            )
+          v-divider
+          v-data-table(
+            :items='submissions'
+            :headers='headers'
+            :page.sync='pagination'
+            :items-per-page='15'
+            :loading='loading'
+            must-sort,
+            sort-by='createdAt',
+            sort-desc,
+            hide-default-footer
+            @page-count="pageTotal = $event"
+          )
+            template(v-slot:item='{ item }')
+              tr
+                td {{ item.id }}
+                td
+                  .body-2: strong {{ item.title }}
+                  .caption.grey--text /{{ item.path }}
+                td
+                  v-chip(
+                    small
+                    :color='getStatusColor(item.status)'
+                    text-color='white'
+                  ) {{ item.status.charAt(0).toUpperCase() + item.status.slice(1) }}
+                td {{ item.submitterName }}
+                td {{ item.createdAt | moment('calendar') }}
+                td.text-right
+                  v-tooltip(bottom, v-if='item.status === "pending"')
+                    template(v-slot:activator='{ on }')
+                      v-btn.mr-1(
+                        v-on='on'
+                        icon
+                        small
+                        color='purple'
+                        @click='openEditDialog(item)'
+                      )
+                        v-icon(small) mdi-pencil
+                    span Edit
+                  v-tooltip(bottom, v-if='item.status === "pending"')
+                    template(v-slot:activator='{ on }')
+                      v-btn.mr-1(
+                        v-on='on'
+                        icon
+                        small
+                        color='green'
+                        @click='openApproveDialog(item)'
+                      )
+                        v-icon(small) mdi-check
+                    span Approve
+                  v-tooltip(bottom, v-if='item.status === "pending"')
+                    template(v-slot:activator='{ on }')
+                      v-btn.mr-1(
+                        v-on='on'
+                        icon
+                        small
+                        color='red'
+                        @click='openRejectDialog(item)'
+                      )
+                        v-icon(small) mdi-close
+                    span Reject
+                  v-tooltip(bottom)
+                    template(v-slot:activator='{ on }')
+                      v-btn(
+                        v-on='on'
+                        icon
+                        small
+                        color='blue'
+                        @click='viewSubmission(item)'
+                      )
+                        v-icon(small) mdi-eye
+                    span View Details
+            template(v-slot:no-data)
+              v-alert.ma-3(icon='mdi-check-circle', :value='true', outlined, color='green') No submissions to review
+          .text-center.py-2.animated.fadeInDown(v-if='pageTotal > 1')
+            v-pagination(v-model='pagination', :length='pageTotal')
+
+    //- Approve Dialog
+    v-dialog(v-model='approveDialog', max-width='500')
+      v-card
+        v-card-title.headline.green--text
+          v-icon.mr-2(color='green') mdi-check-circle
+          | Approve Submission
+        v-card-text
+          p Are you sure you want to approve this submission?
+          p.font-weight-bold The page "{{ selectedSubmission ? selectedSubmission.title : '' }}" will be published immediately.
+        v-card-actions
+          v-spacer
+          v-btn(text, @click='approveDialog = false') Cancel
+          v-btn(color='green', dark, @click='approveSubmission')
+            v-icon(left) mdi-check
+            | Approve & Publish
+
+    //- Reject Dialog
+    v-dialog(v-model='rejectDialog', max-width='500')
+      v-card
+        v-card-title.headline.red--text
+          v-icon.mr-2(color='red') mdi-close-circle
+          | Reject Submission
+        v-card-text
+          p Please provide a reason for rejecting this submission. This will be visible to the author.
+          v-textarea(
+            v-model='rejectComment'
+            label='Rejection Reason'
+            placeholder='Explain why this submission is being rejected...'
+            outlined
+            rows='3'
+            :rules='[v => !!v || "A reason is required"]'
+          )
+        v-card-actions
+          v-spacer
+          v-btn(text, @click='rejectDialog = false') Cancel
+          v-btn(color='red', dark, @click='rejectSubmission', :disabled='!rejectComment.trim()')
+            v-icon(left) mdi-close
+            | Reject
+
+    //- Edit Dialog
+    v-dialog(v-model='editDialog', max-width='1200', persistent, scrollable)
+      v-card(v-if='selectedSubmission')
+        v-toolbar(flat, color='purple', dark)
+          v-icon.mr-2 mdi-pencil
+          v-toolbar-title Edit Submission
+          v-spacer
+          v-btn(icon, @click='editDialog = false')
+            v-icon mdi-close
+        v-card-text.pa-0
+          v-container(fluid)
+            v-row
+              v-col(cols='12')
+                v-text-field(
+                  v-model='editTitle'
+                  label='Title'
+                  outlined
+                  dense
+                  hide-details
+                )
+              v-col(cols='12')
+                v-text-field(
+                  v-model='editDescription'
+                  label='Description'
+                  outlined
+                  dense
+                  hide-details
+                )
+              v-col(cols='12')
+                .d-flex.align-center.mb-2
+                  v-icon.mr-2(small) mdi-language-markdown
+                  span.subtitle-2 Markdown Content
+                  v-spacer
+                  v-chip(small, outlined, v-if='selectedSubmission.contentType !== "markdown"')
+                    v-icon(small, left) mdi-swap-horizontal
+                    | Converted from {{ selectedSubmission.editorKey }}
+                v-textarea(
+                  v-model='editContent'
+                  outlined
+                  rows='20'
+                  class='markdown-editor'
+                  placeholder='Enter markdown content...'
+                  hide-details
+                  :style='{ fontFamily: "Roboto Mono, monospace", fontSize: "14px" }'
+                )
+        v-card-actions
+          v-btn(text, color='grey', @click='editDialog = false') Cancel
+          v-spacer
+          v-btn(color='purple', dark, @click='saveEdit', :loading='saving')
+            v-icon(left) mdi-content-save
+            | Save Changes
+          v-btn(color='green', dark, @click='saveAndApprove', :loading='saving')
+            v-icon(left) mdi-check
+            | Save & Approve
+
+    //- View Content Dialog
+    v-dialog(v-model='viewDialog', max-width='1000', scrollable)
+      v-card(v-if='selectedSubmission')
+        v-toolbar(flat, :color='getStatusColor(selectedSubmission.status)', dark)
+          v-toolbar-title {{ selectedSubmission.title }}
+          v-spacer
+          v-chip.ml-2(small, outlined) {{ selectedSubmission.status.charAt(0).toUpperCase() + selectedSubmission.status.slice(1) }}
+        v-card-text.pa-0
+          v-container(fluid)
+            v-row
+              v-col(cols='12', md='4')
+                v-card(outlined)
+                  v-card-title.subtitle-2 Submission Details
+                  v-card-text
+                    .d-flex.mb-2
+                      v-icon.mr-2(small) mdi-account
+                      span.grey--text Submitted by:&nbsp;
+                      strong {{ selectedSubmission.submitterName }}
+                    .d-flex.mb-2
+                      v-icon.mr-2(small) mdi-calendar
+                      span.grey--text Submitted:&nbsp;
+                      strong {{ selectedSubmission.createdAt | moment('LLLL') }}
+                    .d-flex.mb-2
+                      v-icon.mr-2(small) mdi-link
+                      span.grey--text Path:&nbsp;
+                      strong /{{ selectedSubmission.path }}
+                    .d-flex.mb-2
+                      v-icon.mr-2(small) mdi-file-document
+                      span.grey--text Editor:&nbsp;
+                      strong {{ selectedSubmission.editorKey }}
+                    .d-flex.mb-2(v-if='selectedSubmission.description')
+                      v-icon.mr-2(small) mdi-text
+                      span.grey--text Description:&nbsp;
+                      span {{ selectedSubmission.description }}
+                    .d-flex(v-if='selectedSubmission.reviewerName')
+                      v-icon.mr-2(small) mdi-account-check
+                      span.grey--text Reviewed by:&nbsp;
+                      strong {{ selectedSubmission.reviewerName }}
+                    .mt-3(v-if='selectedSubmission.reviewComment')
+                      v-alert(
+                        :type='selectedSubmission.status === "approved" ? "success" : "error"'
+                        dense
+                        outlined
+                      )
+                        .caption Review Comment:
+                        | {{ selectedSubmission.reviewComment }}
+              v-col(cols='12', md='8')
+                v-card(outlined)
+                  v-tabs(v-model='contentTab', background-color='grey lighten-4')
+                    v-tab Preview
+                    v-tab Source
+                  v-tabs-items(v-model='contentTab')
+                    v-tab-item
+                      .submission-preview.pa-4(v-html='renderedContent')
+                    v-tab-item
+                      pre.submission-source.pa-4 {{ selectedSubmission.contentMarkdown || selectedSubmission.content }}
+        v-card-actions
+          v-spacer
+          v-btn(text, @click='viewDialog = false') Close
+          v-btn(
+            v-if='selectedSubmission.status === "pending"'
+            color='purple'
+            dark
+            @click='viewDialog = false; openEditDialog(selectedSubmission)'
+          )
+            v-icon(left) mdi-pencil
+            | Edit
+          v-btn(
+            v-if='selectedSubmission.status === "pending"'
+            color='green'
+            dark
+            @click='viewDialog = false; openApproveDialog(selectedSubmission)'
+          )
+            v-icon(left) mdi-check
+            | Approve
+          v-btn(
+            v-if='selectedSubmission.status === "pending"'
+            color='red'
+            dark
+            @click='viewDialog = false; openRejectDialog(selectedSubmission)'
+          )
+            v-icon(left) mdi-close
+            | Reject
+
+    notify
+</template>
+
+<script>
+import gql from 'graphql-tag'
+import markdownit from 'markdown-it'
+
+const md = markdownit({
+  html: true,
+  linkify: true,
+  typographer: true,
+  breaks: true
+})
+
+export default {
+  data() {
+    return {
+      submissions: [],
+      pendingCount: 0,
+      pagination: 1,
+      pageTotal: 0,
+      loading: false,
+      saving: false,
+      selectedStatus: 'pending',
+      contentTab: 0,
+      statusOptions: [
+        { text: 'All Submissions', value: null },
+        { text: 'Pending Review', value: 'pending' },
+        { text: 'Approved', value: 'approved' },
+        { text: 'Rejected', value: 'rejected' }
+      ],
+      headers: [
+        { text: 'ID', value: 'id', width: 80 },
+        { text: 'Title / Path', value: 'title' },
+        { text: 'Status', value: 'status', width: 120 },
+        { text: 'Author', value: 'submitterName', width: 150 },
+        { text: 'Submitted', value: 'createdAt', width: 180 },
+        { text: 'Actions', value: 'actions', sortable: false, width: 180, align: 'right' }
+      ],
+      approveDialog: false,
+      rejectDialog: false,
+      editDialog: false,
+      viewDialog: false,
+      selectedSubmission: null,
+      rejectComment: '',
+      editTitle: '',
+      editDescription: '',
+      editContent: ''
+    }
+  },
+  computed: {
+    renderedContent() {
+      if (!this.selectedSubmission) {
+        return ''
+      }
+      // Use contentMarkdown if available, otherwise use content
+      const content = this.selectedSubmission.contentMarkdown || this.selectedSubmission.content
+      if (!content) {
+        return ''
+      }
+      // Render markdown to HTML
+      try {
+        return md.render(content)
+      } catch (e) {
+        return '<pre>' + content + '</pre>'
+      }
+    }
+  },
+  watch: {
+    selectedStatus() {
+      this.refresh()
+    }
+  },
+  methods: {
+    async refresh() {
+      this.loading = true
+      try {
+        const resp = await this.$apollo.query({
+          query: gql`
+            query ($status: SubmissionStatus) {
+              submissions {
+                list(status: $status) {
+                  id
+                  pageId
+                  path
+                  title
+                  description
+                  localeCode
+                  status
+                  submitterName
+                  submitterEmail
+                  reviewerName
+                  createdAt
+                  updatedAt
+                  reviewedAt
+                }
+                pendingCount
+              }
+            }
+          `,
+          variables: {
+            status: this.selectedStatus
+          },
+          fetchPolicy: 'network-only'
+        })
+        this.submissions = resp.data.submissions.list
+        this.pendingCount = resp.data.submissions.pendingCount
+      } catch (err) {
+        this.$store.commit('showNotification', {
+          message: err.message,
+          style: 'error',
+          icon: 'warning'
+        })
+      }
+      this.loading = false
+    },
+    getStatusColor(status) {
+      switch (status) {
+        case 'pending': return 'orange'
+        case 'approved': return 'green'
+        case 'rejected': return 'red'
+        default: return 'grey'
+      }
+    },
+    openApproveDialog(item) {
+      this.selectedSubmission = item
+      this.approveDialog = true
+    },
+    openRejectDialog(item) {
+      this.selectedSubmission = item
+      this.rejectComment = ''
+      this.rejectDialog = true
+    },
+    async openEditDialog(item) {
+      this.loading = true
+      try {
+        const resp = await this.$apollo.query({
+          query: gql`
+            query ($id: Int!) {
+              submissions {
+                single(id: $id) {
+                  id
+                  pageId
+                  path
+                  title
+                  description
+                  content
+                  contentMarkdown
+                  contentType
+                  editorKey
+                  localeCode
+                  status
+                  submitterName
+                  submitterEmail
+                }
+              }
+            }
+          `,
+          variables: { id: item.id },
+          fetchPolicy: 'network-only'
+        })
+        this.selectedSubmission = resp.data.submissions.single
+        // Use converted markdown content for editing
+        this.editTitle = this.selectedSubmission.title
+        this.editDescription = this.selectedSubmission.description || ''
+        this.editContent = this.selectedSubmission.contentMarkdown || this.selectedSubmission.content
+        this.editDialog = true
+      } catch (err) {
+        this.$store.commit('showNotification', {
+          message: err.message,
+          style: 'error',
+          icon: 'warning'
+        })
+      }
+      this.loading = false
+    },
+    async viewSubmission(item) {
+      this.loading = true
+      try {
+        const resp = await this.$apollo.query({
+          query: gql`
+            query ($id: Int!) {
+              submissions {
+                single(id: $id) {
+                  id
+                  pageId
+                  path
+                  title
+                  description
+                  content
+                  contentMarkdown
+                  contentType
+                  editorKey
+                  localeCode
+                  status
+                  submitterName
+                  submitterEmail
+                  reviewerName
+                  reviewComment
+                  createdAt
+                  reviewedAt
+                }
+              }
+            }
+          `,
+          variables: { id: item.id },
+          fetchPolicy: 'network-only'
+        })
+        this.selectedSubmission = resp.data.submissions.single
+        this.contentTab = 0
+        this.viewDialog = true
+      } catch (err) {
+        this.$store.commit('showNotification', {
+          message: err.message,
+          style: 'error',
+          icon: 'warning'
+        })
+      }
+      this.loading = false
+    },
+    async saveEdit() {
+      this.saving = true
+      try {
+        const resp = await this.$apollo.mutate({
+          mutation: gql`
+            mutation ($id: Int!, $content: String!, $title: String, $description: String) {
+              submissions {
+                update(id: $id, content: $content, title: $title, description: $description) {
+                  responseResult {
+                    succeeded
+                    message
+                  }
+                }
+              }
+            }
+          `,
+          variables: {
+            id: this.selectedSubmission.id,
+            content: this.editContent,
+            title: this.editTitle,
+            description: this.editDescription
+          }
+        })
+        if (resp.data.submissions.update.responseResult.succeeded) {
+          this.$store.commit('showNotification', {
+            message: 'Submission updated successfully!',
+            style: 'success',
+            icon: 'check'
+          })
+          this.editDialog = false
+          this.refresh()
+        } else {
+          throw new Error(resp.data.submissions.update.responseResult.message)
+        }
+      } catch (err) {
+        this.$store.commit('showNotification', {
+          message: err.message,
+          style: 'error',
+          icon: 'warning'
+        })
+      }
+      this.saving = false
+    },
+    async saveAndApprove() {
+      this.saving = true
+      try {
+        // First save the edit
+        const updateResp = await this.$apollo.mutate({
+          mutation: gql`
+            mutation ($id: Int!, $content: String!, $title: String, $description: String) {
+              submissions {
+                update(id: $id, content: $content, title: $title, description: $description) {
+                  responseResult {
+                    succeeded
+                    message
+                  }
+                }
+              }
+            }
+          `,
+          variables: {
+            id: this.selectedSubmission.id,
+            content: this.editContent,
+            title: this.editTitle,
+            description: this.editDescription
+          }
+        })
+        if (!updateResp.data.submissions.update.responseResult.succeeded) {
+          throw new Error(updateResp.data.submissions.update.responseResult.message)
+        }
+
+        // Then approve
+        const approveResp = await this.$apollo.mutate({
+          mutation: gql`
+            mutation ($id: Int!, $comment: String) {
+              submissions {
+                approve(id: $id, comment: $comment) {
+                  responseResult {
+                    succeeded
+                    message
+                  }
+                }
+              }
+            }
+          `,
+          variables: {
+            id: this.selectedSubmission.id,
+            comment: 'Edited and approved'
+          }
+        })
+        if (approveResp.data.submissions.approve.responseResult.succeeded) {
+          this.$store.commit('showNotification', {
+            message: 'Submission saved and approved! Page published successfully.',
+            style: 'success',
+            icon: 'check'
+          })
+          // Update sidebar counter
+          this.updateSidebarCount()
+          this.editDialog = false
+          this.refresh()
+        } else {
+          throw new Error(approveResp.data.submissions.approve.responseResult.message)
+        }
+      } catch (err) {
+        this.$store.commit('showNotification', {
+          message: err.message,
+          style: 'error',
+          icon: 'warning'
+        })
+      }
+      this.saving = false
+    },
+    async approveSubmission() {
+      this.loading = true
+      this.approveDialog = false
+      try {
+        const resp = await this.$apollo.mutate({
+          mutation: gql`
+            mutation ($id: Int!, $comment: String) {
+              submissions {
+                approve(id: $id, comment: $comment) {
+                  responseResult {
+                    succeeded
+                    message
+                  }
+                }
+              }
+            }
+          `,
+          variables: {
+            id: this.selectedSubmission.id,
+            comment: ''
+          }
+        })
+        if (resp.data.submissions.approve.responseResult.succeeded) {
+          this.$store.commit('showNotification', {
+            message: 'Submission approved and page published successfully!',
+            style: 'success',
+            icon: 'check'
+          })
+          // Update sidebar counter
+          this.updateSidebarCount()
+          this.refresh()
+        } else {
+          throw new Error(resp.data.submissions.approve.responseResult.message)
+        }
+      } catch (err) {
+        this.$store.commit('showNotification', {
+          message: err.message,
+          style: 'error',
+          icon: 'warning'
+        })
+      }
+      this.loading = false
+    },
+    async rejectSubmission() {
+      this.loading = true
+      this.rejectDialog = false
+      try {
+        const resp = await this.$apollo.mutate({
+          mutation: gql`
+            mutation ($id: Int!, $comment: String!) {
+              submissions {
+                reject(id: $id, comment: $comment) {
+                  responseResult {
+                    succeeded
+                    message
+                  }
+                }
+              }
+            }
+          `,
+          variables: {
+            id: this.selectedSubmission.id,
+            comment: this.rejectComment
+          }
+        })
+        if (resp.data.submissions.reject.responseResult.succeeded) {
+          this.$store.commit('showNotification', {
+            message: 'Submission rejected.',
+            style: 'success',
+            icon: 'check'
+          })
+          // Update sidebar counter
+          this.updateSidebarCount()
+          this.refresh()
+        } else {
+          throw new Error(resp.data.submissions.reject.responseResult.message)
+        }
+      } catch (err) {
+        this.$store.commit('showNotification', {
+          message: err.message,
+          style: 'error',
+          icon: 'warning'
+        })
+      }
+      this.loading = false
+    },
+    updateSidebarCount() {
+      // Update the sidebar counter in Vuex store
+      const info = this.$store.state.admin.info
+      if (info && typeof info.submissionsTotal === 'number' && info.submissionsTotal > 0) {
+        this.$store.set('admin/info', {
+          ...info,
+          submissionsTotal: info.submissionsTotal - 1
+        })
+      }
+    }
+  },
+  mounted() {
+    this.refresh()
+  }
+}
+</script>
+
+<style lang='scss'>
+.submission-preview {
+  min-height: 300px;
+  max-height: 500px;
+  overflow-y: auto;
+
+  h1, h2, h3, h4, h5, h6 {
+    margin-top: 1em;
+    margin-bottom: 0.5em;
+    font-weight: 600;
+  }
+
+  h1 { font-size: 2em; }
+  h2 { font-size: 1.5em; }
+  h3 { font-size: 1.25em; }
+
+  p {
+    margin-bottom: 1em;
+    line-height: 1.6;
+  }
+
+  ul, ol {
+    margin-bottom: 1em;
+    padding-left: 2em;
+  }
+
+  code {
+    background-color: rgba(0, 0, 0, 0.05);
+    padding: 2px 6px;
+    border-radius: 3px;
+    font-family: 'Roboto Mono', monospace;
+    font-size: 0.9em;
+  }
+
+  pre {
+    background-color: rgba(0, 0, 0, 0.05);
+    padding: 16px;
+    border-radius: 4px;
+    overflow-x: auto;
+    margin-bottom: 1em;
+
+    code {
+      background: none;
+      padding: 0;
+    }
+  }
+
+  blockquote {
+    border-left: 4px solid #ccc;
+    margin: 1em 0;
+    padding-left: 1em;
+    color: #666;
+  }
+
+  table {
+    border-collapse: collapse;
+    width: 100%;
+    margin-bottom: 1em;
+
+    th, td {
+      border: 1px solid #ddd;
+      padding: 8px;
+      text-align: left;
+    }
+
+    th {
+      background-color: #f5f5f5;
+    }
+  }
+
+  img {
+    max-width: 100%;
+    height: auto;
+  }
+
+  a {
+    color: #1976d2;
+    text-decoration: none;
+
+    &:hover {
+      text-decoration: underline;
+    }
+  }
+}
+
+.submission-source {
+  white-space: pre-wrap;
+  word-wrap: break-word;
+  font-family: 'Roboto Mono', monospace;
+  font-size: 13px;
+  background-color: rgba(0, 0, 0, 0.03);
+  margin: 0;
+  min-height: 300px;
+  max-height: 500px;
+  overflow-y: auto;
+}
+
+.markdown-editor textarea {
+  font-family: 'Roboto Mono', monospace !important;
+  font-size: 14px !important;
+  line-height: 1.5 !important;
+}
+</style>
diff --git a/server/graph/schemas/submission.graphql b/server/graph/schemas/submission.graphql
new file mode 100644
index 00000000..5c0f6a34
--- /dev/null
+++ b/server/graph/schemas/submission.graphql
@@ -0,0 +1,162 @@
+# ===============================================
+# PAGE SUBMISSIONS (Review Workflow)
+# This file was created by Claude Code
+# ===============================================
+
+extend type Query {
+  submissions: SubmissionQuery
+}
+
+extend type Mutation {
+  submissions: SubmissionMutation
+}
+
+# -----------------------------------------------
+# QUERIES
+# -----------------------------------------------
+
+type SubmissionQuery {
+  """
+  List all submissions with optional filters
+  """
+  list(
+    status: SubmissionStatus
+    submitterId: Int
+    limit: Int
+    offset: Int
+  ): [PageSubmissionListItem]! @auth(requires: ["review:pages", "manage:system"])
+
+  """
+  Get pending submissions count
+  """
+  pendingCount: Int! @auth(requires: ["review:pages", "manage:system"])
+
+  """
+  Get a single submission by ID
+  """
+  single(
+    id: Int!
+  ): PageSubmission @auth(requires: ["review:pages", "manage:system"])
+
+  """
+  Get submissions for the current user
+  """
+  mySubmissions(
+    status: SubmissionStatus
+    limit: Int
+    offset: Int
+  ): [PageSubmissionListItem]! @auth(requires: ["write:pages"])
+}
+
+# -----------------------------------------------
+# MUTATIONS
+# -----------------------------------------------
+
+type SubmissionMutation {
+  """
+  Submit a new page or page edit for review
+  """
+  submit(
+    pageId: Int
+    content: String!
+    description: String!
+    editor: String!
+    isPrivate: Boolean!
+    locale: String!
+    path: String!
+    scriptCss: String
+    scriptJs: String
+    tags: [String]!
+    title: String!
+  ): SubmissionResponse @auth(requires: ["write:pages"])
+
+  """
+  Approve a pending submission (publishes the page)
+  """
+  approve(
+    id: Int!
+    comment: String
+  ): SubmissionResponse @auth(requires: ["review:pages", "manage:system"])
+
+  """
+  Reject a pending submission
+  """
+  reject(
+    id: Int!
+    comment: String!
+  ): SubmissionResponse @auth(requires: ["review:pages", "manage:system"])
+
+  """
+  Update a submission's content (for editing before approval)
+  """
+  update(
+    id: Int!
+    content: String!
+    title: String
+    description: String
+  ): SubmissionResponse @auth(requires: ["review:pages", "manage:system"])
+
+  """
+  Delete a submission (only by submitter if still pending)
+  """
+  delete(
+    id: Int!
+  ): DefaultResponse @auth(requires: ["write:pages"])
+}
+
+# -----------------------------------------------
+# TYPES
+# -----------------------------------------------
+
+type SubmissionResponse {
+  responseResult: ResponseStatus!
+  submission: PageSubmission
+}
+
+type PageSubmission {
+  id: Int!
+  pageId: Int
+  path: String!
+  hash: String!
+  title: String!
+  description: String
+  content: String!
+  contentMarkdown: String
+  contentType: String!
+  editorKey: String!
+  localeCode: String!
+  isPrivate: Boolean!
+  tags: [String]
+  status: SubmissionStatus!
+  submitterId: Int!
+  submitterName: String!
+  submitterEmail: String!
+  reviewerId: Int
+  reviewerName: String
+  reviewComment: String
+  createdAt: Date!
+  updatedAt: Date!
+  reviewedAt: Date
+}
+
+type PageSubmissionListItem {
+  id: Int!
+  pageId: Int
+  path: String!
+  title: String!
+  description: String
+  localeCode: String!
+  status: SubmissionStatus!
+  submitterName: String!
+  submitterEmail: String!
+  reviewerName: String
+  createdAt: Date!
+  updatedAt: Date!
+  reviewedAt: Date
+}
+
+enum SubmissionStatus {
+  pending
+  approved
+  rejected
+}
diff --git a/server/models/pageSubmissions.js b/server/models/pageSubmissions.js
new file mode 100644
index 00000000..eecc4217
--- /dev/null
+++ b/server/models/pageSubmissions.js
@@ -0,0 +1,152 @@
+/**
+ * This file was created by Claude Code
+ * Page Submissions model for the review workflow feature
+ */
+
+const Model = require('objection').Model
+
+/**
+ * Page Submissions model - tracks edits pending review
+ */
+module.exports = class PageSubmission extends Model {
+  static get tableName() { return 'pageSubmissions' }
+
+  static get jsonSchema() {
+    return {
+      type: 'object',
+      required: ['path', 'title', 'content', 'contentType', 'editorKey', 'localeCode', 'submitterId'],
+
+      properties: {
+        id: { type: 'integer' },
+        pageId: { type: ['integer', 'null'] },
+        submitterId: { type: 'integer' },
+        path: { type: 'string' },
+        hash: { type: 'string' },
+        title: { type: 'string' },
+        description: { type: 'string' },
+        content: { type: 'string' },
+        contentType: { type: 'string' },
+        editorKey: { type: 'string' },
+        localeCode: { type: 'string' },
+        isPrivate: { type: 'boolean' },
+        extra: { type: 'string' },
+        tags: { type: 'string' },
+        status: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
+        reviewerId: { type: ['integer', 'null'] },
+        reviewComment: { type: 'string' },
+        createdAt: { type: 'string' },
+        updatedAt: { type: 'string' },
+        reviewedAt: { type: 'string' }
+      }
+    }
+  }
+
+  static get relationMappings() {
+    return {
+      submitter: {
+        relation: Model.BelongsToOneRelation,
+        modelClass: require('./users'),
+        join: {
+          from: 'pageSubmissions.submitterId',
+          to: 'users.id'
+        }
+      },
+      reviewer: {
+        relation: Model.BelongsToOneRelation,
+        modelClass: require('./users'),
+        join: {
+          from: 'pageSubmissions.reviewerId',
+          to: 'users.id'
+        }
+      },
+      page: {
+        relation: Model.BelongsToOneRelation,
+        modelClass: require('./pages'),
+        join: {
+          from: 'pageSubmissions.pageId',
+          to: 'pages.id'
+        }
+      }
+    }
+  }
+
+  $beforeUpdate() {
+    this.updatedAt = new Date().toISOString()
+  }
+
+  $beforeInsert() {
+    this.createdAt = new Date().toISOString()
+    this.updatedAt = new Date().toISOString()
+  }
+
+  /**
+   * Get pending submissions count
+   */
+  static async getPendingCount() {
+    const result = await this.query().where('status', 'pending').count('id as count').first()
+    return parseInt(result.count, 10)
+  }
+
+  /**
+   * Get submissions list with filters
+   */
+  static async getSubmissions({ status, submitterId, limit, offset }) {
+    let query = this.query()
+      .select([
+        'pageSubmissions.id',
+        'pageSubmissions.pageId',
+        'pageSubmissions.path',
+        'pageSubmissions.title',
+        'pageSubmissions.description',
+        'pageSubmissions.localeCode',
+        'pageSubmissions.status',
+        'pageSubmissions.createdAt',
+        'pageSubmissions.updatedAt',
+        'pageSubmissions.reviewedAt',
+        {
+          submitterName: 'submitter.name',
+          submitterEmail: 'submitter.email',
+          reviewerName: 'reviewer.name'
+        }
+      ])
+      .leftJoinRelated('submitter')
+      .leftJoinRelated('reviewer')
+      .orderBy('pageSubmissions.createdAt', 'desc')
+
+    if (status) {
+      query = query.where('pageSubmissions.status', status)
+    }
+
+    if (submitterId) {
+      query = query.where('pageSubmissions.submitterId', submitterId)
+    }
+
+    if (limit) {
+      query = query.limit(limit)
+    }
+
+    if (offset) {
+      query = query.offset(offset)
+    }
+
+    return query
+  }
+
+  /**
+   * Get a single submission with full details
+   */
+  static async getSubmission(id) {
+    return this.query()
+      .findById(id)
+      .select([
+        'pageSubmissions.*',
+        {
+          submitterName: 'submitter.name',
+          submitterEmail: 'submitter.email',
+          reviewerName: 'reviewer.name'
+        }
+      ])
+      .leftJoinRelated('submitter')
+      .leftJoinRelated('reviewer')
+  }
+}

---

### 2. Built-in Video Embeds

Client-side video embed support for YouTube, Vimeo, Dailymotion, Screencast, and MP4/WebM/OGG files.

**Modified Files:**
- `dev/templates/master.pug` - Added client-side JavaScript for video embeds

diff --git a/dev/templates/master.pug b/dev/templates/master.pug
index 478d2725..bf2944de 100644
--- a/dev/templates/master.pug
+++ b/dev/templates/master.pug
@@ -19,11 +19,20 @@ html(lang=siteConfig.lang)
     meta(property='og:url', content=pageMeta.url)
     meta(property='og:site_name', content=config.title)
 
-    //- Favicon
-    link(rel='apple-touch-icon', sizes='180x180', href='/_assets/favicons/apple-touch-icon.png')
-    link(rel='icon', type='image/png', sizes='192x192', href='/_assets/favicons/android-chrome-192x192.png')
-    link(rel='icon', type='image/png', sizes='32x32', href='/_assets/favicons/favicon-32x32.png')
-    link(rel='icon', type='image/png', sizes='16x16', href='/_assets/favicons/favicon-16x16.png')
+    //- Favicon - This section was modified by Claude Code to use site logo as favicon
+    //- Only use custom logo if it's set and not the default Wiki.js butterfly
+    - var useCustomFavicon = siteConfig.logoUrl && !siteConfig.logoUrl.includes('wikijs-butterfly')
+    if useCustomFavicon
+      link(rel='apple-touch-icon', sizes='180x180', href=siteConfig.logoUrl)
+      link(rel='icon', type='image/png', sizes='192x192', href=siteConfig.logoUrl)
+      link(rel='icon', type='image/png', sizes='32x32', href=siteConfig.logoUrl)
+      link(rel='icon', type='image/png', sizes='16x16', href=siteConfig.logoUrl)
+      link(rel='shortcut icon', href=siteConfig.logoUrl)
+    else
+      link(rel='apple-touch-icon', sizes='180x180', href='/_assets/favicons/apple-touch-icon.png')
+      link(rel='icon', type='image/png', sizes='192x192', href='/_assets/favicons/android-chrome-192x192.png')
+      link(rel='icon', type='image/png', sizes='32x32', href='/_assets/favicons/favicon-32x32.png')
+      link(rel='icon', type='image/png', sizes='16x16', href='/_assets/favicons/favicon-16x16.png')
     link(rel='mask-icon', href='/_assets/favicons/safari-pinned-tab.svg', color='#1976d2')
     link(rel='manifest', href='/_assets/manifest.json')
 
@@ -95,3 +104,81 @@ html(lang=siteConfig.lang)
     != analyticsCode.bodyStart
     block body
     != analyticsCode.bodyEnd
+
+    //- Built-in Video Embed Support (YouTube, Vimeo, Dailymotion, Screencast, MP4)
+    style.
+      .responsive-embed {
+        position: relative;
+        padding-bottom: 56.25%;
+        height: 0;
+        overflow: hidden;
+        max-width: 100%;
+        margin: 1rem 0;
+      }
+      .responsive-embed iframe,
+      .responsive-embed video {
+        position: absolute;
+        top: 0;
+        left: 0;
+        width: 100%;
+        height: 100%;
+      }
+    script.
+      (function() {
+        const rxYoutube = /^.*(?:(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|watch\?v=|watch\?.+&v=)))([^#&?]*).*/;
+        const rxVimeo = /vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^\/]*)\/videos\/|album\/(?:\d+)\/video\/|)(\d+)(?:$|\/|\?)/;
+        const rxDailymotion = /(?:dailymotion\.com(?:\/embed)?(?:\/video|\/hub)|dai\.ly)\/([0-9a-z]+)(?:[-_0-9a-zA-Z]+(?:#video=)?([a-z0-9]+)?)?/;
+        const rxScreencast = /^.*(?:(?:https?:)?\/\/)?(?:www\.)?screencast\.com\/users\/([a-z0-9_-]+)\/folders\/([a-z0-9%_-]+)\/media\/([a-z0-9_-]+)(?:\/)?$/i;
+
+        function convertVideoEmbeds() {
+          document.querySelectorAll('.contents oembed, .contents figure.media oembed, .contents a, .contents p').forEach(function(elm) {
+            var url = elm.hasAttribute('url') ? elm.getAttribute('url') : (elm.hasAttribute('href') ? elm.getAttribute('href') : elm.textContent.trim());
+            if (!url) return;
+
+            var newElmHtml = null;
+            var ytMatch = url.match(rxYoutube);
+            var vimeoMatch = url.match(rxVimeo);
+            var dmMatch = url.match(rxDailymotion);
+            var scMatch = url.match(rxScreencast);
+
+            if (ytMatch && ytMatch[1]) {
+              newElmHtml = '<iframe src="https://www.youtube-nocookie.com/embed/' + ytMatch[1] + '" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
+            } else if (vimeoMatch && vimeoMatch[1]) {
+              newElmHtml = '<iframe src="https://player.vimeo.com/video/' + vimeoMatch[1] + '" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>';
+            } else if (dmMatch && dmMatch[1]) {
+              newElmHtml = '<iframe src="https://www.dailymotion.com/embed/video/' + dmMatch[1] + '" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>';
+            } else if (scMatch) {
+              newElmHtml = '<iframe src="' + url + '/embed" frameborder="0" allowfullscreen></iframe>';
+            } else if (url.match(/\.(mp4|webm|ogg)$/i)) {
+              var type = url.endsWith('.mp4') ? 'video/mp4' : (url.endsWith('.webm') ? 'video/webm' : 'video/ogg');
+              newElmHtml = '<video controls><source src="' + url + '" type="' + type + '">Your browser does not support the video tag.</video>';
+            } else {
+              return;
+            }
+
+            // For paragraphs, only convert if it contains just the URL
+            if (elm.tagName === 'P') {
+              if (elm.textContent.trim() !== url || elm.children.length > 0) return;
+            }
+
+            // For links, only convert standalone video links
+            if (elm.tagName === 'A') {
+              var linkText = elm.textContent.trim();
+              if (linkText !== url && !linkText.includes('youtu') && !linkText.includes('vimeo')) return;
+            }
+
+            var newElm = document.createElement('div');
+            newElm.className = 'responsive-embed';
+            newElm.innerHTML = newElmHtml;
+            elm.replaceWith(newElm);
+          });
+        }
+
+        if (window.boot && window.boot.register) {
+          window.boot.register('vue', function() {
+            window.addEventListener('load', convertVideoEmbeds);
+          });
+        } else {
+          document.addEventListener('DOMContentLoaded', convertVideoEmbeds);
+        }
+      })();

---

### 3. Docker Development Setup

**New Files:**
- `Dockerfile.dev` - Development Dockerfile
- `docker-compose.dev.yml` - Development docker-compose configuration

diff --git a/Dockerfile.dev b/Dockerfile.dev
new file mode 100644
index 00000000..b9e4823b
--- /dev/null
+++ b/Dockerfile.dev
@@ -0,0 +1,25 @@
+# This file was created by Claude Code - Development Dockerfile for Wiki.js
+FROM node:20-alpine
+
+RUN apk add --no-cache git python3 make g++ bash openssh-client
+
+WORKDIR /wiki
+
+# Copy package files
+COPY package.json yarn.lock ./
+
+# Install dependencies
+RUN yarn install --frozen-lockfile
+
+# Copy application code
+COPY . .
+
+# Build the application
+RUN yarn build
+
+# Create data directory
+RUN mkdir -p /wiki/data
+
+EXPOSE 3000
+
+CMD ["node", "server"]
diff --git a/docker-compose.dev.yml b/docker-compose.dev.yml
new file mode 100644
index 00000000..a301829d
--- /dev/null
+++ b/docker-compose.dev.yml
@@ -0,0 +1,37 @@
+# This file was created by Claude Code - Development Docker Compose for Wiki.js
+version: "3"
+services:
+  db:
+    image: postgres:15-alpine
+    environment:
+      POSTGRES_DB: wiki
+      POSTGRES_PASSWORD: wikijsrocks
+      POSTGRES_USER: wikijs
+    volumes:
+      - db-data:/var/lib/postgresql/data
+    ports:
+      - "5432:5432"
+
+  wiki:
+    build:
+      context: .
+      dockerfile: Dockerfile.dev
+    depends_on:
+      - db
+    environment:
+      DB_TYPE: postgres
+      DB_HOST: db
+      DB_PORT: 5432
+      DB_USER: wikijs
+      DB_PASS: wikijsrocks
+      DB_NAME: wiki
+      NODE_OPTIONS: --openssl-legacy-provider
+    ports:
+      - "3080:3000"
+    volumes:
+      - wiki-data:/wiki/data
+      - ./config.yml:/wiki/config.yml
+
+volumes:
+  db-data:
+  wiki-data:

---

### 4. Documentation

**New Files:**
- `CLAUDE.md` - Project context for AI assistants
- `context.md` - Additional project context
- `README.md` - Updated with fork information and docker-compose example

diff --git a/README.md b/README.md
index f00f2c56..7a62199a 100644
--- a/README.md
+++ b/README.md
@@ -22,6 +22,78 @@
 
 </div>
 
+---
+
+## Fork: Wiki.js with Review Workflow
+
+This is a modified version of Wiki.js with additional features including:
+- **Page submission review workflow** - Pages can be submitted for review before publishing
+- **Built-in video embeds** - YouTube, Vimeo, Dailymotion, Screencast, and MP4/WebM/OGG support
+- **Custom favicon from logo** - Site logo automatically used as favicon
+
+### Quick Start for Testers
+
+First, authenticate with GitHub Container Registry using a Personal Access Token (PAT) with `read:packages` scope:
+
+```bash
+echo "YOUR_GITHUB_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
+```
+
+Then pull the image:
+
+```bash
+docker pull ghcr.io/serversathome/wikijs-claudecode:latest
+```
+
+### Sample Docker Compose
+
+Create a `docker-compose.yml` file:
+
+```yaml
+services:
+  db:
+    image: postgres:15-alpine
+    container_name: wikijs-db
+    environment:
+      POSTGRES_DB: wiki
+      POSTGRES_PASSWORD: wikijsrocks
+      POSTGRES_USER: wikijs
+    volumes:
+      - ./db-data:/var/lib/postgresql/data
+    restart: unless-stopped
+
+  wiki:
+    image: ghcr.io/serversathome/wikijs-claudecode:latest
+    container_name: wikijs
+    depends_on:
+      - db
+    environment:
+      DB_TYPE: postgres
+      DB_HOST: db
+      DB_PORT: 5432
+      DB_USER: wikijs
+      DB_PASS: wikijsrocks
+      DB_NAME: wiki
+    ports:
+      - "3000:3000"
+    restart: unless-stopped
+```
+
+Then run:
+
+```bash
+docker compose up -d
+```
+
+Access the wiki at `http://localhost:3000`
+
+### Notes for Testers
+
+- **YouTube embeds**: Disable "Referrer Policy" in Admin > Security for YouTube videos to work
+- **Video embeds are automatic**: Just paste a video URL on its own line in the editor
+
+---
+
 - **[Official Website](https://js.wiki/)**
 - **[Documentation](https://docs.requarks.io/)**
 - [Requirements](https://docs.requarks.io/install/requirements)

---

### 5. Other Changes

**Modified Files:**
- `server/modules/rendering/html-security/renderer.js` - Added iframe attribute support
- `client/components/editor/common/katex.js` - Minor fix
- `server/core/auth.js` - Minor authentication fix
- `server/graph/resolvers/page.js` - Minor fix
- `server/graph/resolvers/system.js` - Added dashboard stats
- Various authentication modules - Minor fixes

diff --git a/server/graph/resolvers/system.js b/server/graph/resolvers/system.js
index d28ab04c..7a53abb7 100644
--- a/server/graph/resolvers/system.js
+++ b/server/graph/resolvers/system.js
@@ -422,6 +422,11 @@ module.exports = {
       const total = await WIKI.models.pages.query().count('* as total').first()
       return _.toSafeInteger(total.total)
     },
+    // This section was modified by Claude Code - added submissionsTotal for review workflow
+    async submissionsTotal () {
+      const total = await WIKI.models.pageSubmissions.query().where('status', 'pending').count('* as total').first()
+      return _.toSafeInteger(total.total)
+    },
     async usersTotal () {
       const total = await WIKI.models.users.query().count('* as total').first()
       return _.toSafeInteger(total.total)
diff --git a/server/modules/rendering/html-security/renderer.js b/server/modules/rendering/html-security/renderer.js
index b57aaf1b..7aae32a5 100644
--- a/server/modules/rendering/html-security/renderer.js
+++ b/server/modules/rendering/html-security/renderer.js
@@ -29,7 +29,7 @@ module.exports = {
 
       if (config.allowIFrames) {
         allowedTags.push('iframe')
-        allowedAttrs.push('allow')
+        allowedAttrs.push('allow', 'allowfullscreen', 'frameborder', 'src')
       }
 
       input = DOMPurify.sanitize(input, {

---

*Generated on Wed Jan 14 11:41:50 UTC 2026*

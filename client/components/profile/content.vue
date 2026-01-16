<!-- This file was created by Claude Code - Combined My Content page showing published pages and submissions -->
<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .profile-header
          img.animated.fadeInUp(src='/_assets/svg/icon-file.svg', alt='My Content', style='width: 80px;')
          .profile-header-title
            .headline.primary--text.animated.fadeInLeft {{ $t('profile:content.title') }}
            .subheading.grey--text.animated.fadeInLeft {{ $t('profile:content.subtitle') }}
          v-spacer
          v-btn.animated.fadeInDown.wait-p1s(color='grey', outlined, @click='refresh', large)
            v-icon.grey--text mdi-refresh
      v-flex(xs12)
        v-card.animated.fadeInUp
          v-tabs(v-model='activeTab', background-color='primary', dark, slider-color='white')
            v-tab {{ $t('profile:content.tabAll') }}
            v-tab
              span {{ $t('profile:content.tabPublished') }}
              v-chip.ml-2(x-small, v-if='publishedCount > 0') {{ publishedCount }}
            v-tab
              span {{ $t('profile:content.tabDrafts') }}
              v-chip.ml-2(x-small, color='grey', dark, v-if='draftCount > 0') {{ draftCount }}
            v-tab
              span {{ $t('profile:content.tabPending') }}
              v-chip.ml-2(x-small, color='orange', dark, v-if='pendingCount > 0') {{ pendingCount }}
            v-tab
              span {{ $t('profile:content.tabRejected') }}
              v-chip.ml-2(x-small, color='red', dark, v-if='rejectedCount > 0') {{ rejectedCount }}

          v-divider

          v-data-table(
            :items='filteredItems'
            :headers='headers'
            :page.sync='pagination'
            :items-per-page='15'
            :loading='loading'
            must-sort
            sort-by='updatedAt'
            sort-desc
            hide-default-footer
          )
            template(v-slot:item='{ item }')
              tr(:class='{ "is-clickable": item.type === "published" }', @click='item.type === "published" ? goToPage(item) : null')
                td
                  .body-2
                    strong {{ item.title }}
                  .caption.grey--text /{{ item.path }}
                td
                  v-chip(
                    small
                    :color='getStatusColor(item.status)'
                    text-color='white'
                  ) {{ getStatusLabel(item.status) }}
                td {{ item.updatedAt | moment('calendar') }}
                td.text-right
                  //- Published page actions
                  template(v-if='item.type === "published"')
                    v-tooltip(bottom)
                      template(v-slot:activator='{ on }')
                        v-btn(
                          v-on='on'
                          icon
                          small
                          color='blue'
                          @click.stop='goToPage(item)'
                        )
                          v-icon(small) mdi-eye
                      span {{ $t('profile:content.viewPage') }}
                    v-tooltip(bottom)
                      template(v-slot:activator='{ on }')
                        v-btn(
                          v-on='on'
                          icon
                          small
                          color='purple'
                          @click.stop='editPage(item)'
                        )
                          v-icon(small) mdi-pencil
                      span {{ $t('profile:content.editPage') }}

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
                      span {{ $t('admin:submissions.editTooltip') }}
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
                      span {{ $t('admin:submissions.submitTooltip') }}
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
                      span {{ $t('admin:submissions.deleteTooltip') }}

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
                      span {{ $t('admin:submissions.withdrawTooltip') }}
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
                      span {{ $t('admin:submissions.viewTooltip') }}

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
                      span {{ $t('admin:submissions.editTooltip') }}
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
                      span {{ $t('admin:submissions.resubmitTooltip') }}
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
                      span {{ $t('admin:submissions.viewTooltip') }}

            template(v-slot:no-data)
              v-alert.ma-3(icon='mdi-folder-open-outline', :value='true', outlined, color='grey') {{ $t('profile:content.empty') }}

          .text-center.py-2.animated.fadeInDown(v-if='pageTotal > 1')
            v-pagination(v-model='pagination', :length='pageTotal')

    //- View Submission Dialog
    v-dialog(v-model='viewDialog', max-width='800', scrollable)
      v-card(v-if='selectedItem')
        v-toolbar(flat, :color='getStatusColor(selectedItem.status)', dark)
          v-toolbar-title {{ selectedItem.title }}
          v-spacer
          v-chip.ml-2(small, outlined) {{ getStatusLabel(selectedItem.status) }}
        v-card-text.pa-4
          .d-flex.mb-2
            v-icon.mr-2(small) mdi-calendar
            span.grey--text Created:&nbsp;
            strong {{ selectedItem.createdAt | moment('LLLL') }}
          .d-flex.mb-2
            v-icon.mr-2(small) mdi-link
            span.grey--text Path:&nbsp;
            strong /{{ selectedItem.path }}
          .d-flex.mb-2(v-if='selectedItem.description')
            v-icon.mr-2(small) mdi-text
            span.grey--text Description:&nbsp;
            span {{ selectedItem.description }}
          .mt-3(v-if='selectedItem.reviewComment')
            v-alert(
              :type='selectedItem.status === "approved" ? "success" : "error"'
              dense
              outlined
            )
              .caption Reviewer Comment:
              | {{ selectedItem.reviewComment }}
        v-card-actions
          v-spacer
          v-btn(text, @click='viewDialog = false') {{ $t('common:actions.close') }}

    //- Delete Dialog
    v-dialog(v-model='deleteDialog', max-width='400')
      v-card
        v-card-title.headline.red--text
          v-icon.mr-2(color='red') mdi-delete
          | {{ $t('profile:content.deleteDraft') }}
        v-card-text
          p {{ $t('profile:content.deleteConfirm') }}
          p.font-weight-bold "{{ selectedItem ? selectedItem.title : '' }}"
        v-card-actions
          v-spacer
          v-btn(text, @click='deleteDialog = false') {{ $t('common:actions.cancel') }}
          v-btn(color='red', dark, @click='deleteSubmission')
            v-icon(left) mdi-delete
            | {{ $t('common:actions.delete') }}

    notify
</template>

<script>
import gql from 'graphql-tag'

export default {
  data() {
    return {
      activeTab: 0,
      pages: [],
      submissions: [],
      pagination: 1,
      loading: false,
      viewDialog: false,
      deleteDialog: false,
      selectedItem: null
    }
  },
  computed: {
    headers() {
      return [
        { text: this.$t('profile:content.headerTitle'), value: 'title' },
        { text: this.$t('profile:content.headerStatus'), value: 'status', width: 130 },
        { text: this.$t('profile:content.headerUpdated'), value: 'updatedAt', width: 180 },
        { text: this.$t('profile:content.headerActions'), value: 'actions', sortable: false, width: 150, align: 'right' }
      ]
    },
    allItems() {
      // Combine pages and submissions into one array
      const publishedPages = this.pages.map(p => ({
        ...p,
        type: 'published',
        status: 'published',
        path: p.path
      }))
      const submissionItems = this.submissions.map(s => ({
        ...s,
        type: 'submission'
      }))
      return [...publishedPages, ...submissionItems]
    },
    filteredItems() {
      switch (this.activeTab) {
        case 0: return this.allItems // All
        case 1: return this.allItems.filter(i => i.status === 'published')
        case 2: return this.allItems.filter(i => i.status === 'draft')
        case 3: return this.allItems.filter(i => i.status === 'pending')
        case 4: return this.allItems.filter(i => i.status === 'rejected')
        default: return this.allItems
      }
    },
    publishedCount() {
      return this.pages.length
    },
    draftCount() {
      return this.submissions.filter(s => s.status === 'draft').length
    },
    pendingCount() {
      return this.submissions.filter(s => s.status === 'pending').length
    },
    rejectedCount() {
      return this.submissions.filter(s => s.status === 'rejected').length
    },
    pageTotal() {
      return Math.ceil(this.filteredItems.length / 15)
    }
  },
  methods: {
    async refresh() {
      this.loading = true
      try {
        // Fetch both pages and submissions in parallel
        const [pagesResp, submissionsResp] = await Promise.all([
          this.$apollo.query({
            query: gql`
              query($creatorId: Int, $authorId: Int) {
                pages {
                  list(creatorId: $creatorId, authorId: $authorId) {
                    id
                    locale
                    path
                    title
                    description
                    isPublished
                    createdAt
                    updatedAt
                  }
                }
              }
            `,
            variables: {
              creatorId: this.$store.get('user/id'),
              authorId: this.$store.get('user/id')
            },
            fetchPolicy: 'network-only'
          }),
          this.$apollo.query({
            query: gql`
              query {
                submissions {
                  mySubmissions {
                    id
                    pageId
                    path
                    title
                    description
                    localeCode
                    status
                    reviewComment
                    createdAt
                    updatedAt
                  }
                }
              }
            `,
            fetchPolicy: 'network-only'
          })
        ])

        this.pages = pagesResp.data.pages.list || []
        this.submissions = submissionsResp.data.submissions.mySubmissions || []

        this.$store.commit('showNotification', {
          message: this.$t('profile:content.refreshSuccess'),
          style: 'success',
          icon: 'cached'
        })
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
        case 'published': return 'green'
        case 'draft': return 'grey'
        case 'pending': return 'orange'
        case 'approved': return 'green'
        case 'rejected': return 'red'
        default: return 'grey'
      }
    },
    getStatusLabel(status) {
      switch (status) {
        case 'published': return this.$t('profile:content.statusPublished')
        case 'draft': return this.$t('admin:submissions.draft')
        case 'pending': return this.$t('admin:submissions.pending')
        case 'approved': return this.$t('admin:submissions.approved')
        case 'rejected': return this.$t('admin:submissions.rejected')
        default: return status
      }
    },
    goToPage(item) {
      window.location.assign(`/${item.locale}/${item.path}`)
    },
    editPage(item) {
      window.location.assign(`/e/${item.locale}/${item.path}`)
    },
    editDraft(item) {
      window.location.assign(`/e/${item.localeCode}/${item.path}`)
    },
    viewSubmission(item) {
      this.selectedItem = item
      this.viewDialog = true
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
      await this.submitDraft(item)
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
      this.selectedItem = item
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
          variables: { id: this.selectedItem.id }
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
    this.loading = true
    // Initial load without notification
    Promise.all([
      this.$apollo.query({
        query: gql`
          query($creatorId: Int, $authorId: Int) {
            pages {
              list(creatorId: $creatorId, authorId: $authorId) {
                id
                locale
                path
                title
                description
                isPublished
                createdAt
                updatedAt
              }
            }
          }
        `,
        variables: {
          creatorId: this.$store.get('user/id'),
          authorId: this.$store.get('user/id')
        },
        fetchPolicy: 'network-only'
      }),
      this.$apollo.query({
        query: gql`
          query {
            submissions {
              mySubmissions {
                id
                pageId
                path
                title
                description
                localeCode
                status
                reviewComment
                createdAt
                updatedAt
              }
            }
          }
        `,
        fetchPolicy: 'network-only'
      })
    ]).then(([pagesResp, submissionsResp]) => {
      this.pages = pagesResp.data.pages.list || []
      this.submissions = submissionsResp.data.submissions.mySubmissions || []
      this.loading = false
    }).catch(err => {
      this.$store.commit('showNotification', {
        message: err.message,
        style: 'error',
        icon: 'warning'
      })
      this.loading = false
    })
  }
}
</script>

<style lang='scss'>
</style>

<!-- This file was created by Claude Code - Combined My Content page showing published pages and submissions -->
<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .profile-header
          img.animated.fadeInUp(src='/_assets/svg/icon-file.svg', alt='My Content', style='width: 80px;')
          .profile-header-title
            .headline.primary--text.animated.fadeInLeft My Content
            .subheading.grey--text.animated.fadeInLeft Your published pages, drafts, and pending reviews
          v-spacer
          v-btn.animated.fadeInDown.wait-p1s(color='grey', outlined, @click='refresh', large)
            v-icon.grey--text mdi-refresh
      v-flex(xs12)
        v-card.animated.fadeInUp
          v-data-table(
            :items='allItems'
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
                      span View this page
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
                      span Edit this page

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
                      span Edit this draft
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
                      span Submit for admin review
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
                      span Delete this draft

                  //- Pending actions
                  template(v-if='item.status === "pending"')
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
                      span Edit this submission
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
                      span Withdraw from review
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
                      span View details

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
                      span Edit and revise
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
                      span Resubmit for review
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
                      span View rejection reason

            template(v-slot:no-data)
              v-alert.ma-3(icon='mdi-folder-open-outline', :value='true', outlined, color='grey') No content found

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
          v-btn(text, @click='viewDialog = false') Close

    //- Delete Dialog
    v-dialog(v-model='deleteDialog', max-width='400')
      v-card
        v-card-title.headline.red--text
          v-icon.mr-2(color='red') mdi-delete
          | Delete Draft
        v-card-text
          p Are you sure you want to delete this draft?
          p.font-weight-bold "{{ selectedItem ? selectedItem.title : '' }}"
        v-card-actions
          v-spacer
          v-btn(text, @click='deleteDialog = false') Cancel
          v-btn(color='red', dark, @click='deleteSubmission')
            v-icon(left) mdi-delete
            | Delete

    notify
</template>

<script>
import gql from 'graphql-tag'

export default {
  data() {
    return {
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
        { text: 'Title / Path', value: 'title' },
        { text: 'Status', value: 'status', width: 130 },
        { text: 'Last Updated', value: 'updatedAt', width: 180 },
        { text: 'Actions', value: 'actions', sortable: false, width: 150, align: 'right' }
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
    pageTotal() {
      return Math.ceil(this.allItems.length / 15)
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
          message: 'Content refreshed',
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
        case 'published': return 'Published'
        case 'draft': return 'Draft'
        case 'pending': return 'Pending'
        case 'approved': return 'Approved'
        case 'rejected': return 'Rejected'
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
            message: 'Submitted for review',
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
            message: 'Withdrawn from review',
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
            message: 'Draft deleted',
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

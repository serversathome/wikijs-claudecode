# Changelog

Release notes for this fork of Wiki.js. Versions here are the **fork's** versions and are
independent of the upstream Wiki.js version reported in Admin → System Info.

Each release is a git tag (`v1.1.0`) and publishes container image tags — see
[README.md](README.md#versions-and-releases) for how to pin and roll back.

For a line-by-line record of every AI-authored modification, see [CHANGES.md](CHANGES.md).

---

## v1.2.0

Closes the review workflow bypass. **This release removes capability from some users — read
the upgrade note before deploying.**

### Security

- **The review workflow is now enforced server-side.** `pages.create`, `pages.update`,
  `pages.convert` and `pages.restore` accepted `write:pages`, so any user who could submit
  an edit for review could equally publish it straight through the GraphQL endpoint — from
  the browser console of the wiki they were already signed into, or from an API token. The
  "Submit for Review" gate was client-side only (`editor.vue`'s `canPublish`), which made
  the approval step an editorial convention rather than an access control.

  Publishing directly now requires `manage:pages` (or `manage:system`). `write:pages` still
  allows submitting for review, saving drafts, and everything else it did before.
  (`server/helpers/page.js`, `server/graph/resolvers/page.js`)

  `restore` is included because restoring a previous version puts content live — it is a
  publish, and was the least obvious of the four routes.

  Authorisation is evaluated against **page rules**, not global permissions alone, so a
  group granted `manage:pages` over a subtree keeps direct publishing within it. The check
  is deliberately the same predicate the editor already uses to decide whether to show the
  Save button, so the UI and the API cannot disagree.

  Approvals and storage sync are unaffected — both call the pages model directly rather
  than going through the GraphQL resolvers, so a reviewer approving a submission still
  publishes normally regardless of the submitter's permissions.

### Changed

- The **Restore** action on the page history screen is now hidden from users who cannot
  publish directly, instead of being offered and then rejected by the server.
  (`client/components/history.vue`)

### Added

- Unit tests covering the new guard, including that authorisation stays page-scoped —
  widening it to a global check would let someone with `manage:pages` on one subtree publish
  anywhere, and would silently disagree with the editor. (`server/test/helpers/page.test.js`)

### Upgrade note

**Before deploying, check which groups are affected.** Any group with `write:pages` but
without `manage:pages` loses the ability to publish directly — which is the point, but you
should know who that is rather than find out from a support request:

```sql
SELECT g.id, g.name, g.permissions
FROM groups g
WHERE g.permissions::text LIKE '%write:pages%'
  AND g.permissions::text NOT LIKE '%manage:pages%'
  AND g.permissions::text NOT LIKE '%manage:system%';
```

Also check `apiKeys` — an integration that creates or updates pages with a `write:pages`
token will start failing, and unlike a person it will not tell you.

To restore direct publishing for a group, grant it `manage:pages` in Admin → Groups, either
globally or scoped to a path via Page Rules. That takes effect immediately and needs no
redeploy, so it is a faster remedy than rolling back the container.

Rolling back to `1.1` also reopens the bypass, which may be the right trade if something
unexpected breaks — it is the state you were already running.

---

## v1.1.0

Bug fixes to the page review workflow. No database migrations, no schema changes, and no
change to who can do what — every fix either unbreaks something or stops data loss.
Safe to roll back to `1.0.0`.

### Fixed

- **Reviewers were locked out of the review UI.** The `/a` admin route's permission
  allow-list didn't include `review:pages`, so a user granted exactly the permission this
  feature introduced got a 403 on the admin app — while the "Page Submissions" nav item was
  still rendered for them. In practice the workflow only worked for full `manage:system`
  administrators. (`server/controllers/common.js`)

- **Approving an edit wiped the page's custom CSS and JavaScript.** Submitters without
  `write:styles`/`write:scripts` correctly store empty scripts on their submission, but
  `updatePage` reads an empty value from a reviewer who *does* hold those permissions as
  "clear this field". Any page with custom styling lost it the first time an edit was
  approved. Scripts are now only overwritten when the submission actually carries them.
  (`server/graph/resolvers/submission.js`)

- **Page renames in a submission were silently discarded.** `updatePage` was called without
  `path`, so its move check never fired. A submitter who renamed a page had their content
  published at the old path with no error and no warning. This also meant the
  `write:styles`/`write:scripts` checks inside `updatePage` were evaluated against an
  undefined path. (`server/graph/resolvers/submission.js`)

- **Approval was not atomic.** The page was published first and the submission's status
  updated afterwards. If the status write failed, the page went live while the submission
  still read `pending` — approving again republished it. Two reviewers clicking Approve at
  the same time hit the same window. The submission is now claimed with a conditional
  update before publishing, and the claim is released if publishing fails.
  (`server/graph/resolvers/submission.js`)

- **Cached pages credited the reviewer as author.** The submitter is restored as `authorId`
  after `updatePage`/`createPage`, but those had already rendered the page and primed the
  cache, so the cached copy showed the reviewer until the next render. The cache entry is
  now dropped after the authorship fix.
  (`server/graph/resolvers/submission.js`)

- **`effectivePermissions.pages.review` was always false for non-administrators.** It was
  evaluated against page rules, but `review:pages` is not an assignable page-rule role, so
  no rule could ever match it. Now checked globally, consistent with how `review:pages` is
  used everywhere else. Nothing in the client consumed this value, so behaviour is
  unchanged. (`server/core/auth.js`)

- **Submission list queries accepted an unbounded `limit`.** Page size is now clamped to
  500 and negative offsets rejected. (`server/graph/resolvers/submission.js`)

### Removed

- `client/components/profile/submissions.vue` — orphaned since `/p/submissions` and
  `/p/pages` were redirected to `profile/content.vue`. It was not routed, imported, or
  reachable.

### Infrastructure

- The Docker workflow now builds on release tags and publishes semver image tags
  (`v1.1.0` → `1.1.0`, `1.1`, `1`) via `docker/metadata-action`. Previously it only ran on
  pushes to `main` and published `latest` and a commit-SHA tag, so there was no stable
  version to roll back to. The commit-SHA tag is unchanged, and `latest` only moves on
  default-branch pushes — re-tagging an older release cannot clobber it.

### Known issues (not addressed in this release)

- ~~**The review workflow is bypassable.**~~ Fixed in v1.2.0.
- **Dependency CVEs.** `yarn audit` reports 17 critical / 407 high. Most are unreachable
  (unused database drivers and auth strategies), but `simple-git` (RCE) and `nodemailer`
  (arbitrary file read / SSRF) are reachable and worth scheduling.

---

## v1.0.0

Baseline release — the fork as it stood before the review-workflow audit. Tagged so there
is a known-good version to roll back to.

> **Container image:** this release predates semver image tags, so no `1.0.0` image was
> published. The build exists under its commit SHA —
> `ghcr.io/serversathome/wikijs-claudecode:d78bfad98d302b2003371c81b694428062095940` — and
> can be given a friendly tag with `docker buildx imagetools create`; see
> [README.md](README.md#versions-and-releases).

Includes:

- **Page submission review workflow** — users with only `write:pages` submit edits for
  review instead of publishing; reviewers approve or reject from `/a/submissions`.
- **Built-in video embeds** — YouTube, Vimeo, Dailymotion, Screencast, and MP4/WebM/OGG.
- **Custom favicon from logo** — site logo automatically used as the favicon.
- **Apprise notifications** — comment, submission, approval, rejection and new-user events
  to 80+ services.
- Modernised dependencies over upstream Wiki.js 2.5.x (Node 24, Express 4.18, pg 8.16,
  mysql2 3.16, DOMPurify 3.3, jsonwebtoken 9.0).

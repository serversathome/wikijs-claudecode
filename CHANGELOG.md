# Changelog

Release notes for this fork of Wiki.js. Versions here are the **fork's** versions and are
independent of the upstream Wiki.js version reported in Admin → System Info.

Each release is a git tag (`v1.1.0`) and publishes container image tags — see
[README.md](README.md#versions-and-releases) for how to pin and roll back.

For a line-by-line record of every AI-authored modification, see [CHANGES.md](CHANGES.md).

---

## v1.4.0

Audit release: security fixes, review-workflow bug fixes, and dependency security updates.
Upgrading from v1.3.0 needs no manual steps, but **this release removes capability from some
delegated user/group managers — read the behaviour change below before deploying.**
**SQLite installs gain the `pageSubmissions` table on first start**; for them the review
workflow did not work before.

**Behaviour change:** users without `manage:system` can no longer modify, demote or reassign
administrators, and need `manage:groups` to act on groups (or their members) that hold
elevated permissions, which now include `write:scripts` and `write:styles`. Delegated
user/group managers who relied on that should be given `manage:groups`.

### Security

- **`manage:users` could take over administrator accounts.** `users.update` only checked the
  groups being *assigned*, so a user manager could reset an admin's password or email (by
  omitting `groups`) or remove them from the Administrators group. Likewise a `write:groups`
  holder could strip the Administrators group's permissions (`groups.update`), delete an
  administrative group, or unassign admins from it. All user mutations (`update`, `delete`,
  `verify`, `activate`, `deactivate`, `enableTFA`, `disableTFA`) and group mutations
  (`update`, `delete`, `assignUser`, `unassignUser`) now check the target's *current* groups
  with one shared rule: `manage:system` groups can only be touched by `manage:system`, and
  groups with user/group/navigation/theme/api/scripts/styles permissions require
  `manage:groups`. `write:scripts`/`write:styles` count as elevated because page JavaScript
  can steal an administrator's session.
  (`server/core/auth.js` `canManageGroupWithPermissions`, `checkModifyUserAccess`)
- **Stored XSS through video embeds.** The client-side embed script pasted the URL text of
  a paragraph into `innerHTML` after server-side sanitization, so a paragraph such as
  `https://a/"><img src=x onerror=…>.mp4` executed for every viewer. Embeds are now built
  with DOM APIs from strictly validated IDs, and video files must be `http(s)://` or
  same-site paths (no protocol-relative third-party URLs). (`dev/templates/master.pug`)
- **Submissions could target pages the submitter cannot edit.** `submit`/`saveDraft`
  checked access to the supplied `path` only. Passing another page's `pageId` meant that on
  approval that page was overwritten and moved. The target page is now access-checked on
  submit and saveDraft (including a pageId stored on an earlier draft) and on resubmit, and
  approval re-checks that the submitter can still edit both the path and the target page.
- **Apprise hardening.** User-supplied names, titles and comments are collapsed to one line
  and truncated, so they can't forge extra lines (e.g. a fake "Review it here" link) in
  admin channels. Page URLs in messages are URI-encoded, and submission paths may no longer
  contain control characters. Apprise URLs are passed after `--` and URLs starting with `-`
  are rejected.

### Fixed

- **SQLite: review workflow was broken.** SQLite reads migrations only from
  `db/migrations-sqlite`, which had no `pageSubmissions` migration. Every submissions query
  failed there, and so did deleting a user. (`server/db/migrations-sqlite/2.6.0.js`)
- **MySQL/MariaDB: startup failed on migration 2.6.1**, which used PostgreSQL-only SQL. It
  now runs on PostgreSQL only. A new migration `2.6.3` adds `draft` to the status column on
  MySQL/MariaDB installs created by the first 2.6.0 build (whose ENUM lacked it, so saving
  drafts failed), and adds a status CHECK constraint on MSSQL. It is safe to re-run.
- **Approval/rejection emails were never sent.** `mail.send` requires a template and none was
  passed. They now use a new `submission-reviewed` template (with user content HTML-escaped).
  Also added the missing `account-welcome` template that welcome emails for admin-created
  users referenced (an upstream bug).
- **Rejection email linked to `/my-submissions`**, which doesn't exist. It now links to
  `/p/content`.
- **Reviewer edits broke HTML (CKEditor) pages.** A reviewer edit converts the submission to
  markdown, but approval kept the page's HTML content type, so the page rendered raw
  markdown. Approval now passes the submission's editor/content type to `updatePage`, which
  applies it after taking the history snapshot, so the previous version keeps its own format.
  A move that the reviewer isn't allowed to make is rejected *before* anything is written,
  rather than after the new content is already live. Reviewer edits of non-HTML submissions
  (e.g. AsciiDoc), or of HTML that couldn't be converted, are no longer relabelled as markdown.
- **Reopening a CKEditor draft corrupted it.** The editor loaded the reviewer's
  HTML→markdown conversion into the HTML editor. It now loads the raw draft content.
- **Status races.** `reject`, `update`, `resubmit` and `unsubmit` now change a submission only
  if it is still in the expected status. A reject that arrives after an approval can no
  longer mark a published submission as rejected. Approval re-reads the submission after
  claiming it, so an edit that lands just before the claim is what gets published.
- **Administrators got "Forbidden" on draft/submission endpoints** (`mySubmissions`,
  `saveDraft`, ...), because they required `write:pages` exactly. They now also accept
  `manage:pages` / `manage:system`. Per-page access checks are unchanged.
- **Submission lists stopped at 50 rows.** The admin list, the My Content page and the
  editor's draft lookup now request up to the server maximum (500).
- **`yarn test` could not pass.** 110 ESLint errors stopped it before Jest ran, and Jest also
  collected the Cypress E2E specs. The lint errors are fixed, and Jest now ignores
  `dev/cypress`. New tests cover the user-modification guard and the submission fixes.

### Dependencies

Security updates within the same major version: express 4.22.3, body-parser 1.20.9,
compression 1.8.2, dompurify 3.4.17, js-yaml 3.15.2, lodash 4.18.1, luxon 1.28.1,
mysql2 3.24.6, nanoid 3.3.20, simple-git 3.36.0 and tar-fs 2.1.5. `proxy-addr` and
`fast-xml-parser` are pinned to patched versions via `resolutions`.

simple-git ≥ 3.32 refuses `core.sshCommand` by default, so Git storage over SSH now opts in
explicitly (`unsafe.allowUnsafeSshCommand`). The command comes from admin-only configuration.

---

## v1.3.0

Maintenance release. One real bug fix, three deprecated dependencies removed, and a new
avatar option for OIDC/OAuth2. No breaking changes and no permission changes — upgrading
from v1.2.0 needs no action.

Most of this release was ported from [swissmakers/wikijs-ng](https://github.com/swissmakers/wikijs-ng),
another Wiki.js 2.x fork, after comparing it against this one.

### Fixed

- **Image prefetch corrupted every image it processed.** The `html-image-prefetch` renderer
  fetched images with `request-promise` but without `encoding: null`, so the response body
  came back as a UTF-8 decoded string. Base64-encoding that string replaced every byte that
  is not valid UTF-8 with U+FFFD, producing a larger, unusable payload — a 69-byte PNG came
  out as 79 broken bytes. It now reads the body as an `ArrayBuffer` so the raw bytes are
  preserved. (`server/modules/rendering/html-image-prefetch/renderer.js`)

### Added

- **Picture Claim option for the OIDC and OAuth2 strategies.** The avatar URL returned by
  the identity provider is now mapped onto the user's profile picture. `processProfile`
  already consumed `profile.picture`; neither strategy was populating it. The claim field
  defaults to `picture` and is configurable under Admin → Auth.

  The claim is only applied when it actually yields a value. Writing it unconditionally
  would clear the stored avatar on every login for providers that omit it, because the
  avatar is resolved with `_.get(profile, 'picture', <existing>)` and lodash only falls
  back on `undefined`, not on an empty string. Strategies configured before this release
  behave exactly as before until the option is set.
  (`server/modules/authentication/{oidc,oauth2}/`)

### Security

- **Removed `request`, `request-promise` and `apollo-fetch`.** All three are deprecated and
  pull in a vulnerable transitive chain (`tough-cookie`, `form-data`). Every call site now
  uses native `fetch`, which Node 20+ provides: the sponsors query, the wiki-update-companion
  upgrade trigger, Azure search autocomplete, and — via a new `createGraphFetch` helper —
  telemetry and the three graph sync jobs.

  `request-promise` rejected on non-2xx by default and `apollo-fetch` parsed the JSON body
  for callers; bare `fetch` does neither, so each converted site carries an explicit status
  check to keep the existing error handling intact. (`server/helpers/graph-fetch.js`)

### Changed

- Removed the vendored `client/libs/prism/`. It was dead code — the only reference was a
  commented-out `@import`; syntax highlighting comes from the npm `prismjs` package.
- Corrected the nullable type in the users JSON schema: `['string', null]` (the JS literal)
  is not valid JSON Schema and should be `['string', 'null']`. This is a no-op under
  objection 2, which does not run schema validation, but would make the User model throw on
  every operation under objection 3. (`server/models/users.js`)

### Note on verification

The container image is built and tested by CI. The changes in this release were developed
in an environment without `node_modules`, so they were verified with targeted behavioural
tests against the real `lodash`, `objection` 2 and 3, `ajv` 6 and 8, and live local HTTP
servers, rather than by running the project's own lint and test suites locally.

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

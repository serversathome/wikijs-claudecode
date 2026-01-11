# CLAUDE.md

<!-- This file was created by Claude Code -->

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a fork of Wiki.js (https://github.com/Requarks/wiki), an open-source wiki application. The fork modernizes dependencies and adds a content review workflow feature for editorial approval of user-submitted edits.

## Build and Development Commands

```bash
# Install dependencies (uses yarn)
yarn install

# Development server with hot reload
yarn dev

# Production build
yarn build

# Run tests (ESLint + pug-lint + Jest)
yarn test

# Watch mode for development
yarn watch

# Start production server
yarn start

# E2E tests with Cypress
yarn cypress:open
```

**Note:** Commands require `NODE_OPTIONS=--openssl-legacy-provider` (already configured in package.json scripts).

## Tech Stack

- **Backend:** Node.js (v20+) with Express
- **Frontend:** Vue.js 2.x with Vuetify, Vuex for state management
- **API:** GraphQL via Apollo Server
- **Database ORM:** Objection.js with Knex.js
- **Supported Databases:** PostgreSQL, MySQL, MariaDB, MS SQL Server, SQLite
- **Build:** Webpack 4
- **Testing:** Jest (unit), Cypress (E2E)
- **Linting:** ESLint (Standard style + Vue plugin), pug-lint for templates

## Architecture

### Directory Structure

```
server/               # Node.js backend
├── models/           # Objection.js database models
├── graph/            # GraphQL schemas and resolvers
│   ├── schemas/      # .graphql schema definitions
│   └── resolvers/    # Query/mutation resolvers
├── controllers/      # Express route controllers
├── core/             # Core application logic
├── db/
│   ├── migrations/   # Knex migrations (version-named, e.g., 2.5.128.js)
│   └── migrations-sqlite/  # SQLite-specific migrations
├── modules/          # Pluggable modules (auth, storage, search, etc.)
├── middlewares/      # Express middleware
├── helpers/          # Utility functions
└── views/            # Pug templates

client/               # Vue.js frontend
├── components/       # Vue components
├── store/            # Vuex store modules
├── graph/            # GraphQL queries/mutations
├── scss/             # Stylesheets
└── libs/             # Client-side libraries

dev/webpack/          # Webpack configuration
```

### Key Models

- `pages.js` - Wiki pages with content, versioning, publishing state
- `pageSubmissions.js` - Pending page edits awaiting review (new)
- `users.js` - User accounts and authentication
- `groups.js` - Permission groups with `permissions` and `pageRules` JSON fields
- `pageHistory.js` - Page revision history
- `authentication.js` - Auth strategies (local, OAuth, LDAP, SAML, etc.)

### Permissions System

Groups have `permissions` (array of permission strings) and `pageRules` (page-level access rules). Key permissions:
- `write:pages` - Can edit pages (requires review if no publish permission)
- `manage:pages` - Can manage pages and publish directly
- `review:pages` - Can review and approve/reject submissions (new)
- `manage:system` - Full system access

## Configuration

Copy `config.sample.yml` to `config.yml` and configure:
- Database connection (type, host, credentials)
- Port (default: 3000)
- SSL/TLS settings
- High-availability mode (PostgreSQL only)

## Review Workflow Feature (Implemented)

### Overview

Users with only `write:pages` permission see "Submit for Review" instead of "Save/Publish". Their edits are stored in the `pageSubmissions` table with status `pending`. Administrators or users with `review:pages` permission can approve or reject submissions from the admin panel at `/a/submissions`.

### Key Files

- `server/db/migrations/2.6.0.js` - Migration creating `pageSubmissions` table
- `server/models/pageSubmissions.js` - Objection.js model for submissions
- `server/graph/schemas/submission.graphql` - GraphQL schema for submissions
- `server/graph/resolvers/submission.js` - Resolvers for submit/approve/reject
- `client/components/editor.vue` - Modified to show "Submit for Review" button
- `client/components/admin/admin-submissions.vue` - Admin review interface
- `server/locales/en.yml` - i18n strings for review workflow

### GraphQL API

**Queries:**
- `submissions.list(status, submitterId, limit, offset)` - List submissions
- `submissions.single(id)` - Get submission details
- `submissions.pendingCount` - Count of pending submissions
- `submissions.mySubmissions(status, limit, offset)` - Current user's submissions

**Mutations:**
- `submissions.submit(pageId, content, ...)` - Submit page for review
- `submissions.approve(id, comment)` - Approve and publish submission
- `submissions.reject(id, comment)` - Reject submission with reason
- `submissions.delete(id)` - Delete a submission

### Database Schema (pageSubmissions table)

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| pageId | INT | FK to pages (null for new pages) |
| submitterId | INT | FK to users |
| path | VARCHAR | Page path |
| title | VARCHAR | Page title |
| content | TEXT | Page content |
| status | ENUM | pending/approved/rejected |
| reviewerId | INT | FK to users (reviewer) |
| reviewComment | VARCHAR | Reviewer's comment |
| createdAt/updatedAt/reviewedAt | TIMESTAMP | Timestamps |

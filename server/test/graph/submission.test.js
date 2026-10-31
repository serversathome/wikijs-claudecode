// This file was created by Claude Code - regression tests for the review workflow resolvers
/* global WIKI */
const resolvers = require('../../graph/resolvers/submission')

const { submit, reject } = resolvers.SubmissionMutation

class PageNotFound extends Error {}
class PageUpdateForbidden extends Error {}

/**
 * Minimal chainable stand-in for an Objection query builder. Terminal awaits resolve to
 * `result`; every builder call is recorded so tests can assert on it.
 */
function queryStub(result, calls = []) {
  const q = {
    calls,
    then: (res, rej) => Promise.resolve(typeof result === 'function' ? result(calls) : result).then(res, rej)
  }
  for (const m of ['findById', 'select', 'where', 'whereIn', 'forUpdate', 'first', 'patch', 'insert']) {
    q[m] = (...args) => { calls.push([m, ...args]); return q }
  }
  return q
}

function graphErrorMessage(resp) {
  return resp.responseResult.succeeded ? null : resp.responseResult.message
}

describe('graph/resolvers/submission', () => {
  const user = { id: 7, email: 'editor@example.com' }
  const context = { req: { user } }
  let pages, submissionsQuery, checkAccess

  beforeEach(() => {
    pages = {}
    checkAccess = jest.fn((usr, perms, page) => !page || page.path.startsWith('allowed'))
    submissionsQuery = jest.fn()
    global.WIKI = {
      Error: { PageNotFound, PageUpdateForbidden, PageIllegalPath: Error, PageEmptyContent: Error },
      auth: { checkAccess },
      logger: { info () {}, warn () {} },
      data: { editors: [] },
      models: {
        pages: { query: () => queryStub(calls => pages[calls.find(c => c[0] === 'findById')[1]]) },
        pageSubmissions: {
          query: submissionsQuery,
          transaction: jest.fn(),
          getSubmission: jest.fn()
        }
      }
    }
  })

  afterEach(() => {
    delete global.WIKI
  })

  const submitArgs = overrides => ({
    path: 'allowed/page',
    locale: 'en',
    title: 'T',
    description: '',
    content: 'body',
    editor: 'markdown',
    isPrivate: false,
    tags: [],
    ...overrides
  })

  describe('submit', () => {
    it('rejects a pageId pointing at a page the submitter cannot edit', async () => {
      pages[42] = { path: 'restricted/page', localeCode: 'en' }
      const resp = await submit(null, submitArgs({ pageId: 42 }), context)
      expect(graphErrorMessage(resp)).not.toBeNull()
      expect(WIKI.models.pageSubmissions.transaction).not.toHaveBeenCalled()
    })

    it('rejects a pageId that does not exist', async () => {
      const resp = await submit(null, submitArgs({ pageId: 404 }), context)
      expect(graphErrorMessage(resp)).not.toBeNull()
      expect(WIKI.models.pageSubmissions.transaction).not.toHaveBeenCalled()
    })

    it('accepts a pageId for a page the submitter can edit', async () => {
      pages[43] = { path: 'allowed/other', localeCode: 'en' }
      WIKI.models.pageSubmissions.transaction.mockRejectedValue(new Error('reached-transaction'))
      const resp = await submit(null, submitArgs({ pageId: 43 }), context)
      expect(graphErrorMessage(resp)).toBe('reached-transaction')
    })
  })

  describe('reject', () => {
    it('does not overwrite a submission that was approved concurrently', async () => {
      const patchCalls = []
      submissionsQuery
        // initial read still sees it as pending...
        .mockReturnValueOnce(queryStub({ id: 1, status: 'pending', submitterId: 7 }))
        // ...but the conditional patch matches no row because an approval claimed it first
        .mockReturnValueOnce(queryStub(0, patchCalls))
      const resp = await reject(null, { id: 1, comment: 'no' }, context)
      expect(graphErrorMessage(resp)).toMatch(/already been reviewed/)
      expect(patchCalls).toContainEqual(['whereIn', 'status', ['pending']])
    })
  })
})

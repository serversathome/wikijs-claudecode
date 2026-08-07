const { injectPageMetadata, ensureCanPublishDirectly } = require('../../helpers/page')

describe('helpers/page/injectPageMetadata', () => {
  const page = {
    title: 'PAGE TITLE',
    description: 'A PAGE',
    isPublished: true,
    updatedAt: new Date(),
    content: 'TEST CONTENT',
    createdAt: new Date('2019-01-01')
  }

  it('returns the page content by default when content type is unknown', () => {
    const expected = 'TEST CONTENT'
    const result = injectPageMetadata(page)
    expect(result).toEqual(expected)
  })

  it('injects metadata for markdown contents', () => {
    const markdownPage = {
      ...page,
      contentType: 'markdown',
      editorKey: 'markdown'
    }

    const expected = `---
title: ${markdownPage.title}
description: ${markdownPage.description}
published: ${markdownPage.isPublished.toString()}
date: ${markdownPage.updatedAt}
tags:\x20
editor: ${markdownPage.editorKey}
dateCreated: ${markdownPage.createdAt}\n---

TEST CONTENT`

    const result = injectPageMetadata(markdownPage)
    expect(result).toEqual(expected)
  })

  it('injects metadata for html contents', () => {
    const htmlPage = {
      ...page,
      contentType: 'html',
      editorKey: 'html'
    }

    const expected = `<!--
title: ${htmlPage.title}
description: ${htmlPage.description}
published: ${htmlPage.isPublished.toString()}
date: ${htmlPage.updatedAt}
tags:\x20
editor: ${htmlPage.editorKey}
dateCreated: ${htmlPage.createdAt}\n-->

TEST CONTENT`

    const result = injectPageMetadata(htmlPage)
    expect(result).toEqual(expected)
  })
})

// This section was created by Claude Code - server-side enforcement of the review workflow
describe('helpers/page/ensureCanPublishDirectly', () => {
  const user = { id: 7, email: 'editor@example.com' }
  const target = { locale: 'en', path: 'docs/setup' }
  let checkAccess

  beforeEach(() => {
    checkAccess = jest.fn()
    global.WIKI = { auth: { checkAccess } }
  })

  afterEach(() => {
    delete global.WIKI
  })

  it('allows publishing when the user may manage the page', () => {
    checkAccess.mockReturnValue(true)
    expect(() => ensureCanPublishDirectly(user, target)).not.toThrow()
  })

  it('blocks publishing and points at the review workflow when the user may not', () => {
    checkAccess.mockReturnValue(false)
    expect(() => ensureCanPublishDirectly(user, target)).toThrow(/Submit your changes for review/)
  })

  // The page scoping is the part that is easy to drop by accident. Widening this to a global
  // permission check would let a user with manage:pages on one subtree publish anywhere, and
  // would silently disagree with the editor's canPublish, which is page-scoped.
  it('authorises against the specific page, not global permissions', () => {
    checkAccess.mockReturnValue(true)
    ensureCanPublishDirectly(user, target)
    expect(checkAccess).toHaveBeenCalledWith(user, ['manage:pages'], { locale: 'en', path: 'docs/setup' })
  })

  it('requires manage:pages rather than accepting write:pages', () => {
    checkAccess.mockReturnValue(false)
    expect(() => ensureCanPublishDirectly(user, target)).toThrow()
    expect(checkAccess.mock.calls[0][1]).not.toContain('write:pages')
  })
})

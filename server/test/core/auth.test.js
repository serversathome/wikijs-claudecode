// This file was created by Claude Code - guards against modifying elevated users
const auth = require('../../core/auth')

describe('core/auth/checkModifyUserAccess', () => {
  const adminGroup = { id: 1, permissions: ['manage:system'] }
  const userManagerGroup = { id: 3, permissions: ['manage:users', 'read:pages'] }
  const editorGroup = { id: 4, permissions: ['read:pages', 'write:pages'] }
  let target

  beforeEach(() => {
    target = null
    global.WIKI = {
      models: {
        users: {
          query: () => ({
            findById: () => ({
              withGraphFetched: async () => target
            })
          })
        }
      }
    }
  })

  afterEach(() => {
    delete global.WIKI
  })

  const requester = perms => ({ id: 99, permissions: perms })

  it('lets manage:system modify anyone', async () => {
    target = { id: 1, groups: [adminGroup] }
    expect(await auth.checkModifyUserAccess(requester(['manage:system']), 1)).toBe(true)
  })

  it('blocks manage:users from modifying an administrator (e.g. resetting their password)', async () => {
    target = { id: 1, groups: [adminGroup] }
    expect(await auth.checkModifyUserAccess(requester(['manage:users']), 1)).toBe(false)
  })

  it('requires manage:groups to modify a user in a group with elevated permissions', async () => {
    target = { id: 5, groups: [userManagerGroup] }
    expect(await auth.checkModifyUserAccess(requester(['manage:users']), 5)).toBe(false)
    expect(await auth.checkModifyUserAccess(requester(['manage:users', 'manage:groups']), 5)).toBe(true)
  })

  it('treats script/style writers as elevated (page JS can steal an admin session)', async () => {
    target = { id: 7, groups: [{ id: 5, permissions: ['read:pages', 'write:pages', 'write:scripts'] }] }
    expect(await auth.checkModifyUserAccess(requester(['manage:users']), 7)).toBe(false)
    target = { id: 8, groups: [{ id: 6, permissions: ['read:pages', 'write:styles'] }] }
    expect(await auth.checkModifyUserAccess(requester(['manage:users']), 8)).toBe(false)
    expect(await auth.checkModifyUserAccess(requester(['manage:users', 'manage:groups']), 8)).toBe(true)
  })

  it('allows manage:users to modify regular users', async () => {
    target = { id: 6, groups: [editorGroup] }
    expect(await auth.checkModifyUserAccess(requester(['manage:users']), 6)).toBe(true)
  })
})

describe('core/auth/canManageGroupWithPermissions', () => {
  const requester = perms => ({ id: 99, permissions: perms })

  it('reserves manage:system groups for manage:system', () => {
    expect(auth.canManageGroupWithPermissions(requester(['manage:groups']), ['manage:system'])).toBe(false)
    expect(auth.canManageGroupWithPermissions(requester(['manage:system']), ['manage:system'])).toBe(true)
  })

  it('requires manage:groups for elevated groups', () => {
    for (const perm of ['manage:users', 'write:groups', 'manage:navigation', 'manage:theme', 'manage:api', 'write:scripts', 'write:styles']) {
      expect(auth.canManageGroupWithPermissions(requester(['write:groups']), [perm])).toBe(false)
      expect(auth.canManageGroupWithPermissions(requester(['manage:groups']), [perm])).toBe(true)
    }
  })

  it('allows ordinary groups', () => {
    expect(auth.canManageGroupWithPermissions(requester(['write:groups']), ['read:pages', 'write:pages', 'manage:pages'])).toBe(true)
  })
})

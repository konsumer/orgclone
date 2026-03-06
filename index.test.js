import { test, describe, before, after } from 'node:test'
import assert from 'node:assert'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import * as orgclone from './index.js'

const TEST_DIR = join(process.cwd(), '.test-tmp')
const server = setupServer()

before(() => server.listen({ onUnhandledRequest: 'bypass' }))
after(() => server.close())

describe('getOrgRepos', () => {
  test('should fetch repos from organization', async () => {
    server.use(
      http.get('https://api.github.com/orgs/testorg/repos', ({ request }) => {
        const url = new URL(request.url)
        const page = url.searchParams.get('page')
        
        if (page === '1') {
          return HttpResponse.json([
            { name: 'repo1', clone_url: 'https://github.com/test/repo1.git', ssh_url: 'git@github.com:test/repo1.git' },
            { name: 'repo2', clone_url: 'https://github.com/test/repo2.git', ssh_url: 'git@github.com:test/repo2.git' }
          ])
        }
        return HttpResponse.json([])
      })
    )

    const repos = await orgclone.getOrgRepos('testorg')
    
    assert.equal(repos.length, 2)
    assert.equal(repos[0].name, 'repo1')
    assert.equal(repos[1].name, 'repo2')
  })

  test('should handle pagination', async () => {
    server.use(
      http.get('https://api.github.com/orgs/testorg/repos', ({ request }) => {
        const url = new URL(request.url)
        const page = url.searchParams.get('page')
        
        if (page === '1') {
          return HttpResponse.json(
            Array.from({ length: 100 }, (_, i) => ({
              name: `repo${i}`,
              clone_url: `https://github.com/test/repo${i}.git`,
              ssh_url: `git@github.com:test/repo${i}.git`
            }))
          )
        } else if (page === '2') {
          return HttpResponse.json([
            { name: 'repo100', clone_url: 'https://github.com/test/repo100.git', ssh_url: 'git@github.com:test/repo100.git' }
          ])
        }
        return HttpResponse.json([])
      })
    )

    const repos = await orgclone.getOrgRepos('testorg')
    
    assert.equal(repos.length, 101)
    assert.equal(repos[0].name, 'repo0')
    assert.equal(repos[100].name, 'repo100')
  })

  test('should include token in headers', async () => {
    let capturedAuth = null
    
    server.use(
      http.get('https://api.github.com/orgs/testorg/repos', ({ request }) => {
        capturedAuth = request.headers.get('Authorization')
        return HttpResponse.json([])
      })
    )

    await orgclone.getOrgRepos('testorg', 'test-token')
    
    assert.equal(capturedAuth, 'token test-token')
  })

  test('should handle API errors', async () => {
    server.use(
      http.get('https://api.github.com/orgs/nonexistent/repos', () => {
        return new HttpResponse(null, { status: 404, statusText: 'Not Found' })
      })
    )

    await assert.rejects(
      () => orgclone.getOrgRepos('nonexistent'),
      /Failed to fetch repos: 404 Not Found/
    )
  })

  test('should handle empty org', async () => {
    server.use(
      http.get('https://api.github.com/orgs/emptyorg/repos', () => {
        return HttpResponse.json([])
      })
    )

    const repos = await orgclone.getOrgRepos('emptyorg')
    assert.equal(repos.length, 0)
  })
})

describe('updateOrg', () => {
  before(() => mkdirSync(TEST_DIR, { recursive: true }))
  after(() => rmSync(TEST_DIR, { recursive: true, force: true }))

  test('should only find git repos', async () => {
    const updateDir = join(TEST_DIR, 'update-test')
    mkdirSync(updateDir, { recursive: true })
    
    // Create mock git repos
    mkdirSync(join(updateDir, 'repo1', '.git'), { recursive: true })
    mkdirSync(join(updateDir, 'repo2', '.git'), { recursive: true })
    
    // Create non-git directory
    mkdirSync(join(updateDir, 'not-a-repo'))
    
    // Create a file
    writeFileSync(join(updateDir, 'file.txt'), 'test')

    const progressCalls = []
    const onProgress = (progress) => progressCalls.push(progress)

    try {
      await orgclone.updateOrg(updateDir, { onProgress })
    } catch (e) {
      // Expected to fail on git pull
    }

    // Should only try to update actual git repos (at least 1, might be 2)
    assert.ok(progressCalls.length >= 1)
    assert.ok(progressCalls.every(call => ['repo1', 'repo2'].includes(call.repo)))
  })

  test('should handle empty directory', async () => {
    const emptyDir = join(TEST_DIR, 'empty-dir')
    mkdirSync(emptyDir, { recursive: true })

    let callCount = 0
    await orgclone.updateOrg(emptyDir, { onProgress: () => callCount++ })

    assert.equal(callCount, 0)
  })
})



describe('exports', () => {
  test('should export all functions', () => {
    assert.ok(typeof orgclone.getOrgRepos === 'function')
    assert.ok(typeof orgclone.cloneRepo === 'function')
    assert.ok(typeof orgclone.updateRepo === 'function')
    assert.ok(typeof orgclone.cloneOrg === 'function')
    assert.ok(typeof orgclone.updateOrg === 'function')
  })
})

// library interface for orgclone

import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import { join } from 'path'

const execAsync = promisify(exec)

/**
 * Fetch all repositories from a GitHub organization
 * @param {string} org - The GitHub organization name
 * @param {string} [token] - Optional GitHub token for authentication
 * @returns {Promise<Array<{name: string, clone_url: string, ssh_url: string}>>}
 */
export async function getOrgRepos(org, token) {
  const repos = []
  let page = 1
  const perPage = 100

  while (true) {
    const headers = token
      ? { Authorization: `token ${token}` }
      : {}
    
    const url = `https://api.github.com/orgs/${org}/repos?per_page=${perPage}&page=${page}`
    
    const response = await fetch(url, { headers })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch repos: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json()
    
    if (data.length === 0) break
    
    repos.push(...data.map(repo => ({
      name: repo.name,
      clone_url: repo.clone_url,
      ssh_url: repo.ssh_url
    })))
    
    page++
  }

  return repos
}

/**
 * Clone a repository
 * @param {string} url - Git clone URL
 * @param {string} path - Destination path
 * @param {Object} options - Options
 * @param {string} [options.sshKey] - Path to SSH private key
 * @param {string} [options.token] - GitHub token for fallback auth
 * @param {boolean} [options.fallback=true] - Try HTTPS with token if SSH fails
 * @returns {Promise<string>} The method used ('ssh' or 'http')
 */
export async function cloneRepo(url, path, options = {}) {
  const { sshKey, token, fallback = true } = options
  let cmd = `git clone ${url} ${path}`
  
  if (sshKey) {
    cmd = `GIT_SSH_COMMAND="ssh -i ${sshKey}" ${cmd}`
  }
  
  try {
    await execAsync(cmd)
    return url.startsWith('git@') ? 'ssh' : 'http'
  } catch (error) {
    // If SSH fails and we have a token, try HTTPS with token auth
    if (fallback && token && url.startsWith('git@')) {
      const httpsUrl = url.replace('git@github.com:', 'https://github.com/')
      const tokenUrl = `https://${token}@github.com/${httpsUrl.replace('https://github.com/', '')}`
      await execAsync(`git clone ${tokenUrl} ${path}`)
      return 'http'
    } else {
      throw error
    }
  }
}

/**
 * Update a repository (git pull)
 * @param {string} path - Repository path
 * @returns {Promise<void>}
 */
export async function updateRepo(path) {
  await execAsync(`git -C ${path} pull`)
}

/**
 * Clone all repositories from a GitHub organization
 * @param {string} org - Organization name
 * @param {string} dest - Destination directory
 * @param {Object} options - Options
 * @param {string} [options.token] - GitHub token
 * @param {boolean} [options.ssh=true] - Use SSH URLs instead of HTTPS
 * @param {string} [options.sshKey] - Path to SSH private key
 * @param {Array<string>} [options.repos] - Specific repos to clone (clone all if not provided)
 * @param {boolean} [options.fallback=true] - Try HTTPS with token if SSH fails
 * @param {function} [options.onProgress] - Progress callback
 * @returns {Promise<void>}
 */
export async function cloneOrg(org, dest, options = {}) {
  const { token, ssh = true, sshKey, repos: repoFilter, fallback = true, onProgress } = options
  
  let repos = await getOrgRepos(org, token)
  
  // Filter repos if specific ones requested
  if (repoFilter && repoFilter.length > 0) {
    const repoSet = new Set(repoFilter)
    repos = repos.filter(repo => repoSet.has(repo.name))
    
    if (repos.length === 0) {
      throw new Error(`None of the specified repositories found in organization ${org}`)
    }
    if (repos.length < repoFilter.length) {
      const found = new Set(repos.map(r => r.name))
      const missing = repoFilter.filter(name => !found.has(name))
      console.warn(`Warning: Could not find repositories: ${missing.join(', ')}`)
    }
  }
  
  for (let i = 0; i < repos.length; i++) {
    const repo = repos[i]
    const repoPath = join(dest, repo.name)
    const url = ssh ? repo.ssh_url : repo.clone_url
    
    const method = await cloneRepo(url, repoPath, { sshKey, token, fallback })
    
    if (onProgress) {
      onProgress({ repo: repo.name, index: i + 1, total: repos.length, action: 'cloning', method })
    }
  }
}

/**
 * Update all repositories in a directory
 * @param {string} dest - Directory containing repositories
 * @param {Object} options - Options
 * @param {function} [options.onProgress] - Progress callback
 * @returns {Promise<void>}
 */
export async function updateOrg(dest, options = {}) {
  const { onProgress } = options
  const { readdirSync, statSync } = await import('fs')
  
  const entries = readdirSync(dest)
  const repos = entries.filter(entry => {
    const fullPath = join(dest, entry)
    return statSync(fullPath).isDirectory() && existsSync(join(fullPath, '.git'))
  })
  
  for (let i = 0; i < repos.length; i++) {
    const repo = repos[i]
    const repoPath = join(dest, repo)
    
    if (onProgress) {
      onProgress({ repo, index: i + 1, total: repos.length, action: 'updating' })
    }
    
    await updateRepo(repoPath)
  }
}

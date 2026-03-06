#!/usr/bin/env node

// CLI for orgclone

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { cloneOrg, updateOrg } from './index.js'
import { existsSync } from 'fs'
import { join } from 'path'

yargs(hideBin(process.argv))
  .command(
    ['clone <org> [dest]', '$0 <org> [dest]'],
    'Clone or update all repositories from a GitHub organization',
    (yargs) => {
      return yargs
        .positional('org', {
          describe: 'GitHub organization name',
          type: 'string'
        })
        .positional('dest', {
          describe: 'Destination directory (defaults to org name)',
          type: 'string'
        })
        .option('token', {
          alias: 't',
          describe: 'GitHub personal access token (or set GH_TOKEN/GITHUB_TOKEN)',
          type: 'string'
        })
        .option('http', {
          describe: 'Use HTTPS URLs instead of SSH',
          type: 'boolean',
          default: false
        })
        .option('repo', {
          alias: 'r',
          describe: 'Clone specific repo(s) only (can be used multiple times)',
          type: 'array'
        })
        .option('fallback', {
          describe: 'Try HTTPS with token if SSH fails (default: true)',
          type: 'boolean',
          default: true
        })
        .option('key', {
          alias: 'k',
          describe: 'Path to SSH private key (uses ssh-agent by default)',
          type: 'string'
        })
    },
    async (argv) => {
      try {
        const token = argv.token || process.env.GH_TOKEN || process.env.GITHUB_TOKEN
        const ssh = !argv.http
        const dest = argv.dest || argv.org
        
        if (argv.repo && argv.repo.length > 0) {
          console.log(`Syncing ${argv.repo.length} repo(s) from ${argv.org} to ${dest}...`)
        } else {
          console.log(`Syncing all repositories from ${argv.org} to ${dest}...`)
        }
        
        if (ssh) {
          console.log('Using SSH URLs')
          if (argv.key) {
            console.log(`Using SSH key: ${argv.key}`)
          }
        } else {
          console.log('Using HTTPS URLs')
        }
        
        // Get repos to process
        const { getOrgRepos } = await import('./index.js')
        let repos = await getOrgRepos(argv.org, token)
        
        // Filter repos if specific ones requested
        if (argv.repo && argv.repo.length > 0) {
          const repoSet = new Set(argv.repo)
          repos = repos.filter(repo => repoSet.has(repo.name))
        }
        
        console.log(`Found ${repos.length} repositories\n`)
        
        let cloned = 0
        let updated = 0
        let failed = 0
        
        for (let i = 0; i < repos.length; i++) {
          const repo = repos[i]
          const repoPath = join(dest, repo.name)
          const url = ssh ? repo.ssh_url : repo.clone_url
          
          if (existsSync(join(repoPath, '.git'))) {
            // Update existing repo
            try {
              const { updateRepo } = await import('./index.js')
              await updateRepo(repoPath)
              updated++
              console.log(`[${i + 1}/${repos.length}] updated ${repo.name}`)
            } catch (e) {
              failed++
              console.log(`[${i + 1}/${repos.length}] update failed for ${repo.name}: ${e.message}`)
            }
          } else {
            // Clone new repo
            try {
              const { cloneRepo } = await import('./index.js')
              const method = await cloneRepo(url, repoPath, { sshKey: argv.key, token, fallback: argv.fallback })
              cloned++
              console.log(`[${i + 1}/${repos.length}] cloned ${repo.name} (${method})`)
            } catch (e) {
              failed++
              console.log(`[${i + 1}/${repos.length}] clone failed for ${repo.name}: ${e.message}`)
            }
          }
        }
        
        console.log(`\nDone! Cloned: ${cloned}, Updated: ${updated}, Failed: ${failed}`)
      } catch (error) {
        console.error('Error:', error.message)
        process.exit(1)
      }
    }
  )
  .command(
    'list <org>',
    'List all repositories in a GitHub organization',
    (yargs) => {
      return yargs
        .positional('org', {
          describe: 'GitHub organization name',
          type: 'string'
        })
        .option('token', {
          alias: 't',
          describe: 'GitHub personal access token (or set GH_TOKEN/GITHUB_TOKEN)',
          type: 'string'
        })
    },
    async (argv) => {
      try {
        const token = argv.token || process.env.GH_TOKEN || process.env.GITHUB_TOKEN
        const { getOrgRepos } = await import('./index.js')
        
        console.log(`Fetching repositories from ${argv.org}...`)
        const repos = await getOrgRepos(argv.org, token)
        
        console.log(`\nFound ${repos.length} repositories:\n`)
        repos.forEach((repo, i) => {
          console.log(`${i + 1}. ${repo.name}`)
        })
      } catch (error) {
        console.error('Error:', error.message)
        process.exit(1)
      }
    }
  )
  .demandCommand(1, 'You must specify a command')
  .help()
  .alias('help', 'h')
  .version('1.0.0')
  .alias('version', 'v')
  .strict()
  .argv

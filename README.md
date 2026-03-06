# orgclone

Clone or update all repositories from a GitHub organization. Optimized for private repos with SSH by default. Single command handles both clone and update automatically.

If your default SSH key does not work, and you have not specified an SSH key, it will fallback to HTTP, which has the key in `.git/` (so it can be pulled later, without config.)

## Installation

```bash
npm install -g orgclone
```

Or use directly with npx:

```bash
npx -y orgclone <org>
```

## Quick Start

```bash
# Set your GitHub token (required for private repos)
export GH_TOKEN=ghp_xxxxxxxxxxxx

# Clone all repos (destination defaults to org name)
orgclone myorg

# Or specify destination
orgclone myorg ./myrepos
```

## Usage

```bash
orgclone <org> [dest]
```

**Options:**

- `-t, --token <token>` - GitHub personal access token (or set `GH_TOKEN`/`GITHUB_TOKEN` env var)
- `--http` - Use HTTPS URLs instead of SSH (default: SSH)
- `-k, --key <path>` - Path to SSH private key (uses ssh-agent by default)
- `-r, --repo <name>` - Clone specific repo(s) only (can be used multiple times)
- `--fallback` - Try HTTPS with token if SSH fails (default: true)

**Examples:**

```bash
# Clone all repos (defaults destination to org name)
export GH_TOKEN=ghp_xxxxxxxxxxxx
orgclone myorg

# Clone to specific directory
orgclone myorg ./myrepos

# Clone only specific repos
orgclone myorg --repo repo1 --repo repo2

# Use HTTPS instead of SSH
orgclone myorg --http

# Use a specific SSH key
orgclone myorg --key ~/.ssh/id_ed25519

# List repos
orgclone list myorg
```

The tool automatically detects whether to clone or update:

- If the repo doesn't exist locally → clones it
- If the repo already exists (has `.git`) → updates it (git pull)

## Library Usage

You can also use orgclone as a library in your Node.js projects:

```javascript
import { cloneOrg, updateOrg, getOrgRepos } from 'orgclone'

// Get list of repos
const repos = await getOrgRepos('facebook')
console.log(repos)

// Sync (clone or update) all repos
await cloneOrg('myorg', './myorg-repos', {
  ssh: true, // default: true (use false for HTTPS)
  token: 'ghp_xxxxxxxxxxxx', // optional if GH_TOKEN/GITHUB_TOKEN is set
  sshKey: '~/.ssh/id_ed25519', // optional, uses ssh-agent by default
  repos: ['repo1', 'repo2'], // optional, clone specific repos only
  fallback: true, // default: true
  onProgress: ({ repo, index, total, action, method }) => {
    console.log(`[${index}/${total}] ${action} ${repo} (${method})`)
  }
})

// Or use updateOrg directly for a directory
await updateOrg('./myorg-repos', {
  onProgress: ({ repo, index, total, action }) => {
    console.log(`[${index}/${total}] ${action} ${repo}`)
  }
})

// Update repositories
await updateOrg('./facebook-repos', {
  onProgress: ({ repo, index, total, action }) => {
    console.log(`[${index}/${total}] ${action} ${repo}`)
  }
})
```

## API

### `getOrgRepos(org, token?)`

Fetch all repositories from a GitHub organization.

- `org` (string) - Organization name
- `token` (string, optional) - GitHub personal access token
- Returns: `Promise<Array<{name, clone_url, ssh_url}>>`

### `cloneOrg(org, dest, options?)`

Clone or update all repositories from an organization. Automatically detects whether to clone or update each repo.

- `org` (string) - Organization name
- `dest` (string) - Destination directory
- `options` (object, optional)
  - `token` (string) - GitHub token
  - `ssh` (boolean) - Use SSH URLs (default: true)
  - `sshKey` (string) - Path to SSH private key
  - `repos` (Array<string>) - Clone specific repos only
  - `fallback` (boolean) - Try HTTPS if SSH fails (default: true)
  - `onProgress` (function) - Progress callback ({ repo, index, total, action, method })

### `updateOrg(dest, options?)`

Update all repositories in a directory (git pull).

- `dest` (string) - Directory containing repositories
- `options` (object, optional)
  - `onProgress` (function) - Progress callback

### `getOrgRepos(org, token?)`

Fetch all repositories from a GitHub organization.

- `org` (string) - Organization name
- `token` (string, optional) - GitHub personal access token
- Returns: `Promise<Array<{name, clone_url, ssh_url}>>`

## License

MIT

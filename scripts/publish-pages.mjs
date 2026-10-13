import { spawnSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const version = `v${JSON.parse(readFileSync(join(root, 'apps/desktop/package.json'))).version}`
const repo = 'rsm23/haired'
const branch = 'gh-pages'
function run(command, args, cwd = root, capture = false, input) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', input, stdio: capture || input ? 'pipe' : 'inherit', env: { ...process.env, VITE_RELEASE_VERSION: version } })
  if (result.error || result.status !== 0) {
    if (capture || input) process.stderr.write(result.stderr || result.stdout || '')
    throw new Error(`${command} failed (${result.status})`, { cause: result.error })
  }
  return result.stdout?.trim()
}
const release = JSON.parse(run('gh', ['release', 'view', version, '--repo', repo, '--json', 'isDraft,assets'], root, true))
if (release.isDraft) throw new Error('Publish the signed release before updating its download links.')
for (const name of [`Haired-${version.slice(1)}-mac-arm64.dmg`, `Haired-${version.slice(1)}-mac-x64.dmg`, 'SHA256SUMS.txt']) {
  if (!release.assets.some(asset => asset.name === name)) throw new Error(`Release asset missing: ${name}`)
}
const settings = JSON.parse(run('gh', ['api', `repos/${repo}/pages`], root, true))
run('pnpm', ['--filter', '@haired/contracts', 'build'])
run('pnpm', ['--filter', '@haired/web', 'build'])
const staging = mkdtempSync(join(tmpdir(), 'haired-pages-'))
try {
  run('git', ['init', '-b', branch], staging)
  run('git', ['remote', 'add', 'origin', `https://github.com/${repo}.git`], staging)
  const exists = run('git', ['ls-remote', '--heads', 'origin', branch], staging, true)
  if (exists) {
    run('git', ['fetch', '--depth=1', 'origin', branch], staging)
    run('git', ['reset', '--hard', 'FETCH_HEAD'], staging)
    for (const file of readdirSync(staging).filter(file => file !== '.git')) rmSync(join(staging, file), { recursive: true, force: true })
  }
  cpSync(join(root, 'apps/web/dist'), staging, { recursive: true })
  writeFileSync(join(staging, '.nojekyll'), '')
  if (settings.cname) writeFileSync(join(staging, 'CNAME'), `${settings.cname}\n`)
  writeFileSync(join(staging, 'release.json'), `${JSON.stringify({ version, sourceCommit: run('git', ['rev-parse', 'HEAD'], root, true) }, null, 2)}\n`)
  run('git', ['config', 'user.name', run('git', ['config', 'user.name'], root, true)], staging)
  run('git', ['config', 'user.email', run('git', ['config', 'user.email'], root, true)], staging)
  run('git', ['add', '--all'], staging)
  if (run('git', ['diff', '--cached', '--name-only'], staging, true)) run('git', ['commit', '-m', `Publish website for signed Haired ${version}`], staging)
  run('git', ['push', 'origin', `HEAD:refs/heads/${branch}`], staging)
  run('gh', ['api', '--method', 'PUT', `repos/${repo}/pages`, '--input', '-'], root, true, JSON.stringify({ build_type: 'legacy', source: { branch, path: '/' }, ...(settings.cname ? { cname: settings.cname } : {}) }))
  console.log(`Static website pushed. Check the final Pages deployment and ${settings.html_url}release.json before claiming the live site updated.`)
} finally {
  rmSync(staging, { recursive: true, force: true })
}

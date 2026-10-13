import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const desktopRequire = createRequire(join(root, 'apps/desktop/package.json'))
const builderRequire = createRequire(desktopRequire.resolve('electron-builder/package.json'))
const packagerRequire = createRequire(builderRequire.resolve('app-builder-lib/package.json'))
const { listPackage } = packagerRequire('@electron/asar')
const version = JSON.parse(readFileSync(join(root, 'apps/desktop/package.json'))).version
const output = join(root, 'artifacts', `release-${version}`)
const profile = process.env.APPLE_KEYCHAIN_PROFILE
const signingName = (process.env.CSC_NAME || 'Rahmani Seif El Moulouk (WQ983X3Y8P)').replace(/^Developer ID Application:\s*/, '')
const identity = `Developer ID Application: ${signingName}`
if (process.platform !== 'darwin' || !profile) {
  throw new Error('Run on macOS with APPLE_KEYCHAIN_PROFILE set to a notarytool credential profile.')
}
const env = {
  ...process.env,
  NODE_ENV: 'production',
  CSC_NAME: signingName,
  VITE_RELEASE_OWNER: 'rsm23',
  VITE_RELEASE_REPO: 'haired',
  VITE_PUBLIC_APP_URL: 'https://haired.seifelmoulouk.com/',
  VITE_SUPPORT_EMAIL: 'rahmani@seifelmoulouk.com'
}
function run(command, args, capture = false) {
  const result = spawnSync(command, args, { cwd: root, env, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit' })
  if (result.error || result.status !== 0) {
    if (capture) process.stderr.write(result.stderr || result.stdout || '')
    throw new Error(`${command} failed (${result.status})`, { cause: result.error })
  }
  return result.stdout?.trim()
}
function notarize(path) {
  const result = JSON.parse(run('xcrun', ['notarytool', 'submit', path, '--keychain-profile', profile, '--wait', '--output-format', 'json'], true))
  console.log(`Notarization ${result.id}: ${result.status}`)
  if (result.status !== 'Accepted') throw new Error(`Apple rejected ${path}; inspect submission ${result.id}.`)
  return result.id
}
function verifyApp(path) {
  run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', path])
  const signature = spawnSync('codesign', ['-dv', '--verbose=4', path], { encoding: 'utf8' })
  if (signature.status !== 0 || !signature.stderr.includes(`Authority=${identity}`) || !signature.stderr.includes('TeamIdentifier=WQ983X3Y8P') || !signature.stderr.includes('runtime')) {
    throw new Error('Incorrect application signing identity, team, or hardened runtime.')
  }
  run('xcrun', ['stapler', 'validate', path])
  run('spctl', ['--assess', '--type', 'execute', '--verbose=4', path])
  const resources = join(path, 'Contents/Resources')
  const archive = join(resources, 'app.asar')
  if (listPackage(archive).some(file => file.endsWith('.map'))) throw new Error('Production source map found in application archive.')
  if (/sk-proj-|sk-ant-|AIzaSy|whsec_/.test(readFileSync(archive).toString('utf8'))) throw new Error('Secret-like material found in application archive.')
  if (!readFileSync(join(root, 'apps/desktop/assets/icon.icns')).equals(readFileSync(join(resources, 'icon.icns')))) throw new Error('Packaged icon differs from source.')
  for (const file of readdirSync(join(root, 'apps/desktop/browser-extension'))) {
    const source = join(root, 'apps/desktop/browser-extension', file)
    if (statSync(source).isFile() && !readFileSync(source).equals(readFileSync(join(resources, 'browser-extension', file)))) throw new Error(`Extension resource differs: ${file}`)
  }
}
const sourceCommit = run('git', ['rev-parse', 'HEAD'], true)
if (run('git', ['status', '--porcelain'], true)) throw new Error('Commit source changes before building release packages.')
run('xcrun', ['notarytool', 'history', '--keychain-profile', profile, '--output-format', 'json'], true)
run('pnpm', ['check'])
mkdirSync(output, { recursive: true })
const verification = { version, sourceCommit, architectures: [], nativeMatrixRepeated: false }
const assets = []
for (const arch of ['arm64', 'x64']) {
  const archOutput = join(output, arch)
  run('pnpm', ['--filter', '@haired/desktop', 'exec', 'electron-builder', '--config', 'electron-builder.yml', '--mac', 'dmg', 'zip', `--${arch}`, '--publish', 'never', `--config.directories.output=${archOutput}`])
  const app = join(archOutput, arch === 'arm64' ? 'mac-arm64' : 'mac', 'Haired.app')
  verifyApp(app)
  const dmg = join(archOutput, `Haired-${version}-mac-${arch}.dmg`)
  run('codesign', ['--force', '--timestamp', '--sign', identity, dmg])
  const submissionId = notarize(dmg)
  run('xcrun', ['stapler', 'staple', dmg])
  run('xcrun', ['stapler', 'validate', dmg])
  run('codesign', ['--verify', '--verbose=2', dmg])
  run('spctl', ['--assess', '--type', 'open', '--context', 'context:primary-signature', '--verbose=4', dmg])
  const mount = mkdtempSync(join(tmpdir(), 'haired-dmg-'))
  let attached = false
  try {
    run('hdiutil', ['attach', '-nobrowse', '-readonly', '-mountpoint', mount, dmg])
    attached = true
    verifyApp(join(mount, 'Haired.app'))
  } finally {
    if (attached) run('hdiutil', ['detach', mount])
    rmSync(mount, { recursive: true, force: true })
  }
  for (const name of readdirSync(archOutput).filter(name => /\.(dmg|zip|zip\.blockmap)$/.test(name))) assets.push(join(archOutput, name))
  // The DMG blockmap emitted before stapling no longer describes the final file.
  verification.architectures.push({ arch, dmgSubmissionId: submissionId, appSignature: 'verified', appStaple: 'valid', dmgSignature: 'verified', dmgStaple: 'valid', gatekeeper: 'accepted', mountedApp: 'verified', extensionResources: 'verified' })
}
verification.verifiedAt = new Date().toISOString()
writeFileSync(join(output, 'release-verification.json'), `${JSON.stringify(verification, null, 2)}\n`)
assets.push(join(output, 'release-verification.json'))
const packages = assets.filter(path => /\.(zip|dmg)$/.test(path))
const digest = (path, algorithm, encoding) => createHash(algorithm).update(readFileSync(path)).digest(encoding)
const zip = packages.find(path => path.endsWith('-arm64.zip'))
const yaml = [`version: ${version}`, 'files:', ...packages.flatMap(path => [
  `  - url: ${path.split('/').at(-1)}`,
  `    sha512: ${digest(path, 'sha512', 'base64')}`,
  `    size: ${statSync(path).size}`
]), `path: ${zip.split('/').at(-1)}`, `sha512: ${digest(zip, 'sha512', 'base64')}`, `releaseDate: '${verification.verifiedAt}'`, ''].join('\n')
writeFileSync(join(output, 'latest-mac.yml'), yaml)
assets.push(join(output, 'latest-mac.yml'))
assets.sort()
writeFileSync(join(output, 'SHA256SUMS.txt'), `${assets.map(path => `${digest(path, 'sha256', 'hex')}  ${path.split('/').at(-1)}`).join('\n')}\n`)
console.log(`Verified release assets: ${output}`)

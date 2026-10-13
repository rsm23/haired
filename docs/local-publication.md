# Local signing and publication

The source repository and GitHub Release API do not require a GitHub Actions
runner. A locked billing account can stop Actions before any job starts,
including workflows in public repositories. Build and upload locally instead.

## Signed macOS release

Use a Mac with the Developer ID Application certificate in Keychain, Node.js
22.12 or newer, pnpm 11.10.0, Xcode command line tools, and an authenticated
`gh` CLI. Store notarization credentials with `xcrun notarytool
store-credentials`; keep certificates, passwords, and private keys out of Git.

Commit the version bump and source changes before running:

```sh
APPLE_KEYCHAIN_PROFILE=your-profile pnpm release:mac
```

The script checks the source is committed, runs `pnpm check` in production
mode, builds both architectures with the production configuration, notarizes
apps and DMGs, validates signatures and tickets, and inspects mounted DMGs.
Outputs are under `artifacts/release-VERSION/`. It also generates updater
metadata, a verification report, and SHA-256 checksums. It does not publish.

After reviewing the verification report and applicable native release gates,
create and push the matching version tag. Then create a draft release, upload
only the installers, ZIP archives, ZIP blockmaps, and generated metadata, and
publish it. For v0.1.4:

```sh
git tag -a v0.1.4 -m 'Haired v0.1.4'
git push origin main v0.1.4
gh release create v0.1.4 --repo rsm23/haired --verify-tag --draft \
  --title 'Haired v0.1.4 — Browser tab capture and signed macOS installers' \
  --notes-file docs/releases/v0.1.4.md
gh release upload v0.1.4 --repo rsm23/haired \
  artifacts/release-0.1.4/arm64/*.dmg \
  artifacts/release-0.1.4/arm64/*.zip \
  artifacts/release-0.1.4/arm64/*.zip.blockmap \
  artifacts/release-0.1.4/x64/*.dmg \
  artifacts/release-0.1.4/x64/*.zip \
  artifacts/release-0.1.4/x64/*.zip.blockmap \
  artifacts/release-0.1.4/latest-mac.yml \
  artifacts/release-0.1.4/release-verification.json \
  artifacts/release-0.1.4/SHA256SUMS.txt
gh release edit v0.1.4 --repo rsm23/haired --draft=false --latest
```

The pre-stapling DMG blockmaps and builder debug files are deliberately excluded.
Windows v0.1.4 is published as a separately labelled unsigned preview in the
same release. Its Windows checksum manifest is separate, and the public
aggregate checksum manifest also includes the Windows assets.

## Windows preview or signed build

Use Windows with Node.js 22.12 or newer and pnpm 11.10.0. Install the frozen
dependencies, then build an explicitly authorized unsigned preview with:

```powershell
pnpm install --frozen-lockfile
pnpm release:windows -UnsignedPreview
```

Without `-UnsignedPreview`, the script requires the configured Azure signing
endpoint, account, certificate profile, and publisher name, and validates
Authenticode signatures before succeeding. Azure authentication must also be
available to the signing provider. No signing failure silently falls back to
an unsigned build.

The Windows script runs `pnpm check`, builds NSIS locally, verifies the packaged
version and x64 application/SQLite binaries, checks signature status and bundled
extension files, and rejects source maps and secret-like material. Outputs are
under `artifacts/release-VERSION/windows/`: the installer, blockmap, updater
metadata, verification report, and Windows SHA-256 manifest.

Upload those files directly with `gh release upload`; review the installer and
update the release notes to state its actual signing status. Add the new asset
digests to the aggregate `SHA256SUMS.txt` without changing existing Mac binaries.
This path does not use a GitHub Actions runner. Use `pnpm publish:pages` only
after the public Mac and Windows assets exist.

## GitHub Pages

```sh
pnpm publish:pages
```

This command verifies the release's public download assets, builds the site
locally, and pushes only static output to `gh-pages`. It preserves the custom
domain and sets Pages to publish from that branch. `.nojekyll` skips Jekyll.
The obsolete custom Pages build workflow has been removed.

GitHub still performs the final Pages deployment even for a prebuilt branch.
On 2026-10-13, the managed branch deployment succeeded for v0.1.4 while the
account billing lock continued to block regular CI and CodeQL workflows.
Verify the deployment run and the live `release.json` version on every update
before reporting success.

## v0.1.4 publication evidence

- Release source and annotated tag: `7bb55042ceb72c2c05736973207390582cb8144c`.
- Public [signed release](https://github.com/rsm23/haired/releases/tag/v0.1.4):
  both DMGs, both ZIPs, ZIP blockmaps, updater metadata, verification report,
  and checksums. All nine uploaded assets matched local SHA-256 digests.
- [Verification report](https://github.com/rsm23/haired/releases/download/v0.1.4/release-verification.json):
  signatures, notarization tickets, Gatekeeper, mounted apps, bundled extension,
  ZIP verification, and automated checks. The full native matrix was not repeated.
- [Successful Pages deployment](https://github.com/rsm23/haired/actions/runs/38329143794)
  from `gh-pages` commit `a9b186ead0ff67c5ae845d239a482c981968fe6e`.
- [Live version marker](https://haired.seifelmoulouk.com/release.json): v0.1.4 and
  the release source commit. The rendered download links and both public Mac
  installer URLs were checked after deployment.

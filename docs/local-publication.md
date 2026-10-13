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
The Windows v0.1.2 preview remains linked separately.

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

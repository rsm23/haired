# Haired release gates

Production desktop releases remain drafts until all automated build jobs and the native verification matrix pass.

## macOS signing and notarization

Production macOS packages must use `apps/desktop/electron-builder.yml`. Preview
configuration is never acceptable for a public macOS release.

Before publication, verify both Apple Silicon and Intel packages:

- The app is signed by the Haired Developer ID Application identity with hardened runtime.
- `codesign --verify --deep --strict` succeeds for the app in the build directory and inside each DMG.
- Apple notarization returns `Accepted` for the app and each final DMG.
- `stapler validate` succeeds for the app and each DMG.
- Gatekeeper accepts the app and each DMG with the primary-signature context.
- The mounted DMG contains the committed icon and a valid signed, stapled app.

The release workflow expects `MACOS_CERTIFICATE_BASE64`,
`MACOS_CERTIFICATE_PASSWORD`, `APPLE_API_KEY_P8_BASE64`,
`APPLE_API_KEY_ID`, and `APPLE_API_ISSUER` as GitHub Actions secrets. Never
commit certificates, private keys, passwords, or notarization credentials.

## Windows capture matrix

Run on Windows 10 22H2 and the current supported Windows 11 release. Verify with a second participant and a recording, using both a full-display share and the applicable window/tab share:

- Microsoft Teams: selector, ask prompt, answer, Settings, and History.
- Zoom Workplace: selector, ask prompt, answer, Settings, and History.
- Google Meet in current Chrome and Edge: selector, ask prompt, answer, Settings, and History.

Any visible Haired surface in a supported Windows path blocks the release. Record app versions, Windows build, GPU, sharing mode, and result.

## macOS capture matrix

Repeat on every supported macOS major version and both Intel and Apple Silicon where applicable. Record actual behavior. The product must always say “Best effort on macOS” and must never show a green protected claim.

Verify screen-recording onboarding and denial, permission changes that require restart, multiple monitors, Retina scaling, negative monitor coordinates, rotated displays, full-screen apps, Spaces, sleep/wake, and display hot-plugging.

## Update and provider gates

- Upgrade a signed N-1 build through the public `haired` repository on each platform.
- Verify signature enforcement and preservation of settings and encrypted history.
- Run synthetic-image smoke tests through Codex and Claude CLI login paths and every
  supported BYOK protocol without customer content.
- Verify CLI executable detection, logged-out behavior, disabled-provider behavior,
  encrypted key save/replace/removal, and model switching.
- Confirm no restart occurs during capture, streaming, export, or a history write.

The in-app Privacy Check is diagnostic evidence only and does not replace this matrix.

# Unreleased changes

These changes are in the source tree and packages built from it. This document
does not announce a new installer release or a Chrome Web Store listing.

## Browser tab capture

- Added a Chrome/Edge companion extension, bundled with production and preview
  desktop packages and available in `apps/desktop/browser-extension`.
- Added pairing, connection status, **Open extension folder**, **Copy pairing
  code**, and **Select tab** in Settings → Shortcuts.
- Added **Select tab & answer**: `Cmd+Option+Shift+T` on macOS and
  `Ctrl+Alt+Shift+T` on Windows. Existing customized shortcuts are preserved.
- Capture the visible viewport of the current or another tab by clicking it
  after the shortcut. Selection has no visible prompt, expires after 30 seconds,
  and can be cancelled with Escape before returning focus to the browser.
- Reuse the selected provider, default instruction, answer mode, Interview Mode,
  protected overlay, and encrypted history from the existing answer workflow.
- Authenticate the loopback bridge with a pairing code and accept screenshots
  only for a live capture request. Reject unsupported pages and tab changes
  detected during capture.

See the [setup and troubleshooting guide](../browser-tab-capture.md). Window
capture protection remains platform-dependent, with best effort on macOS.

## CLI provider availability

- Find Codex and Claude executables in common macOS user installation folders
  when Haired launches from Finder. Explicit executable paths take precedence.
- Show **Selected** for an unavailable selected provider, reserving **In use**
  for a selected provider that is ready.

## Validation

Added automated tests for bridge authentication, single-use capture requests,
cancellation and replacement, malformed images, polling, expiry, macOS CLI
resolution, and settings migration. Native browser and installer verification
remain part of the [release gates](../release-gates.md).

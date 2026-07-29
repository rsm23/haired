# Haired

Haired is a free Windows and macOS screen assistant. Select a region, ask a
question, and receive a streamed answer in a capture-protected overlay using an
AI account or API key that you control.

Haired has no account, license key, paid plan, hosted AI proxy, or usage-credit
system.

## Providers

Haired supports two local CLI login paths and five BYOK paths:

| Provider | Connection | Authentication |
|---|---|---|
| OpenAI Codex | `codex app-server` | Existing `codex login` (including ChatGPT plans) |
| Claude Code | Non-interactive `claude` stream JSON | Existing `claude auth login` |
| OpenAI | Responses API | User-supplied API key |
| Anthropic | Messages API | User-supplied API key |
| Google Gemini | `streamGenerateContent` | User-supplied API key |
| Mistral AI | Chat Completions API with vision | User-supplied API key |
| OpenAI-compatible | Chat Completions API | User-supplied key, endpoint, and model |

Every provider has an explicit activation switch. The executable path, model,
and compatible endpoint remain editable. Only a ready, activated provider can
be selected.

CLI providers reuse their own login files. BYOK secrets are encrypted with
Electron `safeStorage` (macOS Keychain or Windows DPAPI) and are never returned
to the renderer. Requests go directly from the desktop process to the selected
provider; Haired does not receive them.

## Supported product

- Windows 10 22H2 and Windows 11 on x64.
- macOS 13 or newer on Intel and Apple Silicon.
- Linux is not a release target.
- No tray, menu-bar, Dock, or taskbar presence by default.

## Workspace

| Package | Responsibility |
|---|---|
| `apps/desktop` | Electron main/preload processes, provider adapters, React UI, protected selector and answers, native capture, encrypted SQLite history, and updates. |
| `apps/web` | Product, setup, support, privacy, and terms surfaces. |
| `packages/contracts` | Shared Zod IPC, settings, provider-status, history, and streaming contracts. |

There is intentionally no Haired API service or payment stack.

## Local development

Requirements: Node.js 22.12 or newer and pnpm 11.

```sh
pnpm install
pnpm dev
```

Useful commands:

```sh
pnpm check
pnpm dev
pnpm dev:web
HAIRED_LIVE_CODEX=1 pnpm --filter @haired/desktop test
```

For a CLI connection, install and authenticate the provider before opening
Haired:

```sh
codex login
claude auth login
```

BYOK credentials must be entered in **Haired → AI providers**. Do not add them
to `.env.local`.

## Capture privacy boundary

Every Haired window is protected before being shown. Windows 10 2004+ removes
protected top-level windows from supported OS capture paths. Current macOS
ScreenCaptureKit capture can ignore AppKit sharing protection, so macOS is
always shown as best effort and must be checked in the meeting share preview.

Capture exclusion is not DRM and does not guarantee protection against every
capture method. The release-blocking Teams, Zoom, and Google Meet verification
matrix is documented in [docs/release-gates.md](docs/release-gates.md).

## Local data security

- Screenshots are captured and cropped in memory and are not written to
  temporary files.
- Codex receives an inline data URL; Claude and BYOK providers receive inline
  base64 image content.
- Successful history fields and screenshots are encrypted individually with
  AES-256-GCM.
- The history key and BYOK secrets are protected by operating-system secure
  storage.
- Clearing history rotates the history key; deletion uses SQLite secure
  deletion and avoids forensic-erasure claims for SSDs.
- Screenshots, prompts, answers, provider keys, tokens, and decrypted history
  are excluded from application logs.

## Releases

`.github/workflows/release.yml` builds signed/notarized macOS DMG and ZIP
assets for x64 and arm64 and an Azure Trusted Signing Windows x64 NSIS
installer. It rejects source maps and secret-like material, verifies signatures,
produces an SPDX SBOM and checksums, and only then promotes a draft release in
the separate public `haired-releases` repository.

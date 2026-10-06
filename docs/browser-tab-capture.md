# Browser tab capture

Haired captures the visible viewport of a selected Chrome or Edge web tab. It does not capture the tab strip, address bar, or other windows. It uses the same AI provider, instruction, mode, history, and protected answer overlay as region capture.

## One-time setup

Use a desktop build containing browser tab capture. These changes are documented
in [unreleased changes](releases/unreleased.md); the previously published
v0.1.3 packages do not establish availability of this feature.

1. Install the updated Haired app and open **Settings → Shortcuts**.
2. Click **Open extension folder**.
3. Open `chrome://extensions` (or `edge://extensions`), enable Developer mode, and click **Load unpacked**. Select that folder.
4. In Haired, click **Copy pairing code**. Open the Haired extension’s options, paste the code, and click **Connect and enable tab capture**.
5. Review the browser permission prompt. The extension needs access to capture web tabs because the next tab you select can be on any website. It contains no content scripts and does not modify page contents.

The extension uses an authenticated connection to `127.0.0.1:43187`. The app stores its pairing secret encrypted with operating-system storage. Screenshots are accepted only during a selection you arm, expire after 30 seconds, and go through Haired’s normal answer/history flow. The extension keeps the pairing code in browser extension storage. Disconnecting in extension options removes the code and optional capture permission.

The companion uses Manifest V3 and requires Chrome 120 or newer, or a compatible
Edge version. It is installed manually as an unpacked extension. For a checkout,
load `apps/desktop/browser-extension`; packaged apps include the same folder as
an application resource. There is no separate extension build step.

### Permissions and data flow

| Permission | Purpose |
|---|---|
| `storage` | Keep the pairing code in local extension storage. |
| `alarms` | Retry the local app connection. |
| `tabs` | Identify the selected tab and check that it stays active during capture. |
| `http://127.0.0.1:43187/*` | Communicate with the Haired app on the same computer. |
| Optional `<all_urls>` | Allow viewport capture after pairing, including when you select a different website. |

The extension sends the PNG screenshot and tab title to the local app. Haired
passes the image into its existing provider and encrypted-history workflow;
using a remote provider sends the captured content to that provider. Treat the
pairing code as a credential and do not include it in screenshots or bug reports.

## Capture

Press **Cmd+Option+Shift+T** on macOS (**Ctrl+Alt+Shift+T** on Windows), then click your current browser tab or another tab within 30 seconds. Haired renders no selection prompt. A transparent, shadowless focus window lets the extension detect your click back into the browser even for an already selected tab. You can customize the shortcut in Settings.

Press Escape before clicking the browser to cancel. Selection expires silently after 30 seconds. Pressing the shortcut again replaces the pending selection. Starting region capture also cancels pending tab capture. Unsupported browser-internal pages and captures that change tabs mid-screenshot are rejected.

You can also click **Select tab** in Haired’s Shortcuts settings. While a
selection is pending, the extension badge displays `TAB`; clicking the extension
toolbar button captures the active tab. Without a pending selection, the toolbar
button opens the extension options. A `!` badge indicates a failed capture.

## Troubleshooting

- **Extension not connected:** keep Haired running, enable the extension, and
  copy a fresh pairing code from Settings → Shortcuts into its options. Allow
  time for the extension to reconnect and for Settings to refresh its status.
- **Permission denied:** open the extension options and choose **Connect and
  enable tab capture** again, then accept the capture permission prompt.
- **No answer after selection:** use a regular `http://` or `https://` web page,
  click the tab within 30 seconds, and keep it active until capture finishes.
  Browser settings pages, extension pages, and local files are unsupported.
- **Shortcut unavailable:** change the binding in Haired’s Shortcuts settings
  if another app or the operating system has reserved it. Existing custom region
  shortcuts are preserved when the new tab shortcut is added.
- **Local bridge error:** check the error in Settings → Shortcuts. The bridge
  requires loopback port `43187` to be available; close a duplicate Haired
  instance or resolve a port conflict, then restart Haired.
- **Disconnect:** choose **Disconnect** in the extension options to remove the
  saved pairing code and optional capture permission. Remove the unpacked
  extension from the browser’s Extensions page if you no longer need it.

## Visibility and verification

Haired’s answer window requests the same OS capture protection as existing region capture. Arming selection briefly moves focus away from the browser without rendering a prompt. This does not suppress browser focus events or promise invisibility. macOS protection remains best effort, and the extension badge/ordinary browser UI can appear in recordings. Verify the exact recording or sharing path separately.

The app and bridge are tested automatically with synthetic images. A browser installation and an actual tab-selection capture are separate runtime checks; passing bridge tests alone does not verify the installed extension.

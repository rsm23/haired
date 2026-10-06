# Haired Tab Capture extension

Manifest V3 companion for Chrome 120+ and compatible Edge versions. It captures
the visible viewport of a web tab selected after Haired arms a capture request.
Haired must be running on the same computer.

1. Open `chrome://extensions` or `edge://extensions` and enable **Developer mode**.
2. Choose **Load unpacked** and select this folder. In a packaged app, use
   Haired → Settings → Shortcuts → **Open extension folder** to find it.
3. In Haired, choose **Copy pairing code**, then paste it into the extension
   options and choose **Connect and enable tab capture**. Accept the permission
   prompt.
4. Press `Cmd+Option+Shift+T` on macOS or `Ctrl+Alt+Shift+T` on Windows, then
   click your current tab or another tab within 30 seconds.

There is no build step. Both production and preview desktop packages include
this folder through Electron Builder’s `extraResources` configuration.

See the [full capture guide](../../../docs/browser-tab-capture.md) for
permissions, data flow, cancellation, troubleshooting, and recording limitations.
Choose **Disconnect** in extension options to remove the saved pairing code and
optional capture permission.

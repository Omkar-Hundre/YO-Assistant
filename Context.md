Context: Windows Floating Overlay Utility

Goal

Build a Windows desktop floating utility that remains visible above normal applications, including a maximized or fullscreen Chrome window, while providing a legitimate private overlay UI such as notes, developer information, a timer, or an accessibility panel.

The application must use native Windows window-management APIs where required rather than relying only on Electron/CSS behavior.

Core Requirements

1. Always-on-top window

The floating window must:

Remain above normal application windows.

Remain visible when Chrome is maximized.

Remain visible when Chrome enters F11 fullscreen where Windows permits topmost windows.

Be independent of Chrome.

Support dragging.

Support resizing or configurable fixed sizes.

Be frameless.

Have a clean modern UI.

Support show/hide through a global keyboard shortcut.

Remember its last position and size during the application session.

Use a native topmost window configuration.

Windows concept:

HWND_TOPMOST

WS_EX_TOPMOST

SetWindowPos(..., HWND_TOPMOST, ...)

Do not use browser fullscreen APIs to achieve this.

2. Screen-capture exclusion

For legitimate privacy use, configure the overlay with Windows Display Affinity:

SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)

Requirements:

Apply the setting to the actual top-level overlay HWND.

Verify that the API call succeeds.

Handle unsupported Windows versions gracefully.

Provide a visible application status such as:
Capture exclusion: Active
or
Capture exclusion: Unsupported

Important:

WDA_EXCLUDEFROMCAPTURE is not a guaranteed security or DRM mechanism. It applies to supported Windows capture mechanisms and must not be presented as universal invisibility.

Do not attempt to bypass, interfere with, or evade third-party proctoring, monitoring, anti-cheat, security, or surveillance systems.

3. Window behavior

The overlay should support:

Always-on-top toggle.

Capture-exclusion status.

Global hotkey to show/hide.

Optional click-through mode.

Normal interactive mode.

Close/minimize controls.

Position persistence.

Multi-monitor awareness.

DPI-aware sizing.

Correct behavior when monitors are added/removed.

When click-through is enabled, the overlay should not intercept mouse input. When disabled, it should behave normally.

4. Suggested technology

Preferred stack:

Electron

TypeScript

HTML/CSS

Node.js

Native Windows integration where necessary

Architecture:

Electron Main Process
|
+-- Window Manager
|     +-- Create overlay
|     +-- Always-on-top
|     +-- Position/size
|     +-- Global shortcuts
|
+-- Windows Native Layer
|     +-- HWND retrieval
|     +-- SetWindowDisplayAffinity
|     +-- Native window flags
|
+-- Renderer
+-- Overlay UI
+-- Controls
+-- Status indicators

Keep native functionality isolated behind a small interface so the rest of the application does not depend directly on Windows API calls.

5. Native bridge

Create a small native module or native helper responsible for:

Getting the Electron BrowserWindow HWND.

Setting WDA_EXCLUDEFROMCAPTURE.

Reading/reporting success or failure.

Setting native window flags if Electron's API is insufficient.

Expose a simple TypeScript interface such as:

interface WindowsOverlay {
  setCaptureExclusion(hwnd: Buffer | bigint | number): {
    success: boolean;
    error?: string;
  };

  setAlwaysOnTop(hwnd: Buffer | bigint | number, enabled: boolean): {
    success: boolean;
    error?: string;
  };
}

The exact HWND representation may differ depending on the Electron version and native binding. Implement it according to the selected Electron/native integration method.

6. Electron window configuration

The BrowserWindow should be configured roughly around:

new BrowserWindow({
  width: 420,
  height: 260,
  frame: false,
  transparent: true,
  alwaysOnTop: true,
  resizable: true,
  movable: true,
  skipTaskbar: false,
  show: false,
  webPreferences: {
    contextIsolation: true,
    nodeIntegration: false,
    preload: path.join(__dirname, "preload.js")
  }
});

Do not blindly copy these values. Adjust them according to the final UI and security requirements.

Use:

win.setAlwaysOnTop(true, "floating");

or the appropriate Electron API, but verify the resulting native HWND behavior on Windows.

7. Security

Electron security must be enabled.

Use:

contextIsolation: true

nodeIntegration: false

Preload bridge with contextBridge

Strict IPC allow-listing

No arbitrary renderer-to-main execution

No remote code execution

No unnecessary permissions

The renderer must never receive unrestricted Node.js access.

8. UI

Create a compact floating panel with:

Header/title

Drag area

Always-on-top indicator

Capture-exclusion indicator

Main content area

Settings button

Close button

Optional opacity control

Optional click-through toggle

The UI should look like a polished desktop utility, not a generic HTML demo.

Recommended visual direction:

Dark/light theme aware

Small rounded window

Subtle border

Minimal shadow

Clear typography

Compact controls

No excessive glassmorphism

No unnecessary animations

9. Keyboard shortcuts

At minimum:

Ctrl + Shift + Space
    Toggle overlay visibility

Optional:

Ctrl + Shift + T
    Toggle always-on-top

Ctrl + Shift + C
    Toggle click-through

Use Electron's globalShortcut API.

Avoid conflicts with common Windows/Chrome shortcuts.

10. Testing requirements

Test the following:

Launch application.

Overlay appears.

Chrome is maximized.

Overlay remains above Chrome.

Chrome enters F11 fullscreen.

Overlay behavior is verified.

Toggle always-on-top.

Toggle click-through.

Toggle overlay using global shortcut.

Move overlay to another monitor.

Change monitor DPI/scaling if possible.

Close and reopen application.

Verify window position behavior.

Test Windows screenshot/capture mechanisms that support display affinity.

Verify capture exclusion status/error handling.

Do not claim capture exclusion works universally. Document tested capture paths.

11. Project structure

Suggested structure:

floating-overlay/
│
├── src/
│   ├── main/
│   │   ├── main.ts
│   │   ├── windowManager.ts
│   │   ├── shortcuts.ts
│   │   └── windowsOverlay.ts
│   │
│   ├── preload/
│   │   └── preload.ts
│   │
│   └── renderer/
│       ├── index.html
│       ├── styles.css
│       └── renderer.ts
│
├── native/
│   └── windows/
│       ├── overlay.cpp
│       └── overlay.h
│
├── package.json
├── tsconfig.json
├── electron-builder.yml
└── README.md

The exact native integration can be changed if a better maintained Electron-compatible solution is selected.

12. Development phases

Phase 1

Create a minimal Electron floating window.

Phase 2

Implement always-on-top behavior.

Phase 3

Implement global shortcuts.

Phase 4

Implement Windows display-affinity capture exclusion.

Phase 5

Build the polished overlay UI.

Phase 6

Add click-through and settings.

Phase 7

Test fullscreen, multi-monitor, DPI, and capture behavior.

Phase 8

Package into a Windows installer.

13. Important constraints

Windows-first application.

Do not depend on Chrome extensions for the overlay itself.

Do not use browser fullscreen APIs.

Do not use hacks that manipulate Chrome internals.

Do not attempt to bypass security, proctoring, monitoring, anti-cheat, or access-control systems.

Treat capture exclusion as a Windows privacy feature, not an invisibility mechanism.

Keep the native Windows layer minimal and auditable.

Prefer TypeScript for application code.

Keep the implementation production-oriented rather than a throwaway proof of concept.

Expected first milestone

The first working prototype should have:

A small frameless floating Electron window.

Always-on-top behavior.

Global show/hide hotkey.

A clean test UI.

Windows WDA_EXCLUDEFROMCAPTURE integration.

A status indicator showing whether capture exclusion was successfully enabled.

Only after this milestone works should additional UI and functionality be added.
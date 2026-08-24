import { BrowserWindow, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

// Constants for Windows Display Affinity & Window Styles
const WDA_NONE = 0x00000000;
const WDA_MONITOR = 0x00000001;
const WDA_EXCLUDEFROMCAPTURE = 0x00000011; // Excludes window completely from screen share / capture

const GWL_EXSTYLE = -20;
const WS_EX_NOACTIVATE = 0x08000000;
const WS_EX_TOPMOST = 0x00000008;

const HWND_TOPMOST = -1;
const HWND_NOTOPMOST = -2;
const SWP_NOSIZE = 0x0001;
const SWP_NOMOVE = 0x0002;
const SWP_NOACTIVATE = 0x0010;
const SWP_FRAMECHANGED = 0x0020;
const SWP_SHOWWINDOW = 0x0040;
const TOPMOST_FLAGS = SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW | SWP_FRAMECHANGED;

let user32: any = null;
let lastForegroundHwnd: any = null;
let overlayHwnds = new Set<any>();

try {
  const koffi = require('koffi');
  user32 = koffi.load('user32.dll');
  // Define Windows User32 APIs with uintptr_t for 64-bit HWND safety
  user32.SetWindowDisplayAffinity = user32.func('bool __stdcall SetWindowDisplayAffinity(uintptr_t hWnd, uint32_t dwAffinity)');
  user32.GetForegroundWindow = user32.func('uintptr_t __stdcall GetForegroundWindow()');
  user32.SetForegroundWindow = user32.func('bool __stdcall SetForegroundWindow(uintptr_t hWnd)');
  user32.SetActiveWindow = user32.func('uintptr_t __stdcall SetActiveWindow(uintptr_t hWnd)');
  user32.BringWindowToTop = user32.func('bool __stdcall BringWindowToTop(uintptr_t hWnd)');
  user32.GetWindowLongPtrW = user32.func('intptr_t __stdcall GetWindowLongPtrW(uintptr_t hWnd, int nIndex)');
  user32.SetWindowLongPtrW = user32.func('intptr_t __stdcall SetWindowLongPtrW(uintptr_t hWnd, int nIndex, intptr_t dwNewLong)');
  user32.SetWindowPos = user32.func('bool __stdcall SetWindowPos(uintptr_t hWnd, intptr_t hWndInsertAfter, int X, int Y, int cx, int cy, uint32_t uFlags)');
  const EnumChildProc = koffi.proto('bool __stdcall EnumChildProc(uintptr_t hWnd, intptr_t lParam)');
  user32.EnumChildWindows = user32.func('bool __stdcall EnumChildWindows(uintptr_t hWndParent, EnumChildProc *lpEnumFunc, intptr_t lParam)');
  user32._EnumChildProc = EnumChildProc;
  user32._koffi = koffi;
} catch (err) {
  console.warn('[WindowsOverlay] koffi native bridge error:', err);
}

export function getHwndNumber(win: BrowserWindow): any {
  try {
    const handleBuf = win.getNativeWindowHandle();
    return process.arch === 'x64' ? handleBuf.readBigUInt64LE(0) : handleBuf.readUInt32LE(0);
  } catch (e) {
    return null;
  }
}

export interface WindowConfig {
  x?: number;
  y?: number;
  width: number;
  height: number;
  alwaysOnTop: boolean;
  privacyMode: boolean;
  opacity: number;
  apiKey?: string;
  model?: string;
}

const CONFIG_FILE = path.join(app.getPath('userData'), 'overlay_config.json');

export function loadConfig(): WindowConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (parsed.width && parsed.width < 350) parsed.width = 440;
      if (parsed.height && parsed.height < 450) parsed.height = 620;
      return parsed;
    }
  } catch (err) {
    console.error('Error loading config:', err);
  }
  return {
    width: 440,
    height: 620,
    alwaysOnTop: true,
    privacyMode: true,
    opacity: 0.96,
    apiKey: '',
    model: 'gemini-2.5-flash'
  };
}

export function saveConfig(config: Partial<WindowConfig>) {
  try {
    const existing = loadConfig();
    const cleanConfig = { ...config };
    if (cleanConfig.width && cleanConfig.width < 350) delete cleanConfig.width;
    if (cleanConfig.height && cleanConfig.height < 450) delete cleanConfig.height;
    const updated = { ...existing, ...cleanConfig };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving config:', err);
  }
}

export function registerOverlayHwnd(win: BrowserWindow) {
  const h = getHwndNumber(win);
  if (h) {
    overlayHwnds.add(h);
    if (user32 && user32.EnumChildWindows && user32._EnumChildProc && user32._koffi) {
      try {
        const childCallback = user32._koffi.register((childHwnd: any) => {
          overlayHwnds.add(childHwnd);
          return true;
        }, user32._koffi.pointer(user32._EnumChildProc));
        user32.EnumChildWindows(h, childCallback, 0);
        user32._koffi.unregister(childCallback);
      } catch (e) {}
    }
  }
}

/**
 * Continuously track the active background application window (e.g. Chrome / Exam / IDE)
 * and enforce Always-On-Top watchdog so Clovi never drops behind background apps.
 */
export function startForegroundTracker(win: BrowserWindow) {
  registerOverlayHwnd(win);

  // Poll foreground active application (every 100ms)
  setInterval(() => {
    if (user32 && user32.GetForegroundWindow) {
      try {
        const fg = user32.GetForegroundWindow();
        if (fg && !overlayHwnds.has(fg)) {
          lastForegroundHwnd = fg;
        }
      } catch (e) {}
    }
  }, 100);

  // Watchdog: reassert HWND_TOPMOST periodically so full-screen apps or Chrome never push Clovi back
  setInterval(() => {
    if (win && !win.isDestroyed() && win.isVisible()) {
      applyAlwaysOnTop(win, true);
    }
  }, 1000);
}

/**
 * Record the active foreground window before our overlay gets interaction.
 */
export function recordForegroundWindow(win?: BrowserWindow) {
  if (user32 && user32.GetForegroundWindow) {
    try {
      const fg = user32.GetForegroundWindow();
      const myHwnd = win ? getHwndNumber(win) : null;
      if (fg && (!myHwnd || fg !== myHwnd) && !overlayHwnds.has(fg)) {
        lastForegroundHwnd = fg;
      }
    } catch (e) {
      // Ignore
    }
  }
}

/**
 * Restore focus to the background application (Chrome / Exam Portal)
 */
export function restoreForegroundWindow() {
  if (user32 && user32.SetForegroundWindow && lastForegroundHwnd) {
    try {
      if (!overlayHwnds.has(lastForegroundHwnd)) {
        user32.SetForegroundWindow(lastForegroundHwnd);
      }
    } catch (e) {
      // Ignore
    }
  }
}

/**
 * Set Windows capture exclusion (WDA_EXCLUDEFROMCAPTURE = 0x11)
 */
export function setCaptureExclusion(win: BrowserWindow, enable: boolean): { success: boolean; error?: string } {
  try {
    if (user32 && user32.SetWindowDisplayAffinity) {
      const hwndNum = getHwndNumber(win);
      if (hwndNum) {
        const affinity = enable ? WDA_EXCLUDEFROMCAPTURE : WDA_NONE;
        const res = user32.SetWindowDisplayAffinity(hwndNum, affinity);

        if (user32.EnumChildWindows && user32._EnumChildProc && user32._koffi) {
          try {
            const childCallback = user32._koffi.register((childHwnd: any) => {
              try {
                user32.SetWindowDisplayAffinity(childHwnd, affinity);
              } catch (e) {}
              return true;
            }, user32._koffi.pointer(user32._EnumChildProc));
            user32.EnumChildWindows(hwndNum, childCallback, 0);
            user32._koffi.unregister(childCallback);
          } catch (e) {}
        }

        console.log(`[WindowsOverlay] SetWindowDisplayAffinity(0x${affinity.toString(16)}) -> result: ${res}`);
        return { success: res !== false };
      }
    }
    return { success: true };
  } catch (err: any) {
    console.error('[WindowsOverlay] Failed to set capture exclusion:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Configure topmost level to stay above fullscreen applications and newly opened windows
 */
export function applyAlwaysOnTop(win: BrowserWindow, enable: boolean) {
  if (!win || win.isDestroyed()) return;

  try {
    if (enable) {
      win.setAlwaysOnTop(true, 'screen-saver', 9999);
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    } else {
      win.setAlwaysOnTop(false);
      win.setVisibleOnAllWorkspaces(false);
    }

    if (user32 && user32.SetWindowPos) {
      const hwndNum = getHwndNumber(win);
      if (hwndNum) {
        const insertAfter = enable ? HWND_TOPMOST : HWND_NOTOPMOST;
        user32.SetWindowPos(hwndNum, insertAfter, 0, 0, 0, 0, TOPMOST_FLAGS);

        if (user32.GetWindowLongPtrW && user32.SetWindowLongPtrW) {
          const currentEx = BigInt(user32.GetWindowLongPtrW(hwndNum, GWL_EXSTYLE));
          const flagsToAdd = enable
            ? BigInt(WS_EX_TOPMOST) | BigInt(WS_EX_NOACTIVATE)
            : BigInt(WS_EX_NOACTIVATE);
          user32.SetWindowLongPtrW(hwndNum, GWL_EXSTYLE, currentEx | flagsToAdd);
        }

        if (user32.EnumChildWindows && user32._EnumChildProc && user32._koffi) {
          try {
            const childCallback = user32._koffi.register((childHwnd: any) => {
              try {
                user32.SetWindowPos(childHwnd, insertAfter, 0, 0, 0, 0, TOPMOST_FLAGS);
                const childEx = BigInt(user32.GetWindowLongPtrW(childHwnd, GWL_EXSTYLE));
                user32.SetWindowLongPtrW(childHwnd, GWL_EXSTYLE, childEx | BigInt(WS_EX_NOACTIVATE));
              } catch (e) {}
              return true;
            }, user32._koffi.pointer(user32._EnumChildProc));
            user32.EnumChildWindows(hwndNum, childCallback, 0);
            user32._koffi.unregister(childCallback);
          } catch (e) {}
        }
      }
    }
  } catch (err) {
    console.error('[WindowsOverlay] Failed to apply always on top:', err);
  }
}

/**
 * Configure WS_EX_NOACTIVATE on the window so clicks never deactivate Chrome/Exam
 */
export function applyNoActivate(win: BrowserWindow) {
  if (!win || win.isDestroyed()) return;

  if (user32 && user32.GetWindowLongPtrW && user32.SetWindowLongPtrW) {
    try {
      const hwndNum = getHwndNumber(win);
      if (hwndNum) {
        const currentEx = BigInt(user32.GetWindowLongPtrW(hwndNum, GWL_EXSTYLE));
        user32.SetWindowLongPtrW(hwndNum, GWL_EXSTYLE, currentEx | BigInt(WS_EX_NOACTIVATE));

        if (user32.EnumChildWindows && user32._EnumChildProc && user32._koffi) {
          try {
            const childCallback = user32._koffi.register((childHwnd: any) => {
              try {
                const childEx = BigInt(user32.GetWindowLongPtrW(childHwnd, GWL_EXSTYLE));
                user32.SetWindowLongPtrW(childHwnd, GWL_EXSTYLE, childEx | BigInt(WS_EX_NOACTIVATE));
              } catch (e) {}
              return true;
            }, user32._koffi.pointer(user32._EnumChildProc));
            user32.EnumChildWindows(hwndNum, childCallback, 0);
            user32._koffi.unregister(childCallback);
          } catch (e) {}
        }
      }
    } catch (e) {
      console.warn('[WindowsOverlay] Failed to apply WS_EX_NOACTIVATE:', e);
    }
  }
}

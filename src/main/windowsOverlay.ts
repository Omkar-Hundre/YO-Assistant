import { BrowserWindow, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

// Constants for Windows Display Affinity & Window Styles
const WDA_NONE = 0x00000000;
const WDA_MONITOR = 0x00000001;
const WDA_EXCLUDEFROMCAPTURE = 0x00000011; // 17: Excludes window completely from screen share / capture

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
const TOPMOST_FLAGS = SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW | SWP_FRAMECHANGED; // 0x0073

let user32: any = null;
let lastForegroundHwnd: any = null;

try {
  const koffi = require('koffi');
  user32 = koffi.load('user32.dll');
  // Define Windows User32 APIs with uintptr_t for 64-bit HWND safety
  user32.SetWindowDisplayAffinity = user32.func('bool __stdcall SetWindowDisplayAffinity(uintptr_t hWnd, uint32_t dwAffinity)');
  user32.GetForegroundWindow = user32.func('uintptr_t __stdcall GetForegroundWindow()');
  user32.SetForegroundWindow = user32.func('bool __stdcall SetForegroundWindow(uintptr_t hWnd)');
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

let overlayHwnds = new Set<any>();

export function registerOverlayHwnd(win: BrowserWindow) {
  const h = getHwndNumber(win);
  if (h) overlayHwnds.add(h);
}

/**
 * Continuously track the active background application window (e.g. Chrome / Exam / IDE)
 */
export function startForegroundTracker(win: BrowserWindow) {
  registerOverlayHwnd(win);
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
 * Restore focus to the previous active application window (e.g. Chrome / Exam)
 */
export function restoreForegroundWindow() {
  if (user32 && user32.SetForegroundWindow && lastForegroundHwnd) {
    try {
      user32.SetForegroundWindow(lastForegroundHwnd);
    } catch (e) {
      // Ignore
    }
  }
}

/**
 * Set Windows capture exclusion (WDA_EXCLUDEFROMCAPTURE = 0x11)
 * Completely excludes the window from all Windows screen sharing (Teams, Zoom, Meet, OBS, Browser Share)
 */
export function setCaptureExclusion(win: BrowserWindow, enable: boolean): { success: boolean; error?: string } {
  try {
    // Pure Win32 SetWindowDisplayAffinity (WDA_EXCLUDEFROMCAPTURE = 0x11)
    // Note: We avoid win.setContentProtection(true) because Chromium's built-in implementation
    // forces WDA_MONITOR (0x01), which causes Windows DWM to paint a solid black box on screen shares.
    if (user32 && user32.SetWindowDisplayAffinity) {
      const hwndNum = getHwndNumber(win);
      if (hwndNum) {
        const affinity = enable ? WDA_EXCLUDEFROMCAPTURE : WDA_NONE;
        const res = user32.SetWindowDisplayAffinity(hwndNum, affinity);

        // Also apply display affinity to child rendering HWNDs for total screen share invisibility
        if (user32.EnumChildWindows && user32._EnumChildProc && user32._koffi) {
          try {
            const childCallback = user32._koffi.register((childHwnd: any, _lParam: any) => {
              try {
                user32.SetWindowDisplayAffinity(childHwnd, affinity);
              } catch (e) { }
              return true;
            }, user32._koffi.pointer(user32._EnumChildProc));
            user32.EnumChildWindows(hwndNum, childCallback, 0);
            user32._koffi.unregister(childCallback);
          } catch (e) { }
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
      win.setAlwaysOnTop(true, 'screen-saver', 1);
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    } else {
      win.setAlwaysOnTop(false);
      win.setVisibleOnAllWorkspaces(false);
    }

    // Direct Win32 SetWindowPos enforcement
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
      }
    }
  } catch (err) {
    console.error('[WindowsOverlay] Failed to apply always on top:', err);
  }
}

/**
 * Configure WS_EX_NOACTIVATE on the top-level window so clicks never deactivate Chrome/Exam
 */
export function applyNoActivate(win: BrowserWindow) {
  if (!win || win.isDestroyed()) return;

  if (user32 && user32.GetWindowLongPtrW && user32.SetWindowLongPtrW) {
    try {
      const hwndNum = getHwndNumber(win);
      if (hwndNum) {
        const currentEx = BigInt(user32.GetWindowLongPtrW(hwndNum, GWL_EXSTYLE));
        user32.SetWindowLongPtrW(hwndNum, GWL_EXSTYLE, currentEx | BigInt(WS_EX_NOACTIVATE));
      }
    } catch (e) {
      console.warn('[WindowsOverlay] Failed to apply WS_EX_NOACTIVATE:', e);
    }
  }
}

import { app, BrowserWindow, ipcMain, globalShortcut, screen, Tray, Menu, nativeImage } from 'electron';
import * as path from 'path';
import {
  loadConfig,
  saveConfig,
  setCaptureExclusion,
  applyAlwaysOnTop,
  applyNoActivate,
  recordForegroundWindow,
  restoreForegroundWindow,
  startForegroundTracker
} from './windowsOverlay';
import { captureScreen } from './screenCapture';
import { GeminiService } from './geminiService';

const STEALTH_BASE_WIDTH = 210;
const STEALTH_BASE_HEIGHT = 48;
let lastNormalBounds = { width: 440, height: 620, x: 0, y: 0 };

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let geminiService: GeminiService | null = null;
let currentConfig = loadConfig();

function createWindow() {
  const config = currentConfig;
  const primaryDisplay = screen.getPrimaryDisplay();
  const workArea = primaryDisplay.workArea;

  const normalWidth = (config.width && config.width >= 350) ? config.width : 440;
  const normalHeight = (config.height && config.height >= 450) ? config.height : 620;
  const normalX = config.x ?? Math.max(0, workArea.width - normalWidth - 20);
  const normalY = config.y ?? 40;

  lastNormalBounds = {
    width: normalWidth,
    height: normalHeight,
    x: normalX,
    y: normalY
  };

  // Launch directly in compact Stealth Mode dock size (210 x 48)
  const initialX = Math.round(normalX + normalWidth - STEALTH_BASE_WIDTH);
  const initialY = Math.round(normalY);

  mainWindow = new BrowserWindow({
    width: STEALTH_BASE_WIDTH,
    height: STEALTH_BASE_HEIGHT,
    x: Math.max(0, initialX),
    y: Math.max(0, initialY),
    minWidth: 50,
    minHeight: 40,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: config.alwaysOnTop,
    skipTaskbar: true, // NEVER show in taskbar
    focusable: true,   // Allows full clicking, typing in input boxes and window dragging
    hasShadow: false,  // Disables Windows OS DWM native shadow rectangle/drag outline on screen shares
    thickFrame: false, // Disables OS resizing border frame
    resizable: true,
    movable: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  // Load index.html
  mainWindow.loadFile(path.join(__dirname, '../../src/renderer/index.html'));

  // Configure always on top
  applyAlwaysOnTop(mainWindow, config.alwaysOnTop);

  // Configure initial opacity
  mainWindow.setOpacity(0.95);

  // Set Windows capture exclusion
  if (config.privacyMode) {
    setCaptureExclusion(mainWindow, true);
  }

  // Show window without activating/stealing foreground focus
  mainWindow.once('ready-to-show', () => {
    mainWindow?.showInactive();
    if (mainWindow) {
      applyAlwaysOnTop(mainWindow, config.alwaysOnTop);
      startForegroundTracker(mainWindow);
      if (config.privacyMode) {
        setCaptureExclusion(mainWindow, true);
      }
    }
  });

  // Track window position/size changes (only preserve full window dimensions)
  const saveBounds = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const bounds = mainWindow.getBounds();
    if (bounds.width >= 350 && bounds.height >= 450) {
      lastNormalBounds = { ...bounds };
      saveConfig({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height
      });
    }
  };

  mainWindow.on('resize', saveBounds);
  mainWindow.on('moved', saveBounds);

  // Initialize Gemini Service
  const apiKey = config.apiKey || '';
  geminiService = new GeminiService(apiKey, config.model || 'gemini-2.5-flash');

  // Register Global Shortcuts
  registerGlobalShortcuts();
}

async function takeCleanScreenshot() {
  return await captureScreen();
}

function registerGlobalShortcuts() {
  // 1. Toggle Show/Hide: Ctrl + Shift + Space
  try {
    globalShortcut.register('CommandOrControl+Shift+Space', () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      if (mainWindow.isVisible()) {
        mainWindow.hide();
        restoreForegroundWindow();
      } else {
        mainWindow.showInactive();
      }
    });
  } catch (err) {
    console.error('Failed to register shortcut Ctrl+Shift+Space:', err);
  }

  // 2. Instant Screen Capture Hotkey: Ctrl + Alt + S
  try {
    globalShortcut.register('CommandOrControl+Alt+S', async () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      try {
        recordForegroundWindow();
        const screenshot = await takeCleanScreenshot();
        if (!mainWindow.isVisible()) {
          mainWindow.showInactive();
        }
        mainWindow.webContents.send('overlay:global-snap', screenshot);
        restoreForegroundWindow();
      } catch (err) {
        console.error('Global screen capture failed:', err);
      }
    });
  } catch (err) {
    console.error('Failed to register shortcut Ctrl+Alt+S:', err);
  }

  // 3. Instant Snap & Solve: Ctrl + Shift + S
  try {
    globalShortcut.register('CommandOrControl+Shift+S', async () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      try {
        recordForegroundWindow();
        const screenshot = await takeCleanScreenshot();
        if (!mainWindow.isVisible()) {
          mainWindow.showInactive();
        }
        mainWindow.webContents.send('overlay:global-solve', screenshot);
        restoreForegroundWindow();
      } catch (err) {
        console.error('Global snap & solve failed:', err);
      }
    });
  } catch (err) {
    console.error('Failed to register shortcut Ctrl+Shift+S:', err);
  }

  // 4. Ghost / Stealth Mode: Ctrl + Shift + G
  try {
    globalShortcut.register('CommandOrControl+Shift+G', () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      mainWindow.webContents.send('overlay:toggle-ghost-mode');
    });
  } catch (err) {
    console.error('Failed to register shortcut Ctrl+Shift+G:', err);
  }
}

// IPC Handlers
function setupIpcHandlers() {
  // Move window by offset (used for smooth stealth capsule drag)
  ipcMain.handle('overlay:move-window-by', (_, { dx, dy }: { dx: number; dy: number }) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const [x, y] = mainWindow.getPosition();
    mainWindow.setPosition(Math.round(x + dx), Math.round(y + dy));
  });

  // Toggle Focusable state on demand (safe no-op to prevent taskbar icon flickering and focus stealing)
  ipcMain.handle('overlay:set-focusable', () => {});

let lastNormalBounds = { width: 440, height: 620, x: 0, y: 0 };
const STEALTH_BASE_WIDTH = 210;
const STEALTH_BASE_HEIGHT = 48;

  // Ghost mode window resize/reposition to capsule dock size
  ipcMain.handle('overlay:set-ghost-mode', (_, isGhost: boolean) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (isGhost) {
      const b = mainWindow.getBounds();
      lastNormalBounds = { ...b };
      // Shrink window to compact dock dimensions
      mainWindow.setBounds({
        x: Math.round(b.x + b.width - STEALTH_BASE_WIDTH),
        y: Math.round(b.y),
        width: STEALTH_BASE_WIDTH,
        height: STEALTH_BASE_HEIGHT
      });
      mainWindow.setOpacity(0.95);
    } else {
      // Restore back to full window
      const currentBounds = mainWindow.getBounds();
      const targetWidth = lastNormalBounds.width || 440;
      const targetHeight = lastNormalBounds.height || 620;
      const targetX = Math.max(0, currentBounds.x - targetWidth + currentBounds.width);
      mainWindow.setBounds({
        x: Math.round(targetX),
        y: Math.round(currentBounds.y),
        width: targetWidth,
        height: targetHeight
      });
      mainWindow.setOpacity(currentConfig.opacity || 0.96);
    }
    // Reassert topmost Z-order so stealth mode stays above all opened apps
    applyAlwaysOnTop(mainWindow, true);
    mainWindow.moveTop();
  });

  // Dynamic resize in stealth mode for popups (mini input bar or response bubble)
  ipcMain.handle('overlay:resize-stealth', (_, { width, height, alignBottom }: { width: number; height: number; alignBottom?: boolean }) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const current = mainWindow.getBounds();
    const w = Math.round(width);
    const h = Math.round(height);
    let newX = current.x;
    let newY = current.y;

    if (alignBottom) {
      // When expanding upward (e.g. response bubble above capsule), adjust Y and X
      newY = current.y + current.height - h;
      newX = current.x + current.width - w;
    }

    mainWindow.setBounds({
      x: Math.max(0, newX),
      y: Math.max(0, newY),
      width: w,
      height: h
    });
    applyAlwaysOnTop(mainWindow, true);
    mainWindow.moveTop();
  });

  // Capture screen (clean unblocked capture)
  ipcMain.handle('overlay:capture-screen', async () => {
    return await takeCleanScreenshot();
  });

  // Send prompt to Gemini with streaming
  ipcMain.handle('overlay:send-prompt', async (_, payload: {
    prompt: string;
    image?: { base64: string; mimeType: string };
    images?: { base64: string; mimeType: string }[];
    history?: any[];
  }) => {
    restoreForegroundWindow();
    if (!currentConfig.apiKey || !currentConfig.apiKey.trim()) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('gemini:stream-error', '🔑 Please enter your Gemini API key in Settings (⚙) to use Yo.');
      }
      return { ok: false, error: 'API key is missing' };
    }
    if (!geminiService) {
      geminiService = new GeminiService(currentConfig.apiKey, currentConfig.model || 'gemini-2.5-flash');
    }

    try {
      geminiService.askStream(
        payload.prompt,
        payload.images || payload.image,
        payload.history || [],
        {
          onChunk: (chunk: string) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('gemini:stream-chunk', chunk);
            }
          },
          onDone: (fullText: string) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('gemini:stream-done', fullText);
            }
          },
          onError: (error: string) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('gemini:stream-error', error);
            }
          }
        }
      ).catch((err) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('gemini:stream-error', err.message || 'API request failed');
        }
      });

      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  });

  // Toggle Always on top
  ipcMain.handle('overlay:toggle-always-on-top', () => {
    if (!mainWindow) return false;
    const current = mainWindow.isAlwaysOnTop();
    const next = !current;
    applyAlwaysOnTop(mainWindow, next);
    currentConfig.alwaysOnTop = next;
    saveConfig({ alwaysOnTop: next });
    return next;
  });

  // Toggle Privacy Capture Exclusion
  ipcMain.handle('overlay:toggle-privacy', () => {
    if (!mainWindow) return { enabled: false, success: false };
    const next = !currentConfig.privacyMode;
    const res = setCaptureExclusion(mainWindow, next);
    currentConfig.privacyMode = next;
    saveConfig({ privacyMode: next });
    return { enabled: next, success: res.success };
  });

  // Opacity slider
  ipcMain.handle('overlay:set-opacity', (_, opacity: number) => {
    if (!mainWindow) return;
    const clamped = Math.max(0.2, Math.min(1.0, opacity));
    mainWindow.setOpacity(clamped);
    currentConfig.opacity = clamped;
    saveConfig({ opacity: clamped });
  });

  // Get configuration
  ipcMain.handle('overlay:get-config', () => {
    return { ...currentConfig };
  });

  // Update configuration
  ipcMain.handle('overlay:update-config', (_, newConfig: any) => {
    currentConfig = { ...currentConfig, ...newConfig };
    saveConfig(currentConfig);
    if (geminiService && currentConfig.apiKey) {
      geminiService.updateConfig(currentConfig.apiKey, currentConfig.model);
    }
  });

  // Restore focus to previous application window
  ipcMain.handle('overlay:restore-focus', () => {
    restoreForegroundWindow();
  });

  // Window actions
  ipcMain.on('overlay:minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.on('overlay:close', () => {
    mainWindow?.close();
  });
}

function createTray() {
  if (tray) return;

  try {
    // Discreet 16x16 icon in System Tray
    const iconBase64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAZklEQVR4nGNgGAXUBsxgzIqmEUSr84eKMzEwMHAzMDEwiSFLokszMmAB5BvAiK4RZEGqGsDCgA3A+BhGQzYw1A1gZMAOqGIAB4fGkOIBj4cRGs6AwwAGkODiQ5iBG4d1wQ4DAwMA/2AJk1zN65MAAAAASUVORK5CYII=';
    const trayIcon = nativeImage.createFromBuffer(Buffer.from(iconBase64, 'base64'));

    tray = new Tray(trayIcon);
    tray.setToolTip('Clovi (Stealth Assistant)');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Toggle Overlay (Ctrl+Shift+Space)',
        click: () => {
          if (!mainWindow || mainWindow.isDestroyed()) return;
          if (mainWindow.isVisible()) {
            mainWindow.hide();
          } else {
            mainWindow.showInactive();
          }
        }
      },
      {
        label: '⚡ Snap & Solve (Ctrl+Shift+S)',
        click: async () => {
          const screenshot = await takeCleanScreenshot();
          if (screenshot && mainWindow && !mainWindow.isDestroyed()) {
            if (!mainWindow.isVisible()) mainWindow.showInactive();
            mainWindow.webContents.send('overlay:global-solve', screenshot);
          }
        }
      },
      {
        label: '👻 Stealth Capsule (Ctrl+Shift+G)',
        click: () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            if (!mainWindow.isVisible()) mainWindow.showInactive();
            mainWindow.webContents.send('overlay:toggle-ghost');
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Quit Clovi',
        click: () => {
          app.quit();
        }
      }
    ]);

    tray.setContextMenu(contextMenu);
    tray.on('click', () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.showInactive();
      }
    });
  } catch (err) {
    console.warn('Failed to create system tray:', err);
  }
}

// App lifecycle
app.whenReady().then(() => {
  setupIpcHandlers();
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (tray) {
    tray.destroy();
    tray = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

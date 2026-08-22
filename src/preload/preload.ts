import { contextBridge, ipcRenderer } from 'electron';

export interface ScreenshotData {
  dataUrl: string;
  base64: string;
  mimeType: string;
  width: number;
  height: number;
}

export interface AppConfig {
  width: number;
  height: number;
  alwaysOnTop: boolean;
  privacyMode: boolean;
  opacity: number;
  apiKey?: string;
  model?: string;
}

const api = {
  // Screen & Capture
  captureScreen: (): Promise<ScreenshotData> => ipcRenderer.invoke('overlay:capture-screen'),
  
  // Gemini AI Stream
  sendPrompt: (data: {
    prompt: string;
    image?: { base64: string; mimeType: string };
    history?: any[];
  }): Promise<{ ok: boolean }> => ipcRenderer.invoke('overlay:send-prompt', data),

  // Stream Event Listeners
  onStreamChunk: (callback: (chunk: string) => void) => {
    const handler = (_: any, chunk: string) => callback(chunk);
    ipcRenderer.on('gemini:stream-chunk', handler);
    return () => ipcRenderer.removeListener('gemini:stream-chunk', handler);
  },
  onStreamDone: (callback: (fullText: string) => void) => {
    const handler = (_: any, fullText: string) => callback(fullText);
    ipcRenderer.on('gemini:stream-done', handler);
    return () => ipcRenderer.removeListener('gemini:stream-done', handler);
  },
  onStreamError: (callback: (error: string) => void) => {
    const handler = (_: any, error: string) => callback(error);
    ipcRenderer.on('gemini:stream-error', handler);
    return () => ipcRenderer.removeListener('gemini:stream-error', handler);
  },

  // Global hotkey triggered snap & ask
  onGlobalSnap: (callback: (screenshot: ScreenshotData) => void) => {
    const handler = (_: any, screenshot: ScreenshotData) => callback(screenshot);
    ipcRenderer.on('overlay:global-snap', handler);
    return () => ipcRenderer.removeListener('overlay:global-snap', handler);
  },
  onGlobalSolve: (callback: (screenshot: ScreenshotData) => void) => {
    const handler = (_: any, screenshot: ScreenshotData) => callback(screenshot);
    ipcRenderer.on('overlay:global-solve', handler);
    return () => ipcRenderer.removeListener('overlay:global-solve', handler);
  },

  // Focus & Ghost mode controls
  moveWindowBy: (dx: number, dy: number): Promise<void> => ipcRenderer.invoke('overlay:move-window-by', { dx, dy }),
  setFocusable: (enable: boolean): Promise<void> => ipcRenderer.invoke('overlay:set-focusable', enable),
  setGhostMode: (isGhost: boolean): Promise<void> => ipcRenderer.invoke('overlay:set-ghost-mode', isGhost),
  resizeStealth: (width: number, height: number, alignBottom?: boolean): Promise<void> =>
    ipcRenderer.invoke('overlay:resize-stealth', { width, height, alignBottom }),
  onToggleGhostMode: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('overlay:toggle-ghost-mode', handler);
    return () => ipcRenderer.removeListener('overlay:toggle-ghost-mode', handler);
  },

  // Window management
  toggleAlwaysOnTop: (): Promise<boolean> => ipcRenderer.invoke('overlay:toggle-always-on-top'),
  togglePrivacyMode: (): Promise<{ enabled: boolean; success: boolean }> => ipcRenderer.invoke('overlay:toggle-privacy'),
  setOpacity: (val: number): Promise<void> => ipcRenderer.invoke('overlay:set-opacity', val),
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke('overlay:get-config'),
  updateConfig: (config: Partial<AppConfig>): Promise<void> => ipcRenderer.invoke('overlay:update-config', config),
  restoreFocus: (): Promise<void> => ipcRenderer.invoke('overlay:restore-focus'),
  minimizeWindow: (): void => ipcRenderer.send('overlay:minimize'),
  closeWindow: (): void => ipcRenderer.send('overlay:close')
};

contextBridge.exposeInMainWorld('electronAPI', api);

export type ElectronAPI = typeof api;

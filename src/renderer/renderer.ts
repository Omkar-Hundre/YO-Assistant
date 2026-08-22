export {};

declare global {
  interface Window {
    electronAPI: any;
  }
}

interface AttachedImage {
  base64: string;
  mimeType: string;
  dataUrl: string;
}

interface ChatMsg {
  role: 'user' | 'model';
  text: string;
  imageBase64?: string;
  imageMimeType?: string;
  images?: { base64: string; mimeType: string }[];
}

// DOM Elements
const chatContainer = document.getElementById('chatContainer') as HTMLElement;
const welcomeBox = document.getElementById('welcomeBox') as HTMLElement;
const promptInput = document.getElementById('promptInput') as HTMLTextAreaElement;
const btnSend = document.getElementById('btnSend') as HTMLButtonElement;
const btnSnapScreen = document.getElementById('btnSnapScreen') as HTMLButtonElement;
const btnAutoSolve = document.getElementById('btnAutoSolve') as HTMLButtonElement;
const btnPasteClipboard = document.getElementById('btnPasteClipboard') as HTMLButtonElement;
const btnClearChat = document.getElementById('btnClearChat') as HTMLButtonElement;

// Multi-Attachment Preview Elements
const attachmentPreview = document.getElementById('attachmentPreview') as HTMLElement;
const attachmentLabel = document.getElementById('attachmentLabel') as HTMLElement;
const thumbList = document.getElementById('thumbList') as HTMLElement;
const btnClearAllAttachments = document.getElementById('btnClearAllAttachments') as HTMLButtonElement;

// Overlay Container & Ghost / Stealth Elements
const overlayContainer = document.getElementById('overlayContainer') as HTMLElement;
const btnStealthToolbar = document.getElementById('btnStealthToolbar') as HTMLButtonElement;
const ghostBubble = document.getElementById('ghostBubble') as HTMLElement;

// Stealth Suite DOM Elements
const stealthContainer = document.getElementById('stealthContainer') as HTMLElement;
const stealthDock = document.getElementById('stealthDock') as HTMLElement;
const stealthDragHandle = document.getElementById('stealthDragHandle') as HTMLElement;
const btnStealthSolve = document.getElementById('btnStealthSolve') as HTMLButtonElement;
const stealthSolveIcon = document.getElementById('stealthSolveIcon') as HTMLElement;
const stealthSolveSpinner = document.getElementById('stealthSolveSpinner') as HTMLElement;
const btnStealthSnap = document.getElementById('btnStealthSnap') as HTMLButtonElement;
const stealthSnapBadge = document.getElementById('stealthSnapBadge') as HTMLElement;
const btnStealthPrompt = document.getElementById('btnStealthPrompt') as HTMLButtonElement;
const btnStealthExpand = document.getElementById('btnStealthExpand') as HTMLButtonElement;
const stealthInputBar = document.getElementById('stealthInputBar') as HTMLElement;
const stealthInputText = document.getElementById('stealthInputText') as HTMLTextAreaElement;
const btnStealthSend = document.getElementById('btnStealthSend') as HTMLButtonElement;
const stealthResponseBubble = document.getElementById('stealthResponseBubble') as HTMLElement;
const stealthResponseContent = document.getElementById('stealthResponseContent') as HTMLElement;

// Window Controls
const btnSettings = document.getElementById('btnSettings') as HTMLButtonElement;
const btnMinimize = document.getElementById('btnMinimize') as HTMLButtonElement;
const btnClose = document.getElementById('btnClose') as HTMLButtonElement;

// Settings Modal
const settingsModal = document.getElementById('settingsModal') as HTMLElement;
const modalBackdrop = document.getElementById('modalBackdrop') as HTMLElement;
const btnCloseSettings = document.getElementById('btnCloseSettings') as HTMLButtonElement;
const btnSaveSettings = document.getElementById('btnSaveSettings') as HTMLButtonElement;
const inputApiKey = document.getElementById('inputApiKey') as HTMLInputElement;
const selectModel = document.getElementById('selectModel') as HTMLSelectElement;
const rangeOpacity = document.getElementById('rangeOpacity') as HTMLInputElement;
const opacityVal = document.getElementById('opacityVal') as HTMLElement;
const chkAlwaysOnTop = document.getElementById('chkAlwaysOnTop') as HTMLInputElement;
const chkPrivacyMode = document.getElementById('chkPrivacyMode') as HTMLInputElement;

// State
let attachedImages: AttachedImage[] = [];
const MAX_ATTACHMENTS = 5;
let chatHistory: ChatMsg[] = [];
let currentStreamingBubble: HTMLElement | null = null;
let currentStreamingText = '';
let isGenerating = false;
let isGhostMode = true;

const DEFAULT_SOLVE_PROMPT = 'Provide the direct written answer or code solution to the problem in the screenshot. If it is a coding question, output clean runnable code (prefer Python unless C/C++/Java specified in the problem). If math or MCQ, output the exact answer value directly.';

// Initialize
async function init() {
  setupEventListeners();
  setupIpcListeners();
  updateStealthBadge();
  await loadInitialConfig();
}

async function loadInitialConfig() {
  try {
    const config = await window.electronAPI.getConfig();
    if (config) {
      if (config.apiKey) inputApiKey.value = config.apiKey;
      if (config.model) selectModel.value = config.model;
      if (config.opacity) {
        rangeOpacity.value = String(Math.round(config.opacity * 100));
        opacityVal.innerText = `${rangeOpacity.value}%`;
      }
      chkAlwaysOnTop.checked = !!config.alwaysOnTop;
      chkPrivacyMode.checked = !!config.privacyMode;

      // If no API key configured yet, prompt user on first launch
      if (!config.apiKey || !config.apiKey.trim()) {
        toggleGhostMode(false);
        if (settingsModal) settingsModal.style.display = 'flex';
      }
    }
  } catch (err) {
    console.error('Failed to load initial config:', err);
  }
}

function setupEventListeners() {
  // Global non-activating click guard: only restore focus when clicking non-interactive backdrop
  document.addEventListener('pointerdown', (e: MouseEvent) => {
    if (e.target instanceof Element && e.target.closest('button, input, select, textarea, .ghost-bubble, .modal-card, .chip, .code-container, .suggested-chips, .stealth-dock, .stealth-input-bar, .stealth-response-bubble')) {
      return;
    }
    window.electronAPI.restoreFocus();
  });

  // Input auto-resize
  promptInput.addEventListener('input', () => {
    promptInput.style.height = 'auto';
    promptInput.style.height = `${Math.min(promptInput.scrollHeight, 120)}px`;
  });

  promptInput.addEventListener('blur', () => {
    window.electronAPI.restoreFocus();
  });

  // Ghost / Stealth Mode Toolbar Button
  if (btnStealthToolbar) {
    btnStealthToolbar.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleGhostMode();
    });
  }

  // Stealth Dock Buttons
  if (btnStealthSolve) {
    btnStealthSolve.addEventListener('click', async (e) => {
      e.stopPropagation();
      await solveFromStealth();
      window.electronAPI.restoreFocus();
    });
  }

  if (btnStealthSnap) {
    btnStealthSnap.addEventListener('click', async (e) => {
      e.stopPropagation();
      await snapScreen();
      window.electronAPI.restoreFocus();
    });
  }

  if (btnStealthPrompt) {
    btnStealthPrompt.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleStealthInputBar();
    });
  }

  if (btnStealthExpand) {
    btnStealthExpand.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleGhostMode(false);
    });
  }

  if (btnStealthSend) {
    btnStealthSend.addEventListener('click', (e) => {
      e.stopPropagation();
      sendStealthPrompt();
    });
  }

  if (stealthInputText) {
    stealthInputText.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      stealthInputText.focus();
    });
    stealthInputText.addEventListener('click', (e) => {
      e.stopPropagation();
      stealthInputText.focus();
    });
    stealthInputText.addEventListener('blur', () => {
      window.electronAPI.restoreFocus();
    });
    stealthInputText.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendStealthPrompt();
        window.electronAPI.restoreFocus();
      }
    });
  }

  // Copy button inside stealth response bubble
  const btnStealthCopyInline = document.getElementById('btnStealthCopyInline') as HTMLButtonElement;
  if (btnStealthCopyInline) {
    btnStealthCopyInline.addEventListener('click', (e) => {
      e.stopPropagation();
      if (stealthResponseContent) {
        navigator.clipboard.writeText(stealthResponseContent.innerText);
        btnStealthCopyInline.innerText = '✅ Copied!';
        setTimeout(() => { btnStealthCopyInline.innerText = '📋 Copy'; }, 1500);
      }
    });
  }

  // Expand button inside stealth response bubble (switches seamlessly to full window)
  const btnStealthExpandInline = document.getElementById('btnStealthExpandInline') as HTMLButtonElement;
  if (btnStealthExpandInline) {
    btnStealthExpandInline.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleGhostMode(false);
    });
  }

  // Close button inside stealth response bubble
  const btnStealthCloseInline = document.getElementById('btnStealthCloseInline') as HTMLButtonElement;
  if (btnStealthCloseInline) {
    btnStealthCloseInline.addEventListener('click', (e) => {
      e.stopPropagation();
      stealthResponseBubble.style.display = 'none';
      adjustStealthBounds();
    });
  }

  // Double Click on micro solution bubble dismisses it
  if (stealthResponseBubble) {
    stealthResponseBubble.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      stealthResponseBubble.style.display = 'none';
      adjustStealthBounds();
    });
  }

  // Stealth Dock Dragging & Double Click Restore
  let isDraggingDock = false;
  let dockStartX = 0;
  let dockStartY = 0;

  const startDrag = (e: PointerEvent) => {
    isDraggingDock = true;
    dockStartX = e.screenX;
    dockStartY = e.screenY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const doDrag = (e: PointerEvent) => {
    if (!isDraggingDock) return;
    const dx = e.screenX - dockStartX;
    const dy = e.screenY - dockStartY;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      window.electronAPI.moveWindowBy(dx, dy);
      dockStartX = e.screenX;
      dockStartY = e.screenY;
    }
  };

  const endDrag = (e: PointerEvent) => {
    if (isDraggingDock) {
      isDraggingDock = false;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (err) {}
    }
  };

  if (stealthDragHandle) {
    stealthDragHandle.addEventListener('pointerdown', startDrag);
    stealthDragHandle.addEventListener('pointermove', doDrag);
    stealthDragHandle.addEventListener('pointerup', endDrag);
  }

  if (stealthDock) {
    stealthDock.addEventListener('dblclick', () => {
      toggleGhostMode(false);
    });
  }

  // Enter to send
  promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      window.electronAPI.setFocusable(false);
      window.electronAPI.restoreFocus();
    }
  });

  // Send button
  btnSend.addEventListener('click', () => {
    handleSend();
    window.electronAPI.setFocusable(false);
    window.electronAPI.restoreFocus();
  });

  // Snap Screen Button (Multi-screenshot support up to 5)
  btnSnapScreen.addEventListener('click', async (e) => {
    e.stopPropagation();
    await snapScreen();
  });

  // Auto-Solve Button
  btnAutoSolve.addEventListener('click', async (e) => {
    e.stopPropagation();
    await snapAndAutoSolve();
  });

  // Paste from clipboard button
  btnPasteClipboard.addEventListener('click', async (e) => {
    e.stopPropagation();
    await readClipboardAndAttach();
  });

  // Clear all attachments button
  if (btnClearAllAttachments) {
    btnClearAllAttachments.addEventListener('click', (e) => {
      e.stopPropagation();
      clearAllAttachments();
    });
    btnClearAllAttachments.addEventListener('pointerdown', (e) => e.stopPropagation());
  }

  // Clear / Delete chat
  btnClearChat.addEventListener('click', (e) => {
    e.stopPropagation();
    chatHistory = [];
    chatContainer.innerHTML = '';
    chatContainer.appendChild(welcomeBox);
    welcomeBox.style.display = 'block';
    clearAllAttachments();
  });

  // Suggestion chips
  document.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const prompt = chip.getAttribute('data-prompt') || '';
      promptInput.value = prompt;
      promptInput.focus();
      promptInput.style.height = 'auto';
      promptInput.style.height = `${Math.min(promptInput.scrollHeight, 120)}px`;
    });
  });

  // Welcome shortcut cards interactive triggers
  const cardSnapSolve = document.getElementById('cardSnapSolve');
  if (cardSnapSolve) {
    cardSnapSolve.addEventListener('click', () => {
      snapAndAutoSolve();
    });
  }

  const cardStealthMode = document.getElementById('cardStealthMode');
  if (cardStealthMode) {
    cardStealthMode.addEventListener('click', () => {
      toggleGhostMode(true);
    });
  }

  // Global paste handler (Ctrl+V)
  window.addEventListener('paste', async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            const base64 = dataUrl.split(',')[1];
            addAttachment({
              base64,
              mimeType: file.type || 'image/png',
              dataUrl
            });
          };
          reader.readAsDataURL(file);
          return;
        }
      }
    }
  });

  // Window Controls
  btnMinimize.addEventListener('click', (e) => {
    e.stopPropagation();
    window.electronAPI.minimizeWindow();
  });
  btnClose.addEventListener('click', (e) => {
    e.stopPropagation();
    window.electronAPI.closeWindow();
  });

  // Settings Modal Controls
  btnSettings.addEventListener('click', () => {
    settingsModal.style.display = 'flex';
  });
  btnCloseSettings.addEventListener('click', () => {
    settingsModal.style.display = 'none';
  });
  modalBackdrop.addEventListener('click', () => {
    settingsModal.style.display = 'none';
  });

  // Opacity Slider live update
  rangeOpacity.addEventListener('input', () => {
    const val = Number(rangeOpacity.value);
    opacityVal.innerText = `${val}%`;
    window.electronAPI.setOpacity(val / 100);
  });

  // Save Settings
  btnSaveSettings.addEventListener('click', async () => {
    const updated = {
      apiKey: inputApiKey.value.trim(),
      model: selectModel.value,
      opacity: Number(rangeOpacity.value) / 100,
      alwaysOnTop: chkAlwaysOnTop.checked,
      privacyMode: chkPrivacyMode.checked
    };
    await window.electronAPI.updateConfig(updated);
    settingsModal.style.display = 'none';
  });
}

function setupIpcListeners() {
  // Streaming chunks
  window.electronAPI.onStreamChunk((chunk: string) => {
    currentStreamingText += chunk;

    // 1. Update stealth micro-bubble if in ghost mode
    if (isGhostMode) {
      if (stealthSolveSpinner) stealthSolveSpinner.style.display = 'none';
      if (stealthSolveIcon) stealthSolveIcon.style.display = 'inline-block';
      if (stealthResponseBubble && stealthResponseBubble.style.display === 'none') {
        stealthResponseBubble.style.display = 'flex';
        adjustStealthBounds();
      }
      if (stealthResponseContent) {
        renderMarkdownInto(stealthResponseContent, currentStreamingText, true);
        stealthResponseContent.scrollTop = stealthResponseContent.scrollHeight;
      }
    }

    // 2. Always update the main window chat bubble in parallel
    if (currentStreamingBubble) {
      renderMarkdownInto(currentStreamingBubble, currentStreamingText, true);
      scrollToBottom();
    }
  });

  // Streaming done
  window.electronAPI.onStreamDone((fullText: string) => {
    // 1. Finalize stealth micro-bubble
    if (isGhostMode) {
      if (stealthSolveSpinner) stealthSolveSpinner.style.display = 'none';
      if (stealthSolveIcon) stealthSolveIcon.style.display = 'inline-block';
      if (stealthResponseBubble && stealthResponseBubble.style.display === 'none') {
        stealthResponseBubble.style.display = 'flex';
        adjustStealthBounds();
      }
      if (stealthResponseContent) {
        renderMarkdownInto(stealthResponseContent, fullText, false);
        stealthResponseContent.scrollTop = 0; // Scroll to top so user can read solution from start
      }
    }

    // 2. Finalize main window chat bubble
    if (currentStreamingBubble) {
      renderMarkdownInto(currentStreamingBubble, fullText, false);
      scrollToBottom();
    }

    // 3. Save to chat history
    chatHistory.push({
      role: 'model',
      text: fullText
    });
    finalizeGeneration();
  });

  // Stream error
  window.electronAPI.onStreamError((err: string) => {
    if (isGhostMode) {
      if (stealthSolveSpinner) stealthSolveSpinner.style.display = 'none';
      if (stealthSolveIcon) stealthSolveIcon.style.display = 'inline-block';
      if (stealthResponseBubble) {
        stealthResponseBubble.style.display = 'flex';
        adjustStealthBounds();
      }
      if (stealthResponseContent) {
        stealthResponseContent.innerHTML = `<span style="color: #ef4444;">⚠️ Error: ${escapeHtml(err)}</span>`;
      }
    }
    if (currentStreamingBubble) {
      currentStreamingBubble.innerHTML = `<span style="color: #ef4444;">⚠️ Error: ${escapeHtml(err)}</span>`;
      scrollToBottom();
    }
    finalizeGeneration();
  });

  // Global Snap shortcut handler
  window.electronAPI.onGlobalSnap((screenshot: any) => {
    if (screenshot && screenshot.dataUrl) {
      addAttachment({
        base64: screenshot.base64,
        mimeType: screenshot.mimeType,
        dataUrl: screenshot.dataUrl
      });
    }
  });

  // Global Snap & Auto-Solve shortcut handler
  window.electronAPI.onGlobalSolve((screenshot: any) => {
    if (screenshot && screenshot.dataUrl) {
      clearAllAttachments();
      addAttachment({
        base64: screenshot.base64,
        mimeType: screenshot.mimeType,
        dataUrl: screenshot.dataUrl
      });
      if (isGhostMode) {
        sendStealthPrompt(DEFAULT_SOLVE_PROMPT);
      } else {
        promptInput.value = DEFAULT_SOLVE_PROMPT;
        handleSend();
      }
    }
  });

  // Global toggle ghost mode handler
  window.electronAPI.onToggleGhostMode(() => {
    toggleGhostMode();
  });
}

async function toggleGhostMode(forced?: boolean) {
  const targetMode = typeof forced === 'boolean' ? forced : !isGhostMode;
  if (targetMode === isGhostMode && typeof forced !== 'undefined') return;
  isGhostMode = targetMode;

  overlayContainer.classList.add('mode-transitioning');

  if (isGhostMode) {
    if (stealthResponseBubble) stealthResponseBubble.style.display = 'none';
    if (stealthInputBar) stealthInputBar.style.display = 'none';
    
    await window.electronAPI.setGhostMode(true);
    
    overlayContainer.classList.add('ghost-active');
    if (stealthContainer) stealthContainer.style.display = 'flex';
    updateStealthBadge();
  } else {
    await window.electronAPI.setGhostMode(false);
    
    overlayContainer.classList.remove('ghost-active');
    if (stealthContainer) stealthContainer.style.display = 'none';
    if (stealthResponseBubble) stealthResponseBubble.style.display = 'none';
    if (stealthInputBar) stealthInputBar.style.display = 'none';
    scrollToBottom();
  }

  requestAnimationFrame(() => {
    setTimeout(() => {
      overlayContainer.classList.remove('mode-transitioning');
    }, 60);
  });
}

function updateStealthBadge() {
  if (stealthSnapBadge) {
    stealthSnapBadge.innerText = String(attachedImages.length);
    stealthSnapBadge.style.display = attachedImages.length > 0 ? 'flex' : 'none';
  }
}

function toggleStealthInputBar(forced?: boolean) {
  if (!stealthInputBar) return;
  const show = typeof forced === 'boolean' ? forced : (stealthInputBar.style.display === 'none');
  stealthInputBar.style.display = show ? 'flex' : 'none';
  if (show && stealthInputText) {
    stealthInputText.focus();
  }
  adjustStealthBounds();
}

function adjustStealthBounds() {
  if (!isGhostMode) return;
  const hasBubble = stealthResponseBubble && stealthResponseBubble.style.display !== 'none';
  const hasInput = stealthInputBar && stealthInputBar.style.display !== 'none';

  if (hasBubble) {
    window.electronAPI.resizeStealth(380, hasInput ? 310 : 250, true);
  } else if (hasInput) {
    window.electronAPI.resizeStealth(260, 92, true);
  } else {
    window.electronAPI.resizeStealth(210, 48, true);
  }
}

async function solveFromStealth() {
  try {
    const screenshot = await window.electronAPI.captureScreen();
    if (screenshot) {
      clearAllAttachments();
      addAttachment(screenshot);
      await sendStealthPrompt(DEFAULT_SOLVE_PROMPT);
    }
  } catch (err) {
    console.error('Stealth solve failed:', err);
  }
}

async function sendStealthPrompt(customPrompt?: string) {
  if (isGenerating) return;

  if (!inputApiKey.value || !inputApiKey.value.trim()) {
    toggleGhostMode(false);
    if (settingsModal) settingsModal.style.display = 'flex';
    return;
  }

  const userText = stealthInputText ? stealthInputText.value.trim() : '';
  const promptText = typeof customPrompt === 'string' ? customPrompt : (userText || DEFAULT_SOLVE_PROMPT);
  const currentImgs = [...attachedImages];

  if (!promptText && currentImgs.length === 0) return;

  // Show blue buffering spinner on the solve icon
  if (stealthSolveIcon) stealthSolveIcon.style.display = 'none';
  if (stealthSolveSpinner) stealthSolveSpinner.style.display = 'inline-block';
  // Keep solution bubble hidden while buffering so no big white box is visible
  if (stealthResponseBubble) stealthResponseBubble.style.display = 'none';
  adjustStealthBounds();

  // Clear inputs
  if (stealthInputText) stealthInputText.value = '';
  clearAllAttachments();

  // Seamlessly sync to main window chatContainer
  if (welcomeBox) welcomeBox.style.display = 'none';
  const displayLabel = promptText || (currentImgs.length > 0 ? `📸 Snap (${currentImgs.length}) & Solve` : '');
  appendUserMessage(displayLabel, currentImgs.map(i => i.dataUrl));

  const bubble = appendGeminiPlaceholder();
  currentStreamingBubble = bubble;
  currentStreamingText = '';
  isGenerating = true;

  try {
    const imagesPayload = currentImgs.map(i => ({ base64: i.base64, mimeType: i.mimeType }));
    await window.electronAPI.sendPrompt({
      prompt: promptText,
      images: imagesPayload,
      history: chatHistory
    });

    chatHistory.push({
      role: 'user',
      text: promptText,
      images: imagesPayload
    });
  } catch (err: any) {
    if (stealthSolveSpinner) stealthSolveSpinner.style.display = 'none';
    if (stealthSolveIcon) stealthSolveIcon.style.display = 'inline-block';
    if (stealthResponseBubble) {
      stealthResponseBubble.style.display = 'flex';
      adjustStealthBounds();
    }
    if (stealthResponseContent) {
      stealthResponseContent.innerHTML = `<span style="color: #ef4444;">⚠️ Error: ${escapeHtml(err.message)}</span>`;
    }
    if (currentStreamingBubble) {
      currentStreamingBubble.innerHTML = `<span style="color: #ef4444;">⚠️ Error: ${escapeHtml(err.message)}</span>`;
    }
    finalizeGeneration();
  }
}

async function snapScreen() {
  try {
    const screenshot = await window.electronAPI.captureScreen();
    if (screenshot) {
      addAttachment(screenshot);
    }
  } catch (err: any) {
    console.error('Screen capture failed:', err);
  }
}

async function snapAndAutoSolve() {
  try {
    const screenshot = await window.electronAPI.captureScreen();
    if (screenshot) {
      clearAllAttachments();
      addAttachment(screenshot);
      promptInput.value = 'Give the direct written answer to the question in this screenshot.';
      handleSend();
    }
  } catch (err: any) {
    console.error('Snap & solve failed:', err);
  }
}

async function readClipboardAndAttach() {
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imageType = item.types.find(t => t.startsWith('image/'));
      if (imageType) {
        const blob = await item.getType(imageType);
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          addAttachment({
            base64: dataUrl.split(',')[1],
            mimeType: imageType,
            dataUrl
          });
        };
        reader.readAsDataURL(blob);
        return;
      }
    }
    // If no image, read text
    const text = await navigator.clipboard.readText();
    if (text) {
      promptInput.value = text;
      promptInput.focus();
    }
  } catch (err) {
    console.warn('Clipboard read error:', err);
  }
}

function addAttachment(img: AttachedImage) {
  if (attachedImages.length >= MAX_ATTACHMENTS) {
    alert(`Maximum of ${MAX_ATTACHMENTS} screenshots reached.`);
    return;
  }
  attachedImages.push(img);
  renderAttachments();
}

function removeAttachment(index: number) {
  if (index >= 0 && index < attachedImages.length) {
    attachedImages.splice(index, 1);
    renderAttachments();
  }
}

function clearAllAttachments() {
  attachedImages = [];
  renderAttachments();
}

function renderAttachments() {
  updateStealthBadge();
  if (attachedImages.length === 0) {
    attachmentPreview.style.display = 'none';
    thumbList.innerHTML = '';
    return;
  }

  attachmentPreview.style.display = 'flex';
  if (attachmentLabel) {
    attachmentLabel.innerText = `📸 Attached Screenshots (${attachedImages.length}/${MAX_ATTACHMENTS})`;
  }

  thumbList.innerHTML = '';
  attachedImages.forEach((img, idx) => {
    const item = document.createElement('div');
    item.className = 'thumb-item';

    const imageEl = document.createElement('img');
    imageEl.src = img.dataUrl;
    imageEl.alt = `Screenshot ${idx + 1}`;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-thumb-remove';
    removeBtn.innerText = '✕';
    removeBtn.title = 'Remove this screenshot';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeAttachment(idx);
    });
    removeBtn.addEventListener('pointerdown', (e) => e.stopPropagation());

    item.appendChild(imageEl);
    item.appendChild(removeBtn);
    thumbList.appendChild(item);
  });
}

async function handleSend() {
  if (isGenerating) return;

  const promptText = promptInput.value.trim();
  const currentImgs = [...attachedImages];

  if (!promptText && currentImgs.length === 0) return;

  welcomeBox.style.display = 'none';

  // Add User Message UI
  const displayLabel = promptText || (currentImgs.length > 0 ? `📸 Analyze ${currentImgs.length} Snapshot(s) & Solve` : '');
  appendUserMessage(displayLabel, currentImgs.map(i => i.dataUrl));

  // Clear inputs
  promptInput.value = '';
  promptInput.style.height = 'auto';
  clearAllAttachments();

  // Create Gemini streaming response placeholder
  const bubble = appendGeminiPlaceholder();
  currentStreamingBubble = bubble;
  currentStreamingText = '';
  isGenerating = true;
  btnSend.disabled = true;

  try {
    const imagesPayload = currentImgs.map(i => ({ base64: i.base64, mimeType: i.mimeType }));
    await window.electronAPI.sendPrompt({
      prompt: promptText,
      images: imagesPayload,
      history: chatHistory
    });

    // Add to history
    chatHistory.push({
      role: 'user',
      text: promptText,
      images: imagesPayload
    });
  } catch (err: any) {
    bubble.innerHTML = `<span style="color: #ef4444;">⚠️ Error: ${escapeHtml(err.message)}</span>`;
    finalizeGeneration();
  }
}

function appendUserMessage(text: string, imageUrls?: string | string[]) {
  const row = document.createElement('div');
  row.className = 'message-row user';

  const avatar = document.createElement('div');
  avatar.className = 'avatar user';
  avatar.innerText = '👤';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  if (imageUrls) {
    const urls = Array.isArray(imageUrls) ? imageUrls : [imageUrls];
    if (urls.length === 1) {
      const img = document.createElement('img');
      img.src = urls[0];
      img.className = 'msg-thumbnail';
      bubble.appendChild(img);
    } else if (urls.length > 1) {
      const grid = document.createElement('div');
      grid.style.display = 'flex';
      grid.style.flexWrap = 'wrap';
      grid.style.gap = '4px';
      grid.style.marginBottom = '5px';
      urls.forEach(u => {
        const img = document.createElement('img');
        img.src = u;
        img.style.maxWidth = '48%';
        img.style.maxHeight = '90px';
        img.style.borderRadius = '4px';
        img.style.objectFit = 'cover';
        grid.appendChild(img);
      });
      bubble.appendChild(grid);
    }
  }

  if (text) {
    const textNode = document.createElement('div');
    textNode.innerText = text;
    bubble.appendChild(textNode);
  }

  row.appendChild(avatar);
  row.appendChild(bubble);
  chatContainer.appendChild(row);
  scrollToBottom();
}

function appendGeminiPlaceholder(): HTMLElement {
  const row = document.createElement('div');
  row.className = 'message-row gemini';

  const avatar = document.createElement('div');
  avatar.className = 'avatar gemini';
  avatar.innerHTML = '✨';

  const wrapper = document.createElement('div');
  wrapper.className = 'gemini-content-wrapper';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.innerHTML = '<span class="typing-cursor"></span>';

  const actions = document.createElement('div');
  actions.className = 'msg-actions';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'btn-copy-msg';
  copyBtn.innerHTML = '📋 Copy';
  copyBtn.title = 'Copy response to clipboard';
  copyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(bubble.innerText);
    copyBtn.innerHTML = '✅ Copied!';
    setTimeout(() => { copyBtn.innerHTML = '📋 Copy'; }, 1500);
  });

  actions.appendChild(copyBtn);
  wrapper.appendChild(bubble);
  wrapper.appendChild(actions);

  row.appendChild(avatar);
  row.appendChild(wrapper);
  chatContainer.appendChild(row);
  scrollToBottom();

  return bubble;
}

function finalizeGeneration() {
  isGenerating = false;
  btnSend.disabled = false;
  currentStreamingBubble = null;
  currentStreamingText = '';
}

function scrollToBottom() {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Markdown parser & Renderer
function renderMarkdownInto(container: HTMLElement, rawMarkdown: string, isStreaming: boolean) {
  let html = rawMarkdown;

  // Code blocks ```lang\ncode\n```
  html = html.replace(/```([a-zA-Z0-9_\-\+]*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    const cleanLang = lang || 'code';
    const escapedCode = escapeHtml(code.trim());
    return `<div class="code-container">
      <div class="code-header">
        <span>${escapeHtml(cleanLang)}</span>
        <button class="btn-copy-code" onclick="copyCodeSnippet(this)">📋 Copy</button>
      </div>
      <pre><code>${escapedCode}</code></pre>
    </div>`;
  });

  // Inline code `code`
  html = html.replace(/`([^`]+)`/g, (_match, code) => {
    return `<code>${escapeHtml(code)}</code>`;
  });

  // Bold **text**
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Italic *text*
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Bullet points
  html = html.replace(/^[\*\-]\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

  // Linebreaks
  html = html.replace(/\n/g, '<br/>');

  if (isStreaming) {
    html += '<span class="typing-cursor"></span>';
  }

  container.innerHTML = html;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Global copy function attached to window for code snippet copy buttons
(window as any).copyCodeSnippet = function (btn: HTMLElement) {
  const codeEl = btn.closest('.code-container')?.querySelector('code');
  if (codeEl) {
    const text = codeEl.innerText;
    navigator.clipboard.writeText(text).then(() => {
      const originalText = btn.innerText;
      btn.innerText = '✅ Copied!';
      setTimeout(() => {
        btn.innerText = originalText;
      }, 1500);
    });
  }
};

window.addEventListener('DOMContentLoaded', init);

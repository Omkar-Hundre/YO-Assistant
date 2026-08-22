# ⚡ YO-Assistant — The Ultimate Floating AI Stealth Capsule

<p align="center">
  <img src="https://raw.githubusercontent.com/Omkar-Hundre/YO-Assistant/main/landing/assets/capsule_preview.png" alt="YO-Assistant Preview" width="600" style="border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.12);" onerror="this.style.display='none'"/>
</p>

<p align="center">
  <strong>An ultra-compact, distraction-free floating desktop assistant powered by Google Gemini Vision.</strong><br>
  Engineered with native Win32 window isolation, screen-share invisibility, and zero background application disruption.
</p>

<p align="center">
  <a href="https://github.com/Omkar-Hundre/YO-Assistant/releases/latest"><img src="https://img.shields.io/badge/Download-Portable_v1.0.0-blue?style=for-the-badge&logo=windows" alt="Download Portable Exe"/></a>
  <a href="https://github.com/Omkar-Hundre/YO-Assistant/stargazers"><img src="https://img.shields.io/github/stars/Omkar-Hundre/YO-Assistant?style=for-the-badge&color=yellow" alt="GitHub Stars"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License"/></a>
</p>

---

## 🌟 Key Highlights

- **👻 Mini Floating Stealth Capsule**: Shrinks into a sleek 210px frosted glass pill that docks anywhere on your screen.
- **⚡ 1-Click Snap & Solve**: Captures your primary display and streams direct written code/math solutions directly into an in-place micro bubble without opening a giant window.
- **📸 Multi-Screenshot Queue**: Capture up to 5 screenshots consecutively with a live count badge (`📸 1`, `📸 2`...).
- **🛡️ 100% Screen Share Invisibility**: Employs native Win32 `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE = 0x11)`. The overlay is completely invisible on Google Meet, Zoom, Discord, and Teams screen sharing **without any black box artifacting**.
- **🎯 Zero Background App Interruption**: Foreground focus is automatically preserved for Chrome, VS Code, Antigravity, and text editors.
- **📋 1-Click Copy**: Instant clipboard copy buttons across all AI answers and code snippets.
- **🔕 System Tray Only**: Runs as a quiet background service with no taskbar clutter or "Apps" listing in Task Manager.

---

## ⌨️ Global Shortcuts

| Action | Shortcut |
|---|---|
| **Toggle Show / Hide Overlay** | `Ctrl + Shift + Space` |
| **Instant Screen Snap & Solve** | `Ctrl + Shift + S` |
| **Instant Screen Capture & Queue** | `Ctrl + Alt + S` |
| **Toggle Stealth Mode Capsule** | `Ctrl + Shift + G` |
| **Paste Image or Text from Clipboard** | `Ctrl + V` |

---

## 🚀 Quick Start (Portable Executable)

1. Download the latest standalone **`Yo-Assistant-Portable.exe`** from [Releases](https://github.com/Omkar-Hundre/YO-Assistant/releases).
2. Double click to run — **No installation or Node.js required!**
3. Input your personal Google Gemini API Key on first run (stored securely in your local `%APPDATA%`).

---

## 🛠️ Developer Setup & Build

```bash
# 1. Clone the repository
git clone https://github.com/Omkar-Hundre/YO-Assistant.git
cd YO-Assistant

# 2. Install dependencies
npm install

# 3. Run in Development Mode
npm start

# 4. Package Standalone Portable Windows Executable
npm run dist:portable
```

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).

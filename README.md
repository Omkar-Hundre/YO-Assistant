# ⚡ Clovi — Undetectable Floating AI Assistant for Windows

<p align="center">
  <img src="landing/Clovi_hero.webp" alt="Clovi Desktop Preview" width="800" style="border-radius: 12px; box-shadow: 0 12px 36px rgba(0,0,0,0.3);"/>
</p>

<p align="center">
  <strong>Read any question on your screen and stream direct code, formulas, or written solutions — 100% invisible on screen shares and proctoring.</strong>
</p>

<p align="center">
  <a href="https://clovi.netlify.app"><img src="https://img.shields.io/badge/Website-clovi.netlify.app-blue?style=for-the-badge" alt="Website"/></a>
  <a href="https://github.com/Omkar-Hundre/Clovi/releases/download/v1.0.1/Clovi-Portable.exe"><img src="https://img.shields.io/badge/Download-Portable_v1.0.1-blue?style=for-the-badge&logo=windows" alt="Download Portable Exe"/></a>
  <a href="https://github.com/Omkar-Hundre/Clovi/stargazers"><img src="https://img.shields.io/github/stars/Omkar-Hundre/Clovi?style=for-the-badge&color=yellow" alt="GitHub Stars"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License"/></a>
</p>

---

## 🌟 What is Clovi?

**Clovi** is an ultra-lightweight, luxury floating desktop assistant for Windows powered by Google Gemini Vision. Built specifically for live coding interviews, technical assessments, and online exams, Clovi captures your screen buffer and streams optimal solutions directly into a micro floating bubble with zero browser focus loss.

---

## 🛡️ Key Features

### 🫥 1. 100% Screen Share & Recording Invisibility
- Uses Windows OS kernel display affinity (`SetWindowDisplayAffinity` with `WDA_EXCLUDEFROMCAPTURE = 0x11`).
- Completely invisible on **Google Meet, Zoom, Microsoft Teams, Discord, and OBS** live streams without producing black boxes or visual artifacts.

### 🔒 2. Zero Tab Focus Loss (No Blurs)
- Engineered with `WS_EX_NOACTIVATE` — clicking, dragging, or interacting with Clovi never steals focus from Chrome, VS Code, or test portals.
- Safely bypasses all browser `onblur` and window focus tracking exam alerts.

### ⚡ 3. 1-Click Instant Snap & Solve (`Ctrl + Shift + S`)
- Instantly captures the optical buffer of your active screen.
- Sends the image directly to Gemini 2.5 Vision and streams formatted code, step-by-step reasoning, and time/space complexities in **under 1.5 seconds**.

### 👻 4. Minimalist Stealth Mode (`Ctrl + Shift + G`)
- Smoothly transforms from a full workspace window into an ultra-compact **210px frosted obsidian glass dock**.
- Streams solutions into an expandable obsidian pop-up card with inline syntax highlighting, full-screen expansion (`⤢ Full View`), and 1-click copy buttons (`📋 Copy`).

### 📸 5. Multi-Screenshot Queue (`Ctrl + Alt + S`)
- Capture up to 5 multi-part question screenshots consecutively with a live count badge (`📸 1`, `📸 2`...).
- Send them together with custom instructions or follow-up prompts.

---

## ⌨️ Global Keyboard Shortcuts & Zero-Focus Macros

| Action | Shortcut | Description | Focus Loss in Chrome |
|---|---|---|:---:|
| ⚡ **Instant Snap & Solve** | `Ctrl + Shift + S` | Snaps screen and auto-solves (auto-attaches clipboard if copied) | **0 ms (None)** |
| 🎯 **MCQ Instant Answer** | `Ctrl + Shift + 1` | Solves screen with direct Option A/B/C/D + concise proof | **0 ms (None)** |
| 🐍 **Optimal Python 3 Code** | `Ctrl + Shift + 2` | Generates optimal Python solution with O(1)/O(N) analysis | **0 ms (None)** |
| ☕ **Java & C++ Solution** | `Ctrl + Shift + 3` | Generates production-ready Java and C++ solutions | **0 ms (None)** |
| 📐 **Math & STEM Derivation** | `Ctrl + Shift + 4` | Solves formulas, calculus, and physics step-by-step | **0 ms (None)** |
| 🐞 **Bug Finder & Fix** | `Ctrl + Shift + 5` | Identifies exact logic flaw/edge case and provides fix | **0 ms (None)** |
| 📸 **Queue Screen Capture** | `Ctrl + Alt + S` | Captures screen and queues image without sending | **0 ms (None)** |
| 👻 **Toggle Stealth Mode** | `Ctrl + Shift + G` | Smoothly transitions between Stealth Dock & Normal Window | **0 ms (None)** |
| 👁️ **Show / Hide Clovi** | `Ctrl + Shift + Space` | Instantly toggles Clovi overlay visibility | **0 ms (None)** |

---

## 🚀 Quick Start (Portable Executable)

1. **Download**: Grab the latest **[`Clovi-Portable.exe`](https://github.com/Omkar-Hundre/Clovi/releases/download/v1.0.1/Clovi-Portable.exe)** from GitHub Releases.
2. **Run**: Double click `Clovi-Portable.exe` — **No installation or setup required!**
3. **Configure API Key**: Enter your free [Google Gemini API Key](https://aistudio.google.com/app/apikey) on first launch (stored securely in your local `%APPDATA%`).
4. **Solve Anywhere**: Press `Ctrl + Shift + S` on any screen to solve problems instantly.

---

## 🛠️ Developer Setup & Build

If you want to run from source or build your own binary:

```bash
# 1. Clone the repository
git clone https://github.com/Omkar-Hundre/Clovi.git
cd Clovi

# 2. Install dependencies
npm install

# 3. Start development mode
npm start

# 4. Build standalone Windows portable executable
npm run dist:portable
```

---

## 🏗️ Architecture & Technology Stack

- **Desktop Framework**: Electron 34 with TypeScript
- **Kernel Integration**: Win32 native display affinity (`koffi` / `SetWindowDisplayAffinity`)
- **AI Engine**: Google Gemini 2.5 Flash / Pro Vision API (`@google/genai`)
- **UI Design System**: Vanilla CSS with Gloock Display Serif, Inter Sans, and JetBrains Mono
- **Landing Page**: Static HTML5/CSS3 hosted on Netlify with secure serverless waitlist functions

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.

---

<p align="center">
  Built with ❤️ by <a href="https://omkarhundre.in">Omkar Hundre</a>
</p>

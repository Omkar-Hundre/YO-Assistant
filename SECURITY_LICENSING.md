# 🛡️ Clovi Code Protection, Encryption & Open-Core Model

This document outlines the security architecture, V8 bytecode binary compilation, cryptographic verification, and GitHub repository licensing model for **Clovi**.

---

## 🔒 1. Binary Code Encryption Pipeline

To prevent unauthorized reverse engineering, source code extraction, or tampering by end users, Clovi utilizes a **3-Tier Production Encryption Pipeline**:

### Tier A: Native V8 Machine Bytecode Compilation (`bytenode`)
- During `npm run dist` / `npm run build:encrypt`, all core Electron main process modules (`main.ts`, `windowsOverlay.ts`, `screenCapture.ts`, `geminiService.ts`) are compiled directly into **raw V8 machine bytecode** (`.jsc` files).
- The original `.js` source files are replaced by 2-line loaders.
- **Security Guarantee**: Unpacking the `app.asar` archive yields zero JavaScript source code for the main process. V8 machine bytecode cannot be decompiled back to readable JavaScript source.

### Tier B: Advanced Renderer JS Obfuscation (`javascript-obfuscator`)
- The renderer bundle (`dist/renderer/renderer.js`) is mangled with string splitting, base64 array encoding, dead code injection, and control flow flattening.

### Tier C: Cryptographic Integrity Verification
- Main process verifies ASAR bundle integrity at runtime. Any unauthorized byte modification or file replacement halts process execution immediately.

---

## 🐙 2. GitHub Repository & Open-Core Licensing Strategy

To protect proprietary intellectual property while sharing Clovi safely on GitHub:

1. **Open-Core Model**:
   - The GitHub repository hosts the public open-core interface, build scripts, client wrappers, and documentation.
   - Core stealth Win32 anti-detection hooks and proprietary prompt engineering engines are compiled into signed `.jsc` / `.dll` bytecode assets.

2. **Tamper Prevention & Signature Protection**:
   - Only binaries built via the official build pipeline with authentic cryptographic signatures can communicate with Clovi update servers.
   - Any modified third-party forks will fail official integrity checks.

---

## 🛠️ Build Commands

```bash
# 1. Compile TypeScript source code
npm run build

# 2. Compile to V8 Bytecode (.jsc) & Obfuscate Renderer
npm run build:encrypt

# 3. Build Signed Encrypted Windows Executable
npm run dist:portable
```

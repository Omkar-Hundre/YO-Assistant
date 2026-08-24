const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');

async function obfuscateBuild() {
  console.log('🔒 Starting Clovi Safe Production Code Encryption & Obfuscation...');

  const mainDistDir = path.join(__dirname, '../dist/main');
  const rendererDistDir = path.join(__dirname, '../dist/renderer');

  // 1. Obfuscate Main Process Files cleanly without breaking V8 event loop bindings
  const mainFiles = ['main.js', 'windowsOverlay.js', 'screenCapture.js', 'geminiService.js'];
  for (const file of mainFiles) {
    const jsPath = path.join(mainDistDir, file);
    if (!fs.existsSync(jsPath)) continue;

    console.log(`  🛡️ Encrypting Main Process: ${file}`);
    const rawJs = fs.readFileSync(jsPath, 'utf8');
    const obfuscated = JavaScriptObfuscator.obfuscate(rawJs, {
      compact: true,
      controlFlowFlattening: false,
      deadCodeInjection: false,
      debugProtection: false,
      disableConsoleOutput: false,
      identifierNamesGenerator: 'mangled',
      renameGlobals: false,
      selfDefending: false,
      simplify: true,
      stringArray: true,
      stringArrayEncoding: ['base64'],
      stringArrayThreshold: 0.8
    });
    fs.writeFileSync(jsPath, obfuscated.getObfuscatedCode(), 'utf8');
  }

  // 2. Obfuscate Renderer JS cleanly
  const rendererJsPath = path.join(rendererDistDir, 'renderer.js');
  if (fs.existsSync(rendererJsPath)) {
    console.log('  🛡️ Encrypting Renderer Bundle: renderer.js');
    const rawJs = fs.readFileSync(rendererJsPath, 'utf8');
    const obfuscated = JavaScriptObfuscator.obfuscate(rawJs, {
      compact: true,
      controlFlowFlattening: false,
      deadCodeInjection: false,
      debugProtection: false,
      disableConsoleOutput: false,
      identifierNamesGenerator: 'mangled',
      renameGlobals: false,
      selfDefending: false,
      simplify: true,
      stringArray: true,
      stringArrayEncoding: ['base64'],
      stringArrayThreshold: 0.8
    });
    fs.writeFileSync(rendererJsPath, obfuscated.getObfuscatedCode(), 'utf8');
  }

  console.log('✅ Clovi Production Code Encryption & Obfuscation Complete!');
  process.exit(0);
}

obfuscateBuild().catch((err) => {
  console.error('❌ Encryption Failed:', err);
  process.exit(1);
});

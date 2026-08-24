const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

function pngToIco(pngBuffer) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const dir = Buffer.alloc(16);
  dir.writeUInt8(0, 0); // 256px width (0 = 256)
  dir.writeUInt8(0, 1); // 256px height (0 = 256)
  dir.writeUInt8(0, 2);
  dir.writeUInt8(0, 3);
  dir.writeUInt16LE(1, 4);
  dir.writeUInt16LE(32, 6);
  dir.writeUInt32LE(pngBuffer.length, 8);
  dir.writeUInt32LE(22, 12);

  return Buffer.concat([header, dir, pngBuffer]);
}

app.whenReady().then(async () => {
  const svgContent = `<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="transparent"/>
  <!-- White Rounded Box Container (Squircle) with crisp border -->
  <rect x="40" y="40" width="432" height="432" rx="108" fill="#FFFFFF" stroke="#E4E4E7" stroke-width="8"/>
  <!-- Clovi Text in Dark Obsidian Serif Typography -->
  <text x="256" y="298" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="118" font-weight="bold" fill="#09090b" letter-spacing="-3">Clovi</text>
</svg>`;

  const buildDir = path.join(__dirname, '../build');
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }

  const svgPath = path.join(buildDir, 'icon.svg');
  fs.writeFileSync(svgPath, svgContent);

  // Render SVG in offscreen Chromium window for perfect pixel rendering
  const win = new BrowserWindow({
    width: 512,
    height: 512,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: { offscreen: true }
  });

  const htmlData = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:transparent;overflow:hidden;">${svgContent}</body></html>`;
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlData)}`);

  setTimeout(async () => {
    const img = await win.webContents.capturePage();
    const pngBuffer = img.toPNG();
    const pngPath = path.join(buildDir, 'icon.png');
    fs.writeFileSync(pngPath, pngBuffer);

    const icoBuffer = pngToIco(pngBuffer);
    const icoPath = path.join(buildDir, 'icon.ico');
    fs.writeFileSync(icoPath, icoBuffer);

    console.log(`✅ App icon generated successfully! PNG: ${pngBuffer.length} bytes, ICO: ${icoBuffer.length} bytes.`);
    win.destroy();
    app.quit();
  }, 300);
});

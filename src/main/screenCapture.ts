import { desktopCapturer, screen } from 'electron';

export interface ScreenshotResult {
  dataUrl: string;
  base64: string;
  mimeType: string;
  width: number;
  height: number;
}

/**
 * Capture full screen content seamlessly without changing window focus
 */
export async function captureScreen(): Promise<ScreenshotResult> {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.size;
  const scaleFactor = primaryDisplay.scaleFactor || 1;

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: Math.round(width * scaleFactor),
      height: Math.round(height * scaleFactor)
    }
  });

  if (!sources || sources.length === 0) {
    throw new Error('No screen sources found for capture');
  }

  // Find primary screen or take first
  const source = sources[0];
  const image = source.thumbnail;
  
  // Convert to high quality JPEG for optimal sharpness & Gemini vision accuracy
  const jpegBuffer = image.toJPEG(92);
  const base64 = jpegBuffer.toString('base64');
  const dataUrl = `data:image/jpeg;base64,${base64}`;

  return {
    dataUrl,
    base64,
    mimeType: 'image/jpeg',
    width: image.getSize().width,
    height: image.getSize().height
  };
}

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { renderTextOverlay } from './canvas';

let ffmpeg = null;
let loaded = false;
let loading = null;

export async function getFFmpeg() {
  if (ffmpeg && loaded) return ffmpeg;
  if (loading) return loading;

  loading = (async () => {
    ffmpeg = new FFmpeg();

    ffmpeg.on('log', ({ message }) => {
      console.log('[FFmpeg]', message);
    });

    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    loaded = true;
    loading = null;
    return ffmpeg;
  })();

  return loading;
}

/**
 * Calculate output dimensions: upscale to 1080p preserving aspect ratio.
 * 9:16 portrait (720x1280) → 1080x1920
 * 16:9 landscape (1280x720) → 1920x1080
 */
function getOutputDimensions(inputWidth, inputHeight) {
  const aspect = inputWidth / inputHeight;

  if (aspect < 1) {
    // Portrait (9:16 etc) — short side becomes 1080
    const outW = 1080;
    // Ensure even height
    const outH = Math.round(outW / aspect / 2) * 2;
    return { width: outW, height: outH };
  } else {
    // Landscape (16:9 etc) — long side becomes 1920
    const outW = 1920;
    const outH = Math.round(outW / aspect / 2) * 2;
    return { width: outW, height: outH };
  }
}

/**
 * Render text overlay to a PNG buffer at the INPUT video resolution.
 * No font scaling — the text is rendered exactly as it appears in the preview.
 * FFmpeg will then scale both video + overlay together to 1080p.
 */
function renderTextToPNG(textConfig, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);

  // Render text exactly as the preview does — no font scaling
  renderTextOverlay(ctx, textConfig, width, height);

  const dataURL = canvas.toDataURL('image/png');
  const byteString = atob(dataURL.split(',')[1]);
  const buffer = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) {
    buffer[i] = byteString.charCodeAt(i);
  }
  return buffer;
}

/**
 * Export a video with text overlay and 1080p upscaling.
 * Preserves original aspect ratio (9:16 portrait → 1080x1920).
 */
export async function exportVideo(videoFile, textConfig, onProgress = () => {}, videoMeta = {}) {
  const ff = await getFFmpeg();

  const inputName = 'input' + getExtension(videoFile.name);
  const overlayName = 'overlay.png';
  const outputName = 'output.mp4';

  onProgress({ stage: 'loading', percent: 5 });

  await ff.writeFile(inputName, await fetchFile(videoFile));

  onProgress({ stage: 'processing', percent: 10 });

  // Get actual video dimensions — fall back to 720x1280 (portrait) if unknown
  const inputW = videoMeta.width || 720;
  const inputH = videoMeta.height || 1280;
  const out = getOutputDimensions(inputW, inputH);

  const hasText = textConfig.text && textConfig.text.trim();

  onProgress({ stage: 'encoding', percent: 15 });

  ff.on('progress', ({ progress }) => {
    const pct = Math.max(0, Math.min(1, progress));
    const percent = 15 + Math.round(pct * 80);
    onProgress({ stage: 'encoding', percent: Math.min(percent, 95) });
  });

  let exitCode;

  if (hasText) {
    // Render overlay at INPUT resolution — matches the preview exactly
    const pngData = renderTextToPNG(textConfig, inputW, inputH);
    await ff.writeFile(overlayName, pngData);

    // Composite text onto video FIRST, THEN upscale both together
    // This ensures text proportions match the preview exactly
    exitCode = await ff.exec([
      '-i', inputName,
      '-i', overlayName,
      '-filter_complex',
      `[0:v][1:v]overlay=0:0[comp];[comp]scale=${out.width}:${out.height}:flags=lanczos`,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '18',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'copy',
      '-movflags', '+faststart',
      '-y',
      outputName,
    ]);
  } else {
    exitCode = await ff.exec([
      '-i', inputName,
      '-vf', `scale=${out.width}:${out.height}:flags=lanczos`,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '18',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'copy',
      '-movflags', '+faststart',
      '-y',
      outputName,
    ]);
  }

  if (exitCode !== 0) {
    try { await ff.deleteFile(inputName); } catch (e) { /* */ }
    try { if (hasText) await ff.deleteFile(overlayName); } catch (e) { /* */ }
    throw new Error(`FFmpeg exited with code ${exitCode}. Check console for [FFmpeg] logs.`);
  }

  onProgress({ stage: 'finalizing', percent: 95 });

  const data = await ff.readFile(outputName);

  if (!data || data.length === 0) {
    throw new Error('FFmpeg produced empty output file');
  }

  try { await ff.deleteFile(inputName); } catch (e) { /* */ }
  try { await ff.deleteFile(outputName); } catch (e) { /* */ }
  try { if (hasText) await ff.deleteFile(overlayName); } catch (e) { /* */ }

  onProgress({ stage: 'done', percent: 100 });

  return new Uint8Array(data);
}

function getExtension(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  return '.' + (ext || 'mp4');
}

/**
 * Download a file in the browser — uses File System Access API for reliable saving
 * under COOP/COEP headers, with fallback for unsupported browsers.
 */
export async function downloadFile(data, filename) {
  // Try modern File System Access API (works under COOP/COEP)
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: 'MP4 Video',
          accept: { 'video/mp4': ['.mp4'] },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(new Blob([data], { type: 'video/mp4' }));
      await writable.close();
      return;
    } catch (err) {
      if (err.name === 'AbortError') return; // User cancelled
      console.warn('showSaveFilePicker failed, using fallback:', err);
    }
  }

  // Fallback: blob URL approach
  const blob = new Blob([data], { type: 'video/mp4' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 30000);
}

/**
 * Select a directory using Electron native dialog if available
 */
export async function selectDirectory() {
  if (window.electronAPI?.selectDirectory) {
    return await window.electronAPI.selectDirectory();
  }
  return { success: false };
}

/**
 * Save file using Electron native dialog if available, otherwise download
 */
export async function saveFile(data, filename, directory = null) {
  if (window.electronAPI?.isElectron) {
    const result = await window.electronAPI.saveFile(Array.from(data), filename, directory);
    return result;
  } else {
    await downloadFile(data, filename);
    return { success: true };
  }
}

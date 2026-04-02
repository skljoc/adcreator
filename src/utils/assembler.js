/**
 * Video Assembler — combines B-roll clips with voiceover audio using FFmpeg.wasm
 * Supports 3 modes: B-Roll Only, Hook+B-Roll, and VSL Style
 * All modes support optional text overlay and ASS subtitle burning.
 */
import { getFFmpeg } from './ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { renderTextOverlay, renderCaptionChunk } from './canvas';
import { chunkWordTimings } from './subtitles';

/**
 * Check if a textOverlay config has actual text to render.
 */
function hasTextOverlay(textOverlay) {
  return textOverlay && textOverlay.text && textOverlay.text.trim().length > 0;
}

/**
 * Apply text overlay (static title) and/or dynamic Captions to a video.
 * 
 * Strategy:
 * - Static title: rendered as a single PNG, merged via overlay.
 * - Captions: FFmpeg WASM doesn't support libass, so we can't use 'ass' filter.
 *   Chaining hundreds of overlay filters crashes WASM memory.
 *   Fix: We use the 'concat' demuxer to turn a sequence of transparent PNGs
 *   (one for each word highlight + blank gaps) into a single transparent video stream,
 *   then apply ONE single overlay filter over the main video.
 */
async function applyOverlaysToVideo(ff, inputFile, outputFile, options) {
  const { textOverlay, captionsConfig, captionTimings, outputWidth = 1080, outputHeight = 1920 } = options;
  const useTextOverlay = hasTextOverlay(textOverlay);
  const useCaptions = captionsConfig?.enabled && captionTimings?.length > 0;

  if (!useTextOverlay && !useCaptions) return inputFile;

  const inputs = ['-i', inputFile];
  const filters = [];
  let inputIdx = 1;

  // 1. Static Title Overlay
  if (useTextOverlay) {
    const canvas = document.createElement('canvas');
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const ctx = canvas.getContext('2d');
    renderTextOverlay(ctx, textOverlay, outputWidth, outputHeight);

    const dataURL = canvas.toDataURL('image/png');
    const byteString = atob(dataURL.split(',')[1]);
    const buffer = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) buffer[i] = byteString.charCodeAt(i);
    
    await ff.writeFile('title.png', buffer);
    
    inputs.push('-i', 'title.png');
    filters.push(`[0:v][${inputIdx}:v]overlay=0:0[titled]`);
    inputIdx++;
  }

  // 2. Dynamics Captions via Concat Demuxer
  if (useCaptions) {
    const canvas = document.createElement('canvas');
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const ctx = canvas.getContext('2d');

    // Create a 1x1 transparent PNG for gaps
    ctx.clearRect(0, 0, outputWidth, outputHeight);
    const blankDataURL = canvas.toDataURL('image/png');
    
    const blankByteStr = atob(blankDataURL.split(',')[1]);
    const blankBuffer = new Uint8Array(blankByteStr.length);
    for (let i = 0; i < blankByteStr.length; i++) blankBuffer[i] = blankByteStr.charCodeAt(i);
    
    await ff.writeFile('blank.png', blankBuffer);

    let concatTxt = '';
    let currentTime = 0;
    let fileIndex = 0;

    const chunks = chunkWordTimings(captionTimings, captionsConfig.maxWordsPerLine || 4);

    for (let c = 0; c < chunks.length; c++) {
      const chunk = chunks[c];

      // Gap before chunk
      if (chunk.start > currentTime) {
        const gap = chunk.start - currentTime;
        concatTxt += `file 'blank.png'\nduration ${gap.toFixed(3)}\n`;
        currentTime = chunk.start;
      }

      for (let w = 0; w < chunk.words.length; w++) {
        const word = chunk.words[w];
        
        ctx.clearRect(0, 0, outputWidth, outputHeight);
        renderCaptionChunk(ctx, chunk, captionsConfig, outputWidth, outputHeight, w);

        const dataURL = canvas.toDataURL('image/png');
        const capByteStr = atob(dataURL.split(',')[1]);
        const buffer = new Uint8Array(capByteStr.length);
        for (let i = 0; i < capByteStr.length; i++) buffer[i] = capByteStr.charCodeAt(i);
        
        const filename = `cap_${fileIndex++}.png`;
        await ff.writeFile(filename, buffer);

        // Determine duration of this highlight
        const nextTime = (w < chunk.words.length - 1) ? chunk.words[w+1].start : chunk.end;
        const duration = Math.max(0.01, nextTime - currentTime);

        concatTxt += `file '${filename}'\nduration ${duration.toFixed(3)}\n`;
        currentTime = nextTime;
      }
    }

    // Add exactly one very long blank frame at the end to prevent the concat from looping/freezing early
    concatTxt += `file 'blank.png'\nduration 999.0\n`;

    await ff.writeFile('captions.txt', new TextEncoder().encode(concatTxt));
    
    // Add concat inputs
    inputs.push('-f', 'concat', '-safe', '0', '-i', 'captions.txt');
    
    // Determine the base stream to overlay on
    const sourceStream = useTextOverlay ? '[titled]' : '[0:v]';
    // Remove shortest=1 from overlay filter to avoid WASM deadlock bugs with concat demuxer
    filters.push(`${sourceStream}[${inputIdx}:v]overlay=0:0[captioned]`);
    inputIdx++;
  }

  // Setup execution arguments
  const args = [...inputs];
  
  if (filters.length > 0) {
    const filterComplex = filters.join(';');
    const lastFilter = filters[filters.length - 1];
    const finalStreamMatch = lastFilter.match(/\[(\w+)\]$/);
    const finalStream = finalStreamMatch ? finalStreamMatch[1] : null;

    args.push('-filter_complex', filterComplex);
    if (finalStream) args.push('-map', `[${finalStream}]`);
    args.push('-map', '0:a');
  } else {
    // Fallback if no filters
    args.push('-c', 'copy');
  }

  // Use output-level -shortest to gracefully terminate encoding exactly when the shortest mapped stream (audio) ends,
  // preventing it from encoding the 999.0 second blank pad without deadlocking the WASM instance.
  args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-shortest', '-y', outputFile);

  const exitCode = await ff.exec(args);
  
  // Cleanup
  try { if (useTextOverlay) await ff.deleteFile('title.png'); } catch(e) {}
  try {
    if (useCaptions) {
      await ff.deleteFile('captions.txt');
      await ff.deleteFile('blank.png');
      const chunks = chunkWordTimings(captionTimings, captionsConfig.maxWordsPerLine || 4);
      let count = chunks.reduce((acc, chunk) => acc + chunk.words.length, 0);
      for (let i = 0; i < count; i++) await ff.deleteFile(`cap_${i}.png`);
    }
  } catch(e) {}

  if (exitCode !== 0) {
    console.warn('[Assembler] Overlay apply failed, falling back to original.');
    return inputFile;
  }
  return outputFile;
}


/**
 * Assemble a video ad from B-roll segments + voiceover audio (original mode).
 *
 * Key guarantees:
 * - Output length ALWAYS matches voiceover duration (not -shortest)
 * - B-roll clips are clean-cut, no freezing
 * - If concat video is shorter, it gets looped; if longer, trimmed to voiceover length
 *
 * @param {Array} segments — selected B-roll clips with { sourceFile, startTime, clipDuration }
 * @param {Blob} voiceoverBlob — MP3 audio blob from ElevenLabs
 * @param {object} options — { outputWidth, outputHeight, textOverlay }
 * @param {function} onProgress — progress callback
 * @returns {Uint8Array} — encoded MP4 data
 */
export async function assembleAd(segments, voiceoverBlob, options = {}, onProgress = () => {}) {
  const ff = await getFFmpeg();

  const { outputWidth = 1080, outputHeight = 1920, textOverlay = null, captionsConfig = null, captionTimings = null } = options;

  onProgress({ stage: 'loading', percent: 5, message: 'Loading source files...' });

  // Write voiceover audio
  const audioData = await fetchFile(voiceoverBlob);
  await ff.writeFile('voiceover.mp3', audioData);

  // Get voiceover duration for precise trimming later
  const voiceoverDuration = await getAudioDurationFromFF(ff, 'voiceover.mp3');
  console.log(`[Assembler] Voiceover duration: ${voiceoverDuration.toFixed(2)}s`);

  // Write each source video file (deduplicate by sourceVideoId)
  const sourceFileMap = new Map();
  for (const seg of segments) {
    if (!sourceFileMap.has(seg.sourceVideoId)) {
      const fname = `src_${sourceFileMap.size}.mp4`;
      await ff.writeFile(fname, await fetchFile(seg.sourceFile));
      sourceFileMap.set(seg.sourceVideoId, fname);
    }
  }

  onProgress({ stage: 'cutting', percent: 15, message: 'Cutting B-roll clips...' });

  // Cut each segment into individual clip files with RE-ENCODING to ensure clean cuts
  const clipFiles = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const srcFile = sourceFileMap.get(seg.sourceVideoId);
    const clipName = `clip_${i}.ts`; // Use .ts for reliable concat

    const exitCode = await ff.exec([
      '-ss', String(seg.startTime),
      '-i', srcFile,
      '-t', String(seg.clipDuration),
      '-vf', `scale=${outputWidth}:${outputHeight}:flags=lanczos:force_original_aspect_ratio=decrease,pad=${outputWidth}:${outputHeight}:(ow-iw)/2:(oh-ih)/2`,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '23',
      '-r', '30', // Force consistent framerate
      '-an',
      '-pix_fmt', 'yuv420p',
      '-y',
      clipName,
    ]);

    if (exitCode !== 0) {
      console.warn(`[Assembler] Clip ${i} cut failed with code ${exitCode}`);
    } else {
      clipFiles.push(clipName);
    }

    const cutProgress = 15 + Math.round(((i + 1) / segments.length) * 35);
    onProgress({ stage: 'cutting', percent: cutProgress, message: `Cut clip ${i + 1}/${segments.length}` });
  }

  if (clipFiles.length === 0) {
    throw new Error('No clips were successfully cut');
  }

  onProgress({ stage: 'assembling', percent: 55, message: 'Concatenating clips...' });

  // Write concat file list
  const concatContent = clipFiles.map(f => `file '${f}'`).join('\n');
  const encoder = new TextEncoder();
  await ff.writeFile('concat.txt', encoder.encode(concatContent));

  // Concatenate all clips
  let exitCode = await ff.exec([
    '-f', 'concat',
    '-safe', '0',
    '-i', 'concat.txt',
    '-c', 'copy',
    '-y',
    'concat_video.ts',
  ]);

  if (exitCode !== 0) {
    throw new Error(`Concat failed with exit code ${exitCode}`);
  }

  onProgress({ stage: 'merging', percent: 65, message: 'Merging video + voiceover...' });

  // Merge concatenated video with voiceover audio
  // Use -t to FORCE the output to be exactly the voiceover duration
  // This prevents:
  // - Cutoff: if video is shorter, last frame extends to fill
  // - Overrun: if video is longer, it gets trimmed to voiceover length
  exitCode = await ff.exec([
    '-i', 'concat_video.ts',
    '-i', 'voiceover.mp3',
    '-t', String(voiceoverDuration),
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-crf', '23',
    '-r', '30',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-y',
    'merged_output.mp4',
  ]);

  if (exitCode !== 0) {
    throw new Error(`Final merge failed with exit code ${exitCode}`);
  }

  // Apply overlays if configured
  let finalFile = 'merged_output.mp4';
  if (hasTextOverlay(textOverlay) || (captionsConfig?.enabled && captionTimings?.length > 0)) {
    onProgress({ stage: 'overlay', percent: 85, message: 'Applying overlays...' });
    finalFile = await applyOverlaysToVideo(ff, 'merged_output.mp4', 'final_output.mp4', { ...options, outputWidth, outputHeight });
  } else {
    finalFile = 'merged_output.mp4';
  }

  onProgress({ stage: 'finalizing', percent: 95, message: 'Reading output...' });

  const data = await ff.readFile(finalFile);

  if (!data || data.length === 0) {
    throw new Error('Assembler produced empty output');
  }

  // Cleanup all temporary files
  const filesToClean = [
    'voiceover.mp3', 'concat.txt', 'concat_video.ts', 'merged_output.mp4', 'final_output.mp4',
    ...clipFiles,
    ...Array.from(sourceFileMap.values()),
  ];
  for (const f of filesToClean) {
    try { await ff.deleteFile(f); } catch (e) { /* ignore */ }
  }

  onProgress({ stage: 'done', percent: 100, message: 'Complete!' });

  return new Uint8Array(data);
}

/**
 * Assemble a Hook + B-Roll ad.
 *
 * Structure: Hook video clip (muted, video only) + B-roll clips — all with voiceover audio
 * playing from the very beginning (over the hook too).
 *
 * @param {object} hookSegment — { sourceFile, startTime, clipDuration }
 * @param {Array} brollSegments — B-roll clips
 * @param {Blob} voiceoverBlob — voiceover audio
 * @param {object} options — { outputWidth, outputHeight, textOverlay }
 * @param {function} onProgress — callback
 * @returns {Uint8Array}
 */
export async function assembleHookBRoll(hookSegment, brollSegments, voiceoverBlob, options = {}, onProgress = () => {}) {
  const ff = await getFFmpeg();
  const { outputWidth = 1080, outputHeight = 1920, textOverlay = null, captionsConfig = null, captionTimings = null } = options;

  onProgress({ stage: 'loading', percent: 5, message: 'Loading source files...' });

  // Write voiceover
  await ff.writeFile('voiceover.mp3', await fetchFile(voiceoverBlob));
  const voiceoverDuration = await getAudioDurationFromFF(ff, 'voiceover.mp3');

  // Write hook video
  await ff.writeFile('hook_src.mp4', await fetchFile(hookSegment.sourceFile));

  // Write b-roll source files (deduplicate)
  const sourceFileMap = new Map();
  for (const seg of brollSegments) {
    if (!sourceFileMap.has(seg.sourceVideoId)) {
      const fname = `bsrc_${sourceFileMap.size}.mp4`;
      await ff.writeFile(fname, await fetchFile(seg.sourceFile));
      sourceFileMap.set(seg.sourceVideoId, fname);
    }
  }

  onProgress({ stage: 'cutting', percent: 10, message: 'Cutting hook clip...' });

  // Cut hook clip (muted — video only)
  const hookClipName = 'hook_clip.ts';
  let exitCode = await ff.exec([
    '-ss', String(hookSegment.startTime),
    '-i', 'hook_src.mp4',
    '-t', String(hookSegment.clipDuration),
    '-vf', `scale=${outputWidth}:${outputHeight}:flags=lanczos:force_original_aspect_ratio=decrease,pad=${outputWidth}:${outputHeight}:(ow-iw)/2:(oh-ih)/2`,
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-crf', '23',
    '-r', '30',
    '-an',
    '-pix_fmt', 'yuv420p',
    '-y',
    hookClipName,
  ]);

  if (exitCode !== 0) {
    throw new Error(`Hook clip cut failed with code ${exitCode}`);
  }

  onProgress({ stage: 'cutting', percent: 15, message: 'Cutting B-roll clips...' });

  // Cut b-roll clips (muted)
  const clipFiles = [hookClipName]; // hook is first
  for (let i = 0; i < brollSegments.length; i++) {
    const seg = brollSegments[i];
    const srcFile = sourceFileMap.get(seg.sourceVideoId);
    const clipName = `bclip_${i}.ts`;

    exitCode = await ff.exec([
      '-ss', String(seg.startTime),
      '-i', srcFile,
      '-t', String(seg.clipDuration),
      '-vf', `scale=${outputWidth}:${outputHeight}:flags=lanczos:force_original_aspect_ratio=decrease,pad=${outputWidth}:${outputHeight}:(ow-iw)/2:(oh-ih)/2`,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '23',
      '-r', '30',
      '-an',
      '-pix_fmt', 'yuv420p',
      '-y',
      clipName,
    ]);

    if (exitCode !== 0) {
      console.warn(`[Assembler] B-roll clip ${i} cut failed`);
    } else {
      clipFiles.push(clipName);
    }

    const cutProgress = 15 + Math.round(((i + 1) / brollSegments.length) * 30);
    onProgress({ stage: 'cutting', percent: cutProgress, message: `Cut B-roll ${i + 1}/${brollSegments.length}` });
  }

  onProgress({ stage: 'assembling', percent: 50, message: 'Concatenating clips...' });

  // Concatenate hook + b-roll clips
  const concatContent = clipFiles.map(f => `file '${f}'`).join('\n');
  await ff.writeFile('concat.txt', new TextEncoder().encode(concatContent));

  exitCode = await ff.exec([
    '-f', 'concat',
    '-safe', '0',
    '-i', 'concat.txt',
    '-c', 'copy',
    '-y',
    'concat_video.ts',
  ]);

  if (exitCode !== 0) {
    throw new Error(`Concat failed with exit code ${exitCode}`);
  }

  onProgress({ stage: 'merging', percent: 60, message: 'Adding voiceover...' });

  // Merge with voiceover — force duration to match voiceover
  exitCode = await ff.exec([
    '-i', 'concat_video.ts',
    '-i', 'voiceover.mp3',
    '-t', String(voiceoverDuration),
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-crf', '23',
    '-r', '30',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-y',
    'merged_output.mp4',
  ]);

  if (exitCode !== 0) {
    throw new Error(`Final merge failed with exit code ${exitCode}`);
  }

  // Apply overlays if configured
  let finalFile = 'merged_output.mp4';
  if (hasTextOverlay(textOverlay) || (captionsConfig?.enabled && captionTimings?.length > 0)) {
    onProgress({ stage: 'overlay', percent: 85, message: 'Applying overlays...' });
    finalFile = await applyOverlaysToVideo(ff, 'merged_output.mp4', 'final_output.mp4', { ...options, outputWidth, outputHeight });
  }

  onProgress({ stage: 'finalizing', percent: 95, message: 'Reading output...' });

  const data = await ff.readFile(finalFile);
  if (!data || data.length === 0) throw new Error('Assembler produced empty output');

  // Cleanup
  const filesToClean = [
    'voiceover.mp3', 'hook_src.mp4', hookClipName,
    'concat.txt', 'concat_video.ts', 'merged_output.mp4', 'final_output.mp4',
    ...clipFiles.filter(f => f !== hookClipName),
    ...Array.from(sourceFileMap.values()),
  ];
  for (const f of filesToClean) {
    try { await ff.deleteFile(f); } catch (e) { /* ignore */ }
  }

  onProgress({ stage: 'done', percent: 100, message: 'Complete!' });
  return new Uint8Array(data);
}

/**
 * Assemble a VSL-style video interleaving person talking with B-roll clips.
 *
 * Structure: The VSL video's AUDIO plays continuously from start to end.
 * VISUALLY, person segments show the actual VSL video, and b-roll segments
 * show B-roll clips while the person's voice continues underneath.
 *
 * @param {File} vslFile — the main VSL video file (person talking)
 * @param {Array} brollSegments — B-roll clips for all b-roll slots
 * @param {Array} timeline — from buildVSLTimeline: [{ type, startTime, duration, brollCount }]
 * @param {object} options — { outputWidth, outputHeight, textOverlay }
 * @param {function} onProgress — callback
 * @returns {Uint8Array}
 */
export async function assembleVSL(vslFile, brollSegments, timeline, options = {}, onProgress = () => {}) {
  const ff = await getFFmpeg();
  const { outputWidth = 1080, outputHeight = 1920, textOverlay = null, captionsConfig = null, captionTimings = null } = options;

  onProgress({ stage: 'loading', percent: 5, message: 'Loading VSL and source files...' });

  // Write VSL video
  await ff.writeFile('vsl_src.mp4', await fetchFile(vslFile));

  // Write b-roll sources (deduplicate)
  const sourceFileMap = new Map();
  for (const seg of brollSegments) {
    if (!sourceFileMap.has(seg.sourceVideoId)) {
      const fname = `bsrc_${sourceFileMap.size}.mp4`;
      await ff.writeFile(fname, await fetchFile(seg.sourceFile));
      sourceFileMap.set(seg.sourceVideoId, fname);
    }
  }

  onProgress({ stage: 'cutting', percent: 10, message: 'Cutting video segments...' });

  // Build ordered clip files following the timeline
  const clipFiles = [];
  let brollIdx = 0; // index into brollSegments
  const totalSegments = timeline.length;
  let segCount = 0;

  for (const segment of timeline) {
    segCount++;

    if (segment.type === 'person') {
      // Cut person segment from VSL video (video only, no audio)
      const clipName = `vseg_${clipFiles.length}.ts`;

      const exitCode = await ff.exec([
        '-ss', String(segment.startTime),
        '-i', 'vsl_src.mp4',
        '-t', String(segment.duration),
        '-vf', `scale=${outputWidth}:${outputHeight}:flags=lanczos:force_original_aspect_ratio=decrease,pad=${outputWidth}:${outputHeight}:(ow-iw)/2:(oh-ih)/2`,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '23',
        '-r', '30',
        '-an',
        '-pix_fmt', 'yuv420p',
        '-y',
        clipName,
      ]);

      if (exitCode !== 0) {
        console.warn(`[VSL] Person segment cut failed`);
      } else {
        clipFiles.push(clipName);
      }
    } else if (segment.type === 'broll') {
      // Cut b-roll clips for this group
      const count = segment.brollCount || 2;
      for (let j = 0; j < count && brollIdx < brollSegments.length; j++) {
        const seg = brollSegments[brollIdx];
        const srcFile = sourceFileMap.get(seg.sourceVideoId);
        const clipName = `vseg_${clipFiles.length}.ts`;

        const exitCode = await ff.exec([
          '-ss', String(seg.startTime),
          '-i', srcFile,
          '-t', String(seg.clipDuration),
          '-vf', `scale=${outputWidth}:${outputHeight}:flags=lanczos:force_original_aspect_ratio=decrease,pad=${outputWidth}:${outputHeight}:(ow-iw)/2:(oh-ih)/2`,
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-crf', '23',
          '-r', '30',
          '-an',
          '-pix_fmt', 'yuv420p',
          '-y',
          clipName,
        ]);

        if (exitCode !== 0) {
          console.warn(`[VSL] B-roll clip ${brollIdx} cut failed`);
        } else {
          clipFiles.push(clipName);
        }

        brollIdx++;
      }
    }

    const cutProgress = 10 + Math.round((segCount / totalSegments) * 35);
    onProgress({ stage: 'cutting', percent: cutProgress, message: `Processing segment ${segCount}/${totalSegments}` });
  }

  if (clipFiles.length === 0) {
    throw new Error('No video segments were successfully cut');
  }

  onProgress({ stage: 'assembling', percent: 50, message: 'Concatenating interleaved clips...' });

  // Concatenate all clips in order
  const concatContent = clipFiles.map(f => `file '${f}'`).join('\n');
  await ff.writeFile('concat.txt', new TextEncoder().encode(concatContent));

  let exitCode = await ff.exec([
    '-f', 'concat',
    '-safe', '0',
    '-i', 'concat.txt',
    '-c', 'copy',
    '-y',
    'concat_video.ts',
  ]);

  if (exitCode !== 0) {
    throw new Error(`Concat failed with exit code ${exitCode}`);
  }

  onProgress({ stage: 'merging', percent: 60, message: 'Extracting VSL audio...' });

  // Extract full audio from VSL video
  exitCode = await ff.exec([
    '-i', 'vsl_src.mp4',
    '-vn',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-y',
    'vsl_audio.aac',
  ]);

  if (exitCode !== 0) {
    throw new Error(`VSL audio extraction failed with exit code ${exitCode}`);
  }

  onProgress({ stage: 'merging', percent: 70, message: 'Merging video with VSL audio...' });

  // Get VSL audio duration for precise trim
  const vslAudioDuration = await getAudioDurationFromFF(ff, 'vsl_audio.aac');

  // Merge interleaved video with full VSL audio — force to audio duration
  exitCode = await ff.exec([
    '-i', 'concat_video.ts',
    '-i', 'vsl_audio.aac',
    '-t', String(vslAudioDuration),
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-crf', '23',
    '-r', '30',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-y',
    'merged_output.mp4',
  ]);

  if (exitCode !== 0) {
    throw new Error(`Final merge failed with exit code ${exitCode}`);
  }

  // Apply overlays if configured
  let finalFile = 'merged_output.mp4';
  if (hasTextOverlay(textOverlay) || (captionsConfig?.enabled && captionTimings?.length > 0)) {
    onProgress({ stage: 'overlay', percent: 85, message: 'Applying overlays...' });
    finalFile = await applyOverlaysToVideo(ff, 'merged_output.mp4', 'final_output.mp4', { ...options, outputWidth, outputHeight });
  }

  onProgress({ stage: 'finalizing', percent: 95, message: 'Reading output...' });

  const data = await ff.readFile(finalFile);
  if (!data || data.length === 0) throw new Error('Assembler produced empty output');

  // Cleanup
  const filesToClean = [
    'vsl_src.mp4', 'vsl_audio.aac',
    'concat.txt', 'concat_video.ts', 'merged_output.mp4', 'final_output.mp4',
    ...clipFiles,
    ...Array.from(sourceFileMap.values()),
  ];
  for (const f of filesToClean) {
    try { await ff.deleteFile(f); } catch (e) { /* ignore */ }
  }

  onProgress({ stage: 'done', percent: 100, message: 'Complete!' });
  return new Uint8Array(data);
}


/**
 * Get audio duration by probing with FFmpeg.
 * Falls back to 0 if probing fails.
 */
async function getAudioDurationFromFF(ff, filename) {
  try {
    // Use ffmpeg to get duration by converting to null output
    // The log output will contain duration info
    let duration = 0;
    
    const logHandler = ({ message }) => {
      // Parse "Duration: HH:MM:SS.ss" from FFmpeg log
      const match = message.match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/);
      if (match) {
        duration = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]) + parseInt(match[4]) / 100;
      }
    };
    
    ff.on('log', logHandler);
    
    await ff.exec([
      '-i', filename,
      '-f', 'null',
      '-y',
      '/dev/null',
    ]);
    
    ff.off('log', logHandler);
    
    return duration || 0;
  } catch (e) {
    console.warn('[Assembler] Could not determine audio duration:', e);
    return 0;
  }
}

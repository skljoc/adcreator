/**
 * Video Assembler — combines B-roll clips with voiceover audio using FFmpeg.wasm
 * Supports 3 modes: B-Roll Only, Hook+B-Roll, and VSL Style
 */
import { getFFmpeg } from './ffmpeg';
import { fetchFile } from '@ffmpeg/util';

/**
 * Assemble a video ad from B-roll segments + voiceover audio (original mode).
 *
 * @param {Array} segments — selected B-roll clips with { sourceFile, startTime, clipDuration }
 * @param {Blob} voiceoverBlob — MP3 audio blob from ElevenLabs
 * @param {object} options — { outputWidth, outputHeight }
 * @param {function} onProgress — progress callback
 * @returns {Uint8Array} — encoded MP4 data
 */
export async function assembleAd(segments, voiceoverBlob, options = {}, onProgress = () => {}) {
  const ff = await getFFmpeg();

  const { outputWidth = 1080, outputHeight = 1920 } = options;

  onProgress({ stage: 'loading', percent: 5, message: 'Loading source files...' });

  // Write voiceover audio
  const audioData = await fetchFile(voiceoverBlob);
  await ff.writeFile('voiceover.mp3', audioData);

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

  // Cut each segment into individual clip files
  const clipFiles = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const srcFile = sourceFileMap.get(seg.sourceVideoId);
    const clipName = `clip_${i}.mp4`;

    const exitCode = await ff.exec([
      '-ss', String(seg.startTime),
      '-i', srcFile,
      '-t', String(seg.clipDuration),
      '-vf', `scale=${outputWidth}:${outputHeight}:flags=lanczos:force_original_aspect_ratio=decrease,pad=${outputWidth}:${outputHeight}:(ow-iw)/2:(oh-ih)/2`,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '23',
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

    const cutProgress = 15 + Math.round(((i + 1) / segments.length) * 40);
    onProgress({ stage: 'cutting', percent: cutProgress, message: `Cut clip ${i + 1}/${segments.length}` });
  }

  if (clipFiles.length === 0) {
    throw new Error('No clips were successfully cut');
  }

  onProgress({ stage: 'assembling', percent: 60, message: 'Concatenating clips...' });

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
    'concat_video.mp4',
  ]);

  if (exitCode !== 0) {
    throw new Error(`Concat failed with exit code ${exitCode}`);
  }

  onProgress({ stage: 'merging', percent: 75, message: 'Merging video + voiceover...' });

  // Merge concatenated video with voiceover audio
  ff.on('progress', ({ progress }) => {
    const pct = Math.max(0, Math.min(1, progress));
    const percent = 75 + Math.round(pct * 20);
    onProgress({ stage: 'merging', percent: Math.min(percent, 95), message: 'Encoding final video...' });
  });

  exitCode = await ff.exec([
    '-i', 'concat_video.mp4',
    '-i', 'voiceover.mp3',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-shortest',
    '-movflags', '+faststart',
    '-y',
    'final_output.mp4',
  ]);

  if (exitCode !== 0) {
    throw new Error(`Final merge failed with exit code ${exitCode}`);
  }

  onProgress({ stage: 'finalizing', percent: 95, message: 'Reading output...' });

  const data = await ff.readFile('final_output.mp4');

  if (!data || data.length === 0) {
    throw new Error('Assembler produced empty output');
  }

  // Cleanup all temporary files
  const filesToClean = [
    'voiceover.mp3', 'concat.txt', 'concat_video.mp4', 'final_output.mp4',
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
 * @param {object} options — { outputWidth, outputHeight }
 * @param {function} onProgress — callback
 * @returns {Uint8Array}
 */
export async function assembleHookBRoll(hookSegment, brollSegments, voiceoverBlob, options = {}, onProgress = () => {}) {
  const ff = await getFFmpeg();
  const { outputWidth = 1080, outputHeight = 1920 } = options;

  onProgress({ stage: 'loading', percent: 5, message: 'Loading source files...' });

  // Write voiceover
  await ff.writeFile('voiceover.mp3', await fetchFile(voiceoverBlob));

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
  const hookClipName = 'hook_clip.mp4';
  let exitCode = await ff.exec([
    '-ss', String(hookSegment.startTime),
    '-i', 'hook_src.mp4',
    '-t', String(hookSegment.clipDuration),
    '-vf', `scale=${outputWidth}:${outputHeight}:flags=lanczos:force_original_aspect_ratio=decrease,pad=${outputWidth}:${outputHeight}:(ow-iw)/2:(oh-ih)/2`,
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-crf', '23',
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
    const clipName = `bclip_${i}.mp4`;

    exitCode = await ff.exec([
      '-ss', String(seg.startTime),
      '-i', srcFile,
      '-t', String(seg.clipDuration),
      '-vf', `scale=${outputWidth}:${outputHeight}:flags=lanczos:force_original_aspect_ratio=decrease,pad=${outputWidth}:${outputHeight}:(ow-iw)/2:(oh-ih)/2`,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '23',
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

    const cutProgress = 15 + Math.round(((i + 1) / brollSegments.length) * 35);
    onProgress({ stage: 'cutting', percent: cutProgress, message: `Cut B-roll ${i + 1}/${brollSegments.length}` });
  }

  onProgress({ stage: 'assembling', percent: 55, message: 'Concatenating clips...' });

  // Concatenate hook + b-roll clips
  const concatContent = clipFiles.map(f => `file '${f}'`).join('\n');
  await ff.writeFile('concat.txt', new TextEncoder().encode(concatContent));

  exitCode = await ff.exec([
    '-f', 'concat',
    '-safe', '0',
    '-i', 'concat.txt',
    '-c', 'copy',
    '-y',
    'concat_video.mp4',
  ]);

  if (exitCode !== 0) {
    throw new Error(`Concat failed with exit code ${exitCode}`);
  }

  onProgress({ stage: 'merging', percent: 70, message: 'Adding voiceover...' });

  // Merge with voiceover (plays from the very beginning, over the hook)
  ff.on('progress', ({ progress }) => {
    const pct = Math.max(0, Math.min(1, progress));
    onProgress({ stage: 'merging', percent: 70 + Math.round(pct * 25), message: 'Encoding final video...' });
  });

  exitCode = await ff.exec([
    '-i', 'concat_video.mp4',
    '-i', 'voiceover.mp3',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-shortest',
    '-movflags', '+faststart',
    '-y',
    'final_output.mp4',
  ]);

  if (exitCode !== 0) {
    throw new Error(`Final merge failed with exit code ${exitCode}`);
  }

  onProgress({ stage: 'finalizing', percent: 95, message: 'Reading output...' });

  const data = await ff.readFile('final_output.mp4');
  if (!data || data.length === 0) throw new Error('Assembler produced empty output');

  // Cleanup
  const filesToClean = [
    'voiceover.mp3', 'hook_src.mp4', hookClipName,
    'concat.txt', 'concat_video.mp4', 'final_output.mp4',
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
 * @param {object} options — { outputWidth, outputHeight }
 * @param {function} onProgress — callback
 * @returns {Uint8Array}
 */
export async function assembleVSL(vslFile, brollSegments, timeline, options = {}, onProgress = () => {}) {
  const ff = await getFFmpeg();
  const { outputWidth = 1080, outputHeight = 1920 } = options;

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
      const clipName = `vseg_${clipFiles.length}.mp4`;

      const exitCode = await ff.exec([
        '-ss', String(segment.startTime),
        '-i', 'vsl_src.mp4',
        '-t', String(segment.duration),
        '-vf', `scale=${outputWidth}:${outputHeight}:flags=lanczos:force_original_aspect_ratio=decrease,pad=${outputWidth}:${outputHeight}:(ow-iw)/2:(oh-ih)/2`,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '23',
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
        const clipName = `vseg_${clipFiles.length}.mp4`;

        const exitCode = await ff.exec([
          '-ss', String(seg.startTime),
          '-i', srcFile,
          '-t', String(seg.clipDuration),
          '-vf', `scale=${outputWidth}:${outputHeight}:flags=lanczos:force_original_aspect_ratio=decrease,pad=${outputWidth}:${outputHeight}:(ow-iw)/2:(oh-ih)/2`,
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-crf', '23',
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

    const cutProgress = 10 + Math.round((segCount / totalSegments) * 40);
    onProgress({ stage: 'cutting', percent: cutProgress, message: `Processing segment ${segCount}/${totalSegments}` });
  }

  if (clipFiles.length === 0) {
    throw new Error('No video segments were successfully cut');
  }

  onProgress({ stage: 'assembling', percent: 55, message: 'Concatenating interleaved clips...' });

  // Concatenate all clips in order
  const concatContent = clipFiles.map(f => `file '${f}'`).join('\n');
  await ff.writeFile('concat.txt', new TextEncoder().encode(concatContent));

  let exitCode = await ff.exec([
    '-f', 'concat',
    '-safe', '0',
    '-i', 'concat.txt',
    '-c', 'copy',
    '-y',
    'concat_video.mp4',
  ]);

  if (exitCode !== 0) {
    throw new Error(`Concat failed with exit code ${exitCode}`);
  }

  onProgress({ stage: 'merging', percent: 65, message: 'Extracting VSL audio...' });

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

  onProgress({ stage: 'merging', percent: 75, message: 'Merging video with VSL audio...' });

  // Merge interleaved video with full VSL audio (audio plays continuously)
  ff.on('progress', ({ progress }) => {
    const pct = Math.max(0, Math.min(1, progress));
    onProgress({ stage: 'merging', percent: 75 + Math.round(pct * 20), message: 'Encoding final video...' });
  });

  exitCode = await ff.exec([
    '-i', 'concat_video.mp4',
    '-i', 'vsl_audio.aac',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-shortest',
    '-movflags', '+faststart',
    '-y',
    'final_output.mp4',
  ]);

  if (exitCode !== 0) {
    throw new Error(`Final merge failed with exit code ${exitCode}`);
  }

  onProgress({ stage: 'finalizing', percent: 95, message: 'Reading output...' });

  const data = await ff.readFile('final_output.mp4');
  if (!data || data.length === 0) throw new Error('Assembler produced empty output');

  // Cleanup
  const filesToClean = [
    'vsl_src.mp4', 'vsl_audio.aac',
    'concat.txt', 'concat_video.mp4', 'final_output.mp4',
    ...clipFiles,
    ...Array.from(sourceFileMap.values()),
  ];
  for (const f of filesToClean) {
    try { await ff.deleteFile(f); } catch (e) { /* ignore */ }
  }

  onProgress({ stage: 'done', percent: 100, message: 'Complete!' });
  return new Uint8Array(data);
}

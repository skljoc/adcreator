/**
 * Smart B-Roll Scene Detection
 * Samples frames from a video and detects scene boundaries
 * by comparing consecutive frames' pixel differences.
 */

const SAMPLE_INTERVAL = 0.5; // seconds between frame samples
const SCENE_THRESHOLD = 25;  // average pixel difference to consider a scene change (0-255)
const MIN_SCENE_DURATION = 1.0; // minimum usable scene duration in seconds
const SAMPLE_SIZE = 64; // thumbnail size for comparison (64x64)

/**
 * Analyze a video file for scene boundaries.
 * Returns array of { startTime, endTime, duration }
 */
export async function detectScenes(videoFile, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const url = typeof videoFile === 'string' ? videoFile : URL.createObjectURL(videoFile);
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.crossOrigin = 'anonymous';

    const canvas = document.createElement('canvas');
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    let prevFrameData = null;
    let sceneBoundaries = [0]; // always start at 0
    let currentTime = 0;
    let totalDuration = 0;
    let samplesProcessed = 0;

    video.onloadedmetadata = () => {
      totalDuration = video.duration;
      video.currentTime = 0;
    };

    video.onseeked = () => {
      // Capture frame
      ctx.drawImage(video, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
      const frameData = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;

      if (prevFrameData) {
        const diff = compareFrames(prevFrameData, frameData);
        if (diff > SCENE_THRESHOLD) {
          sceneBoundaries.push(currentTime);
        }
      }

      prevFrameData = new Uint8ClampedArray(frameData);
      samplesProcessed++;

      const progress = totalDuration > 0 ? currentTime / totalDuration : 0;
      onProgress(Math.min(progress, 1));

      // Advance to next sample
      currentTime += SAMPLE_INTERVAL;
      if (currentTime < totalDuration) {
        video.currentTime = currentTime;
      } else {
        // Done — add final boundary
        sceneBoundaries.push(totalDuration);

        // Convert boundaries to scenes
        const scenes = [];
        for (let i = 0; i < sceneBoundaries.length - 1; i++) {
          const start = sceneBoundaries[i];
          const end = sceneBoundaries[i + 1];
          const duration = end - start;
          if (duration >= MIN_SCENE_DURATION) {
            scenes.push({ startTime: start, endTime: end, duration });
          }
        }

        if (typeof videoFile !== 'string') {
          URL.revokeObjectURL(url);
        }
        resolve(scenes);
      }
    };

    video.onerror = () => {
      if (typeof videoFile !== 'string') {
        URL.revokeObjectURL(url);
      }
      reject(new Error('Failed to load video for scene detection'));
    };

    video.src = url;
  });
}

/**
 * Compare two frame pixel arrays and return the average difference (0-255).
 */
function compareFrames(frame1, frame2) {
  let totalDiff = 0;
  const pixelCount = frame1.length / 4;

  for (let i = 0; i < frame1.length; i += 4) {
    const rDiff = Math.abs(frame1[i] - frame2[i]);
    const gDiff = Math.abs(frame1[i + 1] - frame2[i + 1]);
    const bDiff = Math.abs(frame1[i + 2] - frame2[i + 2]);
    totalDiff += (rDiff + gDiff + bDiff) / 3;
  }

  return totalDiff / pixelCount;
}

/**
 * Select random B-roll segments from analyzed source videos to fill a target duration.
 * Returns array of { sourceVideoIndex, sourceVideoId, startTime, endTime, clipDuration }
 */
export function selectBRollSegments(sourceVideos, targetDuration) {
  // Collect all available scenes across all source videos
  const allScenes = [];
  sourceVideos.forEach((video, videoIndex) => {
    if (!video.scenes || video.scenes.length === 0) return;
    video.scenes.forEach(scene => {
      allScenes.push({
        sourceVideoIndex: videoIndex,
        sourceVideoId: video.id,
        sourceFile: video.file,
        sourceUrl: video.url,
        ...scene,
      });
    });
  });

  if (allScenes.length === 0) {
    throw new Error('No usable scenes found in source videos');
  }

  // Randomly select and trim scenes to fill the target duration
  const segments = [];
  let accumulatedDuration = 0;
  const usedSceneIndices = new Set();
  let attempts = 0;
  const maxAttempts = allScenes.length * 3;

  while (accumulatedDuration < targetDuration && attempts < maxAttempts) {
    // Pick a random scene (prefer unused ones)
    let sceneIdx;
    if (usedSceneIndices.size < allScenes.length) {
      // Find an unused scene
      do {
        sceneIdx = Math.floor(Math.random() * allScenes.length);
      } while (usedSceneIndices.has(sceneIdx) && usedSceneIndices.size < allScenes.length);
    } else {
      // All used, pick any
      sceneIdx = Math.floor(Math.random() * allScenes.length);
    }
    usedSceneIndices.add(sceneIdx);

    const scene = allScenes[sceneIdx];
    const remaining = targetDuration - accumulatedDuration;

    // Determine clip duration — use full scene or trim if last clip
    let clipDuration;
    if (remaining <= scene.duration) {
      clipDuration = remaining;
    } else {
      // Use a portion of the scene (2-5 seconds for dynamic B-rolls), or full if shorter
      const maxClip = Math.min(scene.duration, 5);
      const minClip = Math.min(2, scene.duration);
      clipDuration = minClip + Math.random() * (maxClip - minClip);
      clipDuration = Math.min(clipDuration, remaining);
    }

    // Random start within the scene
    const maxStart = scene.startTime + scene.duration - clipDuration;
    const clipStart = scene.startTime + Math.random() * Math.max(0, maxStart - scene.startTime);

    segments.push({
      sourceVideoIndex: scene.sourceVideoIndex,
      sourceVideoId: scene.sourceVideoId,
      sourceFile: scene.sourceFile,
      sourceUrl: scene.sourceUrl,
      startTime: clipStart,
      endTime: clipStart + clipDuration,
      clipDuration,
    });

    accumulatedDuration += clipDuration;
    attempts++;
  }

  return segments;
}

/**
 * Select a random clip from hook videos for the hook segment.
 * @param {Array} hookVideos — array of hook video objects with { file, url, duration }
 * @param {number} hookDuration — desired hook clip duration in seconds
 * @returns {{ sourceFile, sourceUrl, startTime, clipDuration }}
 */
export function selectHookClip(hookVideos, hookDuration = 3) {
  if (!hookVideos || hookVideos.length === 0) {
    throw new Error('No hook videos available');
  }

  // Pick a random hook video
  const hook = hookVideos[Math.floor(Math.random() * hookVideos.length)];
  const actualDuration = Math.min(hookDuration, hook.duration);

  // Random start position (if hook video is longer than hookDuration)
  const maxStart = Math.max(0, hook.duration - actualDuration);
  const startTime = Math.random() * maxStart;

  return {
    sourceFile: hook.file,
    sourceUrl: hook.url,
    sourceVideoId: hook.id,
    startTime,
    clipDuration: actualDuration,
  };
}

/**
 * Build a VSL-style interleaving timeline.
 *
 * Pattern: Person(3-5s) → 2 brolls → Person(3s) → 2-3 brolls → Person → brolls → Person(end)
 *
 * The algorithm ensures:
 * 1. The video always starts with a person segment
 * 2. The video always ends with a person segment
 * 3. B-roll clips are 2-3 seconds each
 * 4. Person segments between b-roll groups are ~3 seconds
 * 5. Each b-roll group has 2-3 clips
 *
 * @param {number} vslDuration — total duration of the VSL source video
 * @returns {{ timeline: Array<{ type: 'person'|'broll', startTime: number, duration: number, brollCount?: number }>, totalBRollDuration: number }}
 */
export function buildVSLTimeline(vslDuration) {
  if (vslDuration < 5) {
    // Too short for interleaving — just use person only
    return {
      timeline: [{ type: 'person', startTime: 0, duration: vslDuration }],
      totalBRollDuration: 0,
    };
  }

  const BROLL_CLIP_DURATION = 2.5; // average b-roll clip duration
  const PERSON_SEGMENT_MIN = 3;
  const PERSON_SEGMENT_MAX = 5;
  const BROLL_GROUP_MIN = 2;
  const BROLL_GROUP_MAX = 3;
  const END_PERSON_MIN = 2; // minimum end person segment

  // Build timeline iteratively
  const timeline = [];
  let currentVslTime = 0; // tracks position in the VSL video

  // First person segment: 3-5 seconds
  const firstPersonDur = Math.min(
    PERSON_SEGMENT_MIN + Math.random() * (PERSON_SEGMENT_MAX - PERSON_SEGMENT_MIN),
    vslDuration - END_PERSON_MIN
  );

  timeline.push({ type: 'person', startTime: 0, duration: firstPersonDur });
  currentVslTime = firstPersonDur;

  // Keep adding broll groups + person segments until we're near the end
  let iteration = 0;
  const MAX_ITERATIONS = 100;

  while (currentVslTime < vslDuration - END_PERSON_MIN && iteration < MAX_ITERATIONS) {
    iteration++;

    // How much VSL time remains?
    const remaining = vslDuration - currentVslTime;

    // Need at least: 1 broll group + 1 person end segment
    // Minimum: 2 brolls * 2.5s = 5s broll + 2s person = 7s
    if (remaining < 7) {
      // Not enough room for another broll group — end with person
      break;
    }

    // B-roll group: 2-3 clips
    const brollCount = Math.random() < 0.5 ? BROLL_GROUP_MIN : BROLL_GROUP_MAX;
    const brollGroupDuration = brollCount * BROLL_CLIP_DURATION;

    // Check if we have enough remaining for this broll group + next person
    if (currentVslTime + brollGroupDuration + PERSON_SEGMENT_MIN > vslDuration - END_PERSON_MIN) {
      break;
    }

    // Add b-roll group (visual only — the vslTime advances because the audio continues)
    timeline.push({
      type: 'broll',
      startTime: currentVslTime, // where in the VSL audio timeline this starts
      duration: brollGroupDuration,
      brollCount,
    });
    currentVslTime += brollGroupDuration;

    // Person segment: ~3 seconds (shorter mid segments)
    const personDur = Math.min(
      PERSON_SEGMENT_MIN + Math.random() * 1,
      vslDuration - currentVslTime - END_PERSON_MIN
    );

    if (personDur < 1) break;

    timeline.push({ type: 'person', startTime: currentVslTime, duration: personDur });
    currentVslTime += personDur;
  }

  // Final person segment — everything remaining
  const endDuration = vslDuration - currentVslTime;
  if (endDuration > 0) {
    // Check if the last segment is already a person — extend it
    const lastSeg = timeline[timeline.length - 1];
    if (lastSeg && lastSeg.type === 'person') {
      lastSeg.duration += endDuration;
    } else {
      timeline.push({ type: 'person', startTime: currentVslTime, duration: endDuration });
    }
  }

  // Calculate total b-roll duration needed
  const totalBRollDuration = timeline
    .filter(s => s.type === 'broll')
    .reduce((sum, s) => sum + s.duration, 0);

  return { timeline, totalBRollDuration };
}

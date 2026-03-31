import React, { useCallback } from 'react';
import { useBRoll } from '../../context/BRollContext';
import SourceUpload from './SourceUpload';
import AdSlots from './AdSlots';
import BRollSettings from './BRollSettings';
import { generateSpeech, getAudioDuration } from '../../utils/elevenlabs';
import { detectScenes, selectBRollSegments, selectHookClip, buildVSLTimeline } from '../../utils/scenes';
import { assembleAd, assembleHookBRoll, assembleVSL } from '../../utils/assembler';
import { downloadFile, saveFile, selectDirectory } from '../../utils/ffmpeg';
import './BRollCreator.css';

export default function BRollCreator() {
  const {
    creationMode,
    sourceVideos, hookVideos, vslVideo,
    ads, settings,
    generating, setGenerating,
    updateAd, addLog, clearLog, setScenes,
    generationLog,
  } = useBRoll();

  const isVSL = creationMode === 'vsl';
  const isHookBRoll = creationMode === 'hook-broll';

  // ─── Analyze source videos for scenes ───
  const analyzeSourceVideos = useCallback(async (scenesMap) => {
    const unanalyzed = sourceVideos.filter(v => !v.analyzed);
    if (unanalyzed.length > 0) {
      addLog(`Analyzing ${unanalyzed.length} source videos for scene detection...`);
      for (const video of unanalyzed) {
        try {
          addLog(`  Scanning: ${video.name}`);
          const scenes = await detectScenes(video.url);
          setScenes(video.id, scenes);
          scenesMap.set(video.id, scenes);
          addLog(`  → Found ${scenes.length} usable scenes`);
        } catch (err) {
          addLog(`  ❌ Failed to analyze ${video.name}: ${err.message}`);
        }
      }
    }
  }, [sourceVideos, setScenes, addLog]);

  // ─── Build analyzed sources list from local map ───
  const getAnalyzedSources = useCallback((scenesMap) => {
    return sourceVideos
      .filter(v => scenesMap.has(v.id) && scenesMap.get(v.id).length > 0)
      .map(v => ({ ...v, scenes: scenesMap.get(v.id), analyzed: true }));
  }, [sourceVideos]);

  // ─── GENERATE: B-Roll Only mode ───
  // ─── Helper: ask user for save directory (Electron or browser) ───
  const askForSaveDirectory = useCallback(async () => {
    // Try Electron native dialog first
    if (window.electronAPI?.selectDirectory) {
      const dirResult = await selectDirectory();
      if (!dirResult.success || !dirResult.path) return null;
      return { type: 'electron', path: dirResult.path };
    }
    // Browser fallback: use showDirectoryPicker (File System Access API)
    if (window.showDirectoryPicker) {
      try {
        const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
        return { type: 'browser', handle: dirHandle };
      } catch (err) {
        if (err.name === 'AbortError') return null;
        console.warn('showDirectoryPicker failed:', err);
        return null;
      }
    }
    // No directory picker available — will fall back to individual downloads
    return { type: 'download' };
  }, []);

  // ─── Helper: save file to selected directory ───
  const saveToDirectory = useCallback(async (videoData, filename, dir) => {
    if (!dir) {
      downloadFile(videoData, filename);
      return;
    }
    if (dir.type === 'electron') {
      await saveFile(videoData, filename, dir.path);
    } else if (dir.type === 'browser' && dir.handle) {
      try {
        const fileHandle = await dir.handle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(new Blob([videoData], { type: 'video/mp4' }));
        await writable.close();
      } catch (err) {
        console.warn('Browser directory save failed, downloading instead:', err);
        downloadFile(videoData, filename);
      }
    } else {
      downloadFile(videoData, filename);
    }
  }, []);

  // ─── GENERATE: B-Roll Only mode ───
  const handleGenerateBRoll = useCallback(async () => {
    const adsToProcess = ads.filter(a => a.script.trim());
    if (adsToProcess.length === 0 || !settings.apiKey || !settings.voiceId || sourceVideos.length === 0) return;

    setGenerating(true);
    clearLog();

    // Ask for save directory FIRST, before any processing
    const selectedDir = await askForSaveDirectory();
    if (!selectedDir) {
      addLog('❌ Directory selection cancelled.');
      setGenerating(false);
      return;
    }
    if (selectedDir.type === 'electron') addLog(`📁 Saving to: ${selectedDir.path}`);
    else if (selectedDir.type === 'browser') addLog(`📁 Saving to selected folder`);

    // Analyze source videos
    const scenesMap = new Map();
    sourceVideos.forEach(v => { if (v.analyzed && v.scenes?.length) scenesMap.set(v.id, v.scenes); });
    await analyzeSourceVideos(scenesMap);
    const analyzedSources = getAnalyzedSources(scenesMap);

    if (analyzedSources.length === 0) {
      addLog('❌ No analyzed source videos available.');
      setGenerating(false);
      return;
    }

    addLog(`Starting generation of ${adsToProcess.length} B-Roll ads...`);

    for (let i = 0; i < adsToProcess.length; i++) {
      const ad = adsToProcess[i];
      const adNum = ads.indexOf(ad) + 1;
      addLog(`\n--- Ad #${adNum} ---`);

      try {
        updateAd(ad.id, { status: 'generating-voice', progress: 10 });
        addLog(`Generating voiceover...`);
        const voiceId = ad.voiceId || settings.voiceId;
        const { blob: voiceBlob, wordTimings } = await generateSpeech(settings.apiKey, voiceId, ad.script);
        const duration = await getAudioDuration(voiceBlob);
        const voiceoverUrl = URL.createObjectURL(voiceBlob);
        updateAd(ad.id, { voiceoverBlob: voiceBlob, voiceoverUrl, voiceoverDuration: duration, captionTimings: wordTimings, progress: 25 });
        addLog(`✅ Voiceover generated (${duration.toFixed(1)}s)`);

        updateAd(ad.id, { status: 'analyzing', progress: 30 });
        addLog(`Selecting B-roll segments for ${duration.toFixed(1)}s duration...`);
        const segments = selectBRollSegments(analyzedSources, duration);
        addLog(`✅ Selected ${segments.length} B-roll clips`);

        updateAd(ad.id, { status: 'assembling', progress: 40 });
        addLog(`Assembling video...`);
        if (ad.textOverlay?.text?.trim()) addLog(`  📝 Text overlay: "${ad.textOverlay.text.trim()}"`);

        const firstSource = analyzedSources[0];
        const outputWidth = firstSource.width < firstSource.height ? 1080 : 1920;
        const outputHeight = firstSource.width < firstSource.height ? 1920 : 1080;

        const videoData = await assembleAd(segments, voiceBlob, { 
          outputWidth, 
          outputHeight, 
          textOverlay: ad.textOverlay,
          captionsConfig: ad.captionsConfig,
          captionTimings: wordTimings
        }, (prog) => {
          updateAd(ad.id, { progress: 40 + Math.round(prog.percent * 0.55) });
        });

        const outputBlob = new Blob([videoData], { type: 'video/mp4' });
        const outputUrl = URL.createObjectURL(outputBlob);
        updateAd(ad.id, { status: 'done', progress: 100, outputUrl });
        addLog(`✅ Ad #${adNum} complete!`);
        
        await saveToDirectory(videoData, `ad_${adNum}.mp4`, selectedDir);
      } catch (err) {
        console.error(`Ad #${adNum} failed:`, err);
        updateAd(ad.id, { status: 'error', error: err.message, progress: 0 });
        addLog(`❌ Ad #${adNum} failed: ${err.message}`);
      }
    }

    addLog(`\n✨ Generation complete!`);
    setGenerating(false);
  }, [ads, settings, sourceVideos, setGenerating, clearLog, addLog, updateAd, analyzeSourceVideos, getAnalyzedSources, askForSaveDirectory, saveToDirectory]);

  // ─── GENERATE: Hook + B-Roll mode ───
  const handleGenerateHookBRoll = useCallback(async () => {
    const adsToProcess = ads.filter(a => a.script.trim());
    if (adsToProcess.length === 0 || !settings.apiKey || !settings.voiceId || sourceVideos.length === 0 || hookVideos.length === 0) return;

    setGenerating(true);
    clearLog();

    // Ask for save directory FIRST, before any processing
    const selectedDir = await askForSaveDirectory();
    if (!selectedDir) {
      addLog('❌ Directory selection cancelled.');
      setGenerating(false);
      return;
    }
    if (selectedDir.type === 'electron') addLog(`📁 Saving to: ${selectedDir.path}`);
    else if (selectedDir.type === 'browser') addLog(`📁 Saving to selected folder`);

    // Analyze source videos
    const scenesMap = new Map();
    sourceVideos.forEach(v => { if (v.analyzed && v.scenes?.length) scenesMap.set(v.id, v.scenes); });
    await analyzeSourceVideos(scenesMap);
    const analyzedSources = getAnalyzedSources(scenesMap);

    if (analyzedSources.length === 0) {
      addLog('❌ No analyzed source videos available.');
      setGenerating(false);
      return;
    }

    addLog(`Starting generation of ${adsToProcess.length} Hook+B-Roll ads...`);
    addLog(`Hook duration: ${settings.hookDuration}s`);

    for (let i = 0; i < adsToProcess.length; i++) {
      const ad = adsToProcess[i];
      const adNum = ads.indexOf(ad) + 1;
      addLog(`\n--- Ad #${adNum} (Hook+B-Roll) ---`);

      try {
        // Generate voiceover
        updateAd(ad.id, { status: 'generating-voice', progress: 10 });
        addLog(`Generating voiceover...`);
        const voiceId = ad.voiceId || settings.voiceId;
        const { blob: voiceBlob, wordTimings } = await generateSpeech(settings.apiKey, voiceId, ad.script);
        const duration = await getAudioDuration(voiceBlob);
        const voiceoverUrl = URL.createObjectURL(voiceBlob);
        updateAd(ad.id, { voiceoverBlob: voiceBlob, voiceoverUrl, voiceoverDuration: duration, captionTimings: wordTimings, progress: 25 });
        addLog(`✅ Voiceover generated (${duration.toFixed(1)}s)`);

        // Select hook clip
        addLog(`Selecting hook clip (${settings.hookDuration}s)...`);
        const hookClip = selectHookClip(hookVideos, settings.hookDuration);
        addLog(`✅ Hook clip selected from: ${hookVideos.find(h => h.id === hookClip.sourceVideoId)?.name || 'hook video'}`);

        // Select b-roll segments for remaining duration
        const brollDuration = Math.max(0, duration - hookClip.clipDuration);
        updateAd(ad.id, { status: 'analyzing', progress: 30 });
        addLog(`Selecting B-roll segments for ${brollDuration.toFixed(1)}s remaining...`);
        const brollSegments = selectBRollSegments(analyzedSources, brollDuration);
        addLog(`✅ Selected ${brollSegments.length} B-roll clips`);

        // Assemble
        updateAd(ad.id, { status: 'assembling', progress: 40 });
        addLog(`Assembling Hook+B-Roll video...`);
        if (ad.textOverlay?.text?.trim()) addLog(`  📝 Text overlay: "${ad.textOverlay.text.trim()}"`);

        const firstSource = analyzedSources[0];
        const outputWidth = firstSource.width < firstSource.height ? 1080 : 1920;
        const outputHeight = firstSource.width < firstSource.height ? 1920 : 1080;

        const videoData = await assembleHookBRoll(hookClip, brollSegments, voiceBlob, { 
          outputWidth, 
          outputHeight, 
          textOverlay: ad.textOverlay,
          captionsConfig: ad.captionsConfig,
          captionTimings: wordTimings
        }, (prog) => {
          updateAd(ad.id, { progress: 40 + Math.round(prog.percent * 0.55) });
        });

        const outputBlob = new Blob([videoData], { type: 'video/mp4' });
        const outputUrl = URL.createObjectURL(outputBlob);
        updateAd(ad.id, { status: 'done', progress: 100, outputUrl });
        addLog(`✅ Ad #${adNum} complete!`);
        
        await saveToDirectory(videoData, `hook_broll_ad_${adNum}.mp4`, selectedDir);
      } catch (err) {
        console.error(`Ad #${adNum} failed:`, err);
        updateAd(ad.id, { status: 'error', error: err.message, progress: 0 });
        addLog(`❌ Ad #${adNum} failed: ${err.message}`);
      }
    }

    addLog(`\n✨ Generation complete!`);
    setGenerating(false);
  }, [ads, settings, sourceVideos, hookVideos, setGenerating, clearLog, addLog, updateAd, analyzeSourceVideos, getAnalyzedSources, askForSaveDirectory, saveToDirectory]);

  // ─── GENERATE: VSL Style mode ───
  const handleGenerateVSL = useCallback(async () => {
    if (!vslVideo || sourceVideos.length === 0 || ads.length === 0) return;

    setGenerating(true);
    clearLog();

    // Ask for save directory FIRST, before any processing
    const selectedDir = await askForSaveDirectory();
    if (!selectedDir) {
      addLog('❌ Directory selection cancelled.');
      setGenerating(false);
      return;
    }
    if (selectedDir.type === 'electron') addLog(`📁 Saving to: ${selectedDir.path}`);
    else if (selectedDir.type === 'browser') addLog(`📁 Saving to selected folder`);

    // Analyze source videos
    const scenesMap = new Map();
    sourceVideos.forEach(v => { if (v.analyzed && v.scenes?.length) scenesMap.set(v.id, v.scenes); });
    await analyzeSourceVideos(scenesMap);
    const analyzedSources = getAnalyzedSources(scenesMap);

    if (analyzedSources.length === 0) {
      addLog('❌ No analyzed source videos available.');
      setGenerating(false);
      return;
    }

    addLog(`Starting VSL-style generation (${ads.length} variation${ads.length !== 1 ? 's' : ''})...`);
    addLog(`VSL source: ${vslVideo.name} (${vslVideo.duration.toFixed(1)}s)`);

    for (let i = 0; i < ads.length; i++) {
      const ad = ads[i];
      const varNum = i + 1;
      addLog(`\n--- Variation #${varNum} (VSL) ---`);

      try {
        // Build VSL interleaving timeline
        updateAd(ad.id, { status: 'building-timeline', progress: 10 });
        addLog(`Building VSL interleave timeline...`);
        const { timeline, totalBRollDuration } = buildVSLTimeline(vslVideo.duration);

        const personSegments = timeline.filter(s => s.type === 'person');
        const brollGroups = timeline.filter(s => s.type === 'broll');
        const totalBrollClips = brollGroups.reduce((sum, g) => sum + (g.brollCount || 2), 0);

        addLog(`  Timeline: ${personSegments.length} person segments, ${brollGroups.length} b-roll groups (${totalBrollClips} clips)`);
        addLog(`  Person time: ${(vslVideo.duration - totalBRollDuration).toFixed(1)}s, B-roll time: ${totalBRollDuration.toFixed(1)}s`);

        // Select b-roll segments for all b-roll slots
        updateAd(ad.id, { status: 'analyzing', progress: 25 });
        addLog(`Selecting ${totalBrollClips} B-roll clips...`);

        // Build individual b-roll segment requests
        const brollSegments = [];
        for (const group of brollGroups) {
          const count = group.brollCount || 2;
          const clipDurationEach = group.duration / count;
          const clips = selectBRollSegments(analyzedSources, group.duration);

          // Adjust clip durations to match the group evenly
          let remaining = group.duration;
          for (let j = 0; j < clips.length && j < count; j++) {
            const dur = j < count - 1 ? clipDurationEach : remaining;
            clips[j].clipDuration = Math.min(dur, clips[j].clipDuration || dur);
            remaining -= clips[j].clipDuration;
            brollSegments.push(clips[j]);
          }
        }

        addLog(`✅ Selected ${brollSegments.length} B-roll clips`);

        // Assemble VSL
        updateAd(ad.id, { status: 'assembling', progress: 35 });
        addLog(`Assembling VSL interleaved video...`);
        if (ad.textOverlay?.text?.trim()) addLog(`  📝 Text overlay: "${ad.textOverlay.text.trim()}"`);

        const outputWidth = vslVideo.width < vslVideo.height ? 1080 : 1920;
        const outputHeight = vslVideo.width < vslVideo.height ? 1920 : 1080;

        const videoData = await assembleVSL(vslVideo.file, brollSegments, timeline, { 
          outputWidth, 
          outputHeight, 
          textOverlay: ad.textOverlay,
          captionsConfig: ad.captionsConfig,
          captionTimings: [] // VSL usually doesn't have caption timings like AI voice, but we pass config
        }, (prog) => {
          updateAd(ad.id, { progress: 35 + Math.round(prog.percent * 0.60) });
        });

        const outputBlob = new Blob([videoData], { type: 'video/mp4' });
        const outputUrl = URL.createObjectURL(outputBlob);
        updateAd(ad.id, { status: 'done', progress: 100, outputUrl });
        addLog(`✅ Variation #${varNum} complete!`);
        
        await saveToDirectory(videoData, `vsl_variation_${varNum}.mp4`, selectedDir);
      } catch (err) {
        console.error(`Variation #${varNum} failed:`, err);
        updateAd(ad.id, { status: 'error', error: err.message, progress: 0 });
        addLog(`❌ Variation #${varNum} failed: ${err.message}`);
      }
    }

    addLog(`\n✨ Generation complete!`);
    setGenerating(false);
  }, [ads, vslVideo, sourceVideos, setGenerating, clearLog, addLog, updateAd, analyzeSourceVideos, getAnalyzedSources, askForSaveDirectory, saveToDirectory]);

  // ─── Dispatch to correct handler ───
  const handleGenerate = useCallback(() => {
    if (isVSL) return handleGenerateVSL();
    if (isHookBRoll) return handleGenerateHookBRoll();
    return handleGenerateBRoll();
  }, [isVSL, isHookBRoll, handleGenerateVSL, handleGenerateHookBRoll, handleGenerateBRoll]);

  // ─── Readiness checks ───
  const totalScripts = ads.filter(a => a.script.trim()).length;

  const readyToGenerate = (() => {
    if (generating) return false;
    if (sourceVideos.length === 0) return false;
    if (isVSL) return vslVideo !== null && ads.length > 0;
    if (isHookBRoll) return hookVideos.length > 0 && totalScripts > 0 && settings.apiKey && settings.voiceId;
    return totalScripts > 0 && settings.apiKey && settings.voiceId;
  })();

  const completedAds = ads.filter(a => a.status === 'done').length;

  // ─── Button label ───
  const getButtonLabel = () => {
    if (generating) return null; // spinner shown
    if (isVSL) return `🚀 Generate ${ads.length} Variation${ads.length !== 1 ? 's' : ''}`;
    if (isHookBRoll) return `🪝 Generate ${totalScripts} Hook Ad${totalScripts !== 1 ? 's' : ''}`;
    return `🚀 Generate ${totalScripts} Ad${totalScripts !== 1 ? 's' : ''}`;
  };

  // ─── Left panel title ───
  const getLeftPanelTitle = () => {
    if (isVSL) return 'Video Sources';
    if (isHookBRoll) return 'Video Sources';
    return 'B-Roll Sources';
  };

  const getLeftPanelCount = () => {
    if (isVSL) return sourceVideos.length + (vslVideo ? 1 : 0);
    if (isHookBRoll) return sourceVideos.length + hookVideos.length;
    return sourceVideos.length;
  };

  return (
    <div className="broll-creator">
      {/* Left Panel — Source Videos */}
      <aside className="panel panel-left glass-panel animate-slide-up">
        <div className="panel-header">
          <h2 className="panel-title">{getLeftPanelTitle()}</h2>
          <span className="badge badge-accent">{getLeftPanelCount()}</span>
        </div>
        <div className="panel-body">
          <SourceUpload />
        </div>
      </aside>

      {/* Center — Ad Slots */}
      <section className="panel panel-center glass-panel animate-slide-up" style={{ animationDelay: '50ms' }}>
        <div className="panel-header">
          <h2 className="panel-title">
            {isVSL ? 'VSL Variations' : 'Video Ads'}
          </h2>
          <span className="badge badge-accent">
            {isVSL
              ? `${ads.length} variation${ads.length !== 1 ? 's' : ''}`
              : `${totalScripts}/${ads.length} ready`
            }
          </span>
        </div>
        <div className="panel-body">
          <AdSlots />
        </div>
      </section>

      {/* Right Panel — Settings + Generate */}
      <aside className="panel panel-right glass-panel animate-slide-up" style={{ animationDelay: '100ms' }}>
        <div className="panel-header">
          <h2 className="panel-title">Settings</h2>
        </div>
        <div className="panel-body">
          <BRollSettings />

          {/* Generate button */}
          <div className="broll-generate-section">
            <button
              className="btn btn-primary export-btn"
              onClick={handleGenerate}
              disabled={!readyToGenerate}
            >
              {generating ? (
                <>
                  <span className="export-spinner" />
                  Generating...
                </>
              ) : (
                getButtonLabel()
              )}
            </button>

            {completedAds > 0 && (
              <div className="broll-completed">
                <span className="badge badge-success">{completedAds} completed</span>
              </div>
            )}
          </div>

          {/* Generation Log */}
          {generationLog.length > 0 && (
            <div className="broll-log">
              <div className="control-label">Generation Log</div>
              <div className="broll-log-content">
                {generationLog.map((entry, i) => (
                  <div key={i} className="log-line">
                    {entry.message}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

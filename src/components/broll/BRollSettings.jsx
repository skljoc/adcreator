import React, { useState, useCallback, useEffect } from 'react';
import { useBRoll } from '../../context/BRollContext';
import { fetchVoices } from '../../utils/elevenlabs';

const MODES = [
  { id: 'broll', label: 'B-Roll', icon: '🎞️', desc: 'Voiceover + B-Roll clips' },
  { id: 'hook-broll', label: 'Hook+B-Roll', icon: '🪝', desc: 'Hook video → B-Roll + voiceover' },
  { id: 'vsl', label: 'VSL Style', icon: '🎙️', desc: 'Person talking + B-Roll interleave' },
];

export default function BRollSettings() {
  const {
    settings, updateSettings,
    creationMode, setCreationMode,
    sourceVideos, hookVideos, vslVideo,
    ads, generating,
  } = useBRoll();
  const [showKey, setShowKey] = useState(false);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [voiceError, setVoiceError] = useState(null);
  const [previewingVoiceId, setPreviewingVoiceId] = useState(null);
  const [audio] = useState(new Audio());

  const isVSL = creationMode === 'vsl';
  const isHookBRoll = creationMode === 'hook-broll';

  const handleLoadVoices = useCallback(async () => {
    if (!settings.apiKey.trim()) return;
    setLoadingVoices(true);
    setVoiceError(null);
    try {
      const voices = await fetchVoices(settings.apiKey);
      updateSettings({ voices, voicesLoaded: true });
      if (voices.length > 0 && !settings.voiceId) {
        updateSettings({ voiceId: voices[0].id });
      }
    } catch (err) {
      setVoiceError(err.message);
    } finally {
      setLoadingVoices(false);
    }
  }, [settings.apiKey, settings.voiceId, updateSettings]);

  // Auto-load voices when API key changes
  useEffect(() => {
    if (settings.apiKey.trim() && !settings.voicesLoaded) {
      handleLoadVoices();
    }
  }, [settings.apiKey, settings.voicesLoaded, handleLoadVoices]);

  const togglePreview = useCallback((voice) => {
    if (previewingVoiceId === voice.id) {
      audio.pause();
      setPreviewingVoiceId(null);
    } else {
      audio.src = voice.previewUrl;
      audio.play();
      setPreviewingVoiceId(voice.id);
      audio.onended = () => setPreviewingVoiceId(null);
    }
  }, [previewingVoiceId, audio]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      audio.pause();
      audio.src = '';
    };
  }, [audio]);

  const totalScripts = ads.filter(a => a.script.trim()).length;
  const sourceCount = sourceVideos.length;

  // Mode-specific readiness
  const getReadiness = () => {
    const base = sourceCount > 0 && !generating;
    if (isVSL) {
      return base && vslVideo !== null && ads.length > 0;
    }
    if (isHookBRoll) {
      return base && hookVideos.length > 0 && totalScripts > 0 && settings.apiKey && settings.voiceId;
    }
    // broll
    return base && totalScripts > 0 && settings.apiKey && settings.voiceId;
  };

  const readyToGenerate = getReadiness();

  return (
    <div className="broll-settings">
      {/* Mode Selector */}
      <div className="editor-section">
        <label className="control-label">Creation Mode</label>
        <div className="mode-selector">
          {MODES.map(mode => (
            <button
              key={mode.id}
              className={`mode-btn ${creationMode === mode.id ? 'active' : ''}`}
              onClick={() => setCreationMode(mode.id)}
              disabled={generating}
              title={mode.desc}
            >
              <span className="mode-btn-icon">{mode.icon}</span>
              <span className="mode-btn-label">{mode.label}</span>
            </button>
          ))}
        </div>
        <div className="mode-description">
          {MODES.find(m => m.id === creationMode)?.desc}
        </div>
      </div>

      {/* Hook Duration Slider (Hook+B-Roll mode only) */}
      {isHookBRoll && (
        <div className="editor-section">
          <label className="control-label">
            Hook Duration
            <span className="value">{settings.hookDuration}s</span>
          </label>
          <input
            type="range"
            min={1}
            max={10}
            step={0.5}
            value={settings.hookDuration}
            onChange={(e) => updateSettings({ hookDuration: parseFloat(e.target.value) })}
          />
        </div>
      )}

      {/* API Key + Voice (hidden in VSL mode) */}
      {!isVSL && (
        <div className="editor-section">
          <div className="control-group">
            <label className="control-label">ElevenLabs API Key</label>
            <div className="api-key-row">
              <input
                type={showKey ? 'text' : 'password'}
                className="glass-input"
                value={settings.apiKey}
                onChange={(e) => updateSettings({ apiKey: e.target.value, voicesLoaded: false })}
                placeholder="Enter your API key..."
              />
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowKey(s => !s)}
                style={{ flexShrink: 0 }}
              >
                {showKey ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {settings.apiKey && (
            <div className="control-group" style={{ marginTop: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleLoadVoices}
                  disabled={loadingVoices || !settings.apiKey.trim()}
                >
                  {loadingVoices ? '⏳ Loading...' : '🔄 Load Voices'}
                </button>
                {settings.voicesLoaded && (
                  <span className="badge badge-success">{settings.voices.length} voices</span>
                )}
              </div>
              {voiceError && (
                <div className="ad-error" style={{ marginTop: '6px' }}>⚠️ {voiceError}</div>
              )}
            </div>
          )}

          {/* Voice Selector */}
          {settings.voicesLoaded && settings.voices.length > 0 && (
            <div className="control-group" style={{ marginTop: '10px' }}>
              <label className="control-label">Voice</label>
              <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                <select
                  className="glass-input"
                  value={settings.voiceId}
                  onChange={(e) => updateSettings({ voiceId: e.target.value })}
                  style={{ flex: 1 }}
                >
                  {settings.voices.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.category})
                    </option>
                  ))}
                </select>
                <button
                  className={`btn btn-sm ${previewingVoiceId === settings.voiceId ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => {
                    const voice = settings.voices.find(v => v.id === settings.voiceId);
                    if (voice) togglePreview(voice);
                  }}
                  title="Preview Voice"
                  type="button"
                  style={{ flexShrink: 0, minWidth: '80px' }}
                >
                  {previewingVoiceId === settings.voiceId ? '🔇 Stop' : '🔊 Play'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      <div className="editor-section">
        <div className="broll-summary">
          {isVSL && (
            <div className="summary-row">
              <span>VSL Video</span>
              <span className="summary-value">
                {vslVideo ? `${Math.round(vslVideo.duration)}s` : 'Not uploaded'}
              </span>
            </div>
          )}
          {isHookBRoll && (
            <div className="summary-row">
              <span>Hook Videos</span>
              <span className="summary-value">{hookVideos.length}</span>
            </div>
          )}
          <div className="summary-row">
            <span>B-Roll Sources</span>
            <span className="summary-value">{sourceCount}</span>
          </div>
          {!isVSL && (
            <>
              <div className="summary-row">
                <span>Ads with Scripts</span>
                <span className="summary-value">{totalScripts} / {ads.length}</span>
              </div>
              <div className="summary-row">
                <span>Voice</span>
                <span className="summary-value">
                  {settings.voiceId
                    ? settings.voices.find(v => v.id === settings.voiceId)?.name || 'Selected'
                    : 'Not selected'}
                </span>
              </div>
            </>
          )}
          {isVSL && (
            <div className="summary-row">
              <span>Variations</span>
              <span className="summary-value">{ads.length}</span>
            </div>
          )}
        </div>
      </div>

      {/* Ready check */}
      {!readyToGenerate && !generating && (
        <div className="editor-section">
          <div className="broll-checklist">
            {!isVSL && (
              <>
                <div className={`check-item ${settings.apiKey ? 'done' : ''}`}>
                  {settings.apiKey ? '✅' : '⬜'} API Key set
                </div>
                <div className={`check-item ${settings.voiceId ? 'done' : ''}`}>
                  {settings.voiceId ? '✅' : '⬜'} Voice selected
                </div>
              </>
            )}
            {isVSL && (
              <div className={`check-item ${vslVideo ? 'done' : ''}`}>
                {vslVideo ? '✅' : '⬜'} VSL video uploaded
              </div>
            )}
            {isHookBRoll && (
              <div className={`check-item ${hookVideos.length > 0 ? 'done' : ''}`}>
                {hookVideos.length > 0 ? '✅' : '⬜'} Hook videos uploaded
              </div>
            )}
            <div className={`check-item ${sourceCount > 0 ? 'done' : ''}`}>
              {sourceCount > 0 ? '✅' : '⬜'} B-Roll source videos uploaded
            </div>
            {!isVSL && (
              <div className={`check-item ${totalScripts > 0 ? 'done' : ''}`}>
                {totalScripts > 0 ? '✅' : '⬜'} At least one script written
              </div>
            )}
            {isVSL && (
              <div className={`check-item ${ads.length > 0 ? 'done' : ''}`}>
                {ads.length > 0 ? '✅' : '⬜'} At least one variation
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

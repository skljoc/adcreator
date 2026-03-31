import React, { useState, useCallback } from 'react';
import { useBRoll } from '../../context/BRollContext';
import BRollTextOverlay from './BRollTextOverlay';
import CaptionsSettings from './CaptionsSettings';
import BRollPreview from './BRollPreview';
import './AdSlots.css';

import { ErrorBoundary } from '../ErrorBoundary';

export default function AdSlots() {
  const { ads, setAdCount, updateAdScript, updateAd, creationMode, vslVideo, settings } = useBRoll();
  const [previewingVoiceId, setPreviewingVoiceId] = useState(null);
  const [audio] = useState(new Audio());

  const isVSL = creationMode === 'vsl';
  const voices = settings.voices || [];

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

  return (
    <div className="video-slots">
      <div className="video-slots-header">
        <div className="variation-count-control">
          <label className="control-label" style={{ margin: 0 }}>
            {isVSL ? 'VSL Video Variations' : 'Number of Ads'}
          </label>
          <div className="variation-count-input">
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setAdCount(Math.max(1, ads.length - 1))}
              disabled={ads.length <= 1}
            >−</button>
            <input
              type="number"
              className="glass-input"
              value={ads.length}
              min={1}
              max={50}
              onChange={(e) => {
                const val = Math.max(1, Math.min(50, parseInt(e.target.value) || 1));
                setAdCount(val);
              }}
              style={{ width: '60px', textAlign: 'center' }}
            />
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setAdCount(Math.min(50, ads.length + 1))}
            >+</button>
          </div>
        </div>
      </div>

      <div className="video-slots-list">
        <ErrorBoundary>
        {ads.map((ad, index) => (
          <div key={ad.id} className={`video-slot glass-card ${ad.status !== 'idle' ? `video-status-${ad.status}` : ''}`}>
            <div className="video-slot-header">
              <span className="video-slot-number">
                {isVSL ? `Variation #${index + 1}` : `Ad #${index + 1}`}
              </span>
              <StatusBadge status={ad.status} progress={ad.progress} />
            </div>

            <div className="video-slot-content">
              {/* Left Column: All Controls */}
              <div className="video-slot-controls">
                {isVSL ? (
                  /* VSL mode — no script needed */
                  <div className="vsl-slot-info">
                    <div className="vsl-info-card">
                      <span className="vsl-info-icon">🎙️</span>
                      <div className="vsl-info-text">
                        <span className="vsl-info-title">VSL + B-Roll Interleave</span>
                        <span className="vsl-info-desc">
                          {vslVideo
                            ? `Person talking → B-rolls → Person → B-rolls → ... → Person (${Math.round(vslVideo.duration)}s total)`
                            : 'Upload a VSL video to generate variations'
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* B-Roll or Hook+B-Roll — script textarea */
                  <textarea
                    className="glass-input video-script-input"
                    value={ad.script}
                    onChange={(e) => updateAdScript(ad.id, e.target.value)}
                    placeholder={`Write voiceover script for Ad #${index + 1}...`}
                    rows={4}
                    disabled={ad.status !== 'idle' && ad.status !== 'error'}
                  />
                )}

                {/* Per-Ad Voice Selector — always shown for non-VSL when voices are loaded */}
                {!isVSL && voices.length > 0 && (
                  <div className="ad-voice-selector">
                    <div className="voice-selector-label">
                      <span className="voice-icon">🎙️</span>
                      <span>Voice</span>
                    </div>
                    <div className="voice-selector-controls">
                      <select
                        className="glass-input"
                        value={ad.voiceId || ''}
                        onChange={(e) => updateAd(ad.id, { voiceId: e.target.value })}
                        disabled={ad.status !== 'idle' && ad.status !== 'error'}
                      >
                        <option value="">Global — {voices.find(v => v.id === settings.voiceId)?.name || 'Default'}</option>
                        {voices.map(v => (
                          <option key={v.id} value={v.id}>{v.name} — {v.category}</option>
                        ))}
                      </select>
                      <button
                        className={`btn btn-sm voice-preview-btn ${previewingVoiceId === (ad.voiceId || settings.voiceId) ? 'playing' : ''}`}
                        onClick={() => {
                          const voiceId = ad.voiceId || settings.voiceId;
                          const voice = voices.find(v => v.id === voiceId);
                          if (voice) togglePreview(voice);
                        }}
                        title="Preview Voice"
                        type="button"
                      >
                        {previewingVoiceId === (ad.voiceId || settings.voiceId) ? '⏹️ Stop' : '▶️ Play'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Text Overlay — available in all modes */}
                <BRollTextOverlay
                  adId={ad.id}
                  textOverlay={ad.textOverlay}
                  disabled={ad.status !== 'idle' && ad.status !== 'error'}
                />

                {/* CapCut Auto-Captions — only relevant if there's voiceover (b-roll and hook-broll mode) */}
                {!isVSL && (
                  <CaptionsSettings
                    adId={ad.id}
                    captionsConfig={ad.captionsConfig}
                    disabled={ad.status !== 'idle' && ad.status !== 'error'}
                  />
                )}
              </div>

              {/* Right Column: Visual Preview */}
              <BRollPreview
                textOverlay={ad.textOverlay}
                captionsConfig={ad.captionsConfig}
              />
            </div>

            {ad.error && (
              <div className="ad-error">⚠️ {ad.error}</div>
            )}

            {ad.voiceoverDuration > 0 && (
              <div className="video-voice-info">
                <span>🎙️ {ad.voiceoverDuration.toFixed(1)}s voiceover</span>
              </div>
            )}

            {ad.status !== 'idle' && ad.status !== 'done' && ad.status !== 'error' && (
              <div className="progress-bar" style={{ marginTop: '8px' }}>
                <div className="progress-bar-fill" style={{ width: `${ad.progress}%` }} />
              </div>
            )}

            {ad.outputUrl && ad.status === 'done' && (
              <div className="ad-output-actions">
                <a
                  href={ad.outputUrl}
                  download={`ad_${index + 1}.mp4`}
                  className="btn btn-primary btn-sm"
                >💾 Download</a>
              </div>
            )}
          </div>
        ))}
        </ErrorBoundary>
      </div>
    </div>
  );
}

function StatusBadge({ status, progress }) {
  switch (status) {
    case 'idle': return null;
    case 'generating-voice': return <span className="badge badge-accent">🎙️ Generating voice...</span>;
    case 'analyzing': return <span className="badge badge-accent">🔍 Analyzing scenes...</span>;
    case 'building-timeline': return <span className="badge badge-accent">📐 Building timeline...</span>;
    case 'assembling': return <span className="badge badge-warning">🎬 Assembling {progress}%</span>;
    case 'done': return <span className="badge badge-success">✓ Done</span>;
    case 'error': return <span className="badge" style={{ background: 'rgba(245,69,92,0.15)', color: 'var(--danger)' }}>✕ Error</span>;
    default: return null;
  }
}

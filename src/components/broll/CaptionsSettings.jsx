import React, { useState, useCallback } from 'react';
import { useBRoll } from '../../context/BRollContext';
import { DEFAULT_CAPTIONS_CONFIG } from '../../context/BRollContext';

const FONT_FAMILIES = [
  'Inter', 'Montserrat', 'Poppins', 'Oswald', 'Playfair Display',
  'Roboto', 'Arial', 'Georgia', 'Verdana', 'Impact',
];

function MiniSection({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overlay-mini-section">
      <div className="overlay-mini-header" onClick={() => setOpen(o => !o)}>
        <span>{title}</span>
        <span className={`section-chevron ${open ? 'open' : ''}`}>▾</span>
      </div>
      {open && <div className="overlay-mini-body">{children}</div>}
    </div>
  );
}

export default function CaptionsSettings({ adId, captionsConfig, disabled = false }) {
  const { updateAd } = useBRoll();
  const [expanded, setExpanded] = useState(false);

  const config = captionsConfig || DEFAULT_CAPTIONS_CONFIG;

  const update = useCallback((field, value) => {
    updateAd(adId, {
      captionsConfig: { ...config, [field]: value }
    });
  }, [adId, config, updateAd]);

  if (disabled) return null;

  return (
    <div className="broll-text-overlay captions-settings border-top">
      <div className="overlay-header" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="overlay-title-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => update('enabled', e.target.checked)}
            />
            <span className="slider round"></span>
          </label>
          <label className="overlay-label" style={{ margin: 0 }}>CapCut Auto-Captions</label>
        </div>
        
        {config.enabled && (
          <button
            className="btn-icon"
            onClick={() => setExpanded(!expanded)}
            title="Caption Settings"
          >
            ⚙️ {expanded ? 'Close' : 'Settings'}
          </button>
        )}
      </div>

      {config.enabled && expanded && (
        <div className="overlay-settings-panel captions-panel">
          
          <MiniSection title="Font & Style" defaultOpen={true}>
            <div className="settings-grid">
              <div className="setting-group">
                <label>Font Family</label>
                <select value={config.fontFamily} onChange={(e) => update('fontFamily', e.target.value)}>
                  {FONT_FAMILIES.map(ff => <option key={ff} value={ff}>{ff}</option>)}
                </select>
              </div>
              <div className="setting-group">
                <label>Size</label>
                <div className="scrubber-input">
                  <input type="range" min="20" max="120" value={config.fontSize} onChange={(e) => update('fontSize', parseInt(e.target.value))} />
                  <span>{config.fontSize}px</span>
                </div>
              </div>
            </div>
            <div className="settings-grid" style={{ marginTop: '10px' }}>
              <div className="setting-group">
                <label>Text Color</label>
                <input type="color" className="color-picker" value={config.textColor} onChange={(e) => update('textColor', e.target.value)} />
              </div>
              <div className="setting-group">
                <label>Word Highlight</label>
                <input type="color" className="color-picker" value={config.highlightColor} onChange={(e) => update('highlightColor', e.target.value)} />
              </div>
            </div>
          </MiniSection>

          <MiniSection title="Position & Layout" defaultOpen={true}>
             <div className="settings-grid">
              <div className="setting-group">
                <label>Vertical Position</label>
                <div className="scrubber-input">
                  <input type="range" min="10" max="95" value={config.yPosition} onChange={(e) => update('yPosition', parseInt(e.target.value))} />
                  <span>{config.yPosition}% (from top)</span>
                </div>
              </div>
              <div className="setting-group">
                <label>Words per line</label>
                <div className="scrubber-input">
                  <input type="range" min="1" max="10" value={config.maxWordsPerLine} onChange={(e) => update('maxWordsPerLine', parseInt(e.target.value))} />
                  <span>{config.maxWordsPerLine} words</span>
                </div>
              </div>
            </div>
          </MiniSection>

          <MiniSection title="Stroke & Background" defaultOpen={false}>
            <div className="settings-grid">
              <div className="setting-group toggle-group" style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <input type="checkbox" checked={config.strokeEnabled} onChange={(e) => update('strokeEnabled', e.target.checked)} id={`stroke-${adId}`} />
                <label htmlFor={`stroke-${adId}`} style={{margin:0}}>Enable Stroke</label>
              </div>
              {config.strokeEnabled && (
                <div className="setting-group row-flex">
                  <input type="color" className="color-picker compact" value={config.strokeColor} onChange={(e) => update('strokeColor', e.target.value)} />
                  <input type="number" className="compact-num" title="Stroke Width" min="1" max="20" value={config.strokeWidth} onChange={(e) => update('strokeWidth', parseInt(e.target.value))} />
                </div>
              )}
            </div>

            <div className="settings-grid" style={{ marginTop: '10px' }}>
              <div className="setting-group toggle-group" style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <input type="checkbox" checked={config.bgEnabled} onChange={(e) => update('bgEnabled', e.target.checked)} id={`bg-${adId}`} />
                <label htmlFor={`bg-${adId}`} style={{margin:0}}>Opaque Highlight Box</label>
              </div>
            </div>
          </MiniSection>
        </div>
      )}
    </div>
  );
}

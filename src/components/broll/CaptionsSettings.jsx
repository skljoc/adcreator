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
      <div className="overlay-title-row" style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
          <label className="toggle-switch" style={{ margin: 0 }}>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => update('enabled', e.target.checked)}
              disabled={disabled}
            />
            <span className="slider round"></span>
          </label>
          <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)' }}>CapCut Auto-Captions</span>
        </div>
        
        {config.enabled && (
          <button
            className={`btn btn-sm ${expanded ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setExpanded(!expanded)}
            title="Caption Settings"
            disabled={disabled}
          >
            ⚙️
          </button>
        )}
      </div>

      {config.enabled && expanded && (
        <div className="overlay-options animate-slide-up">
          
          <MiniSection title="Font & Style" defaultOpen={true}>
            <div className="overlay-row">
              <div className="overlay-col">
                <label className="control-label">Font Family</label>
                <select 
                  className="glass-input" 
                  value={config.fontFamily} 
                  onChange={(e) => update('fontFamily', e.target.value)}
                  disabled={disabled}
                >
                  {FONT_FAMILIES.map(ff => <option key={ff} value={ff}>{ff}</option>)}
                </select>
              </div>
            </div>
            
            <div className="overlay-row">
              <div className="overlay-col">
                <label className="control-label">
                  Size <span className="value">{config.fontSize}px</span>
                </label>
                <input 
                  type="range" min="20" max="120" 
                  value={config.fontSize} 
                  onChange={(e) => update('fontSize', parseInt(e.target.value))} 
                  disabled={disabled}
                />
              </div>
            </div>

            <div className="overlay-row">
              <div className="overlay-col">
                <label className="control-label">Text Color</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="color" className="color-picker" value={config.textColor} onChange={(e) => update('textColor', e.target.value)} disabled={disabled} />
                  <span className="value">{config.textColor}</span>
                </div>
              </div>
              <div className="overlay-col">
                <label className="control-label">Word Highlight</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="color" className="color-picker" value={config.highlightColor} onChange={(e) => update('highlightColor', e.target.value)} disabled={disabled} />
                  <span className="value">{config.highlightColor}</span>
                </div>
              </div>
            </div>
          </MiniSection>

          <MiniSection title="Position & Layout" defaultOpen={true}>
             <div className="overlay-row">
              <div className="overlay-col">
                <label className="control-label">
                  Vertical Position <span className="value">{config.yPosition}% (from top)</span>
                </label>
                <input 
                  type="range" min="10" max="95" 
                  value={config.yPosition} 
                  onChange={(e) => update('yPosition', parseInt(e.target.value))} 
                  disabled={disabled}
                />
              </div>
            </div>
            <div className="overlay-row">
              <div className="overlay-col">
                <label className="control-label">
                  Words per line <span className="value">{config.maxWordsPerLine} words</span>
                </label>
                <input 
                  type="range" min="1" max="10" 
                  value={config.maxWordsPerLine} 
                  onChange={(e) => update('maxWordsPerLine', parseInt(e.target.value))} 
                  disabled={disabled}
                />
              </div>
            </div>
          </MiniSection>

          <MiniSection title="Stroke & Background" defaultOpen={false}>
            <div className="overlay-row" style={{ alignItems: 'center' }}>
              <div className="overlay-col" style={{ flex: '0 0 auto' }}>
                <label className="toggle-switch" style={{ margin: 0 }}>
                  <input type="checkbox" checked={config.strokeEnabled} onChange={(e) => update('strokeEnabled', e.target.checked)} disabled={disabled} />
                  <span className="slider round"></span>
                </label>
              </div>
              <div className="overlay-col">
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Enable Stroke</span>
              </div>
            </div>

            {config.strokeEnabled && (
              <div className="overlay-row">
                <div className="overlay-col">
                  <label className="control-label">Stroke Color</label>
                  <input type="color" className="color-picker" value={config.strokeColor} onChange={(e) => update('strokeColor', e.target.value)} disabled={disabled} />
                </div>
                <div className="overlay-col">
                  <label className="control-label">
                    Width <span className="value">{config.strokeWidth}px</span>
                  </label>
                  <input type="range" min="1" max="20" value={config.strokeWidth} onChange={(e) => update('strokeWidth', parseInt(e.target.value))} disabled={disabled} />
                </div>
              </div>
            )}

            <div className="overlay-row" style={{ alignItems: 'center', marginTop: '1rem' }}>
              <div className="overlay-col" style={{ flex: '0 0 auto' }}>
                <label className="toggle-switch" style={{ margin: 0 }}>
                  <input type="checkbox" checked={config.bgEnabled} onChange={(e) => update('bgEnabled', e.target.checked)} disabled={disabled} />
                  <span className="slider round"></span>
                </label>
              </div>
              <div className="overlay-col">
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Opaque Highlight Box</span>
              </div>
            </div>
          </MiniSection>
        </div>
      )}
    </div>
  );
}

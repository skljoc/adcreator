import React, { useCallback } from 'react';
import { useBRoll } from '../../context/BRollContext';
import { DEFAULT_CAPTIONS_CONFIG } from '../../context/BRollContext';

const FONT_FAMILIES = [
  'Inter', 'Montserrat', 'Poppins', 'Oswald', 'Playfair Display',
  'Roboto', 'Arial', 'Georgia', 'Verdana', 'Impact',
];

export default function CaptionsSettings({ adId, captionsConfig, disabled = false }) {
  const { updateAd, applyStylesGlobally } = useBRoll();
  const config = captionsConfig || DEFAULT_CAPTIONS_CONFIG;

  const update = useCallback((field, value) => {
    updateAd(adId, {
      captionsConfig: { ...config, [field]: value }
    });
  }, [adId, config, updateAd]);

  if (disabled) return null;

  return (
    <div className="captions-settings-v2">
      <div className="captions-header">
        <div className="captions-toggle-wrap">
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => update('enabled', e.target.checked)}
              disabled={disabled}
            />
            <span className="slider round"></span>
          </label>
          <span className="captions-label">Auto-Captions {config.enabled ? 'ON' : 'OFF'}</span>
        </div>

        <button 
          className="btn btn-secondary btn-xs"
          onClick={() => applyStylesGlobally(adId)}
          title="Copy this ad's Title & Caption styles to ALL other ads"
        >
          ✨ Apply Styles Globally
        </button>
      </div>

      {config.enabled && (
        <div className="captions-grid animate-slide-up">
          <div className="captions-row">
            <div className="captions-field">
              <label>Font</label>
              <select 
                className="glass-input" 
                value={config.fontFamily} 
                onChange={(e) => update('fontFamily', e.target.value)}
              >
                {FONT_FAMILIES.map(ff => <option key={ff} value={ff}>{ff}</option>)}
              </select>
            </div>
            <div className="captions-field">
              <label>Size ({config.fontSize}px)</label>
              <input 
                type="range" min="20" max="150" 
                value={config.fontSize} 
                onChange={(e) => update('fontSize', parseInt(e.target.value))} 
              />
            </div>
          </div>

          <div className="captions-row">
            <div className="captions-field">
              <label>Text Color</label>
              <div className="color-input-wrap">
                <input type="color" value={config.textColor} onChange={(e) => update('textColor', e.target.value)} />
                <span>{config.textColor}</span>
              </div>
            </div>
            <div className="captions-field">
              <label>Highlight</label>
              <div className="color-input-wrap">
                <input type="color" value={config.highlightColor} onChange={(e) => update('highlightColor', e.target.value)} />
                <span>{config.highlightColor}</span>
              </div>
            </div>
          </div>

          <div className="captions-row">
            <div className="captions-field">
              <label>Vertical Position ({config.yPosition}%)</label>
              <input 
                type="range" min="10" max="95" 
                value={config.yPosition} 
                onChange={(e) => update('yPosition', parseInt(e.target.value))} 
              />
            </div>
            <div className="captions-field">
              <label>Words per line ({config.maxWordsPerLine})</label>
              <input 
                type="range" min="1" max="6" 
                value={config.maxWordsPerLine} 
                onChange={(e) => update('maxWordsPerLine', parseInt(e.target.value))} 
              />
            </div>
          </div>

          <div className="captions-row options-row">
            <label className="checkbox-wrap">
              <input type="checkbox" checked={config.strokeEnabled} onChange={(e) => update('strokeEnabled', e.target.checked)} />
              <span>Enable Stroke</span>
            </label>
            <label className="checkbox-wrap">
              <input type="checkbox" checked={config.bgEnabled} onChange={(e) => update('bgEnabled', e.target.checked)} />
              <span>Opaque Box</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

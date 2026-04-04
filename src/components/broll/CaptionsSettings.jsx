import React, { useState, useCallback, useEffect } from 'react';
import { useBRoll } from '../../context/BRollContext';
import { DEFAULT_CAPTIONS_CONFIG } from '../../context/BRollContext';

const FONT_FAMILIES = [
  'Inter', 'Montserrat', 'Poppins', 'Oswald', 'Playfair Display',
  'Roboto', 'Arial', 'Georgia', 'Verdana', 'Impact',
];

const CAPTION_PRESETS = [
  {
    name: 'CapCut Classic',
    config: {
      fontFamily: 'Inter',
      fontSize: 75,
      fontWeight: '800',
      textColor: '#FFFFFF',
      highlightColor: '#FFE600',
      strokeEnabled: true,
      strokeColor: '#000000',
      strokeWidth: 4,
      shadowEnabled: true,
      shadowColor: 'rgba(0,0,0,0.8)',
      shadowBlur: 10,
      shadowOffsetY: 4,
      bgEnabled: false,
      yPosition: 70,
      maxWordsPerLine: 4,
    }
  },
  {
    name: 'Neon Pop',
    config: {
      fontFamily: 'Montserrat',
      fontSize: 75,
      fontWeight: '900',
      textColor: '#FFFFFF',
      highlightColor: '#FF3366',
      strokeEnabled: true,
      strokeColor: '#1a0030',
      strokeWidth: 5,
      shadowEnabled: true,
      shadowColor: 'rgba(255,51,102,0.6)',
      shadowBlur: 16,
      shadowOffsetY: 0,
      bgEnabled: false,
      yPosition: 70,
      maxWordsPerLine: 3,
    }
  },
  {
    name: 'Clean Minimal',
    config: {
      fontFamily: 'Poppins',
      fontSize: 75,
      fontWeight: '700',
      textColor: '#FFFFFF',
      highlightColor: '#00D4AA',
      strokeEnabled: false,
      strokeColor: '#000000',
      strokeWidth: 0,
      shadowEnabled: true,
      shadowColor: 'rgba(0,0,0,0.5)',
      shadowBlur: 8,
      shadowOffsetY: 3,
      bgEnabled: false,
      yPosition: 70,
      maxWordsPerLine: 5,
    }
  },
  {
    name: 'Bold Box',
    config: {
      fontFamily: 'Impact',
      fontSize: 75,
      fontWeight: '400',
      textColor: '#FFFFFF',
      highlightColor: '#FF6B00',
      strokeEnabled: false,
      strokeColor: '#000000',
      strokeWidth: 0,
      shadowEnabled: false,
      shadowColor: 'rgba(0,0,0,0.5)',
      shadowBlur: 0,
      shadowOffsetY: 0,
      bgEnabled: true,
      bgColor: 'rgba(0,0,0,0.75)',
      yPosition: 70,
      maxWordsPerLine: 4,
    }
  },
];

export default function CaptionsSettings({ adId, captionsConfig, disabled = false }) {
  const { updateAd, applyStylesGlobally } = useBRoll();
  const config = captionsConfig || DEFAULT_CAPTIONS_CONFIG;
  const [expanded, setExpanded] = useState(false);
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('vae-caption-templates')) || [];
      setTemplates(saved);
    } catch (e) { console.error('Failed to parse caption templates:', e); }
  }, []);

  const handleReset = () => {
    updateAd(adId, { captionsConfig: { ...DEFAULT_CAPTIONS_CONFIG } });
  };

  const handleSaveTemplate = () => {
    const name = window.prompt("Enter a name for this caption template:");
    if (!name) return;
    const newTemplate = { name, config };
    const updated = [...templates, newTemplate];
    setTemplates(updated);
    localStorage.setItem('vae-caption-templates', JSON.stringify(updated));
  };

  const handleLoadTemplate = (e) => {
    const tmplName = e.target.value;
    if (!tmplName) return;
    const tmpl = templates.find(t => t.name === tmplName);
    if (tmpl) {
      updateAd(adId, { captionsConfig: tmpl.config });
    }
    e.target.value = '';
  };

  const update = useCallback((field, value) => {
    updateAd(adId, {
      captionsConfig: { ...config, [field]: value }
    });
  }, [adId, config, updateAd]);

  const applyPreset = useCallback((preset) => {
    updateAd(adId, {
      captionsConfig: { ...config, ...preset.config, enabled: true }
    });
  }, [adId, config, updateAd]);

  return (
    <div className="captions-settings-v2">
      <div className="captions-header">
        <div className="captions-toggle-wrap">
          {/* BIG visible toggle button */}
          <button
            type="button"
            className={`caption-toggle-btn ${config.enabled ? 'on' : 'off'}`}
            onClick={() => update('enabled', !config.enabled)}
            disabled={disabled}
          >
            <span className="caption-toggle-knob" />
          </button>
          <span className={`captions-label ${config.enabled ? 'status-on' : 'status-off'}`}>
            {config.enabled ? '🔤 Captions ON' : 'Captions OFF'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          {config.enabled && (
            <button
              className="btn btn-secondary btn-xs"
              onClick={() => setExpanded(!expanded)}
              title="Caption Settings"
              disabled={disabled}
            >
              ⚙️ {expanded ? 'Hide' : 'Settings'}
            </button>
          )}
          <button 
            className="btn btn-secondary btn-xs"
            onClick={() => applyStylesGlobally(adId)}
            title="Copy this ad's Title & Caption styles to ALL other ads"
            disabled={disabled}
          >
            ✨ Apply Styles Globally
          </button>
        </div>
      </div>

      {config.enabled && expanded && (
        <div className="captions-grid animate-slide-up">
          {/* Presets Row */}
          <div className="captions-presets">
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '6px', display: 'block' }}>
              Style Presets
            </label>
            <div className="caption-preset-grid">
              {CAPTION_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  className={`caption-preset-btn ${
                    config.fontFamily === preset.config.fontFamily && 
                    config.highlightColor === preset.config.highlightColor 
                      ? 'active' : ''
                  }`}
                  onClick={() => applyPreset(preset)}
                  disabled={disabled}
                  type="button"
                >
                  <span className="preset-preview" style={{ color: preset.config.highlightColor }}>Aa</span>
                  <span className="preset-name">{preset.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="captions-row">
            <div className="captions-field">
              <label>Font</label>
              <select 
                className="glass-input" 
                value={config.fontFamily} 
                onChange={(e) => update('fontFamily', e.target.value)}
                disabled={disabled}
              >
                {FONT_FAMILIES.map(ff => <option key={ff} value={ff}>{ff}</option>)}
              </select>
            </div>
            <div className="captions-field">
              <label>Weight</label>
              <select 
                className="glass-input" 
                value={config.fontWeight} 
                onChange={(e) => update('fontWeight', e.target.value)}
                disabled={disabled}
              >
                <option value="400">Regular</option>
                <option value="500">Medium</option>
                <option value="600">Semibold</option>
                <option value="700">Bold</option>
                <option value="800">ExtraBold</option>
                <option value="900">Black</option>
              </select>
            </div>
          </div>

          <div className="captions-row">
            <div className="captions-field">
              <label>Size ({config.fontSize}px)</label>
              <input 
                type="range" min="40" max="180" 
                value={config.fontSize} 
                onChange={(e) => update('fontSize', parseInt(e.target.value))} 
                disabled={disabled}
              />
            </div>
          </div>

          <div className="captions-row">
            <div className="captions-field">
              <label>Text Color</label>
              <div className="color-input-wrap">
                <input type="color" value={config.textColor} onChange={(e) => update('textColor', e.target.value)} disabled={disabled} />
                <span>{config.textColor}</span>
              </div>
            </div>
            <div className="captions-field">
              <label>Highlight Color</label>
              <div className="color-input-wrap">
                <input type="color" value={config.highlightColor} onChange={(e) => update('highlightColor', e.target.value)} disabled={disabled} />
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
                disabled={disabled}
              />
            </div>
            <div className="captions-field">
              <label>Words per line ({config.maxWordsPerLine})</label>
              <input 
                type="range" min="1" max="8" 
                value={config.maxWordsPerLine} 
                onChange={(e) => update('maxWordsPerLine', parseInt(e.target.value))} 
                disabled={disabled}
              />
            </div>
          </div>

          <div className="captions-divider" />

          <div className="captions-row options-row">
            <label className="checkbox-wrap">
              <input type="checkbox" checked={config.strokeEnabled} onChange={(e) => update('strokeEnabled', e.target.checked)} disabled={disabled} />
              <span>Stroke</span>
            </label>
            <label className="checkbox-wrap">
              <input type="checkbox" checked={config.shadowEnabled} onChange={(e) => update('shadowEnabled', e.target.checked)} disabled={disabled} />
              <span>Shadow</span>
            </label>
            <label className="checkbox-wrap">
              <input type="checkbox" checked={config.bgEnabled} onChange={(e) => update('bgEnabled', e.target.checked)} disabled={disabled} />
              <span>BG Box</span>
            </label>
          </div>

          {config.bgEnabled && (
            <div className="captions-row">
              <div className="captions-field">
                <label>BG Box Color</label>
                <div className="color-input-wrap">
                  <input type="color" value={config.bgColor || '#000000'} onChange={(e) => update('bgColor', e.target.value)} disabled={disabled} />
                  <span>{config.bgColor || '#000000'}</span>
                </div>
              </div>
            </div>
          )}

          {config.strokeEnabled && (
            <div className="captions-row">
              <div className="captions-field">
                <label>Stroke Color</label>
                <div className="color-input-wrap">
                  <input type="color" value={config.strokeColor} onChange={(e) => update('strokeColor', e.target.value)} disabled={disabled} />
                  <span>{config.strokeColor}</span>
                </div>
              </div>
              <div className="captions-field">
                <label>Stroke Width ({config.strokeWidth}px)</label>
                <input 
                  type="range" min="1" max="10" 
                  value={config.strokeWidth} 
                  onChange={(e) => update('strokeWidth', parseInt(e.target.value))} 
                  disabled={disabled}
                />
              </div>
            </div>
          )}

          {config.shadowEnabled && (
            <div className="captions-row">
              <div className="captions-field">
                <label>Shadow Blur ({config.shadowBlur}px)</label>
                <input 
                  type="range" min="0" max="30" 
                  value={config.shadowBlur} 
                  onChange={(e) => update('shadowBlur', parseInt(e.target.value))} 
                  disabled={disabled}
                />
              </div>
              <div className="captions-field">
                <label>Shadow Offset ({config.shadowOffsetY}px)</label>
                <input 
                  type="range" min="0" max="15" 
                  value={config.shadowOffsetY} 
                  onChange={(e) => update('shadowOffsetY', parseInt(e.target.value))} 
                  disabled={disabled}
                />
              </div>
            </div>
          )}

          <div className="captions-divider" style={{ margin: '16px 0 12px 0' }} />
          <div className="overlay-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', paddingBottom: '4px' }}>
            <button className="btn btn-secondary btn-sm" onClick={handleReset} disabled={disabled}>
              ↺ Reset Style
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleSaveTemplate} disabled={disabled}>
              💾 Save Custom Template
            </button>
            <select className="glass-input" onChange={handleLoadTemplate} disabled={disabled || templates.length === 0} style={{ padding: '4px 8px', fontSize: '0.8rem', flex: 1, minWidth: '130px' }}>
              <option value="">{templates.length === 0 ? 'No Custom Templates' : 'Load Custom Template...'}</option>
              {templates.map(t => (
                <option key={t.name} value={t.name}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

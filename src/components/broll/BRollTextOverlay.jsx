import React, { useState, useCallback, useEffect } from 'react';
import { useBRoll, DEFAULT_TEXT_OVERLAY } from '../../context/BRollContext';

const FALLBACK_TEXT_OVERLAY = {
  text: '',
  x: 50,
  y: 50,
  fontSize: 48,
  fontFamily: 'Inter',
  fontWeight: '700',
  fontStyle: 'normal',
  color: '#FFFFFF',
  backgroundColor: 'transparent',
  bgEnabled: false,
  bgStyle: 'highlight',
  backgroundPadding: 14,
  borderRadius: 8,
  textAlign: 'center',
  letterSpacing: 0,
  lineHeight: 1.3,
  shadow: { enabled: false, color: '#000000', blur: 6, offsetX: 2, offsetY: 2 },
  stroke: { enabled: false, color: '#000000', width: 2 },
  opacity: 1,
  rotation: 0,
};

const FONT_FAMILIES = [
  'Inter', 'Montserrat', 'Poppins', 'Oswald', 'Playfair Display',
  'Roboto', 'Arial', 'Georgia', 'Verdana', 'Impact',
  'Courier New', 'Times New Roman',
];

const FONT_WEIGHTS = [
  { label: 'Light', value: '300' },
  { label: 'Regular', value: '400' },
  { label: 'Medium', value: '500' },
  { label: 'Semibold', value: '600' },
  { label: 'Bold', value: '700' },
  { label: 'Extrabold', value: '800' },
  { label: 'Black', value: '900' },
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

export default function BRollTextOverlay({ adId, textOverlay, disabled = false }) {
  const { updateAdTextOverlay, updateAd } = useBRoll();
  const [expanded, setExpanded] = useState(false);
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('vae-title-templates')) || [];
      setTemplates(saved);
    } catch (e) { console.error('Failed to parse title templates:', e); }
  }, []);

  const handleReset = () => {
    updateAd(adId, { textOverlay: { ...DEFAULT_TEXT_OVERLAY } });
  };

  const handleSaveTemplate = () => {
    const name = window.prompt("Enter a name for this title template:");
    if (!name) return;
    const newTemplate = { name, config: textOverlay };
    const updated = [...templates, newTemplate];
    setTemplates(updated);
    localStorage.setItem('vae-title-templates', JSON.stringify(updated));
  };

  const handleLoadTemplate = (e) => {
    const tmplName = e.target.value;
    if (!tmplName) return;
    const tmpl = templates.find(t => t.name === tmplName);
    if (tmpl) {
      updateAd(adId, { textOverlay: tmpl.config });
    }
    e.target.value = '';
  };

  const update = useCallback((field, value) => {
    updateAdTextOverlay(adId, { [field]: value });
  }, [adId, updateAdTextOverlay]);

  const updateNested = useCallback((parent, field, value) => {
    updateAdTextOverlay(adId, { [parent]: { [field]: value } });
  }, [adId, updateAdTextOverlay]);

  const tc = textOverlay || FALLBACK_TEXT_OVERLAY;
  const shadow = tc.shadow || FALLBACK_TEXT_OVERLAY.shadow;
  const stroke = tc.stroke || FALLBACK_TEXT_OVERLAY.stroke;
  const hasText = tc.text && tc.text.trim();

  return (
    <div className="broll-text-overlay">
      {/* Title Input — always visible */}
      <div className="overlay-title-row">
        <textarea
          className="glass-input overlay-title-input"
          value={tc.text}
          onChange={(e) => update('text', e.target.value)}
          placeholder="Text overlay title (optional)...\nUse Enter for new lines"
          disabled={disabled}
          rows={2}
        />
        {hasText && (
          <button
            className={`btn btn-sm ${expanded ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setExpanded(e => !e)}
            title="Text style options"
            disabled={disabled}
          >
            ⚙️
          </button>
        )}
      </div>

      {/* Expanded options — only when text is entered and gear clicked */}
      {hasText && expanded && (
        <div className="overlay-options animate-slide-up">
          {/* Typography */}
          <MiniSection title="Typography" defaultOpen={true}>
            <div className="overlay-row">
              <div className="overlay-col">
                <label className="control-label">Font</label>
                <select
                  className="glass-input"
                  value={tc.fontFamily}
                  onChange={(e) => update('fontFamily', e.target.value)}
                  disabled={disabled}
                >
                  {FONT_FAMILIES.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overlay-row">
              <div className="overlay-col">
                <label className="control-label">
                  Size <span className="value">{tc.fontSize}px</span>
                </label>
                <input
                  type="range" min="12" max="200"
                  value={tc.fontSize}
                  onChange={(e) => update('fontSize', Number(e.target.value))}
                  disabled={disabled}
                />
              </div>
            </div>

            <div className="overlay-row">
              <div className="overlay-col">
                <label className="control-label">Weight</label>
                <select
                  className="glass-input"
                  value={tc.fontWeight}
                  onChange={(e) => update('fontWeight', e.target.value)}
                  disabled={disabled}
                >
                  {FONT_WEIGHTS.map(w => (
                    <option key={w.value} value={w.value}>{w.label}</option>
                  ))}
                </select>
              </div>
              <div className="overlay-col" style={{ flex: '0 0 auto' }}>
                <label className="control-label">Style</label>
                <button
                  className={`btn btn-sm ${tc.fontStyle === 'italic' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => update('fontStyle', tc.fontStyle === 'italic' ? 'normal' : 'italic')}
                  style={{ fontStyle: 'italic', minWidth: '36px' }}
                  disabled={disabled}
                >I</button>
              </div>
            </div>

            <div className="overlay-row">
              <div className="overlay-col">
                <label className="control-label">
                  Letter Spacing <span className="value">{tc.letterSpacing}px</span>
                </label>
                <input
                  type="range" min="-5" max="20" step="0.5"
                  value={tc.letterSpacing}
                  onChange={(e) => update('letterSpacing', Number(e.target.value))}
                  disabled={disabled}
                />
              </div>
            </div>

            <div className="overlay-row">
              <div className="overlay-col">
                <label className="control-label">
                  Line Height <span className="value">{tc.lineHeight}</span>
                </label>
                <input
                  type="range" min="0.8" max="3" step="0.1"
                  value={tc.lineHeight}
                  onChange={(e) => update('lineHeight', Number(e.target.value))}
                  disabled={disabled}
                />
              </div>
            </div>

            <div className="overlay-row">
              <label className="control-label">Alignment</label>
              <div className="align-buttons">
                {['left', 'center', 'right'].map(a => (
                  <button
                    key={a}
                    className={`btn btn-sm ${tc.textAlign === a ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => update('textAlign', a)}
                    disabled={disabled}
                  >
                    {a === 'left' ? '◧' : a === 'center' ? '◫' : '◨'}
                  </button>
                ))}
              </div>
            </div>
          </MiniSection>

          {/* Colors */}
          <MiniSection title="Colors" defaultOpen={true}>
            <div className="overlay-row">
              <div className="overlay-col">
                <label className="control-label">Text Color</label>
                <div className="color-picker-row">
                  <input
                    type="color"
                    value={tc.color}
                    onChange={(e) => update('color', e.target.value)}
                    disabled={disabled}
                  />
                  <input
                    type="text"
                    className="glass-input color-hex"
                    value={tc.color}
                    onChange={(e) => update('color', e.target.value)}
                    disabled={disabled}
                  />
                </div>
              </div>
            </div>

            <div className="overlay-row">
              <div className="overlay-col">
                <label className="control-label">
                  Background
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={tc.bgEnabled}
                      onChange={(e) => update('bgEnabled', e.target.checked)}
                      disabled={disabled}
                    />
                    <span className="toggle-slider" />
                  </label>
                </label>
                {tc.bgEnabled && (
                  <>
                    <div className="bg-style-toggle" style={{ marginBottom: '6px' }}>
                      <button
                        className={`bg-toggle-btn ${(tc.bgStyle || 'highlight') === 'highlight' ? 'active' : ''}`}
                        onClick={() => update('bgStyle', 'highlight')}
                        disabled={disabled}
                      >✨ Highlight</button>
                      <button
                        className={`bg-toggle-btn ${tc.bgStyle === 'block' ? 'active' : ''}`}
                        onClick={() => update('bgStyle', 'block')}
                        disabled={disabled}
                      >▬ Block</button>
                    </div>
                    <div className="color-picker-row">
                      <input
                        type="color"
                        value={tc.backgroundColor === 'transparent' ? '#000000' : tc.backgroundColor}
                        onChange={(e) => update('backgroundColor', e.target.value)}
                        disabled={disabled}
                      />
                      <input
                        type="text"
                        className="glass-input color-hex"
                        value={tc.backgroundColor}
                        onChange={(e) => update('backgroundColor', e.target.value)}
                        disabled={disabled}
                      />
                    </div>
                    <div className="overlay-row" style={{ marginTop: '6px' }}>
                      <div className="overlay-col">
                        <label className="control-label">
                          Padding <span className="value">{tc.backgroundPadding}px</span>
                        </label>
                        <input
                          type="range" min="0" max="40"
                          value={tc.backgroundPadding}
                          onChange={(e) => update('backgroundPadding', Number(e.target.value))}
                          disabled={disabled}
                        />
                      </div>
                      <div className="overlay-col">
                        <label className="control-label">
                          Radius <span className="value">{tc.borderRadius}px</span>
                        </label>
                        <input
                          type="range" min="0" max="30"
                          value={tc.borderRadius}
                          onChange={(e) => update('borderRadius', Number(e.target.value))}
                          disabled={disabled}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </MiniSection>

          {/* Effects */}
          <MiniSection title="Effects" defaultOpen={false}>
            <div className="overlay-row">
              <div className="overlay-col">
                <label className="control-label">
                  Drop Shadow
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={shadow.enabled}
                      onChange={(e) => updateNested('shadow', 'enabled', e.target.checked)}
                      disabled={disabled}
                    />
                    <span className="toggle-slider" />
                  </label>
                </label>
                {shadow.enabled && (
                  <div className="nested-controls">
                    <div className="color-picker-row">
                      <input
                        type="color"
                        value={shadow.color}
                        onChange={(e) => updateNested('shadow', 'color', e.target.value)}
                        disabled={disabled}
                      />
                      <span className="control-label" style={{ margin: 0, fontSize: '0.7rem' }}>Shadow Color</span>
                    </div>
                    <div className="overlay-row">
                      <div className="overlay-col">
                        <label className="control-label">
                          Blur <span className="value">{shadow.blur}</span>
                        </label>
                        <input type="range" min="0" max="30" value={shadow.blur}
                          onChange={(e) => updateNested('shadow', 'blur', Number(e.target.value))}
                          disabled={disabled}
                        />
                      </div>
                    </div>
                    <div className="overlay-row">
                      <div className="overlay-col">
                        <label className="control-label">
                          X <span className="value">{shadow.offsetX}</span>
                        </label>
                        <input type="range" min="-20" max="20" value={shadow.offsetX}
                          onChange={(e) => updateNested('shadow', 'offsetX', Number(e.target.value))}
                          disabled={disabled}
                        />
                      </div>
                      <div className="overlay-col">
                        <label className="control-label">
                          Y <span className="value">{shadow.offsetY}</span>
                        </label>
                        <input type="range" min="-20" max="20" value={shadow.offsetY}
                          onChange={(e) => updateNested('shadow', 'offsetY', Number(e.target.value))}
                          disabled={disabled}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="overlay-row" style={{ marginTop: '8px' }}>
              <div className="overlay-col">
                <label className="control-label">
                  Text Stroke
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={stroke.enabled}
                      onChange={(e) => updateNested('stroke', 'enabled', e.target.checked)}
                      disabled={disabled}
                    />
                    <span className="toggle-slider" />
                  </label>
                </label>
                {stroke.enabled && (
                  <div className="nested-controls">
                    <div className="color-picker-row">
                      <input
                        type="color"
                        value={stroke.color}
                        onChange={(e) => updateNested('stroke', 'color', e.target.value)}
                        disabled={disabled}
                      />
                      <span className="control-label" style={{ margin: 0, fontSize: '0.7rem' }}>Stroke Color</span>
                    </div>
                    <div className="overlay-col">
                      <label className="control-label">
                        Width <span className="value">{stroke.width}px</span>
                      </label>
                      <input type="range" min="1" max="10" value={stroke.width}
                        onChange={(e) => updateNested('stroke', 'width', Number(e.target.value))}
                        disabled={disabled}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="overlay-row" style={{ marginTop: '8px' }}>
              <div className="overlay-col">
                <label className="control-label">
                  Opacity <span className="value">{Math.round(tc.opacity * 100)}%</span>
                </label>
                <input type="range" min="0" max="1" step="0.05" value={tc.opacity}
                  onChange={(e) => update('opacity', Number(e.target.value))}
                  disabled={disabled}
                />
              </div>
            </div>

            <div className="overlay-row" style={{ marginTop: '8px' }}>
              <div className="overlay-col">
                <label className="control-label">
                  Rotation <span className="value">{tc.rotation}°</span>
                </label>
                <input type="range" min="-180" max="180" value={tc.rotation}
                  onChange={(e) => update('rotation', Number(e.target.value))}
                  disabled={disabled}
                />
              </div>
            </div>
          </MiniSection>

          {/* Position */}
          <MiniSection title="Position" defaultOpen={false}>
            <div className="overlay-row">
              <div className="overlay-col">
                <label className="control-label">
                  X <span className="value">{Math.round(tc.x)}%</span>
                </label>
                <input type="range" min="0" max="100" value={tc.x}
                  onChange={(e) => update('x', Number(e.target.value))}
                  disabled={disabled}
                />
              </div>
              <div className="overlay-col">
                <label className="control-label">
                  Y <span className="value">{Math.round(tc.y)}%</span>
                </label>
                <input type="range" min="0" max="100" value={tc.y}
                  onChange={(e) => update('y', Number(e.target.value))}
                  disabled={disabled}
                />
              </div>
            </div>

            <div className="overlay-row">
              <label className="control-label">Quick Position</label>
              <div className="preset-grid">
                {[
                  { label: '↖', x: 15, y: 15 },
                  { label: '↑', x: 50, y: 15 },
                  { label: '↗', x: 85, y: 15 },
                  { label: '←', x: 15, y: 50 },
                  { label: '⊙', x: 50, y: 50 },
                  { label: '→', x: 85, y: 50 },
                  { label: '↙', x: 15, y: 85 },
                  { label: '↓', x: 50, y: 85 },
                  { label: '↘', x: 85, y: 85 },
                ].map(p => (
                  <button
                    key={p.label}
                    className="btn btn-secondary preset-btn"
                    onClick={() => {
                      update('x', p.x);
                      update('y', p.y);
                    }}
                    disabled={disabled}
                  >{p.label}</button>
                ))}
              </div>
            </div>
          </MiniSection>

          {/* Timing */}
          <MiniSection title="Timing" defaultOpen={true}>
            <div className="overlay-row">
              <div className="overlay-col">
                <label className="control-label">
                  Duration <span className="value">{tc.duration || 3}s</span>
                </label>
                <input type="range" min="1" max="20" step="1" value={tc.duration || 3}
                  onChange={(e) => update('duration', Number(e.target.value))}
                  disabled={disabled}
                />
              </div>
            </div>
          </MiniSection>

          {/* Bottom Actions */}
          <div className="overlay-actions" style={{ display: 'flex', gap: '8px', padding: '12px', flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <button className="btn btn-secondary btn-sm" onClick={handleReset} disabled={disabled}>
              ↺ Reset Style
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleSaveTemplate} disabled={disabled}>
              💾 Save as Template
            </button>
            <select className="glass-input" onChange={handleLoadTemplate} disabled={disabled || templates.length === 0} style={{ padding: '4px 8px', fontSize: '0.8rem', flex: 1, minWidth: '130px' }}>
              <option value="">{templates.length === 0 ? 'No Templates' : 'Load Template...'}</option>
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

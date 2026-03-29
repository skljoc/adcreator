import React, { useState, useCallback } from 'react';
import { useVideos } from '../context/VideoContext';
import './TextEditor.css';

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

function CollapsibleSection({ title, defaultOpen = true, children }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="editor-collapsible">
      <div className="section-header" onClick={() => setIsOpen(o => !o)}>
        <h3>{title}</h3>
        <span className={`section-chevron ${isOpen ? 'open' : ''}`}>▾</span>
      </div>
      {isOpen && <div className="editor-section">{children}</div>}
    </div>
  );
}

export default function TextEditor() {
  const {
    selectedVideo, globalText, getEffectiveTextConfig,
    updateVideoText, setGlobalText,
    applyGlobalToAll, applyCurrentToAll, resetToGlobal,
  } = useVideos();

  const [editMode, setEditMode] = useState('global'); // 'global' | 'individual'

  const isGlobalMode = editMode === 'global';
  const textConfig = isGlobalMode
    ? globalText
    : (selectedVideo ? getEffectiveTextConfig(selectedVideo) : globalText);

  const updateField = useCallback((field, value) => {
    if (isGlobalMode) {
      setGlobalText({ [field]: value });
    } else if (selectedVideo) {
      updateVideoText(selectedVideo.id, { [field]: value, useGlobal: false });
    }
  }, [isGlobalMode, selectedVideo, setGlobalText, updateVideoText]);

  const updateNestedField = useCallback((parent, field, value) => {
    const current = textConfig[parent] || {};
    const updated = { ...current, [field]: value };
    updateField(parent, updated);
  }, [textConfig, updateField]);

  const handleApplyToAll = () => {
    if (isGlobalMode) {
      applyGlobalToAll();
    } else if (selectedVideo) {
      applyCurrentToAll(selectedVideo.id);
    }
  };

  const handleResetToGlobal = () => {
    if (selectedVideo) {
      resetToGlobal(selectedVideo.id);
    }
  };

  return (
    <div className="text-editor" id="text-editor">
      {/* Mode Toggle */}
      <div className="editor-mode-toggle">
        <button
          className={`mode-btn ${isGlobalMode ? 'active' : ''}`}
          onClick={() => setEditMode('global')}
        >
          🌐 Global
        </button>
        <button
          className={`mode-btn ${!isGlobalMode ? 'active' : ''}`}
          onClick={() => setEditMode('individual')}
        >
          🎯 Individual
        </button>
      </div>

      {!isGlobalMode && !selectedVideo && (
        <div className="editor-notice">
          <span>Select a video to edit its text individually</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="editor-actions">
        <button className="btn btn-primary btn-sm" onClick={handleApplyToAll}>
          📋 Apply to All Videos
        </button>
        {!isGlobalMode && selectedVideo && !textConfig.useGlobal && (
          <button className="btn btn-secondary btn-sm" onClick={handleResetToGlobal}>
            ↩ Reset to Global
          </button>
        )}
      </div>

      {/* Text Content */}
      <CollapsibleSection title="Text Content" defaultOpen={true}>
        <div className="control-group">
          <label className="control-label">Title Text</label>
          <textarea
            className="glass-input"
            value={textConfig.text}
            onChange={(e) => updateField('text', e.target.value)}
            placeholder="Enter your ad title..."
            rows={3}
          />
        </div>
      </CollapsibleSection>

      {/* Typography */}
      <CollapsibleSection title="Typography" defaultOpen={true}>
        <div className="control-group">
          <label className="control-label">Font Family</label>
          <select
            className="glass-input"
            value={textConfig.fontFamily}
            onChange={(e) => updateField('fontFamily', e.target.value)}
          >
            {FONT_FAMILIES.map(f => (
              <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
            ))}
          </select>
        </div>

        <div className="control-row">
          <div className="control-group">
            <label className="control-label">
              Size <span className="value">{textConfig.fontSize}px</span>
            </label>
            <input
              type="range"
              min="12"
              max="200"
              value={textConfig.fontSize}
              onChange={(e) => updateField('fontSize', Number(e.target.value))}
            />
          </div>
        </div>

        <div className="control-row">
          <div className="control-group">
            <label className="control-label">Weight</label>
            <select
              className="glass-input"
              value={textConfig.fontWeight}
              onChange={(e) => updateField('fontWeight', e.target.value)}
            >
              {FONT_WEIGHTS.map(w => (
                <option key={w.value} value={w.value}>{w.label}</option>
              ))}
            </select>
          </div>
          <div className="control-group" style={{ flex: '0 0 auto' }}>
            <label className="control-label">Style</label>
            <button
              className={`btn btn-sm ${textConfig.fontStyle === 'italic' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => updateField('fontStyle', textConfig.fontStyle === 'italic' ? 'normal' : 'italic')}
              style={{ fontStyle: 'italic', minWidth: '36px' }}
            >
              I
            </button>
          </div>
        </div>

        <div className="control-row">
          <div className="control-group">
            <label className="control-label">
              Letter Spacing <span className="value">{textConfig.letterSpacing}px</span>
            </label>
            <input
              type="range"
              min="-5"
              max="20"
              step="0.5"
              value={textConfig.letterSpacing}
              onChange={(e) => updateField('letterSpacing', Number(e.target.value))}
            />
          </div>
        </div>

        <div className="control-row">
          <div className="control-group">
            <label className="control-label">
              Line Height <span className="value">{textConfig.lineHeight}</span>
            </label>
            <input
              type="range"
              min="0.8"
              max="3"
              step="0.1"
              value={textConfig.lineHeight}
              onChange={(e) => updateField('lineHeight', Number(e.target.value))}
            />
          </div>
        </div>

        <div className="control-group">
          <label className="control-label">Alignment</label>
          <div className="align-buttons">
            {['left', 'center', 'right'].map(a => (
              <button
                key={a}
                className={`btn btn-sm ${textConfig.textAlign === a ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => updateField('textAlign', a)}
              >
                {a === 'left' ? '◧' : a === 'center' ? '◫' : '◨'}
              </button>
            ))}
          </div>
        </div>
      </CollapsibleSection>

      {/* Colors */}
      <CollapsibleSection title="Colors" defaultOpen={true}>
        <div className="control-row">
          <div className="control-group">
            <label className="control-label">Text Color</label>
            <div className="color-picker-row">
              <input
                type="color"
                value={textConfig.color}
                onChange={(e) => updateField('color', e.target.value)}
              />
              <input
                type="text"
                className="glass-input color-hex"
                value={textConfig.color}
                onChange={(e) => updateField('color', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="control-group">
          <label className="control-label">
            Background
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={textConfig.bgEnabled}
                onChange={(e) => updateField('bgEnabled', e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </label>
          {textConfig.bgEnabled && (
            <>
              <div className="bg-style-toggle" style={{ marginBottom: '8px' }}>
                <button
                  className={`mode-btn ${(textConfig.bgStyle || 'highlight') === 'highlight' ? 'active' : ''}`}
                  onClick={() => updateField('bgStyle', 'highlight')}
                  style={{ flex: 1 }}
                >
                  ✨ Highlight
                </button>
                <button
                  className={`mode-btn ${textConfig.bgStyle === 'block' ? 'active' : ''}`}
                  onClick={() => updateField('bgStyle', 'block')}
                  style={{ flex: 1 }}
                >
                  ▬ Block
                </button>
              </div>
              <div className="color-picker-row">
                <input
                  type="color"
                  value={textConfig.backgroundColor === 'transparent' ? '#000000' : textConfig.backgroundColor}
                  onChange={(e) => updateField('backgroundColor', e.target.value)}
                />
                <input
                  type="text"
                  className="glass-input color-hex"
                  value={textConfig.backgroundColor}
                  onChange={(e) => updateField('backgroundColor', e.target.value)}
                />
              </div>
              <div className="control-row" style={{ marginTop: '8px' }}>
                <div className="control-group">
                  <label className="control-label">
                    Padding <span className="value">{textConfig.backgroundPadding}px</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    value={textConfig.backgroundPadding}
                    onChange={(e) => updateField('backgroundPadding', Number(e.target.value))}
                  />
                </div>
                <div className="control-group">
                  <label className="control-label">
                    Radius <span className="value">{textConfig.borderRadius}px</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="30"
                    value={textConfig.borderRadius}
                    onChange={(e) => updateField('borderRadius', Number(e.target.value))}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </CollapsibleSection>

      {/* Effects */}
      <CollapsibleSection title="Effects" defaultOpen={false}>
        {/* Shadow */}
        <div className="control-group">
          <label className="control-label">
            Drop Shadow
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={textConfig.shadow.enabled}
                onChange={(e) => updateNestedField('shadow', 'enabled', e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </label>
          {textConfig.shadow.enabled && (
            <div className="nested-controls">
              <div className="color-picker-row">
                <input
                  type="color"
                  value={textConfig.shadow.color}
                  onChange={(e) => updateNestedField('shadow', 'color', e.target.value)}
                />
                <span className="control-label" style={{ margin: 0, fontSize: '0.7rem' }}>Shadow Color</span>
              </div>
              <div className="control-row">
                <div className="control-group">
                  <label className="control-label">
                    Blur <span className="value">{textConfig.shadow.blur}</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="30"
                    value={textConfig.shadow.blur}
                    onChange={(e) => updateNestedField('shadow', 'blur', Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="control-row">
                <div className="control-group">
                  <label className="control-label">
                    X <span className="value">{textConfig.shadow.offsetX}</span>
                  </label>
                  <input
                    type="range"
                    min="-20"
                    max="20"
                    value={textConfig.shadow.offsetX}
                    onChange={(e) => updateNestedField('shadow', 'offsetX', Number(e.target.value))}
                  />
                </div>
                <div className="control-group">
                  <label className="control-label">
                    Y <span className="value">{textConfig.shadow.offsetY}</span>
                  </label>
                  <input
                    type="range"
                    min="-20"
                    max="20"
                    value={textConfig.shadow.offsetY}
                    onChange={(e) => updateNestedField('shadow', 'offsetY', Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Stroke */}
        <div className="control-group" style={{ marginTop: '12px' }}>
          <label className="control-label">
            Text Stroke
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={textConfig.stroke.enabled}
                onChange={(e) => updateNestedField('stroke', 'enabled', e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </label>
          {textConfig.stroke.enabled && (
            <div className="nested-controls">
              <div className="color-picker-row">
                <input
                  type="color"
                  value={textConfig.stroke.color}
                  onChange={(e) => updateNestedField('stroke', 'color', e.target.value)}
                />
                <span className="control-label" style={{ margin: 0, fontSize: '0.7rem' }}>Stroke Color</span>
              </div>
              <div className="control-group">
                <label className="control-label">
                  Width <span className="value">{textConfig.stroke.width}px</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={textConfig.stroke.width}
                  onChange={(e) => updateNestedField('stroke', 'width', Number(e.target.value))}
                />
              </div>
            </div>
          )}
        </div>

        {/* Opacity */}
        <div className="control-group" style={{ marginTop: '12px' }}>
          <label className="control-label">
            Opacity <span className="value">{Math.round(textConfig.opacity * 100)}%</span>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={textConfig.opacity}
            onChange={(e) => updateField('opacity', Number(e.target.value))}
          />
        </div>

        {/* Rotation */}
        <div className="control-group" style={{ marginTop: '12px' }}>
          <label className="control-label">
            Rotation <span className="value">{textConfig.rotation}°</span>
          </label>
          <input
            type="range"
            min="-180"
            max="180"
            value={textConfig.rotation}
            onChange={(e) => updateField('rotation', Number(e.target.value))}
          />
        </div>
      </CollapsibleSection>

      {/* Position */}
      <CollapsibleSection title="Position" defaultOpen={false}>
        <div className="control-row">
          <div className="control-group">
            <label className="control-label">
              X <span className="value">{Math.round(textConfig.x)}%</span>
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={textConfig.x}
              onChange={(e) => updateField('x', Number(e.target.value))}
            />
          </div>
          <div className="control-group">
            <label className="control-label">
              Y <span className="value">{Math.round(textConfig.y)}%</span>
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={textConfig.y}
              onChange={(e) => updateField('y', Number(e.target.value))}
            />
          </div>
        </div>

        <div className="position-presets">
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
                  updateField('x', p.x);
                  updateField('y', p.y);
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}

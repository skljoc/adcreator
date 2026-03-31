import React from 'react';
import './BRollPreview.css';

export default function BRollPreview({ textOverlay, captionsConfig }) {
  const tc = textOverlay;
  const cc = captionsConfig;

  // Sync scaling: 140px preview width vs 1080px actual video width
  const SCALE = 140 / 1080;

  // Mock caption text
  const mockCaption = "This is how your captions will look!";

  // Text Overlay Styles
  const overlayStyle = {
    position: 'absolute',
    left: `${tc.x}%`,
    top: `${tc.y}%`,
    transform: `translate(-50%, -50%) rotate(${tc.rotation}deg)`,
    color: tc.color,
    fontSize: `${tc.fontSize * SCALE}px`, // Unified scaling
    fontFamily: tc.fontFamily,
    fontWeight: tc.fontWeight,
    fontStyle: tc.fontStyle,
    textAlign: tc.textAlign,
    letterSpacing: `${tc.letterSpacing * SCALE}px`,
    lineHeight: tc.lineHeight,
    opacity: tc.opacity,
    padding: tc.bgEnabled ? `${tc.backgroundPadding * SCALE}px` : '0',
    backgroundColor: tc.bgEnabled ? tc.backgroundColor : 'transparent',
    borderRadius: tc.bgEnabled ? `${tc.borderRadius * SCALE}px` : '0',
    zIndex: 10,
    pointerEvents: 'none',
    whiteSpace: 'pre-wrap',
    width: '80%',
    display: 'flex',
    justifyContent: tc.textAlign === 'center' ? 'center' : tc.textAlign === 'right' ? 'flex-end' : 'flex-start',
  };

  // Shadow/Stroke for Text Overlay
  if (tc.shadow?.enabled) {
    overlayStyle.textShadow = `${tc.shadow.offsetX * SCALE}px ${tc.shadow.offsetY * SCALE}px ${tc.shadow.blur * SCALE}px ${tc.shadow.color}`;
  }
  if (tc.stroke?.enabled) {
    overlayStyle.WebkitTextStroke = `${tc.stroke.width * SCALE}px ${tc.stroke.color}`;
  }

  // Highlight style logic
  if (tc.bgEnabled && tc.bgStyle === 'highlight') {
    // In CSS we can't easily do the per-line highlight effect without wrapping each line,
    // so for preview we'll just show it as a block or handle it with box-decoration-break if supported.
    overlayStyle.boxDecorationBreak = 'clone';
    overlayStyle.WebkitBoxDecorationBreak = 'clone';
  }

  // Captions Styles
  const captionsStyle = {
    position: 'absolute',
    left: '50%',
    top: `${cc.yPosition}%`,
    transform: 'translateX(-50%)',
    width: '90%',
    textAlign: 'center',
    fontFamily: cc.fontFamily,
    fontSize: `${cc.fontSize * SCALE}px`, // Unified scaling
    fontWeight: cc.fontWeight,
    color: cc.textColor,
    zIndex: 20,
    pointerEvents: 'none',
    textTransform: 'uppercase', // CapCut style usually uppercase
  };

  if (cc.strokeEnabled) {
    captionsStyle.WebkitTextStroke = `${cc.strokeWidth * SCALE}px ${cc.strokeColor}`;
  }
  if (cc.shadowEnabled) {
    captionsStyle.textShadow = `0 ${cc.shadowOffsetY * SCALE}px ${cc.shadowBlur * SCALE}px ${cc.shadowColor}`;
  }
  if (cc.bgEnabled) {
    captionsStyle.backgroundColor = cc.bgColor;
    captionsStyle.padding = '4px 8px';
    captionsStyle.borderRadius = '4px';
  }

  return (
    <div className="broll-preview-container">
      <div className="broll-preview-aspect">
        <div className="broll-preview-bg">
          <div className="broll-preview-placeholder">
            <span>Video Preview</span>
          </div>
          
          {/* Text Overlay Preview */}
          {tc.text && tc.text.trim() && (
            <div style={overlayStyle}>
              {tc.text}
            </div>
          )}

          {/* Captions Preview */}
          {cc.enabled && (
            <div style={captionsStyle}>
              <span style={{ color: cc.highlightColor }}>WORD</span> {mockCaption.split(' ').slice(1).join(' ')}
            </div>
          )}
        </div>
      </div>
      <div className="preview-label">Live Preview</div>
    </div>
  );
}

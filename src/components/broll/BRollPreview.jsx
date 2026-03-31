import React, { useState, useEffect } from 'react';
import './BRollPreview.css';

const MOCK_WORDS = ['This', 'is', 'how', 'your', 'captions', 'look'];

export default function BRollPreview({ textOverlay, captionsConfig }) {
  const tc = textOverlay;
  const cc = captionsConfig;

  // Sync scaling: 140px preview width vs 1080px actual video width
  const SCALE = 140 / 1080;

  // Animated word highlight index — cycles through mock words when captions are enabled
  const [activeWordIdx, setActiveWordIdx] = useState(0);

  useEffect(() => {
    if (!cc.enabled) return;
    const interval = setInterval(() => {
      setActiveWordIdx(prev => (prev + 1) % MOCK_WORDS.length);
    }, 600);
    return () => clearInterval(interval);
  }, [cc.enabled]);

  // Determine bg mode
  const isBlock = tc.bgEnabled && tc.bgStyle === 'block';
  const isHighlight = tc.bgEnabled && (tc.bgStyle === 'highlight' || !tc.bgStyle);

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
    zIndex: 10,
    pointerEvents: 'none',
    whiteSpace: 'pre-wrap',
    width: '80%',
    display: 'flex',
    justifyContent: tc.textAlign === 'center' ? 'center' : tc.textAlign === 'right' ? 'flex-end' : 'flex-start',
  };

  // Block mode: single rectangle behind ALL text
  if (isBlock) {
    overlayStyle.padding = `${tc.backgroundPadding * SCALE}px`;
    overlayStyle.backgroundColor = tc.backgroundColor === 'transparent' ? 'rgba(0,0,0,0.6)' : tc.backgroundColor;
    overlayStyle.borderRadius = `${tc.borderRadius * SCALE}px`;
  }

  // Highlight mode: per-line inline background applied via inner span
  const highlightSpanStyle = isHighlight ? {
    backgroundColor: tc.backgroundColor === 'transparent' ? 'rgba(0,0,0,0.6)' : tc.backgroundColor,
    padding: `${tc.backgroundPadding * SCALE}px`,
    borderRadius: `${tc.borderRadius * SCALE}px`,
    boxDecorationBreak: 'clone',
    WebkitBoxDecorationBreak: 'clone',
    lineHeight: 1.8,
  } : null;

  // Shadow/Stroke for Text Overlay
  if (tc.shadow?.enabled) {
    overlayStyle.textShadow = `${tc.shadow.offsetX * SCALE}px ${tc.shadow.offsetY * SCALE}px ${tc.shadow.blur * SCALE}px ${tc.shadow.color}`;
  }
  if (tc.stroke?.enabled) {
    overlayStyle.WebkitTextStroke = `${tc.stroke.width * SCALE}px ${tc.stroke.color}`;
  }

  // Captions Styles
  const captionsContainerStyle = {
    position: 'absolute',
    left: '50%',
    top: `${cc.yPosition}%`,
    transform: 'translateX(-50%)',
    width: '90%',
    textAlign: 'center',
    fontFamily: cc.fontFamily,
    fontSize: `${cc.fontSize * SCALE}px`,
    fontWeight: cc.fontWeight,
    zIndex: 20,
    pointerEvents: 'none',
    display: 'flex',
    justifyContent: 'center',
    gap: '3px',
    flexWrap: 'wrap',
  };

  const getWordStyle = (isActive) => {
    const style = {
      color: isActive ? cc.highlightColor : cc.textColor,
      transition: 'color 0.15s ease, transform 0.15s ease',
      display: 'inline-block',
      transform: isActive ? 'scale(1.1)' : 'scale(1)',
    };

    if (cc.strokeEnabled) {
      style.WebkitTextStroke = `${cc.strokeWidth * SCALE}px ${cc.strokeColor}`;
      style.paintOrder = 'stroke fill';
    }
    if (cc.shadowEnabled) {
      style.textShadow = `0 ${cc.shadowOffsetY * SCALE}px ${cc.shadowBlur * SCALE}px ${cc.shadowColor}`;
    }

    return style;
  };

  // BG box for captions
  const captionsBgStyle = cc.bgEnabled ? {
    backgroundColor: cc.bgColor || 'rgba(0,0,0,0.75)',
    padding: `${3 * SCALE}px ${6 * SCALE}px`,
    borderRadius: `${4 * SCALE}px`,
  } : {};

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
              {highlightSpanStyle ? (
                <span style={highlightSpanStyle}>{tc.text}</span>
              ) : (
                tc.text
              )}
            </div>
          )}

          {/* CapCut-Style Captions Preview with animated word highlight */}
          {cc.enabled && (
            <div style={{ ...captionsContainerStyle, ...captionsBgStyle }}>
              {MOCK_WORDS.map((word, i) => (
                <span key={i} style={getWordStyle(i === activeWordIdx)}>
                  {word}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="preview-label">Live Preview</div>
    </div>
  );
}

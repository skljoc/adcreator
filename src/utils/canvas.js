/**
 * Canvas text rendering utilities
 */

export function renderTextOverlay(ctx, textConfig, canvasWidth, canvasHeight) {
  const {
    text, x, y, fontSize, fontFamily, fontWeight, fontStyle,
    color, backgroundColor, bgEnabled, bgStyle, backgroundPadding, borderRadius,
    textAlign, letterSpacing, lineHeight,
    shadow, stroke, opacity, rotation,
  } = textConfig;

  if (!text || !text.trim()) return;

  ctx.save();
  ctx.globalAlpha = opacity;

  // Calculate position in pixels
  const posX = (x / 100) * canvasWidth;
  const posY = (y / 100) * canvasHeight;

  // Set font
  const fontStr = `${fontStyle} ${fontWeight} ${fontSize}px '${fontFamily}', sans-serif`;
  ctx.font = fontStr;
  ctx.textBaseline = 'top';
  ctx.letterSpacing = `${letterSpacing}px`;

  // Split into lines
  const lines = text.split('\n');
  const lineHeightPx = fontSize * lineHeight;

  // Measure text
  let maxWidth = 0;
  const lineWidths = [];
  for (const line of lines) {
    const m = ctx.measureText(line || ' ');
    lineWidths.push(m.width);
    if (m.width > maxWidth) maxWidth = m.width;
  }

  const totalHeight = lines.length * lineHeightPx;
  const padding = bgEnabled ? backgroundPadding : 0;
  const blockWidth = maxWidth + padding * 2;
  const blockHeight = totalHeight + padding * 2;

  // Calculate anchor based on alignment
  let anchorX = posX;
  if (textAlign === 'center') anchorX = posX - blockWidth / 2;
  else if (textAlign === 'right') anchorX = posX - blockWidth;

  const anchorY = posY - blockHeight / 2;

  // Apply rotation
  if (rotation !== 0) {
    const cx = anchorX + blockWidth / 2;
    const cy = anchorY + blockHeight / 2;
    ctx.translate(cx, cy);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }

  const useHighlight = bgStyle === 'highlight';

  // Draw background
  if (bgEnabled && backgroundColor && backgroundColor !== 'transparent') {
    if (useHighlight) {
      // CapCut-style: draw per-line highlight rects that follow each line's width
      for (let i = 0; i < lines.length; i++) {
        const lw = lineWidths[i];
        const lineY = anchorY + padding + i * lineHeightPx;
        let lineX;

        if (textAlign === 'center') {
          lineX = anchorX + padding + (maxWidth - lw) / 2;
        } else if (textAlign === 'right') {
          lineX = anchorX + padding + (maxWidth - lw);
        } else {
          lineX = anchorX + padding;
        }

        // Center the highlight rect symmetrically around the text
        // The text is drawn at lineY with textBaseline='top', so the text occupies
        // lineY to lineY+fontSize. We want equal padding on all sides.
        const hlPad = padding;
        const hlX = lineX - hlPad;
        const hlY = lineY - hlPad;
        const hlW = lw + hlPad * 2;
        const hlH = fontSize + hlPad * 2;

        ctx.fillStyle = backgroundColor;
        if (borderRadius > 0) {
          roundRect(ctx, hlX, hlY, hlW, hlH, Math.min(borderRadius, hlH / 2));
          ctx.fill();
        } else {
          ctx.fillRect(hlX, hlY, hlW, hlH);
        }
      }
    } else {
      // Block mode: single rectangle around all text
      ctx.fillStyle = backgroundColor;
      if (borderRadius > 0) {
        roundRect(ctx, anchorX, anchorY, blockWidth, blockHeight, borderRadius);
        ctx.fill();
      } else {
        ctx.fillRect(anchorX, anchorY, blockWidth, blockHeight);
      }
    }
  }

  // Draw text lines
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let lineX = anchorX + padding;
    const lineY = anchorY + padding + i * lineHeightPx;

    if (textAlign === 'center') {
      lineX = anchorX + padding + (maxWidth - lineWidths[i]) / 2;
    } else if (textAlign === 'right') {
      lineX = anchorX + padding + (maxWidth - lineWidths[i]);
    }

    // Shadow
    if (shadow.enabled) {
      ctx.shadowColor = shadow.color;
      ctx.shadowBlur = shadow.blur;
      ctx.shadowOffsetX = shadow.offsetX;
      ctx.shadowOffsetY = shadow.offsetY;
    }

    // Stroke
    if (stroke.enabled && stroke.width > 0) {
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineJoin = 'round';
      ctx.strokeText(line, lineX, lineY);
    }

    // Fill
    ctx.fillStyle = color;
    ctx.fillText(line, lineX, lineY);

    // Reset shadow after first line to avoid stacking
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  ctx.restore();
}

/**
 * Render a single caption chunk (a few words) with the CapCut-style highlight.
 * activeWordIndex: which word in the chunk should use the highlightColor.
 */
export function renderCaptionChunk(ctx, chunk, config, canvasWidth, canvasHeight, activeWordIndex = -1) {
  const {
    fontSize, fontFamily, fontWeight, textColor, highlightColor,
    strokeEnabled, strokeColor, strokeWidth,
    shadowEnabled, shadowColor, shadowBlur, shadowOffsetY,
    bgEnabled, bgColor, yPosition
  } = config;

  if (!chunk || !chunk.words || chunk.words.length === 0) return;

  ctx.save();
  
  const posY = (yPosition / 100) * canvasHeight;
  const fontStr = `${fontWeight} ${fontSize}px '${fontFamily}', sans-serif`;
  ctx.font = fontStr;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  // Measure each word and total width
  const words = chunk.words;
  const wordWidths = words.map(w => ctx.measureText(w.word).width);
  const spaceWidth = ctx.measureText(' ').width;
  const totalWidth = wordWidths.reduce((a, b) => a + b, 0) + (words.length - 1) * spaceWidth;

  let startX = (canvasWidth - totalWidth) / 2;

  // Background box for the whole chunk if enabled
  if (bgEnabled) {
    ctx.fillStyle = bgColor;
    const padding = fontSize * 0.25;
    const boxX = startX - padding;
    const boxY = posY - (fontSize / 2) - padding;
    const boxW = totalWidth + (padding * 2);
    const boxH = fontSize + (padding * 2);
    roundRect(ctx, boxX, boxY, boxW, boxH, 8);
    ctx.fill();
  }

  // Draw words
  let currentX = startX;
  for (let i = 0; i < words.length; i++) {
    const wordObj = words[i];
    const ww = wordWidths[i];
    const wx = currentX + ww / 2;
    const isHighlighted = i === activeWordIndex;

    // Shadow
    if (shadowEnabled) {
      ctx.shadowColor = shadowColor;
      ctx.shadowBlur = shadowBlur;
      ctx.shadowOffsetY = shadowOffsetY;
    }

    // Stroke
    if (strokeEnabled && strokeWidth > 0) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineJoin = 'round';
      ctx.strokeText(wordObj.word, wx, posY);
    }

    // Fill
    ctx.fillStyle = isHighlighted ? highlightColor : textColor;
    ctx.fillText(wordObj.word, wx, posY);

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    currentX += ww + spaceWidth;
  }

  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Get bounding box of the text block for hit testing (drag)
 */
export function getTextBounds(textConfig, canvasWidth, canvasHeight) {
  const {
    text, x, y, fontSize, fontFamily, fontWeight, fontStyle,
    bgEnabled, backgroundPadding, textAlign, lineHeight,
  } = textConfig;

  if (!text || !text.trim()) return null;

  // We need a temporary canvas to measure
  const offscreen = document.createElement('canvas');
  const ctx = offscreen.getContext('2d');
  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px '${fontFamily}', sans-serif`;

  const lines = text.split('\n');
  const lineHeightPx = fontSize * lineHeight;
  let maxWidth = 0;
  for (const line of lines) {
    const w = ctx.measureText(line || ' ').width;
    if (w > maxWidth) maxWidth = w;
  }

  const totalHeight = lines.length * lineHeightPx;
  const padding = bgEnabled ? backgroundPadding : 8;
  const blockWidth = maxWidth + padding * 2;
  const blockHeight = totalHeight + padding * 2;

  const posX = (x / 100) * canvasWidth;
  const posY = (y / 100) * canvasHeight;

  let anchorX = posX;
  if (textAlign === 'center') anchorX = posX - blockWidth / 2;
  else if (textAlign === 'right') anchorX = posX - blockWidth;
  const anchorY = posY - blockHeight / 2;

  return { x: anchorX, y: anchorY, width: blockWidth, height: blockHeight };
}

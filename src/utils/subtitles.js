/**
 * Utilities for generating Advanced SubStation Alpha (.ass) subtitle scripts.
 * Used for FFMPEG-compatible CapCut-style animated captions.
 */

// Convert #RRGGBB or rgb() or rgba() to ASS BGR hex format: &H00BBGGRR&
function colorToASS(cssColor) {
  if (!cssColor) return '&H00FFFFFF&';
  
  // Clean up hex
  if (cssColor.startsWith('#')) {
    let hex = cssColor.substring(1);
    // Expand 3-digit hex
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    // Handle 8-digit hex (with alpha)
    let a = '00';
    if (hex.length === 8) {
      // ASS alpha is 00=opaque, FF=transparent (inverted from CSS).
      // CSS FF=opaque, 00=transparent
      const opacityStr = hex.substring(6, 8);
      const alpha = 255 - parseInt(opacityStr, 16);
      a = alpha.toString(16).padStart(2, '0').toUpperCase();
    }
    const r = hex.substring(0, 2).toUpperCase();
    const g = hex.substring(2, 4).toUpperCase();
    const b = hex.substring(4, 6).toUpperCase();
    return `&H${a}${b}${g}${r}&`;
  }
  
  // Handle rgba/rgb strings (extremely basic parsing)
  if (cssColor.startsWith('rgb')) {
    const parts = cssColor.match(/[\d.]+/g);
    if (!parts || parts.length < 3) return '&H00FFFFFF&';
    const r = parseInt(parts[0]).toString(16).padStart(2, '0').toUpperCase();
    const g = parseInt(parts[1]).toString(16).padStart(2, '0').toUpperCase();
    const b = parseInt(parts[2]).toString(16).padStart(2, '0').toUpperCase();
    let a = '00';
    if (parts.length > 3) {
      const alpha = 255 - Math.round(parseFloat(parts[3]) * 255);
      a = alpha.toString(16).padStart(2, '0').toUpperCase();
    }
    return `&H${a}${b}${g}${r}&`;
  }
  
  return '&H00FFFFFF&'; // Default fallback
}

// Convert seconds to ASS timestamp format: H:MM:SS.cs (centiseconds)
function formatASSTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  
  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
}

/**
 * Slice an array of word timings into punchy, short subtitle lines (e.g., 3-5 words).
 * Considers natural pauses based on punctuation.
 */
function chunkWordTimings(wordTimings, maxWords = 4) {
  const chunks = [];
  let currentChunk = [];
  
  for (let i = 0; i < wordTimings.length; i++) {
    const wordObj = wordTimings[i];
    currentChunk.push(wordObj);
    
    // Check if we should break the line
    const wordText = wordObj.word.trim();
    const endsWithPunctuation = /[.,!?]$/.test(wordText);
    
    // Also check if there's a long pause before the next word
    let longPauseSegment = false;
    if (i < wordTimings.length - 1) {
      const gap = wordTimings[i+1].start - wordObj.end;
      if (gap > 0.4) longPauseSegment = true; // 400ms pause breaks the line naturally
    }
    
    if (currentChunk.length >= maxWords || endsWithPunctuation || longPauseSegment || i === wordTimings.length - 1) {
      chunks.push({
        words: [...currentChunk],
        start: currentChunk[0].start,
        end: currentChunk[currentChunk.length - 1].end,
      });
      currentChunk = [];
    }
  }
  
  return chunks;
}

/**
 * Generates the raw string for an .ass Subtitle file with CapCut-style word highlighting.
 */
export function generateASS(captionTimings, config, canvasWidth, canvasHeight) {
  if (!captionTimings || captionTimings.length === 0) return '';
  if (!config.enabled) return '';
  
  const {
    fontFamily, fontSize, textColor, highlightColor,
    strokeEnabled, strokeColor, strokeWidth,
    shadowEnabled, shadowColor, shadowBlur, shadowOffsetY,
    bgEnabled, bgColor, yPosition, maxWordsPerLine
  } = config;

  const width = canvasWidth || 1080;
  const height = canvasHeight || 1920;
  
  const primaryColor = colorToASS(textColor);
  const hColor = colorToASS(highlightColor);
  
  const outlineColor = strokeEnabled ? colorToASS(strokeColor) : '&H00000000&';
  const outlineWidth = strokeEnabled ? strokeWidth : 0;
  
  const backColor = shadowEnabled ? colorToASS(shadowColor) : '&H00000000&';
  const shadowDepth = shadowEnabled ? shadowOffsetY : 0; // ASS uses simple offset
  
  // BorderStyle 3 = Opaque Box, 1 = Outline+Shadow
  const borderStyle = bgEnabled ? 3 : 1; 

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
WrapStyle: 1
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Main,Inter,${fontSize},${primaryColor},&H000000FF,${outlineColor},${backColor},-1,0,0,0,100,100,0,0,${borderStyle},${outlineWidth},${shadowDepth},2,20,20,${Math.round(height * (100 - yPosition) / 100)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const chunks = chunkWordTimings(captionTimings, maxWordsPerLine);
  
  let dialogueLines = '';

  for (const chunk of chunks) {
    const startObj = formatASSTime(chunk.start);
    const endObj = formatASSTime(chunk.end);
    
    // For instant word highlighting, we duplicate the line multiple times.
    // Each duplication corresponds to a specific word being highlighted during its duration.
    // Better method: ASS allows override tags IN LINE. \c&HBBGGRR& changes color.
    // However, to change color EXACTLY during the word's duration without re-writing Dialogue lines,
    // we would use karaoke (\k), but \k is a wipe effect over time, not instant.
    // FFMPEG 6+ ASS renderer does not easily support instant color switches per word unless 
    // we use multiple dialogue lines stacked or precise {\t} transforms.
    // Wait, simple dialogue duplication per word is rock solid!
    
    // Let's create one Dialogue line PER WORD in the chunk, showing the whole chunk,
    // but with the active word colored differently.
    
    for (let w = 0; w < chunk.words.length; w++) {
      const activeWord = chunk.words[w];
      const wordStart = formatASSTime(activeWord.start);
      // Wait, if a word ends early, there might be a gap before the next word.
      // We should span the active word's highlight until the NEXT word starts.
      const rawWordEnd = (w < chunk.words.length - 1) ? chunk.words[w+1].start : chunk.end;
      const wordEnd = formatASSTime(rawWordEnd);
      
      let assTextParts = [];
      for (let i = 0; i < chunk.words.length; i++) {
        if (i === w) {
          assTextParts.push(`{\\c${hColor}}${chunk.words[i].word}{\\r}`);
        } else {
          assTextParts.push(chunk.words[i].word);
        }
      }
      
      const lineText = assTextParts.join(' ');
      dialogueLines += `Dialogue: 0,${formatASSTime(activeWord.start)},${formatASSTime(rawWordEnd)},Main,,0,0,0,,${lineText}\n`;
    }
  }

  return header + dialogueLines;
}

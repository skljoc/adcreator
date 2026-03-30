/**
 * ElevenLabs v3 API client
 */

const BASE_URL = 'https://api.elevenlabs.io/v1';

/**
 * Fetch available voices
 */
export async function fetchVoices(apiKey) {
  const res = await fetch(`${BASE_URL}/voices`, {
    headers: { 'xi-api-key': apiKey },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch voices: ${res.status} — ${err}`);
  }

  const data = await res.json();
  return data.voices.map(v => ({
    id: v.voice_id,
    name: v.name,
    category: v.category,
    previewUrl: v.preview_url,
  }));
}

/**
 * Generate speech from text using ElevenLabs v3 with timestamps
 * Returns { blob: Blob, wordTimings: Array }
 */
export async function generateSpeech(apiKey, voiceId, text) {
  const res = await fetch(`${BASE_URL}/text-to-speech/${voiceId}/with-timestamps`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_v3',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.5,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs TTS failed: ${res.status} — ${err}`);
  }

  const data = await res.json();
  
  // Convert base64 audio to Blob
  const byteCharacters = atob(data.audio_base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'audio/mpeg' });

  // Parse character alignment into word timings
  const wordTimings = [];
  if (data.alignment && data.alignment.characters) {
    const chars = data.alignment.characters;
    const starts = data.alignment.character_start_times_seconds;
    const ends = data.alignment.character_end_times_seconds;

    let currentWord = '';
    let wordStart = null;
    let wordEnd = null;

    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      // Break words on spaces, newlines, and sometimes punctuation if desired.
      // We'll just break on space/newline for now.
      if (char === ' ' || char === '\n') {
        if (currentWord.trim()) {
          wordTimings.push({ word: currentWord.trim(), start: wordStart, end: wordEnd });
          currentWord = '';
          wordStart = null;
        }
      } else {
        if (currentWord === '') wordStart = starts[i];
        currentWord += char;
        wordEnd = ends[i];
      }
    }
    // catch last word
    if (currentWord.trim()) {
      wordTimings.push({ word: currentWord.trim(), start: wordStart, end: wordEnd });
    }
  }

  return { blob, wordTimings };
}

/**
 * Get audio duration from a Blob
 */
export function getAudioDuration(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    audio.preload = 'metadata';

    audio.onloadedmetadata = () => {
      const duration = audio.duration;
      URL.revokeObjectURL(url);
      resolve(duration);
    };

    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load audio metadata'));
    };

    audio.src = url;
  });
}

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
 * Generate speech from text using ElevenLabs v3
 * Returns an audio Blob (mp3)
 */
export async function generateSpeech(apiKey, voiceId, text) {
  const res = await fetch(`${BASE_URL}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
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

  const blob = await res.blob();
  return blob;
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

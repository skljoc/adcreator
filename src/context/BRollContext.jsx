import React, { createContext, useContext, useReducer, useCallback } from 'react';

const BRollContext = createContext();

const initialState = {
  // Creation mode: 'broll' | 'hook-broll' | 'vsl'
  creationMode: 'broll',

  // B-Roll source videos (used in all modes)
  sourceVideos: [],

  // Hook source videos (used in hook-broll mode only)
  hookVideos: [],

  // VSL main video (used in vsl mode only) — single video object or null
  vslVideo: null,

  ads: [],
  settings: {
    apiKey: localStorage.getItem('vae-elevenlabs-key') || '',
    voiceId: '',
    voices: [],
    voicesLoaded: false,
    hookDuration: 3, // seconds, configurable
  },
  generating: false,
  generationLog: [],
};

function processVideoData(dataList) {
  return dataList.map(v => ({
    id: crypto.randomUUID(),
    file: v.file,
    url: v.url,
    thumbnail: v.thumbnail,
    name: v.file.name,
    duration: v.duration,
    width: v.width,
    height: v.height,
    scenes: [],
    analyzed: false,
  }));
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_CREATION_MODE':
      return { ...state, creationMode: action.payload };

    case 'ADD_SOURCES': {
      const newSources = processVideoData(action.payload);
      return { ...state, sourceVideos: [...state.sourceVideos, ...newSources] };
    }

    case 'REMOVE_SOURCE':
      return { ...state, sourceVideos: state.sourceVideos.filter(v => v.id !== action.payload) };

    case 'SET_SCENES':
      return {
        ...state,
        sourceVideos: state.sourceVideos.map(v =>
          v.id === action.payload.videoId
            ? { ...v, scenes: action.payload.scenes, analyzed: true }
            : v
        ),
      };

    // Hook video actions
    case 'ADD_HOOK_SOURCES': {
      const newHooks = processVideoData(action.payload);
      return { ...state, hookVideos: [...state.hookVideos, ...newHooks] };
    }

    case 'REMOVE_HOOK_SOURCE':
      return { ...state, hookVideos: state.hookVideos.filter(v => v.id !== action.payload) };

    // VSL video actions
    case 'SET_VSL_VIDEO': {
      const v = action.payload;
      return {
        ...state,
        vslVideo: {
          id: crypto.randomUUID(),
          file: v.file,
          url: v.url,
          thumbnail: v.thumbnail,
          name: v.file.name,
          duration: v.duration,
          width: v.width,
          height: v.height,
        },
      };
    }

    case 'REMOVE_VSL_VIDEO':
      return { ...state, vslVideo: null };

    case 'SET_AD_COUNT': {
      const count = action.payload;
      const currentAds = state.ads;
      const ads = [];
      for (let i = 0; i < count; i++) {
        if (currentAds[i]) {
          ads.push(currentAds[i]);
        } else {
          ads.push({
            id: crypto.randomUUID(),
            index: i,
            script: '',
            voiceoverBlob: null,
            voiceoverUrl: null,
            voiceoverDuration: 0,
            status: 'idle', // idle | generating-voice | analyzing | assembling | done | error
            progress: 0,
            error: null,
            outputUrl: null,
          });
        }
      }
      return { ...state, ads };
    }

    case 'UPDATE_AD_SCRIPT':
      return {
        ...state,
        ads: state.ads.map(ad =>
          ad.id === action.payload.adId
            ? { ...ad, script: action.payload.script }
            : ad
        ),
      };

    case 'UPDATE_AD': {
      const { adId, updates } = action.payload;
      return {
        ...state,
        ads: state.ads.map(ad =>
          ad.id === adId ? { ...ad, ...updates } : ad
        ),
      };
    }

    case 'UPDATE_SETTINGS': {
      const settings = { ...state.settings, ...action.payload };
      if (action.payload.apiKey !== undefined) {
        localStorage.setItem('vae-elevenlabs-key', action.payload.apiKey);
      }
      return { ...state, settings };
    }

    case 'SET_GENERATING':
      return { ...state, generating: action.payload };

    case 'ADD_LOG':
      return { ...state, generationLog: [...state.generationLog, { time: Date.now(), message: action.payload }] };

    case 'CLEAR_LOG':
      return { ...state, generationLog: [] };

    case 'RESET_ADS':
      return {
        ...state,
        ads: state.ads.map(ad => ({
          ...ad,
          status: 'idle',
          progress: 0,
          error: null,
          voiceoverBlob: null,
          voiceoverUrl: null,
          voiceoverDuration: 0,
          outputUrl: null,
        })),
      };

    default:
      return state;
  }
}

export function BRollProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const setCreationMode = useCallback((mode) => dispatch({ type: 'SET_CREATION_MODE', payload: mode }), []);
  const addSources = useCallback((data) => dispatch({ type: 'ADD_SOURCES', payload: data }), []);
  const removeSource = useCallback((id) => dispatch({ type: 'REMOVE_SOURCE', payload: id }), []);
  const setScenes = useCallback((videoId, scenes) => dispatch({ type: 'SET_SCENES', payload: { videoId, scenes } }), []);
  const addHookSources = useCallback((data) => dispatch({ type: 'ADD_HOOK_SOURCES', payload: data }), []);
  const removeHookSource = useCallback((id) => dispatch({ type: 'REMOVE_HOOK_SOURCE', payload: id }), []);
  const setVslVideo = useCallback((data) => dispatch({ type: 'SET_VSL_VIDEO', payload: data }), []);
  const removeVslVideo = useCallback(() => dispatch({ type: 'REMOVE_VSL_VIDEO' }), []);
  const setAdCount = useCallback((count) => dispatch({ type: 'SET_AD_COUNT', payload: count }), []);
  const updateAdScript = useCallback((adId, script) => dispatch({ type: 'UPDATE_AD_SCRIPT', payload: { adId, script } }), []);
  const updateAd = useCallback((adId, updates) => dispatch({ type: 'UPDATE_AD', payload: { adId, updates } }), []);
  const updateSettings = useCallback((updates) => dispatch({ type: 'UPDATE_SETTINGS', payload: updates }), []);
  const setGenerating = useCallback((val) => dispatch({ type: 'SET_GENERATING', payload: val }), []);
  const addLog = useCallback((msg) => dispatch({ type: 'ADD_LOG', payload: msg }), []);
  const clearLog = useCallback(() => dispatch({ type: 'CLEAR_LOG' }), []);
  const resetAds = useCallback(() => dispatch({ type: 'RESET_ADS' }), []);

  return (
    <BRollContext.Provider value={{
      ...state,
      setCreationMode,
      addSources, removeSource, setScenes,
      addHookSources, removeHookSource,
      setVslVideo, removeVslVideo,
      setAdCount, updateAdScript, updateAd,
      updateSettings, setGenerating, addLog, clearLog, resetAds,
    }}>
      {children}
    </BRollContext.Provider>
  );
}

export function useBRoll() {
  const ctx = useContext(BRollContext);
  if (!ctx) throw new Error('useBRoll must be inside BRollProvider');
  return ctx;
}

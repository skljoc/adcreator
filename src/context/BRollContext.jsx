import React, { createContext, useContext, useReducer, useCallback } from 'react';

const BRollContext = createContext();

export const DEFAULT_TEXT_OVERLAY = {
  text: '',
  x: 50,
  y: 50,
  fontSize: 100,
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

export const DEFAULT_CAPTIONS_CONFIG = {
  enabled: false,
  fontFamily: 'Inter',
  fontSize: 75,
  fontWeight: '800', // Bold/Black looks best for CapCut style
  textColor: '#FFFFFF',
  highlightColor: '#FFE600', // CapCut yellow
  strokeEnabled: true,
  strokeColor: '#000000',
  strokeWidth: 4,
  shadowEnabled: true,
  shadowColor: 'rgba(0,0,0,0.8)',
  shadowBlur: 10,
  shadowOffsetY: 4,
  bgEnabled: false,
  bgColor: '#000000',
  yPosition: 70, // percentage from top
  maxWordsPerLine: 4,
};

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
            voiceId: '', // empty = use global voice from settings
            textOverlay: { ...DEFAULT_TEXT_OVERLAY },
            captionsConfig: { ...DEFAULT_CAPTIONS_CONFIG },
            captionTimings: [],
            voiceoverBlob: null,
            voiceoverUrl: null,
            voiceoverDuration: 0,
            status: 'idle',
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

    case 'UPDATE_AD_TEXT_OVERLAY': {
      const { adId, updates } = action.payload;
      return {
        ...state,
        ads: state.ads.map(ad => {
          if (ad.id !== adId) return ad;
          const current = ad.textOverlay || { ...DEFAULT_TEXT_OVERLAY };
          const merged = { ...current };
          for (const [key, value] of Object.entries(updates)) {
            if (typeof value === 'object' && value !== null && !Array.isArray(value) && typeof current[key] === 'object') {
              merged[key] = { ...current[key], ...value };
            } else {
              merged[key] = value;
            }
          }
          return { ...ad, textOverlay: merged };
        }),
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

    case 'APPLY_STYLES_GLOBALLY': {
      const sourceAd = state.ads.find(a => a.id === action.payload);
      if (!sourceAd) return state;
      return {
        ...state,
        ads: state.ads.map(ad => ({
          ...ad,
          textOverlay: { ...sourceAd.textOverlay },
          captionsConfig: { ...sourceAd.captionsConfig }
        }))
      };
    }

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
  const updateAdTextOverlay = useCallback((adId, updates) => dispatch({ type: 'UPDATE_AD_TEXT_OVERLAY', payload: { adId, updates } }), []);
  const updateSettings = useCallback((updates) => dispatch({ type: 'UPDATE_SETTINGS', payload: updates }), []);
  const setGenerating = useCallback((val) => dispatch({ type: 'SET_GENERATING', payload: val }), []);
  const addLog = useCallback((msg) => dispatch({ type: 'ADD_LOG', payload: msg }), []);
  const clearLog = useCallback(() => dispatch({ type: 'CLEAR_LOG' }), []);
  const resetAds = useCallback(() => dispatch({ type: 'RESET_ADS' }), []);
  const applyStylesGlobally = useCallback((adId) => dispatch({ type: 'APPLY_STYLES_GLOBALLY', payload: adId }), []);

  return (
    <BRollContext.Provider value={{
      ...state,
      setCreationMode,
      addSources, removeSource, setScenes,
      addHookSources, removeHookSource,
      setVslVideo, removeVslVideo,
      setAdCount, updateAdScript, updateAd, updateAdTextOverlay,
      updateSettings, setGenerating, addLog, clearLog, resetAds, applyStylesGlobally
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

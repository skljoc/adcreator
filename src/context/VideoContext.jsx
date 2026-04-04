import React, { createContext, useContext, useReducer, useCallback } from 'react';

const VideoContext = createContext();

const DEFAULT_TEXT_CONFIG = {
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
  bgStyle: 'highlight', // 'highlight' (per-line, CapCut-style) | 'block' (single rect)
  backgroundPadding: 14,
  borderRadius: 8,
  textAlign: 'center',
  letterSpacing: 0,
  lineHeight: 1.3,
  shadow: { enabled: false, color: '#000000', blur: 6, offsetX: 2, offsetY: 2 },
  stroke: { enabled: false, color: '#000000', width: 2 },
  opacity: 1,
  rotation: 0,
  duration: 3,
  useGlobal: true,
};

const initialState = {
  videos: [],
  selectedVideoId: null,
  globalText: { ...DEFAULT_TEXT_CONFIG, text: 'Your Title Here' },
  isExporting: false,
  exportProgress: {},
};

function reducer(state, action) {
  switch (action.type) {
    case 'ADD_VIDEOS': {
      const newVideos = action.payload.map(v => ({
        id: crypto.randomUUID(),
        file: v.file,
        url: v.url,
        thumbnail: v.thumbnail,
        name: v.file.name,
        duration: v.duration,
        width: v.width,
        height: v.height,
        textConfig: { ...DEFAULT_TEXT_CONFIG },
      }));
      const videos = [...state.videos, ...newVideos];
      return {
        ...state,
        videos,
        selectedVideoId: state.selectedVideoId || (newVideos.length > 0 ? newVideos[0].id : null),
      };
    }

    case 'REMOVE_VIDEO': {
      const videos = state.videos.filter(v => v.id !== action.payload);
      const selectedVideoId = state.selectedVideoId === action.payload
        ? (videos.length > 0 ? videos[0].id : null)
        : state.selectedVideoId;
      return { ...state, videos, selectedVideoId };
    }

    case 'SELECT_VIDEO':
      return { ...state, selectedVideoId: action.payload };

    case 'UPDATE_VIDEO_TEXT': {
      const { videoId, updates } = action.payload;
      return {
        ...state,
        videos: state.videos.map(v =>
          v.id === videoId ? { ...v, textConfig: { ...v.textConfig, ...updates } } : v
        ),
      };
    }

    case 'SET_GLOBAL_TEXT':
      return { ...state, globalText: { ...state.globalText, ...action.payload } };

    case 'APPLY_GLOBAL_TO_ALL':
      return {
        ...state,
        videos: state.videos.map(v => ({
          ...v,
          textConfig: { ...state.globalText, useGlobal: true },
        })),
      };

    case 'APPLY_CURRENT_TO_ALL': {
      const sourceVideo = state.videos.find(v => v.id === action.payload);
      if (!sourceVideo) return state;
      const config = { ...sourceVideo.textConfig };
      return {
        ...state,
        videos: state.videos.map(v => ({
          ...v,
          textConfig: { ...config },
        })),
      };
    }

    case 'RESET_TO_GLOBAL': {
      return {
        ...state,
        videos: state.videos.map(v =>
          v.id === action.payload
            ? { ...v, textConfig: { ...state.globalText, useGlobal: true } }
            : v
        ),
      };
    }

    case 'SET_EXPORTING':
      return { ...state, isExporting: action.payload };

    case 'SET_EXPORT_PROGRESS':
      return {
        ...state,
        exportProgress: { ...state.exportProgress, [action.payload.videoId]: action.payload.progress },
      };

    case 'CLEAR_EXPORT_PROGRESS':
      return { ...state, exportProgress: {} };

    default:
      return state;
  }
}

export function VideoProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const addVideos = useCallback((videoData) => {
    dispatch({ type: 'ADD_VIDEOS', payload: videoData });
  }, []);

  const removeVideo = useCallback((id) => {
    dispatch({ type: 'REMOVE_VIDEO', payload: id });
  }, []);

  const selectVideo = useCallback((id) => {
    dispatch({ type: 'SELECT_VIDEO', payload: id });
  }, []);

  const updateVideoText = useCallback((videoId, updates) => {
    dispatch({ type: 'UPDATE_VIDEO_TEXT', payload: { videoId, updates } });
  }, []);

  const setGlobalText = useCallback((updates) => {
    dispatch({ type: 'SET_GLOBAL_TEXT', payload: updates });
  }, []);

  const applyGlobalToAll = useCallback(() => {
    dispatch({ type: 'APPLY_GLOBAL_TO_ALL' });
  }, []);

  const applyCurrentToAll = useCallback((videoId) => {
    dispatch({ type: 'APPLY_CURRENT_TO_ALL', payload: videoId });
  }, []);

  const resetToGlobal = useCallback((videoId) => {
    dispatch({ type: 'RESET_TO_GLOBAL', payload: videoId });
  }, []);

  const setExporting = useCallback((val) => {
    dispatch({ type: 'SET_EXPORTING', payload: val });
  }, []);

  const setExportProgress = useCallback((videoId, progress) => {
    dispatch({ type: 'SET_EXPORT_PROGRESS', payload: { videoId, progress } });
  }, []);

  const clearExportProgress = useCallback(() => {
    dispatch({ type: 'CLEAR_EXPORT_PROGRESS' });
  }, []);

  const selectedVideo = state.videos.find(v => v.id === state.selectedVideoId) || null;

  const getEffectiveTextConfig = useCallback((video) => {
    if (!video) return state.globalText;
    if (video.textConfig.useGlobal) return { ...state.globalText, useGlobal: true };
    return video.textConfig;
  }, [state.globalText]);

  return (
    <VideoContext.Provider value={{
      ...state,
      selectedVideo,
      addVideos,
      removeVideo,
      selectVideo,
      updateVideoText,
      setGlobalText,
      applyGlobalToAll,
      applyCurrentToAll,
      resetToGlobal,
      setExporting,
      setExportProgress,
      clearExportProgress,
      getEffectiveTextConfig,
    }}>
      {children}
    </VideoContext.Provider>
  );
}

export function useVideos() {
  const ctx = useContext(VideoContext);
  if (!ctx) throw new Error('useVideos must be inside VideoProvider');
  return ctx;
}

export { DEFAULT_TEXT_CONFIG };

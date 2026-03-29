import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useVideos } from '../context/VideoContext';
import { renderTextOverlay, getTextBounds } from '../utils/canvas';
import './VideoPreview.css';

export default function VideoPreview() {
  const { selectedVideo, getEffectiveTextConfig, updateVideoText, setGlobalText } = useVideos();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animFrameRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDraggingText, setIsDraggingText] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const textConfig = selectedVideo ? getEffectiveTextConfig(selectedVideo) : null;

  // Render loop
  const renderFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !selectedVideo) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;

    ctx.clearRect(0, 0, width, height);

    // Draw video frame
    if (video.readyState >= 2) {
      ctx.drawImage(video, 0, 0, width, height);
    }

    // Draw text overlay
    if (textConfig && textConfig.text) {
      renderTextOverlay(ctx, textConfig, width, height);
    }

    animFrameRef.current = requestAnimationFrame(renderFrame);
  }, [selectedVideo, textConfig]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(renderFrame);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [renderFrame]);

  // Update canvas size — canvas pixel resolution = actual video resolution
  // CSS handles scaling it down to fit the container
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !selectedVideo) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      // Canvas PIXEL resolution = actual video resolution (for accurate text rendering)
      const videoW = selectedVideo.width || 720;
      const videoH = selectedVideo.height || 1280;
      canvas.width = videoW;
      canvas.height = videoH;

      // CSS display size = fit to container
      const videoAspect = videoW / videoH;
      let displayW = rect.width;
      let displayH = displayW / videoAspect;
      if (displayH > rect.height) {
        displayH = rect.height;
        displayW = displayH * videoAspect;
      }
      canvas.style.width = displayW + 'px';
      canvas.style.height = displayH + 'px';
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [selectedVideo]);

  // Video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onLoaded = () => {
      setDuration(video.duration);
      setCurrentTime(0);
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
    };
  }, [selectedVideo]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  };

  const seek = (e) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    video.currentTime = ratio * duration;
  };

  const formatTime = (t) => {
    if (!t || isNaN(t)) return '0:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Text dragging
  const handleCanvasMouseDown = useCallback((e) => {
    if (!textConfig || !textConfig.text || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const bounds = getTextBounds(textConfig, canvas.width, canvas.height);
    if (!bounds) return;

    if (mx >= bounds.x && mx <= bounds.x + bounds.width &&
        my >= bounds.y && my <= bounds.y + bounds.height) {
      setIsDraggingText(true);
      const posX = (textConfig.x / 100) * canvas.width;
      const posY = (textConfig.y / 100) * canvas.height;
      setDragOffset({ x: mx - posX, y: my - posY });
      e.preventDefault();
    }
  }, [textConfig]);

  const handleCanvasMouseMove = useCallback((e) => {
    if (!isDraggingText || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const newX = ((mx - dragOffset.x) / canvas.width) * 100;
    const newY = ((my - dragOffset.y) / canvas.height) * 100;

    const clampedX = Math.max(5, Math.min(95, newX));
    const clampedY = Math.max(5, Math.min(95, newY));

    if (selectedVideo) {
      if (textConfig.useGlobal) {
        setGlobalText({ x: clampedX, y: clampedY });
      } else {
        updateVideoText(selectedVideo.id, { x: clampedX, y: clampedY });
      }
    }
  }, [isDraggingText, dragOffset, selectedVideo, textConfig, updateVideoText, setGlobalText]);

  const handleCanvasMouseUp = useCallback(() => {
    setIsDraggingText(false);
  }, []);

  useEffect(() => {
    if (isDraggingText) {
      window.addEventListener('mousemove', handleCanvasMouseMove);
      window.addEventListener('mouseup', handleCanvasMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleCanvasMouseMove);
        window.removeEventListener('mouseup', handleCanvasMouseUp);
      };
    }
  }, [isDraggingText, handleCanvasMouseMove, handleCanvasMouseUp]);

  if (!selectedVideo) {
    return (
      <div className="video-preview-empty empty-state">
        <div className="empty-state-icon">🎥</div>
        <div className="empty-state-text">Select a video to preview</div>
        <div className="empty-state-hint">Import videos using the panel on the left</div>
      </div>
    );
  }

  return (
    <div className="video-preview animate-fade-in" id="video-preview">
      <div className="video-preview-canvas-wrap" ref={containerRef}>
        <video
          ref={videoRef}
          src={selectedVideo.url}
          style={{ display: 'none' }}
          crossOrigin="anonymous"
          preload="auto"
        />
        <canvas
          ref={canvasRef}
          className={`video-preview-canvas ${isDraggingText ? 'dragging' : ''}`}
          onMouseDown={handleCanvasMouseDown}
        />
        {textConfig?.text && (
          <div className="canvas-drag-hint">Drag text to reposition</div>
        )}
      </div>

      <div className="video-controls glass-card">
        <button className="btn-icon" onClick={togglePlay} id="play-pause-btn">
          {isPlaying ? '⏸' : '▶️'}
        </button>

        <span className="video-time">{formatTime(currentTime)}</span>

        <div className="video-seekbar" onClick={seek}>
          <div
            className="video-seekbar-fill"
            style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
          />
        </div>

        <span className="video-time">{formatTime(duration)}</span>
      </div>
    </div>
  );
}

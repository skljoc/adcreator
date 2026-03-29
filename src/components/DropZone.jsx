import React, { useRef, useState, useCallback } from 'react';
import { useVideos } from '../context/VideoContext';
import './DropZone.css';

const ACCEPTED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'];
const ACCEPTED_EXTENSIONS = ['.mp4', '.mov', '.webm', '.avi'];

export default function DropZone() {
  const { addVideos, videos } = useVideos();
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef(null);

  const processFiles = useCallback(async (files) => {
    const validFiles = Array.from(files).filter(f => {
      const ext = '.' + f.name.split('.').pop().toLowerCase();
      return ACCEPTED_TYPES.includes(f.type) || ACCEPTED_EXTENSIONS.includes(ext);
    });

    if (validFiles.length === 0) return;

    setIsProcessing(true);

    const videoDataPromises = validFiles.map(file => {
      return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;

        video.onloadedmetadata = () => {
          video.currentTime = 1;
        };

        video.onseeked = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 320;
          canvas.height = Math.round(320 * (video.videoHeight / video.videoWidth));
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const thumbnail = canvas.toDataURL('image/jpeg', 0.7);

          resolve({
            file,
            url,
            thumbnail,
            duration: video.duration,
            width: video.videoWidth,
            height: video.videoHeight,
          });
        };

        video.onerror = () => {
          resolve({
            file,
            url,
            thumbnail: null,
            duration: 0,
            width: 1280,
            height: 720,
          });
        };

        video.src = url;
      });
    });

    const videoData = await Promise.all(videoDataPromises);
    addVideos(videoData);
    setIsProcessing(false);
  }, [addVideos]);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e) => {
    processFiles(e.target.files);
    e.target.value = '';
  }, [processFiles]);

  const hasVideos = videos.length > 0;

  return (
    <div
      className={`dropzone ${isDragging ? 'dropzone-active' : ''} ${hasVideos ? 'dropzone-compact' : ''} ${isProcessing ? 'dropzone-processing' : ''}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      id="video-dropzone"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS.join(',')}
        multiple
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {isProcessing ? (
        <div className="dropzone-content animate-fade-in">
          <div className="dropzone-spinner" />
          <span className="dropzone-text">Processing videos...</span>
        </div>
      ) : (
        <div className="dropzone-content">
          <div className="dropzone-icon">
            {hasVideos ? '➕' : '🎬'}
          </div>
          <span className="dropzone-text">
            {hasVideos
              ? 'Add more videos'
              : 'Drop video files here'}
          </span>
          {!hasVideos && (
            <span className="dropzone-hint">or click to browse · MP4, MOV, WebM</span>
          )}
        </div>
      )}

      {isDragging && (
        <div className="dropzone-overlay">
          <div className="dropzone-overlay-content">
            <span className="dropzone-overlay-icon">📥</span>
            <span>Drop to add videos</span>
          </div>
        </div>
      )}
    </div>
  );
}

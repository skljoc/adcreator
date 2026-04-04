import React, { useRef, useState, useCallback } from 'react';
import { useBRoll } from '../../context/BRollContext';

const ACCEPTED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'];
const ACCEPTED_EXTENSIONS = ['.mp4', '.mov', '.webm', '.avi'];

/**
 * Generic file processor — reads video metadata + thumbnail
 */
function useVideoProcessor(callback) {
  const [isProcessing, setIsProcessing] = useState(false);

  const processFiles = useCallback(async (files) => {
    const validFiles = Array.from(files).filter(f => {
      const ext = '.' + f.name.split('.').pop().toLowerCase();
      return ACCEPTED_TYPES.includes(f.type) || ACCEPTED_EXTENSIONS.includes(ext);
    });
    if (validFiles.length === 0) return;
    setIsProcessing(true);

    const dataPromises = validFiles.map(file => {
      return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.onloadedmetadata = () => { video.currentTime = 1; };
        video.onseeked = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 160;
          canvas.height = Math.round(160 * (video.videoHeight / video.videoWidth));
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          resolve({
            file, url,
            thumbnail: canvas.toDataURL('image/jpeg', 0.6),
            duration: video.duration,
            width: video.videoWidth,
            height: video.videoHeight,
          });
        };
        video.onerror = () => {
          resolve({ file, url, thumbnail: null, duration: 0, width: 720, height: 1280 });
        };
        video.src = url;
      });
    });

    const data = await Promise.all(dataPromises);
    callback(data);
    setIsProcessing(false);
  }, [callback]);

  return { processFiles, isProcessing };
}

const formatDuration = (s) => {
  if (!s) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

/**
 * Reusable drop zone component
 */
function UploadDropZone({ onFiles, isProcessing, hasFiles, label, icon, addLabel }) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragEnter = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); if (e.currentTarget === e.target) setIsDragging(false); };
  const handleDragOver = (e) => { e.preventDefault(); };
  const handleDrop = (e) => { e.preventDefault(); setIsDragging(false); onFiles(e.dataTransfer.files); };
  const handleClick = () => fileInputRef.current?.click();
  const handleFileChange = (e) => { onFiles(e.target.files); e.target.value = ''; };

  return (
    <div
      className={`broll-dropzone ${isDragging ? 'active' : ''}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
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
        <div className="broll-drop-content">
          <span className="broll-spinner" />
          <span>Processing...</span>
        </div>
      ) : (
        <div className="broll-drop-content">
          <span className="broll-drop-icon">{hasFiles ? '➕' : icon}</span>
          <span>{hasFiles ? addLabel : label}</span>
        </div>
      )}
      {isDragging && (
        <div className="broll-drop-overlay">📥 Drop videos</div>
      )}
    </div>
  );
}

/**
 * Video list component
 */
function VideoList({ videos, onRemove, label, badgeClass = 'badge-accent' }) {
  if (videos.length === 0) return null;

  return (
    <div className="source-list">
      <div className="source-list-header">
        <span className="control-label" style={{ margin: 0 }}>{label}</span>
        <span className={`badge ${badgeClass}`}>{videos.length}</span>
      </div>
      {videos.map(video => (
        <div key={video.id} className="source-item glass-card">
          <div className="source-thumb">
            {video.thumbnail ? (
              <img src={video.thumbnail} alt={video.name} />
            ) : (
              <span>🎬</span>
            )}
            <span className="source-duration">{formatDuration(video.duration)}</span>
          </div>
          <div className="source-info">
            <span className="source-name" title={video.name}>{video.name}</span>
            <div className="source-meta">
              <span className={`badge ${badgeClass}`}>{video.width}×{video.height}</span>
              {video.analyzed && (
                <span className="badge badge-success">{video.scenes.length} scenes</span>
              )}
            </div>
          </div>
          <button
            className="btn-icon"
            onClick={() => onRemove(video.id)}
            title="Remove"
          >✕</button>
        </div>
      ))}
    </div>
  );
}

/**
 * Single VSL video display
 */
function VSLVideoCard({ video, onRemove }) {
  return (
    <div className="source-list">
      <div className="source-list-header">
        <span className="control-label" style={{ margin: 0 }}>Main VSL Video</span>
        <span className="badge badge-warning">1</span>
      </div>
      <div className="source-item glass-card vsl-card">
        <div className="source-thumb">
          {video.thumbnail ? (
            <img src={video.thumbnail} alt={video.name} />
          ) : (
            <span>🎙️</span>
          )}
          <span className="source-duration">{formatDuration(video.duration)}</span>
        </div>
        <div className="source-info">
          <span className="source-name" title={video.name}>{video.name}</span>
          <div className="source-meta">
            <span className="badge badge-warning">{video.width}×{video.height}</span>
            <span className="badge badge-accent">{formatDuration(video.duration)}</span>
          </div>
        </div>
        <button
          className="btn-icon"
          onClick={onRemove}
          title="Remove"
        >✕</button>
      </div>
    </div>
  );
}

export default function SourceUpload() {
  const {
    creationMode,
    addSources, sourceVideos, removeSource,
    addHookSources, hookVideos, removeHookSource,
    setVslVideo, vslVideo, removeVslVideo,
    settings, updateSettings,
  } = useBRoll();

  const { processFiles: processBRoll, isProcessing: brollProcessing } = useVideoProcessor(addSources);
  const { processFiles: processHooks, isProcessing: hookProcessing } = useVideoProcessor(addHookSources);
  const { processFiles: processVSL, isProcessing: vslProcessing } = useVideoProcessor((data) => {
    if (data.length > 0) setVslVideo(data[0]);
  });

  return (
    <div className="source-upload">
      {/* ---- VSL Video Upload (VSL mode only) ---- */}
      {creationMode === 'vsl' && (
        <div className="upload-section">
          {!vslVideo ? (
            <UploadDropZone
              onFiles={processVSL}
              isProcessing={vslProcessing}
              hasFiles={false}
              label="Drop main VSL video (person talking)"
              icon="🎙️"
              addLabel="Replace VSL video"
            />
          ) : (
            <VSLVideoCard video={vslVideo} onRemove={removeVslVideo} />
          )}
        </div>
      )}

      {/* ---- Hook Videos Upload (Hook+B-Roll mode only) ---- */}
      {creationMode === 'hook-broll' && (
        <div className="upload-section">
          <div className="upload-section-label">
            <span className="section-icon">🪝</span>
            <span>Hook Videos</span>
          </div>
          <UploadDropZone
            onFiles={processHooks}
            isProcessing={hookProcessing}
            hasFiles={hookVideos.length > 0}
            label="Drop hook source videos"
            icon="🪝"
            addLabel="Add more hook videos"
          />
          <VideoList
            videos={hookVideos}
            onRemove={removeHookSource}
            label="Hook Videos"
            badgeClass="badge-warning"
          />
        </div>
      )}

      {/* ---- B-Roll Source Videos (always visible) ---- */}
      <div className="upload-section">
        {(creationMode === 'hook-broll' || creationMode === 'vsl') && (
          <div className="upload-section-label">
            <span className="section-icon">🎞️</span>
            <span>B-Roll Videos</span>
          </div>
        )}
        <UploadDropZone
          onFiles={processBRoll}
          isProcessing={brollProcessing}
          hasFiles={sourceVideos.length > 0}
          label="Drop B-Roll source videos"
          icon="🎞️"
          addLabel="Add more source videos"
        />
        <VideoList
          videos={sourceVideos}
          onRemove={removeSource}
          label="Source Videos"
          badgeClass="badge-accent"
        />

        {sourceVideos.length > 0 && (
          <div className="broll-options" style={{ marginTop: '12px' }}>
            <label className="checkbox-wrap" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={settings.shuffleScenes !== false} 
                onChange={(e) => updateSettings({ shuffleScenes: e.target.checked })} 
              />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Shuffle scenes and cut randomly (Uncheck to play videos sequentially as-is)
              </span>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

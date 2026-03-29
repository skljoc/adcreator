import React from 'react';
import { useVideos } from '../context/VideoContext';
import './VideoList.css';

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function VideoList() {
  const { videos, selectedVideoId, selectVideo, removeVideo } = useVideos();

  if (videos.length === 0) {
    return (
      <div className="video-list-empty empty-state">
        <div className="empty-state-icon">📁</div>
        <div className="empty-state-text">No videos yet</div>
        <div className="empty-state-hint">Drop videos above to get started</div>
      </div>
    );
  }

  return (
    <div className="video-list" id="video-list">
      {videos.map((video, index) => (
        <div
          key={video.id}
          className={`video-item glass-card ${video.id === selectedVideoId ? 'video-item-selected' : ''}`}
          onClick={() => selectVideo(video.id)}
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <div className="video-item-thumb">
            {video.thumbnail ? (
              <img src={video.thumbnail} alt={video.name} />
            ) : (
              <div className="video-item-thumb-placeholder">🎬</div>
            )}
            <span className="video-item-duration">{formatDuration(video.duration)}</span>
          </div>

          <div className="video-item-info">
            <span className="video-item-name" title={video.name}>
              {video.name}
            </span>
            <div className="video-item-meta">
              <span className="badge badge-accent">
                {video.width}×{video.height}
              </span>
              {video.textConfig.useGlobal ? (
                <span className="badge badge-success">Global</span>
              ) : (
                <span className="badge badge-warning">Custom</span>
              )}
            </div>
          </div>

          <button
            className="btn-icon video-item-remove"
            onClick={(e) => {
              e.stopPropagation();
              removeVideo(video.id);
            }}
            title="Remove video"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

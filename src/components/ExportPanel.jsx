import React, { useState, useCallback } from 'react';
import { useVideos } from '../context/VideoContext';
import { exportVideo, saveFile } from '../utils/ffmpeg';
import './ExportPanel.css';

export default function ExportPanel() {
  const {
    videos, selectedVideo, getEffectiveTextConfig,
    isExporting, setExporting,
    exportProgress, setExportProgress, clearExportProgress,
  } = useVideos();

  const [exportMode, setExportMode] = useState('all'); // 'all' | 'selected'

  const handleExport = useCallback(async () => {
    const videosToExport = exportMode === 'all'
      ? videos
      : (selectedVideo ? [selectedVideo] : []);

    if (videosToExport.length === 0) return;

    setExporting(true);
    clearExportProgress();

    for (const video of videosToExport) {
      const textConfig = getEffectiveTextConfig(video);

      try {
        const data = await exportVideo(
          video.file,
          textConfig,
          (progress) => {
            setExportProgress(video.id, progress);
          },
          { width: video.width, height: video.height }
        );

        const baseName = video.name.replace(/\.[^.]+$/, '');
        const outputName = `${baseName}_1080p.mp4`;

        await saveFile(data, outputName);
      } catch (err) {
        console.error(`Export failed for ${video.name}:`, err);
        setExportProgress(video.id, { stage: 'error', percent: 0, error: err.message });
      }
    }

    setExporting(false);
  }, [videos, selectedVideo, exportMode, getEffectiveTextConfig, setExporting, setExportProgress, clearExportProgress]);

  const totalVideos = exportMode === 'all' ? videos.length : (selectedVideo ? 1 : 0);
  const completedVideos = Object.values(exportProgress).filter(p => p.stage === 'done').length;
  const hasError = Object.values(exportProgress).some(p => p.stage === 'error');

  return (
    <div className="export-panel glass-card" id="export-panel">
      <div className="export-header">
        <h3 className="export-title">Export</h3>
        <span className="badge badge-accent">{videos.length} video{videos.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="export-options">
        <div className="export-mode-toggle">
          <button
            className={`mode-btn ${exportMode === 'all' ? 'active' : ''}`}
            onClick={() => setExportMode('all')}
            disabled={isExporting}
          >
            All Videos
          </button>
          <button
            className={`mode-btn ${exportMode === 'selected' ? 'active' : ''}`}
            onClick={() => setExportMode('selected')}
            disabled={isExporting || !selectedVideo}
          >
            Selected Only
          </button>
        </div>

        <div className="export-info">
          <div className="export-info-row">
            <span>Output Resolution</span>
            <span className="export-value">
              {selectedVideo && selectedVideo.width < selectedVideo.height
                ? '1080 × 1920 (Full HD Portrait)'
                : '1920 × 1080 (Full HD)'}
            </span>
          </div>
          <div className="export-info-row">
            <span>Upscale Filter</span>
            <span className="export-value">Lanczos</span>
          </div>
          <div className="export-info-row">
            <span>Format</span>
            <span className="export-value">H.264 MP4</span>
          </div>
        </div>
      </div>

      {isExporting && (
        <div className="export-progress-section animate-fade-in">
          <div className="export-progress-header">
            <span>Exporting {completedVideos}/{totalVideos}</span>
            <span className="export-percent">
              {totalVideos > 0 ? Math.round((completedVideos / totalVideos) * 100) : 0}%
            </span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{ width: `${totalVideos > 0 ? (completedVideos / totalVideos) * 100 : 0}%` }}
            />
          </div>

          <div className="export-video-list">
            {(exportMode === 'all' ? videos : (selectedVideo ? [selectedVideo] : [])).map(video => {
              const progress = exportProgress[video.id];
              return (
                <div key={video.id} className="export-video-item">
                  <span className="export-video-name">{video.name}</span>
                  <div className="export-video-status">
                    {!progress && <span className="badge">Waiting...</span>}
                    {progress?.stage === 'loading' && <span className="badge badge-accent">Loading</span>}
                    {progress?.stage === 'processing' && <span className="badge badge-accent">Processing</span>}
                    {progress?.stage === 'encoding' && <span className="badge badge-warning">Encoding {progress.percent}%</span>}
                    {progress?.stage === 'finalizing' && <span className="badge badge-accent">Finalizing</span>}
                    {progress?.stage === 'done' && <span className="badge badge-success">✓ Done</span>}
                    {progress?.stage === 'error' && <span className="badge" style={{ background: 'rgba(245,69,92,0.15)', color: 'var(--danger)' }}>✕ Error</span>}
                  </div>
                  {progress && progress.stage !== 'done' && progress.stage !== 'error' && (
                    <div className="progress-bar" style={{ marginTop: '4px' }}>
                      <div className="progress-bar-fill" style={{ width: `${progress.percent}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button
        className="btn btn-primary export-btn"
        onClick={handleExport}
        disabled={isExporting || videos.length === 0}
      >
        {isExporting ? (
          <>
            <span className="export-spinner" />
            Exporting...
          </>
        ) : (
          <>
            🚀 Export {exportMode === 'all' ? `All (${videos.length})` : 'Selected'} to 1080p
          </>
        )}
      </button>

      {hasError && (
        <div className="export-error-notice">
          Some exports failed. Check the console for details.
        </div>
      )}
    </div>
  );
}

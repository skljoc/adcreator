import React, { useState } from 'react';
import DropZone from './components/DropZone';
import VideoList from './components/VideoList';
import VideoPreview from './components/VideoPreview';
import TextEditor from './components/TextEditor';
import ExportPanel from './components/ExportPanel';
import ThemeToggle from './components/ThemeToggle';
import BRollCreator from './components/broll/BRollCreator';
import { useVideos } from './context/VideoContext';
import { HashRouter, Routes, Route } from 'react-router-dom';
import LicenseWrapper from './components/auth/LicenseWrapper';
import AdminPanel from './components/admin/AdminPanel';
import './App.css';

const TABS = [
  { id: 'overlay', label: '✨ Text Overlay', icon: '✨' },
  { id: 'broll', label: '🎬 B-Roll Creator', icon: '🎬' },
];

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={
          <LicenseWrapper>
            <EditorApp />
          </LicenseWrapper>
        } />
        <Route path="/admin" element={<AdminPanel />} />
      </Routes>
    </HashRouter>
  );
}

function EditorApp() {
  const { videos } = useVideos();
  const hasVideos = videos.length > 0;
  const [activeTab, setActiveTab] = useState('overlay');

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header glass-panel drag-handle">
        <div className="header-left no-drag">
          <div className="header-logo">
            <span className="logo-icon">🎬</span>
            <h1 className="logo-text">Video Ads Editor</h1>
          </div>
          {/* Tab Navigation */}
          <nav className="header-tabs">
            {TABS.map(tab => (
              <button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="header-right no-drag">
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="app-main">
        {activeTab === 'overlay' ? (
          <>
            {!hasVideos ? (
              /* Empty state — full-screen drop zone */
              <div className="app-empty-state animate-slide-up">
                <div className="empty-hero">
                  <div className="empty-hero-icon">✨</div>
                  <h2 className="empty-hero-title">Text Overlay Editor</h2>
                  <p className="empty-hero-subtitle">
                    Add text overlays to your video ads and export at 1080p
                  </p>
                </div>
                <DropZone />
                <div className="empty-features">
                  <div className="feature-card glass-card">
                    <span className="feature-icon">✨</span>
                    <span className="feature-text">CapCut-style text editing</span>
                  </div>
                  <div className="feature-card glass-card">
                    <span className="feature-icon">🎯</span>
                    <span className="feature-text">Global & per-video titles</span>
                  </div>
                  <div className="feature-card glass-card">
                    <span className="feature-icon">🚀</span>
                    <span className="feature-text">Export to 1080p MP4</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Three-panel editor layout */
              <div className="app-editor">
                <aside className="panel panel-left glass-panel animate-slide-up">
                  <div className="panel-header">
                    <h2 className="panel-title">Videos</h2>
                    <span className="badge badge-accent">{videos.length}</span>
                  </div>
                  <DropZone />
                  <VideoList />
                </aside>

                <section className="panel panel-center glass-panel animate-slide-up" style={{ animationDelay: '50ms' }}>
                  <VideoPreview />
                </section>

                <aside className="panel panel-right glass-panel animate-slide-up" style={{ animationDelay: '100ms' }}>
                  <div className="panel-header">
                    <h2 className="panel-title">Text Overlay</h2>
                  </div>
                  <div className="right-panel-content">
                    <TextEditor />
                    <ExportPanel />
                  </div>
                </aside>
              </div>
            )}
          </>
        ) : (
          <BRollCreator />
        )}
      </main>
    </div>
  );
}

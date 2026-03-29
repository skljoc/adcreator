import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { VideoProvider } from './context/VideoContext';
import { BRollProvider } from './context/BRollContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <VideoProvider>
        <BRollProvider>
          <App />
        </BRollProvider>
      </VideoProvider>
    </ThemeProvider>
  </React.StrictMode>
);

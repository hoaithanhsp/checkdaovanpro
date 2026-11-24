import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import { LEGACY_GEMINI_MODEL_STORAGE_KEYS } from './services/apiKeyService';

// Tự động di trú (Migration): dọn sạch các khóa model cũ để trình duyệt tự nhận mặc định gemini-4-hydrogen (v4)
try {
  for (const legacyKey of LEGACY_GEMINI_MODEL_STORAGE_KEYS) {
    if (localStorage.getItem(legacyKey) !== null) {
      localStorage.removeItem(legacyKey);
    }
  }
} catch {
  // Bỏ qua nếu trình duyệt chặn localStorage
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

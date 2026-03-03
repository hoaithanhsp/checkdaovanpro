import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';

// Dọn dẹp model cũ không hợp lệ trong localStorage
const INVALID_MODELS = ['gemini-2.0-flash', 'gemini-3-pro-preview', 'gemini-2.5-flash-preview-05-20'];
const savedModel = localStorage.getItem('skkn-gemini-model');
if (savedModel && INVALID_MODELS.includes(savedModel)) {
  localStorage.removeItem('skkn-gemini-model');
  console.log(`🔄 Đã xóa model cũ không hợp lệ: ${savedModel}`);
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

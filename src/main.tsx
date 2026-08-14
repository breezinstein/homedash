import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext.tsx'

// /monitor route: separate root tree, lazy-loaded so the main dashboard
// doesn't pay for it. No react-router — just a pathname check.
const isMonitor = window.location.pathname.replace(/\/+$/, '').endsWith('/monitor');

const root = document.getElementById('root')!;

if (isMonitor) {
  const MonitorApp = lazy(() => import('./monitor/MonitorApp').then(m => ({ default: m.MonitorApp })));
  createRoot(root).render(
    <StrictMode>
      <AuthProvider>
        <Suspense fallback={<div style={{ minHeight: '100dvh', background: 'var(--color-background, #0a0a0a)' }} />}>
          <MonitorApp />
        </Suspense>
      </AuthProvider>
    </StrictMode>,
  );
} else {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

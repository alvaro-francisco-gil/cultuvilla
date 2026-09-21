import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { chipStyles, ink, onAccent, surfaces } from './theme';
import './styles.css';

/**
 * Publish the measured theme as CSS variables. The stylesheet holds no hex
 * values on purpose: every colour has to come from theme.ts, which is the file
 * theme.test.ts checks against WCAG AA.
 */
function applyTheme(): void {
  const root = document.documentElement;
  root.style.setProperty('--page', surfaces.page);
  root.style.setProperty('--card', surfaces.card);
  root.style.setProperty('--card-alt', surfaces.cardAlt);
  root.style.setProperty('--border', surfaces.border);
  root.style.setProperty('--border-strong', surfaces.borderStrong);
  root.style.setProperty('--ink', ink.strong);
  root.style.setProperty('--ink-muted', ink.muted);
  root.style.setProperty('--accent', ink.accent);
  root.style.setProperty('--on-accent', onAccent);
  root.style.setProperty('--danger', chipStyles.urgente.fg);
  root.style.setProperty('--mark-bg', chipStyles.activo.bg);
}

applyTheme();

const container = document.getElementById('root');
if (!container) throw new Error('#root missing from index.html');
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

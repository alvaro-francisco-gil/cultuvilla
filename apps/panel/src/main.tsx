import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { colors } from '@cultuvilla/shared/design-system';
import { App } from './App';
import './styles.css';

/**
 * Publish the design-system tokens as CSS variables instead of copying hex
 * values into the stylesheet — the panel then follows the app's palette for free.
 */
function applyTokens(): void {
  const root = document.documentElement;
  const { bg, fg, border } = colors.light;
  for (const [name, value] of Object.entries(bg)) root.style.setProperty(`--bg-${name}`, value);
  for (const [name, value] of Object.entries(fg)) root.style.setProperty(`--fg-${name}`, value);
  for (const [name, value] of Object.entries(border)) root.style.setProperty(`--border-${name}`, value);
}

applyTokens();

const container = document.getElementById('root');
if (!container) throw new Error('#root missing from index.html');
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

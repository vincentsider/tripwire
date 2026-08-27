// src/main.tsx
//
// App entry. If no native WebMCP host is present (local dev, or a browser
// without the flag), install the polyfill so the range is still runnable. Then
// render the app. The full Trace / Scorecard UI lands next; this first screen
// reports which host is live, which is exactly what the day-0 spike needs.

import React from 'react';
import { createRoot } from 'react-dom/client';
import { resolveHost } from './webmcp/shim.ts';
import { installPolyfill } from './webmcp/polyfill.ts';
import { App } from './ui/App.tsx';
import './ui/theme.css';

// Resolve a native host first; only fall back to the polyfill if none exists,
// so we never shadow a real document.modelContext / navigator.modelContext.
const native = resolveHost();
if (native.source === 'none') installPolyfill();

const container = document.getElementById('root');
if (!container) throw new Error('#root not found');
createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

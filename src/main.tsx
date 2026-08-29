// src/main.tsx
//
// App entry + client routing. If no native WebMCP host is present (local dev, or
// a browser without the flag), install the polyfill so the range is still
// runnable. Then mount the router. The Worker serves index.html for every
// unknown path (SPA fallback), so deep links like /badge work on refresh.

import React from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { resolveHost } from './webmcp/shim.ts';
import { installPolyfill } from './webmcp/polyfill.ts';
import { App } from './ui/App.tsx';
import { Home } from './ui/pages/Home.tsx';
import { RangePage } from './ui/pages/RangePage.tsx';
import { AuditWizard } from './ui/pages/AuditWizard.tsx';
import { ScanPage } from './ui/pages/ScanPage.tsx';
import { BadgePage } from './ui/pages/BadgePage.tsx';
import './ui/theme.css';
import './ui/console.css';

const native = resolveHost();
if (native.source === 'none') installPolyfill();

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Home /> },
      { path: 'range', element: <RangePage /> },
      { path: 'badge', element: <AuditWizard /> },
      { path: 'embed', element: <BadgePage /> },
      { path: 'scan', element: <ScanPage /> },
      { path: '*', element: <Home /> },
    ],
  },
]);

const container = document.getElementById('root');
if (!container) throw new Error('#root not found');
createRoot(container).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);

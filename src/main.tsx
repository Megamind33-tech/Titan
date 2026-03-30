import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AssetLibraryProvider } from './hooks/useAssetLibrary.tsx';
import { MaterialLibraryProvider } from './hooks/useMaterialLibrary.tsx';
import { EnvironmentLibraryProvider } from './hooks/useEnvironmentLibrary.tsx';

import { polyfill } from 'mobile-drag-drop';
import 'mobile-drag-drop/default.css';

// Initialize the polyfill
polyfill({
    dragImageTranslateOverride: "auto"
});

// Workaround for iOS Safari to allow polyfill to prevent default scroll
window.addEventListener('touchmove', function() {}, {passive: false});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AssetLibraryProvider>
      <MaterialLibraryProvider>
        <EnvironmentLibraryProvider>
          <App />
        </EnvironmentLibraryProvider>
      </MaterialLibraryProvider>
    </AssetLibraryProvider>
  </StrictMode>,
);

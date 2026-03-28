import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AssetLibraryProvider } from './hooks/useAssetLibrary.tsx';
import { MaterialLibraryProvider } from './hooks/useMaterialLibrary.tsx';
import { EnvironmentLibraryProvider } from './hooks/useEnvironmentLibrary.tsx';

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

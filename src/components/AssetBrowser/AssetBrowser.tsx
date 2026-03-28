
import React, { useState, useMemo } from 'react';
import { Asset, AssetCategory } from '../../types/assets';
import { useAssetLibrary } from '../../hooks/useAssetLibrary';

interface AssetBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onPlaceAsset: (asset: Asset) => void;
}

const CATEGORIES: (AssetCategory | 'All')[] = [
  'All',
  'Models',
  'Environment',
  'Ground',
  'Water',
  'Props',
  'Ads and Signage',
  'Textures',
  'Materials',
  'Lights',
  'Saved Presets'
];

export default function AssetBrowser({ isOpen, onClose, onPlaceAsset }: AssetBrowserProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const {
    filteredAssets,
    addAsset,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    filterOptions,
    setFilterOptions,
  } = useAssetLibrary();

  const [importCategory, setImportCategory] = useState<AssetCategory>('Models');
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      let successCount = 0;
      let errorCount = 0;

      Array.from(files).forEach(file => {
        const ext = file.name.split('.').pop()?.toLowerCase();
        const supportedExts = ['glb', 'gltf', 'obj', 'png', 'jpg', 'jpeg', 'webp'];
        
        if (!ext || !supportedExts.includes(ext)) {
          errorCount++;
          return;
        }

        if (file.size > 50 * 1024 * 1024) { // 50MB hard limit
          showNotification(`File ${file.name} is too large (>50MB)`, 'error');
          errorCount++;
          return;
        }

        try {
          addAsset(file, importCategory);
          successCount++;
        } catch (err) {
          console.error(err);
          errorCount++;
        }
      });

      if (successCount > 0) {
        showNotification(`Successfully imported ${successCount} asset(s)`, 'success');
      }
      if (errorCount > 0) {
        showNotification(`Failed to import ${errorCount} asset(s) - unsupported format or too large`, 'error');
      }
    }
  };

  return (
    <div className={`fixed bottom-4 left-[200px] z-[100] flex flex-col transition-all duration-300 ease-in-out ${
      isOpen ? 'translate-y-0 opacity-100' : 'translate-y-[110%] opacity-0 pointer-events-none'
    } ${isMinimized ? 'h-14' : 'top-16 h-auto'}`}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[450px] h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between bg-gray-800/50 relative shrink-0">
          {notification && (
            <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 px-4 py-2 rounded-lg shadow-xl z-50 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 ${
              notification.type === 'success' ? 'bg-green-600 text-white' : 
              notification.type === 'error' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'
            }`}>
              {notification.message}
            </div>
          )}
          <div className="flex flex-col gap-2 w-full mr-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 cursor-pointer" onClick={() => setIsMinimized(!isMinimized)}>
                <span>📦</span> Assets {isMinimized && <span className="text-[10px] text-gray-500 ml-2 font-normal">(Minimized)</span>}
              </h2>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="text-gray-400 hover:text-white transition-colors text-xl p-1 hover:bg-gray-700 rounded"
                  title={isMinimized ? "Restore" : "Minimize"}
                >
                  {isMinimized ? '◻️' : '−'}
                </button>
                <button 
                  onClick={onClose}
                  className="text-gray-400 hover:text-white transition-colors text-xl p-1 hover:bg-gray-700 rounded"
                  title="Close"
                >
                  &times;
                </button>
              </div>
            </div>
            {!isMinimized && (
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search assets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-gray-800 text-white px-4 py-1.5 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full text-sm"
                />
                <span className="absolute right-3 top-1.5 opacity-50">🔍</span>
              </div>
            )}
          </div>
        </div>

        {!isMinimized && (
          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar Categories */}
            <div className="w-32 border-r border-gray-700 bg-gray-900/50 overflow-y-auto p-2">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">Categories</div>
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors mb-1 ${
                    selectedCategory === cat 
                      ? 'bg-blue-600 text-white' 
                      : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}

              <div className="mt-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">Filters</div>
              <div className="px-1 space-y-1.5">
                {Object.entries(filterOptions).map(([key, value]) => (
                  <label key={key} className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer hover:text-gray-200">
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(e) => setFilterOptions(prev => ({ ...prev, [key]: e.target.checked }))}
                      className="rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-blue-500 w-3 h-3"
                    />
                    <span className="capitalize">{key}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col bg-gray-950/30">
              {/* Import Bar */}
              <div className="p-3 border-b border-gray-800 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500 uppercase font-bold">Import</span>
                  <div className="text-[10px] text-gray-500">
                    {filteredAssets.length} items
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select 
                    value={importCategory}
                    onChange={(e) => setImportCategory(e.target.value as AssetCategory)}
                    className="bg-gray-800 text-white text-xs px-2 py-1 rounded border border-gray-700 flex-1"
                  >
                    {CATEGORIES.filter(c => c !== 'All').map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap"
                  >
                    <span>➕</span> Import
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileImport}
                    multiple
                    accept=".glb,.gltf,.obj,.png,.jpg,.jpeg,.webp"
                    className="hidden"
                  />
                </div>
              </div>

              {/* Asset Grid */}
              <div className="flex-1 overflow-y-auto p-3">
                {filteredAssets.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-2 text-center p-4">
                    <span className="text-4xl">📭</span>
                    <p className="text-sm">No assets found.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {filteredAssets.map(asset => (
                      <AssetCard 
                        key={asset.id} 
                        asset={asset} 
                        onPlace={() => onPlaceAsset(asset)}
                      />
                    ))}
                  </div>
                )}
              </div>
              
              <div className="p-2 border-t border-gray-800 bg-gray-900/50">
                <p className="text-[10px] text-gray-500 text-center italic">
                  Tip: Drag and drop assets directly into the scene
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AssetCard({ asset, onPlace }: { asset: Asset; onPlace: () => void }) {
  const isHeavy = asset.metadata.optimizedStatus === 'heavy';
  
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/json', JSON.stringify(asset));
    e.dataTransfer.effectAllowed = 'copy';
    
    // Optional: set a drag image
    const dragIcon = document.createElement('div');
    dragIcon.style.width = '50px';
    dragIcon.style.height = '50px';
    dragIcon.style.background = '#3b82f6';
    dragIcon.style.borderRadius = '8px';
    dragIcon.style.display = 'flex';
    dragIcon.style.alignItems = 'center';
    dragIcon.style.justifyContent = 'center';
    dragIcon.innerHTML = '📦';
    document.body.appendChild(dragIcon);
    e.dataTransfer.setDragImage(dragIcon, 25, 25);
    setTimeout(() => document.body.removeChild(dragIcon), 0);
  };
  
  return (
    <div 
      draggable
      onDragStart={handleDragStart}
      className="group bg-gray-800 border border-gray-700 rounded-xl overflow-hidden hover:border-blue-500 transition-all flex flex-col relative cursor-grab active:cursor-grabbing"
    >
      {/* Preview */}
      <div className="aspect-square bg-gray-900 flex items-center justify-center overflow-hidden relative">
        {asset.metadata.type === 'texture' ? (
          <img 
            src={asset.url} 
            alt={asset.metadata.name} 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="text-4xl opacity-50">
            {asset.metadata.type === 'model' ? '🧊' : 
             asset.metadata.type === 'light' ? '💡' : 
             asset.metadata.type === 'material' ? '🎨' : '📄'}
          </div>
        )}
        
        {isHeavy && (
          <div className="absolute top-2 right-2 bg-red-500/80 text-white text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter">
            Heavy
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2 flex flex-col gap-1">
        <div className="text-xs font-medium text-white truncate" title={asset.metadata.name}>
          {asset.metadata.name}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-500 uppercase">{asset.metadata.type}</span>
          <span className="text-[10px] text-gray-400">{(asset.metadata.fileSize / 1024 / 1024).toFixed(1)} MB</span>
        </div>
      </div>

      {/* Hover Overlay */}
      <div className="absolute inset-0 bg-blue-600/90 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity p-4">
        <button
          onClick={onPlace}
          className="w-full bg-white text-blue-600 font-bold py-2 rounded-lg text-sm hover:bg-gray-100 transition-colors"
        >
          Place in Scene
        </button>
        <div className="text-[10px] text-white/80 text-center">
          {asset.metadata.category} • {asset.metadata.classification}
        </div>
      </div>
    </div>
  );
}

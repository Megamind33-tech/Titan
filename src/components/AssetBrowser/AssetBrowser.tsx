
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
      <div className="bg-[#151619] border border-white/10 rounded-xl shadow-2xl w-[450px] h-full flex flex-col overflow-hidden backdrop-blur-xl">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/20 relative shrink-0">
          {notification && (
            <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 px-4 py-2 rounded-lg shadow-xl z-50 text-[10px] font-mono uppercase tracking-widest animate-in fade-in slide-in-from-top-2 duration-300 ${
              notification.type === 'success' ? 'bg-green-600 text-white' : 
              notification.type === 'error' ? 'bg-red-600 text-white' : 'bg-white/10 text-white border border-white/20 backdrop-blur-md'
            }`}>
              {notification.message}
            </div>
          )}
          <div className="flex flex-col gap-2 w-full mr-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-mono uppercase tracking-widest text-white flex items-center gap-2 cursor-pointer" onClick={() => setIsMinimized(!isMinimized)}>
                <span className="opacity-50">📦</span> Assets {isMinimized && <span className="text-[9px] text-white/30 ml-2 font-normal lowercase tracking-normal">(minimized)</span>}
              </h2>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="text-white/40 hover:text-white transition-colors p-1.5 hover:bg-white/5 rounded border border-transparent hover:border-white/10"
                  title={isMinimized ? "Restore" : "Minimize"}
                >
                  {isMinimized ? '◻️' : '−'}
                </button>
                <button 
                  onClick={onClose}
                  className="text-white/40 hover:text-white transition-colors p-1.5 hover:bg-white/5 rounded border border-transparent hover:border-white/10"
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
                  placeholder="SEARCH_ASSETS..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="hardware-input w-full py-2 text-[10px]"
                />
                <span className="absolute right-3 top-2 opacity-30 text-[10px]">🔍</span>
              </div>
            )}
          </div>
        </div>

        {!isMinimized && (
          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar Categories */}
            <div className="w-32 border-r border-white/10 bg-black/10 overflow-y-auto p-2 custom-scrollbar">
              <div className="text-[9px] font-mono font-bold text-white/30 uppercase tracking-widest mb-3 px-1">Categories</div>
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`w-full text-left px-2 py-2 rounded text-[10px] font-mono uppercase tracking-tighter transition-all mb-1 border ${
                    selectedCategory === cat 
                      ? 'bg-white text-black border-white' 
                      : 'text-white/40 border-transparent hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}

              <div className="mt-6 text-[9px] font-mono font-bold text-white/30 uppercase tracking-widest mb-3 px-1">Filters</div>
              <div className="px-1 space-y-2">
                {Object.entries(filterOptions).map(([key, value]) => (
                  <label key={key} className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-tighter text-white/40 cursor-pointer hover:text-white transition-colors">
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(e) => setFilterOptions(prev => ({ ...prev, [key]: e.target.checked }))}
                      className="rounded border-white/10 bg-black/40 text-white focus:ring-white/20 w-3 h-3"
                    />
                    <span>{key}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col bg-black/5">
              {/* Import Bar */}
              <div className="p-3 border-b border-white/5 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-white/30 uppercase font-mono tracking-widest">Import</span>
                  <div className="text-[9px] font-mono text-white/30">
                    {filteredAssets.length} ITEMS
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select 
                    value={importCategory}
                    onChange={(e) => setImportCategory(e.target.value as AssetCategory)}
                    className="hardware-input flex-1 py-1.5 text-[10px]"
                  >
                    {CATEGORIES.filter(c => c !== 'All').map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="hardware-button px-3 py-1.5 text-[10px] flex items-center gap-2"
                  >
                    <span>➕</span> IMPORT
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
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {filteredAssets.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-white/20 gap-3 text-center p-4">
                    <span className="text-4xl opacity-10">📭</span>
                    <p className="text-[10px] font-mono uppercase tracking-widest">No assets found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
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
              
              <div className="p-3 border-t border-white/5 bg-black/20">
                <p className="text-[9px] text-white/30 text-center font-mono uppercase tracking-widest">
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
    dragIcon.style.background = '#ffffff';
    dragIcon.style.borderRadius = '4px';
    dragIcon.style.display = 'flex';
    dragIcon.style.alignItems = 'center';
    dragIcon.style.justifyContent = 'center';
    dragIcon.style.border = '1px solid rgba(0,0,0,0.1)';
    dragIcon.innerHTML = '📦';
    document.body.appendChild(dragIcon);
    e.dataTransfer.setDragImage(dragIcon, 25, 25);
    setTimeout(() => document.body.removeChild(dragIcon), 0);
  };
  
  return (
    <div 
      draggable
      onDragStart={handleDragStart}
      className="group bg-black/40 border border-white/5 rounded-xl overflow-hidden hover:border-white/20 transition-all flex flex-col relative cursor-grab active:cursor-grabbing"
    >
      {/* Preview */}
      <div className="aspect-square bg-black/60 flex items-center justify-center overflow-hidden relative">
        {asset.metadata.type === 'texture' ? (
          <img 
            src={asset.url} 
            alt={asset.metadata.name} 
            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="text-4xl opacity-20 group-hover:opacity-40 transition-opacity">
            {asset.metadata.type === 'model' ? '🧊' : 
             asset.metadata.type === 'light' ? '💡' : 
             asset.metadata.type === 'material' ? '🎨' : '📄'}
          </div>
        )}
        
        {isHeavy && (
          <div className="absolute top-2 right-2 bg-red-500/80 text-white text-[8px] px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-tighter">
            Heavy
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1">
        <div className="text-[10px] font-mono uppercase tracking-tighter text-white/90 truncate" title={asset.metadata.name}>
          {asset.metadata.name}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-mono text-white/30 uppercase">{asset.metadata.type}</span>
          <span className="text-[9px] font-mono text-white/30">{(asset.metadata.fileSize / 1024 / 1024).toFixed(1)} MB</span>
        </div>
      </div>

      {/* Hover Overlay */}
      <div className="absolute inset-0 bg-white/10 backdrop-blur-sm flex flex-col items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity p-4">
        <button
          onClick={onPlace}
          className="hardware-button w-full py-2 text-[10px]"
        >
          PLACE_IN_SCENE
        </button>
        <div className="text-[8px] font-mono text-white/60 text-center uppercase tracking-widest">
          {asset.metadata.category} • {asset.metadata.classification}
        </div>
      </div>
    </div>
  );
}

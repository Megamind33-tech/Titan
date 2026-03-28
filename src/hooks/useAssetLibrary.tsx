
import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { Asset, AssetCategory, AssetType, AssetMetadata } from '../types/assets';

const STORAGE_KEY = 'game_editor_asset_library';

interface AssetLibraryContextType {
  assets: Asset[];
  filteredAssets: Asset[];
  addAsset: (file: File, category: AssetCategory) => Asset;
  removeAsset: (id: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: AssetCategory | 'All';
  setSelectedCategory: (category: AssetCategory | 'All') => void;
  filterOptions: {
    indoor: boolean;
    outdoor: boolean;
    optimized: boolean;
    large: boolean;
  };
  setFilterOptions: React.Dispatch<React.SetStateAction<{
    indoor: boolean;
    outdoor: boolean;
    optimized: boolean;
    large: boolean;
  }>>;
}

const AssetLibraryContext = createContext<AssetLibraryContextType | undefined>(undefined);

export function AssetLibraryProvider({ children }: { children: React.ReactNode }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<AssetCategory | 'All'>('All');
  const [filterOptions, setFilterOptions] = useState({
    indoor: false,
    outdoor: false,
    optimized: false,
    large: false,
  });

  // Load metadata from localStorage on mount
  useEffect(() => {
    const savedMetadata = localStorage.getItem(STORAGE_KEY);
    if (savedMetadata) {
      try {
        const parsedMetadata = JSON.parse(savedMetadata) as AssetMetadata[];
        const initialAssets: Asset[] = parsedMetadata.map(meta => ({
          id: meta.assetId,
          metadata: meta,
          url: '', // This will be empty until the user re-uploads or we use a persistent storage
        }));
        setAssets(initialAssets);
      } catch (e) {
        console.error("Failed to load asset library metadata", e);
      }
    }
  }, []);

  // Save metadata to localStorage when assets change
  useEffect(() => {
    const metadata = assets.map(a => a.metadata);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(metadata));
  }, [assets]);

  const addAsset = useCallback((file: File, category: AssetCategory) => {
    const assetId = Date.now().toString() + Math.random().toString(36).substring(7);
    const url = URL.createObjectURL(file);
    
    let type: AssetType = 'model';
    if (file.type.startsWith('image/')) type = 'texture';
    else if (file.name.endsWith('.json')) type = 'material';
    else if (file.name.endsWith('.glb') || file.name.endsWith('.gltf') || file.name.endsWith('.obj')) type = 'model';

    const metadata: AssetMetadata = {
      assetId,
      name: file.name,
      type,
      category,
      fileSize: file.size,
      optimizedStatus: file.size > 5 * 1024 * 1024 ? 'heavy' : 'optimized',
      version: 1,
      editStatus: 'original',
      classification: 'outdoor',
      exportCompatibility: 'ready',
      tags: [type, category.toLowerCase()],
      importDate: Date.now(),
    };

    const newAsset: Asset = {
      id: assetId,
      metadata,
      url,
      file,
    };

    setAssets(prev => [...prev, newAsset]);
    return newAsset;
  }, []);

  const removeAsset = useCallback((id: string) => {
    setAssets(prev => {
      const asset = prev.find(a => a.id === id);
      if (asset?.url.startsWith('blob:')) {
        URL.revokeObjectURL(asset.url);
      }
      return prev.filter(a => a.id !== id);
    });
  }, []);

  const filteredAssets = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    const filtered = assets.filter(asset => {
      const matchesCategory = selectedCategory === 'All' || asset.metadata.category === selectedCategory;
      
      const matchesIndoor = !filterOptions.indoor || asset.metadata.classification === 'indoor' || asset.metadata.classification === 'both';
      const matchesOutdoor = !filterOptions.outdoor || asset.metadata.classification === 'outdoor' || asset.metadata.classification === 'both';
      const matchesOptimized = !filterOptions.optimized || asset.metadata.optimizedStatus === 'optimized';
      const matchesLarge = !filterOptions.large || asset.metadata.optimizedStatus === 'heavy';

      if (!(matchesCategory && matchesIndoor && matchesOutdoor && matchesOptimized && matchesLarge)) {
        return false;
      }

      if (!query) return true;

      const matchesName = asset.metadata.name.toLowerCase().includes(query);
      const matchesTags = asset.metadata.tags.some(tag => tag.toLowerCase().includes(query));

      return matchesName || matchesTags;
    });

    if (!query) return filtered;

    // Sort by relevance: Name matches first, then tag matches
    return [...filtered].sort((a, b) => {
      const aName = a.metadata.name.toLowerCase();
      const bName = b.metadata.name.toLowerCase();

      const aNameMatch = aName.includes(query);
      const bNameMatch = bName.includes(query);

      // Prioritize name matches
      if (aNameMatch && !bNameMatch) return -1;
      if (!aNameMatch && bNameMatch) return 1;

      // If both match name, prioritize startsWith
      if (aNameMatch && bNameMatch) {
        const aStarts = aName.startsWith(query);
        const bStarts = bName.startsWith(query);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
      }

      // Default to alphabetical
      return aName.localeCompare(bName);
    });
  }, [assets, searchQuery, selectedCategory, filterOptions]);

  const value = {
    assets,
    filteredAssets,
    addAsset,
    removeAsset,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    filterOptions,
    setFilterOptions,
  };

  return (
    <AssetLibraryContext.Provider value={value}>
      {children}
    </AssetLibraryContext.Provider>
  );
}

export function useAssetLibrary() {
  const context = useContext(AssetLibraryContext);
  if (context === undefined) {
    throw new Error('useAssetLibrary must be used within an AssetLibraryProvider');
  }
  return context;
}

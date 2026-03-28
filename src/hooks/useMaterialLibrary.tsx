
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { MaterialPreset, MaterialCategory, DEFAULT_MATERIAL } from '../types/materials';

interface MaterialLibraryContextType {
  presets: MaterialPreset[];
  addPreset: (preset: Omit<MaterialPreset, 'id'>) => MaterialPreset;
  updatePreset: (id: string, updates: Partial<MaterialPreset>) => void;
  deletePreset: (id: string) => void;
  getPreset: (id: string) => MaterialPreset | undefined;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: MaterialCategory | 'All';
  setSelectedCategory: (category: MaterialCategory | 'All') => void;
  filteredPresets: MaterialPreset[];
}

const MaterialLibraryContext = createContext<MaterialLibraryContextType | undefined>(undefined);

export function MaterialLibraryProvider({ children }: { children: React.ReactNode }) {
  const [presets, setPresets] = useState<MaterialPreset[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MaterialCategory | 'All'>('All');

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('material_presets');
    if (saved) {
      try {
        setPresets(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load material presets', e);
        setPresets([DEFAULT_MATERIAL]);
      }
    } else {
      setPresets([DEFAULT_MATERIAL]);
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (presets.length > 0) {
      localStorage.setItem('material_presets', JSON.stringify(presets));
    }
  }, [presets]);

  const addPreset = (presetData: Omit<MaterialPreset, 'id'>) => {
    const newPreset: MaterialPreset = {
      ...presetData,
      id: `mat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    setPresets(prev => [...prev, newPreset]);
    return newPreset;
  };

  const updatePreset = (id: string, updates: Partial<MaterialPreset>) => {
    setPresets(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const deletePreset = (id: string) => {
    if (id === 'default') return; // Don't delete default
    setPresets(prev => prev.filter(p => p.id !== id));
  };

  const getPreset = (id: string) => presets.find(p => p.id === id);

  const filteredPresets = useMemo(() => {
    return presets.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [presets, searchQuery, selectedCategory]);

  return (
    <MaterialLibraryContext.Provider value={{
      presets,
      addPreset,
      updatePreset,
      deletePreset,
      getPreset,
      searchQuery,
      setSearchQuery,
      selectedCategory,
      setSelectedCategory,
      filteredPresets
    }}>
      {children}
    </MaterialLibraryContext.Provider>
  );
}

export function useMaterialLibrary() {
  const context = useContext(MaterialLibraryContext);
  if (context === undefined) {
    throw new Error('useMaterialLibrary must be used within a MaterialLibraryProvider');
  }
  return context;
}


import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { EnvironmentPreset, EnvironmentCategory, DEFAULT_ENVIRONMENT, POOL_INDOOR_BRIGHT, POOL_COMPETITION, OUTDOOR_SUNSET } from '../types/environment';

interface EnvironmentLibraryContextType {
  presets: EnvironmentPreset[];
  addPreset: (preset: Omit<EnvironmentPreset, 'id'>) => EnvironmentPreset;
  updatePreset: (id: string, updates: Partial<EnvironmentPreset>) => void;
  deletePreset: (id: string) => void;
  getPreset: (id: string) => EnvironmentPreset | undefined;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: EnvironmentCategory | 'All';
  setSelectedCategory: (category: EnvironmentCategory | 'All') => void;
  filteredPresets: EnvironmentPreset[];
}

const EnvironmentLibraryContext = createContext<EnvironmentLibraryContextType | undefined>(undefined);

const INITIAL_PRESETS: EnvironmentPreset[] = [
  DEFAULT_ENVIRONMENT,
  POOL_INDOOR_BRIGHT,
  POOL_COMPETITION,
  OUTDOOR_SUNSET
];

export function EnvironmentLibraryProvider({ children }: { children: React.ReactNode }) {
  const [presets, setPresets] = useState<EnvironmentPreset[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<EnvironmentCategory | 'All'>('All');

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('environment_presets');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Merge with initial presets (in case new ones were added in code)
        const merged = [...INITIAL_PRESETS];
        parsed.forEach((p: EnvironmentPreset) => {
          if (!merged.find(ip => ip.id === p.id)) {
            merged.push(p);
          }
        });
        setPresets(merged);
      } catch (e) {
        console.error('Failed to load environment presets', e);
        setPresets(INITIAL_PRESETS);
      }
    } else {
      setPresets(INITIAL_PRESETS);
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (presets.length > 0) {
      // Only save custom ones or all? Let's save all for now.
      localStorage.setItem('environment_presets', JSON.stringify(presets));
    }
  }, [presets]);

  const addPreset = (presetData: Omit<EnvironmentPreset, 'id'>) => {
    const newPreset: EnvironmentPreset = {
      ...presetData,
      id: `env_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    setPresets(prev => [...prev, newPreset]);
    return newPreset;
  };

  const updatePreset = (id: string, updates: Partial<EnvironmentPreset>) => {
    setPresets(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const deletePreset = (id: string) => {
    // Don't delete built-in ones
    if (INITIAL_PRESETS.find(p => p.id === id)) return;
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
    <EnvironmentLibraryContext.Provider value={{
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
    </EnvironmentLibraryContext.Provider>
  );
}

export function useEnvironmentLibrary() {
  const context = useContext(EnvironmentLibraryContext);
  if (context === undefined) {
    throw new Error('useEnvironmentLibrary must be used within a EnvironmentLibraryProvider');
  }
  return context;
}

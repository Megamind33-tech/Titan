import React, { useState } from 'react';
import { Box, Plus, Search, Tag, Trash2, Copy, LayoutGrid, List as ListIcon, ChevronRight, ChevronDown } from 'lucide-react';
import { Prefab, PREFAB_CATEGORIES, PrefabCategory } from '../types/prefabs';
import { ModelData } from '../App';

interface PrefabLibraryProps {
  prefabs: Prefab[];
  onPlacePrefab: (prefab: Prefab) => void;
  onCreatePrefabFromSelection: () => void;
  onDeletePrefab: (id: string) => void;
  canCreatePrefab: boolean;
}

export default function PrefabLibrary({
  prefabs,
  onPlacePrefab,
  onCreatePrefabFromSelection,
  onDeletePrefab,
  canCreatePrefab
}: PrefabLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<PrefabCategory | 'All'>('All');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Custom']));

  const filteredPrefabs = prefabs.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         p.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const toggleCategory = (category: string) => {
    const next = new Set(expandedCategories);
    if (next.has(category)) next.delete(category);
    else next.add(category);
    setExpandedCategories(next);
  };

  const prefabsByCategory = PREFAB_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = filteredPrefabs.filter(p => p.category === cat);
    return acc;
  }, {} as Record<PrefabCategory, Prefab[]>);

  return (
    <div className="flex flex-col h-full bg-[#151619] text-white/80 font-mono text-[10px]">
      <div className="p-3 border-b border-white/5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-3.5 h-3.5 text-blue-400" />
            <span className="uppercase tracking-widest font-bold">Prefab Library</span>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-1 rounded ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}
            >
              <LayoutGrid className="w-3 h-3" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-1 rounded ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}
            >
              <ListIcon className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/20" />
          <input 
            type="text"
            placeholder="Search prefabs..."
            className="w-full bg-white/5 border border-white/10 rounded py-1.5 pl-7 pr-2 outline-none focus:border-blue-500/50 transition-colors"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <button 
          onClick={onCreatePrefabFromSelection}
          disabled={!canCreatePrefab}
          className={`w-full flex items-center justify-center gap-2 py-2 rounded border transition-all ${
            canCreatePrefab 
              ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20' 
              : 'bg-white/5 border-white/10 text-white/20 cursor-not-allowed'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="uppercase tracking-tighter font-bold">Create Prefab from Selection</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-4 custom-scrollbar">
        {PREFAB_CATEGORIES.map(category => {
          const categoryPrefabs = prefabsByCategory[category];
          if (categoryPrefabs.length === 0 && searchQuery === '') return null;
          
          const isExpanded = expandedCategories.has(category);

          return (
            <div key={category} className="space-y-1">
              <button 
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center gap-1 py-1 px-1 hover:bg-white/5 rounded transition-colors group"
              >
                {isExpanded ? <ChevronDown className="w-3 h-3 text-white/20" /> : <ChevronRight className="w-3 h-3 text-white/20" />}
                <span className="uppercase tracking-widest text-[9px] font-bold text-white/40 group-hover:text-white/60">
                  {category}
                </span>
                <span className="ml-auto text-[8px] text-white/20">({categoryPrefabs.length})</span>
              </button>

              {isExpanded && (
                <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-2' : 'space-y-1'}>
                  {categoryPrefabs.map(prefab => (
                    <div 
                      key={prefab.id}
                      className={`group relative bg-white/5 border border-white/5 rounded overflow-hidden hover:border-blue-500/30 transition-all cursor-pointer ${
                        viewMode === 'list' ? 'flex items-center gap-2 p-2' : ''
                      }`}
                      onClick={() => onPlacePrefab(prefab)}
                    >
                      {viewMode === 'grid' ? (
                        <>
                          <div className="aspect-square bg-black/40 flex items-center justify-center relative overflow-hidden">
                            {prefab.thumbnail ? (
                              <img src={prefab.thumbnail} alt={prefab.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <Box className="w-6 h-6 text-white/10" />
                            )}
                            <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/10 transition-colors flex items-center justify-center">
                              <Plus className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                          <div className="p-2 space-y-0.5">
                            <div className="font-bold truncate text-white/80 group-hover:text-white">{prefab.name}</div>
                            <div className="text-[8px] text-white/30 uppercase tracking-tighter">
                              {prefab.models.length} {prefab.models.length === 1 ? 'Object' : 'Objects'}
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-8 h-8 bg-black/40 rounded flex items-center justify-center flex-shrink-0">
                            <Box className="w-4 h-4 text-white/20" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold truncate text-white/80 group-hover:text-white">{prefab.name}</div>
                            <div className="text-[8px] text-white/30 uppercase tracking-tighter">
                              {prefab.models.length} {prefab.models.length === 1 ? 'Object' : 'Objects'}
                            </div>
                          </div>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeletePrefab(prefab.id);
                            }}
                            className="p-1.5 text-white/10 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {filteredPrefabs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-white/20 space-y-2">
            <Box className="w-8 h-8 opacity-20" />
            <div className="uppercase tracking-widest text-[9px]">No prefabs found</div>
          </div>
        )}
      </div>
    </div>
  );
}

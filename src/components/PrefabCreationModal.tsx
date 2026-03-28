import React, { useState } from 'react';
import { X, Check, Box, Tag, LayoutGrid, Info, ChevronRight, ChevronLeft } from 'lucide-react';
import { PREFAB_CATEGORIES, PrefabCategory } from '../types/prefabs';

interface PrefabCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string, category: PrefabCategory, tags: string[]) => void;
  selectionCount: number;
}

export default function PrefabCreationModal({
  isOpen,
  onClose,
  onConfirm,
  selectionCount
}: PrefabCreationModalProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<PrefabCategory>('Custom');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  if (!isOpen) return null;

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onConfirm(name.trim(), category, tags);
      onClose();
      // Reset state after closing
      setTimeout(() => {
        setStep(1);
        setName('');
        setCategory('Custom');
        setTags([]);
        setTagInput('');
      }, 300);
    }
  };

  const nextStep = () => setStep(s => Math.min(s + 1, 3));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#151619] border border-white/10 rounded-xl shadow-2xl overflow-hidden font-mono text-[11px]">
        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/2">
          <div className="flex items-center gap-2">
            <Box className="w-4 h-4 text-blue-400" />
            <span className="uppercase tracking-widest font-bold text-white/80">Create New Prefab</span>
          </div>
          <button onClick={onClose} className="p-1 text-white/20 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center px-6 pt-6">
          {[1, 2, 3].map((i) => (
            <React.Fragment key={i}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                step >= i ? 'bg-blue-500 text-white' : 'bg-white/5 text-white/40 border border-white/10'
              }`}>
                {i}
              </div>
              {i < 3 && (
                <div className={`flex-1 h-px mx-2 transition-colors ${
                  step > i ? 'bg-blue-500' : 'bg-white/10'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase tracking-widest text-white/40 font-bold flex items-center gap-2">
                  <Box className="w-3 h-3" />
                  Prefab Name
                </label>
                <input 
                  autoFocus
                  type="text"
                  placeholder="e.g., Poolside Seating Set"
                  className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 px-3 text-white outline-none focus:border-blue-500/50 transition-colors"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
                <p className="text-[9px] text-white/40 mt-2">
                  Give your prefab a clear, descriptive name to find it easily later.
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase tracking-widest text-white/40 font-bold flex items-center gap-2">
                  <LayoutGrid className="w-3 h-3" />
                  Category
                </label>
                <select 
                  className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 px-3 text-white outline-none focus:border-blue-500/50 transition-colors appearance-none"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as PrefabCategory)}
                >
                  {PREFAB_CATEGORIES.map(cat => (
                    <option key={cat} value={cat} className="bg-[#151619]">{cat}</option>
                  ))}
                </select>
                <p className="text-[9px] text-white/40 mt-2">
                  Group similar prefabs together for better organization in your library.
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase tracking-widest text-white/40 font-bold flex items-center gap-2">
                  <Tag className="w-3 h-3" />
                  Tags (Optional)
                </label>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    placeholder="Add a tag..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg py-2.5 px-3 text-white outline-none focus:border-blue-500/50 transition-colors"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                  />
                  <button 
                    type="button"
                    onClick={handleAddTag}
                    className="px-4 bg-white/5 border border-white/10 rounded-lg text-white/60 hover:bg-white/10 transition-colors uppercase text-[9px] font-bold"
                  >
                    Add
                  </button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {tags.map(tag => (
                      <span key={tag} className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded text-blue-400 text-[9px] uppercase font-bold group">
                        {tag}
                        <button type="button" onClick={() => handleRemoveTag(tag)} className="hover:text-white">
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-4 flex gap-3 mt-4">
                <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <div className="text-[10px] text-blue-400/80 leading-relaxed">
                  Creating <span className="font-bold text-blue-400">{name}</span> from <span className="font-bold text-blue-400">{selectionCount} selected {selectionCount === 1 ? 'object' : 'objects'}</span>. 
                  This will preserve all materials, textures, and relative transforms.
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-white/5">
            {step > 1 ? (
              <button 
                type="button"
                onClick={prevStep}
                className="flex-1 py-3 border border-white/10 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-all uppercase tracking-widest font-bold flex items-center justify-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            ) : (
              <button 
                type="button"
                onClick={onClose}
                className="flex-1 py-3 border border-white/10 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-all uppercase tracking-widest font-bold"
              >
                Cancel
              </button>
            )}

            {step < 3 ? (
              <button 
                type="button"
                onClick={nextStep}
                disabled={step === 1 && !name.trim()}
                className="flex-1 py-3 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white transition-all uppercase tracking-widest font-bold flex items-center justify-center gap-2"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button 
                type="submit"
                disabled={!name.trim()}
                className="flex-1 py-3 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white transition-all uppercase tracking-widest font-bold shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Create Prefab
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

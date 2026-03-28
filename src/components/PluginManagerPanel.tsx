import React, { useState, useEffect } from 'react';
import { pluginManager } from '../services/PluginManager';
import { Plugin, PluginState } from '../types/plugin';
import { Settings, AlertTriangle, CheckCircle, Info, Shield, Box, X } from 'lucide-react';

const PluginManagerPanel: React.FC = () => {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [states, setStates] = useState<Record<string, PluginState>>({});
  const [errors, setErrors] = useState<Record<string, Error>>({});
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);

  const refresh = () => {
    const allPlugins = pluginManager.getPlugins();
    setPlugins(allPlugins);
    
    const newStates: Record<string, PluginState> = {};
    const newErrors: Record<string, Error> = {};
    
    allPlugins.forEach(p => {
      newStates[p.metadata.id] = pluginManager.getPluginState(p.metadata.id) || 'registered';
      const err = pluginManager.getPluginError(p.metadata.id);
      if (err) newErrors[p.metadata.id] = err;
    });
    
    setStates(newStates);
    setErrors(newErrors);
  };

  useEffect(() => {
    refresh();
    // In a real app, subscribe to plugin manager events
    const interval = setInterval(refresh, 1000);
    return () => clearInterval(interval);
  }, []);

  const togglePlugin = async (id: string) => {
    const state = states[id];
    if (state === 'active') {
      await pluginManager.deactivate(id);
    } else {
      await pluginManager.activate(id);
    }
    refresh();
  };

  return (
    <div className="flex flex-col h-full bg-[#151619] text-white font-mono text-[11px]">
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Box className="w-4 h-4 text-blue-400" />
          <h2 className="font-bold uppercase tracking-widest text-white/80">Plugin Manager</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {plugins.map(plugin => {
          const state = states[plugin.metadata.id];
          const error = errors[plugin.metadata.id];
          const isActive = state === 'active';
          
          return (
            <div 
              key={plugin.metadata.id} 
              className={`border rounded-lg p-3 transition-colors cursor-pointer ${
                selectedPlugin?.metadata.id === plugin.metadata.id 
                  ? 'bg-blue-500/10 border-blue-500/30' 
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
              onClick={() => setSelectedPlugin(plugin)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white/90">{plugin.metadata.name}</span>
                  <span className="text-[9px] text-white/40 px-1.5 py-0.5 bg-white/5 rounded">v{plugin.metadata.version}</span>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePlugin(plugin.metadata.id);
                  }}
                  className={`px-3 py-1 rounded text-[10px] uppercase font-bold transition-colors ${
                    isActive 
                      ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' 
                      : 'bg-white/10 text-white/60 hover:bg-white/20'
                  }`}
                >
                  {isActive ? 'Disable' : 'Enable'}
                </button>
              </div>
              
              <div className="text-white/50 line-clamp-1 mb-2">
                {plugin.metadata.description}
              </div>

              <div className="flex items-center gap-2 text-[10px]">
                {state === 'error' ? (
                  <span className="flex items-center gap-1 text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded">
                    <AlertTriangle className="w-3 h-3" /> Error
                  </span>
                ) : isActive ? (
                  <span className="flex items-center gap-1 text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded">
                    <CheckCircle className="w-3 h-3" /> Active
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-white/40 bg-white/5 px-1.5 py-0.5 rounded">
                    <Info className="w-3 h-3" /> {state}
                  </span>
                )}
                
                <span className="text-white/30">by {plugin.metadata.author}</span>
              </div>
            </div>
          );
        })}
        {plugins.length === 0 && (
          <div className="text-center text-white/40 py-8">
            No plugins installed.
          </div>
        )}
      </div>

      {/* Plugin Details Panel */}
      {selectedPlugin && (
        <div className="h-1/3 border-t border-white/10 bg-[#1a1b1e] p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-white/90">{selectedPlugin.metadata.name} Details</h3>
            <button onClick={() => setSelectedPlugin(null)} className="text-white/40 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <div className="text-[9px] uppercase tracking-widest text-white/40 mb-1">Description</div>
              <div className="text-white/70">{selectedPlugin.metadata.description}</div>
            </div>

            <div>
              <div className="text-[9px] uppercase tracking-widest text-white/40 mb-1 flex items-center gap-1">
                <Shield className="w-3 h-3" /> Permissions Required
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedPlugin.metadata.permissions.map(p => (
                  <span key={p} className="px-2 py-1 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded text-[9px]">
                    {p}
                  </span>
                ))}
                {selectedPlugin.metadata.permissions.length === 0 && (
                  <span className="text-white/40 italic">None</span>
                )}
              </div>
            </div>

            {selectedPlugin.metadata.dependencies && selectedPlugin.metadata.dependencies.length > 0 && (
              <div>
                <div className="text-[9px] uppercase tracking-widest text-white/40 mb-1">Dependencies</div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedPlugin.metadata.dependencies.map(d => (
                    <span key={d} className="px-2 py-1 bg-white/5 text-white/60 border border-white/10 rounded text-[9px]">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {errors[selectedPlugin.metadata.id] && (
              <div className="bg-red-500/10 border border-red-500/20 rounded p-2 text-red-400">
                <div className="font-bold mb-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Error Details
                </div>
                <div className="font-mono text-[9px] whitespace-pre-wrap">
                  {errors[selectedPlugin.metadata.id].message}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PluginManagerPanel;

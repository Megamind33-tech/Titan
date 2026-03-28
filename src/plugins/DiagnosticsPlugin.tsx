import React from 'react';
import { Plugin, PluginContext } from '../types/plugin';
import { Activity } from 'lucide-react';

const DiagnosticsPanel: React.FC<{ api: any }> = ({ api }) => {
  const [sceneData, setSceneData] = React.useState<any>(null);

  React.useEffect(() => {
    // Initial fetch
    try {
      setSceneData(api.scene.get());
    } catch (e) {
      console.error("Failed to get scene data", e);
    }

    // Subscribe to changes
    const unsubscribe = api.scene.subscribe((state: any) => {
      setSceneData(state);
    });

    return () => unsubscribe();
  }, [api]);

  if (!sceneData) return <div className="p-4 text-white/50">Loading diagnostics...</div>;

  return (
    <div className="p-4 bg-[#151619] text-white font-mono text-[11px]">
      <h3 className="font-bold uppercase tracking-widest text-white/80 mb-4 flex items-center gap-2">
        <Activity className="w-4 h-4 text-green-400" />
        Scene Diagnostics
      </h3>
      
      <div className="space-y-2">
        <div className="flex justify-between bg-white/5 p-2 rounded">
          <span className="text-white/50">Models</span>
          <span className="font-bold">{sceneData.models?.length || 0}</span>
        </div>
        <div className="flex justify-between bg-white/5 p-2 rounded">
          <span className="text-white/50">Layers</span>
          <span className="font-bold">{sceneData.layers?.length || 0}</span>
        </div>
        <div className="flex justify-between bg-white/5 p-2 rounded">
          <span className="text-white/50">Paths</span>
          <span className="font-bold">{sceneData.paths?.length || 0}</span>
        </div>
      </div>
    </div>
  );
};

export const DiagnosticsPlugin: Plugin = {
  metadata: {
    id: 'core.diagnostics',
    name: 'Scene Diagnostics',
    version: '1.0.0',
    author: 'System',
    description: 'Provides basic scene health and statistics.',
    type: ['diagnostics', 'ui'],
    permissions: ['read:scene', 'ui:panels'],
  },
  initialize: async (context: PluginContext) => {
    console.log('Diagnostics plugin initialized');
  },
  activate: async (context: PluginContext) => {
    context.api.ui.registerExtension({
      id: 'diagnostics-panel',
      type: 'panel',
      render: () => <DiagnosticsPanel api={context.api} />,
      label: 'Diagnostics',
      icon: 'Activity'
    });
  },
  deactivate: async (context: PluginContext) => {
    context.api.ui.unregisterExtension('diagnostics-panel');
  }
};

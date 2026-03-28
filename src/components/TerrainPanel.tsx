import React from 'react';
import { TerrainData } from '../types/terrain';

interface TerrainPanelProps {
  terrain: TerrainData;
  onUpdateTerrain: (updates: Partial<TerrainData>) => void;
}

const TerrainPanel: React.FC<TerrainPanelProps> = ({ terrain, onUpdateTerrain }) => {
  return (
    <div className="p-4 text-white">
      <h2 className="text-lg font-bold mb-4">Terrain Editing</h2>
      <div className="space-y-4">
        <button className="w-full bg-blue-600 p-2 rounded">Raise Terrain</button>
        <button className="w-full bg-blue-600 p-2 rounded">Lower Terrain</button>
        <button className="w-full bg-blue-600 p-2 rounded">Flatten Terrain</button>
        <div className="mt-4">
          <label className="block text-sm">Brush Size</label>
          <input type="range" className="w-full" />
        </div>
      </div>
    </div>
  );
};

export default TerrainPanel;

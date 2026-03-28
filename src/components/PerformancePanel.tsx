import React, { useMemo } from 'react';
import { ModelData } from '../App';
import { calculateSceneMetrics } from '../utils/performanceUtils';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface PerformancePanelProps {
  models: ModelData[];
}

const PerformancePanel: React.FC<PerformancePanelProps> = ({ models }) => {
  const metrics = useMemo(() => calculateSceneMetrics(models), [models]);

  const StatusIcon = {
    healthy: <CheckCircle className="w-4 h-4 text-green-500" />,
    warning: <AlertTriangle className="w-4 h-4 text-yellow-500" />,
    critical: <XCircle className="w-4 h-4 text-red-500" />
  }[metrics.status];

  return (
    <div className="p-4 bg-[#151619] text-white border-t border-white/10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold uppercase tracking-widest">Performance</h2>
        {StatusIcon}
      </div>
      <div className="space-y-2 text-xs font-mono text-white/70">
        <p>Objects: {metrics.totalObjectCount}</p>
        <p>Triangles: {metrics.totalTriangleCount.toLocaleString()}</p>
        <p>Draw Calls: {metrics.estimatedDrawCalls}</p>
      </div>
      {metrics.suggestions.length > 0 && (
        <div className="mt-4 space-y-1">
          <p className="text-xs font-bold text-white/50">Suggestions:</p>
          {metrics.suggestions.map((s, i) => (
            <p key={i} className="text-xs text-yellow-400">• {s}</p>
          ))}
        </div>
      )}
    </div>
  );
};

export default PerformancePanel;

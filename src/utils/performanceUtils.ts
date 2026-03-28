import { ModelData } from '../App';
import { AssetMetrics, SceneMetrics, HealthStatus } from '../types/performance';

export const calculateAssetMetrics = (model: ModelData): AssetMetrics => {
  // Mock calculations based on model data
  const polygonCount = model.scale[0] * 1000; // Placeholder
  const materialCount = 1; // Placeholder
  const textureCount = model.textureUrl ? 1 : 0;
  const estimatedMemoryMB = (polygonCount * 0.001) + (textureCount * 2);
  const drawCallImpact = 1;

  const warnings: string[] = [];
  if (polygonCount > 5000) warnings.push('High polygon count');
  if (textureCount > 2) warnings.push('Too many textures');

  const status: HealthStatus = warnings.length > 1 ? 'critical' : (warnings.length > 0 ? 'warning' : 'healthy');

  return {
    polygonCount,
    materialCount,
    textureCount,
    estimatedMemoryMB,
    drawCallImpact,
    status,
    warnings
  };
};

export const calculateSceneMetrics = (models: ModelData[]): SceneMetrics => {
  const totalObjectCount = models.length;
  const totalTriangleCount = models.reduce((acc, m) => acc + (m.scale[0] * 1000), 0);
  const estimatedDrawCalls = totalObjectCount * 2;
  const activeLights = 3; // Placeholder

  const suggestions: string[] = [];
  if (totalTriangleCount > 100000) suggestions.push('Reduce total triangle count');
  if (estimatedDrawCalls > 100) suggestions.push('Use instancing for repeated objects');

  const status: HealthStatus = totalTriangleCount > 100000 ? 'critical' : (totalTriangleCount > 50000 ? 'warning' : 'healthy');

  return {
    totalObjectCount,
    totalTriangleCount,
    estimatedDrawCalls,
    activeLights,
    status,
    suggestions
  };
};

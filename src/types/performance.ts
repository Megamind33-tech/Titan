export type HealthStatus = 'healthy' | 'warning' | 'critical';

export interface AssetMetrics {
  polygonCount: number;
  materialCount: number;
  textureCount: number;
  estimatedMemoryMB: number;
  drawCallImpact: number;
  status: HealthStatus;
  warnings: string[];
}

export interface SceneMetrics {
  totalObjectCount: number;
  totalTriangleCount: number;
  estimatedDrawCalls: number;
  activeLights: number;
  status: HealthStatus;
  suggestions: string[];
}

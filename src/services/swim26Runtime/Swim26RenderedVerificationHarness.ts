import { Swim26RuntimeAssemblyResult } from './Swim26RuntimeSceneAssembler';

export interface Swim26RenderedVerificationReport {
  pass: boolean;
  reasons: string[];
  snapshot: {
    meshCount: number;
    meshNames: string[];
    positions: Array<{ id: string; x: number; y: number; z: number }>;
    clearColor?: string;
    environmentPresetId?: string;
  };
}

export const verifyRenderedSwim26Scene = (
  assembled: Swim26RuntimeAssemblyResult
): Swim26RenderedVerificationReport => {
  const reasons: string[] = [];
  if (!assembled.ok) reasons.push('Assembly was not successful enough to render.');
  if (assembled.scene.meshes.length === 0) reasons.push('No visible meshes were assembled.');
  if (!assembled.scene.clearColor) reasons.push('Environment clear color is missing.');

  const snapshot = {
    meshCount: assembled.scene.meshes.length,
    meshNames: assembled.scene.meshes.map(mesh => mesh.name),
    positions: assembled.scene.meshes.map(mesh => ({
      id: mesh.id,
      x: mesh.position.x,
      y: mesh.position.y,
      z: mesh.position.z,
    })),
    clearColor: assembled.scene.clearColor,
    environmentPresetId: assembled.scene.environmentPresetId,
  };

  return {
    pass: reasons.length === 0,
    reasons,
    snapshot,
  };
};

export const renderRuntimeVerificationSvg = (
  report: Swim26RenderedVerificationReport
): string => {
  const width = 360;
  const height = 220;
  const circles = report.snapshot.positions.map((point, idx) => {
    const x = 30 + (point.x * 20) + (idx * 30);
    const y = height - (30 + point.z * 20);
    return `<circle cx="${x}" cy="${y}" r="8" fill="#4DA3FF" /><text x="${x + 10}" y="${y - 10}" font-size="10" fill="#D5E7FF">${point.id}</text>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect x="0" y="0" width="${width}" height="${height}" fill="#0B132B"/>
  <text x="12" y="18" font-size="12" fill="#D5E7FF">SWIM26 Runtime Verification</text>
  <text x="12" y="34" font-size="10" fill="#9FB3C8">Meshes: ${report.snapshot.meshCount} | Env: ${report.snapshot.environmentPresetId ?? 'none'}</text>
  ${circles}
</svg>`;
};

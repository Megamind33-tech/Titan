import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('support matrix includes required capability rows and status categories', () => {
  const matrixPath = path.join(process.cwd(), 'SWIM26_SUPPORT_MATRIX.md');
  const content = fs.readFileSync(matrixPath, 'utf-8');

  [
    'GLB',
    'GLTF',
    'OBJ',
    'Opacity',
    'Roughness',
    'Metalness',
    'Emissive',
    'Path visualization',
    'Gameplay/runtime systems',
    'Adapter/profile/session use in handoff',
  ].forEach(required => {
    assert.ok(content.includes(required), `Missing support matrix row: ${required}`);
  });

  ['Supported', 'Supported with approximation', 'Unsupported', 'Runtime-owned'].forEach(status => {
    assert.ok(content.includes(status), `Missing status category: ${status}`);
  });
});

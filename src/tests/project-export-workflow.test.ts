import test from 'node:test';
import assert from 'node:assert/strict';
import { activateProjectForEditor } from '../services/ProjectLoadService';
import { getProjectAwareExportConfig } from '../services/ProjectExportWorkflow';

test('generic project export config keeps generic formats and recommendations', () => {
  const activation = activateProjectForEditor({ profileHint: 'titan-scene' });
  const config = getProjectAwareExportConfig(activation);

  assert.deepEqual(config.allowedFormats.sort(), ['glb', 'obj', 'original'].sort());
  assert.equal(config.recommendedFormat, 'original');
  assert.equal(config.contextNote, undefined);
});

test('SWIM26 project export config hides unsupported options and shows bridge note', () => {
  const activation = activateProjectForEditor({ profileHint: 'swim26-babylon' });
  const config = getProjectAwareExportConfig(activation);

  assert.deepEqual(config.allowedFormats.sort(), ['glb', 'original', 'swim26-manifest'].sort());
  assert.equal(config.recommendedFormat, 'swim26-manifest');
  assert.match(config.contextNote ?? '', /runtime handoff/i);
});

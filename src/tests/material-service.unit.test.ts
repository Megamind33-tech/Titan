import test from 'node:test';
import assert from 'node:assert/strict';
import { MaterialService } from '../services/MaterialService';
import { MaterialPreset } from '../types/materials';
import { ModelData } from '../App';

const preset: MaterialPreset = {
  id: 'mat-concrete',
  name: 'Concrete',
  category: 'Concrete',
  color: '#9ca3af',
  opacity: 0.9,
  transparent: true,
  roughness: 0.8,
  metalness: 0.1,
  emissiveColor: '#000000',
  emissiveIntensity: 0,
  tiling: [1, 1],
  offset: [0, 0],
  rotation: 0,
  wireframe: false,
  side: 'front',
};

const baseModel: ModelData = {
  id: 'm1',
  name: 'Floor',
  url: '/floor.glb',
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  behaviorTags: ['keep-me', 'material:old'],
};

test('MaterialService.applyMaterial applies full preset fields and updates material tag', () => {
  const updated = MaterialService.applyMaterial(baseModel, preset);

  assert.equal(updated.material?.id, preset.id);
  assert.equal(updated.colorTint, preset.color);
  assert.equal(updated.opacity, preset.opacity);
  assert.equal(updated.roughness, preset.roughness);
  assert.equal(updated.metalness, preset.metalness);
  assert.equal(updated.emissiveColor, preset.emissiveColor);
  assert.equal(updated.wireframe, preset.wireframe);

  assert.deepEqual(updated.behaviorTags, ['keep-me', `material:${preset.id}`]);
  assert.equal(baseModel.material, undefined);
  assert.deepEqual(baseModel.behaviorTags, ['keep-me', 'material:old']);
});

test('MaterialService.validateMaterial accepts valid preset and rejects invalid values/required fields', () => {
  assert.equal(MaterialService.validateMaterial(preset), null);
  assert.match(MaterialService.validateMaterial({ ...preset, roughness: 2 }) ?? '', /Roughness/);
  assert.match(MaterialService.validateMaterial({ ...preset, metalness: -1 }) ?? '', /Metalness/);
  assert.match(MaterialService.validateMaterial({ ...preset, opacity: 2 }) ?? '', /Opacity/);
  assert.match(MaterialService.validateMaterial({ ...preset, id: '' }) ?? '', /ID/);
  assert.match(MaterialService.validateMaterial({ ...preset, name: '' }) ?? '', /name/i);
});

test('MaterialService helper accessors track and clean material tags correctly', () => {
  const applied = MaterialService.applyMaterial(baseModel, preset);
  assert.equal(MaterialService.getMaterial(applied)?.id, preset.id);
  assert.equal(MaterialService.getMaterialIdFromTags(applied), preset.id);
  assert.equal(MaterialService.hasMaterial(applied, preset.id), true);

  const removed = MaterialService.removeMaterial(applied);
  assert.equal(removed.material, undefined);
  assert.equal(MaterialService.getMaterialIdFromTags(removed), null);
  assert.equal((removed.behaviorTags || []).some(tag => tag.startsWith('material:')), false);
});

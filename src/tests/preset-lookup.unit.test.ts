import test from 'node:test';
import assert from 'node:assert/strict';
import { findEnvironmentPreset, findMaterialPreset } from '../services/PresetLookupService';
import { MaterialPreset } from '../types/materials';
import { DEFAULT_ENVIRONMENT, POOL_COMPETITION } from '../types/environment';

const materials: MaterialPreset[] = [
  {
    id: 'mat-wood',
    name: 'Warm Wood',
    category: 'Wood',
    color: '#8b5a2b',
    opacity: 1,
    transparent: false,
    roughness: 0.6,
    metalness: 0,
    emissiveColor: '#000000',
    emissiveIntensity: 0,
    tiling: [1, 1],
    offset: [0, 0],
    rotation: 0,
    wireframe: false,
    side: 'front',
  },
];

test('material preset lookup resolves by id/exact name/partial and returns null when missing', () => {
  assert.equal(findMaterialPreset(materials, { id: 'mat-wood' })?.id, 'mat-wood');
  assert.equal(findMaterialPreset(materials, { name: ' warm wood ' })?.id, 'mat-wood');
  assert.equal(findMaterialPreset(materials, { name: 'warm' })?.id, 'mat-wood');
  assert.equal(findMaterialPreset(materials, { name: 'steel' }), null);
});

test('environment preset lookup resolves by id/exact name/partial and returns null when missing', () => {
  const environments = [DEFAULT_ENVIRONMENT, POOL_COMPETITION];
  assert.equal(findEnvironmentPreset(environments, { id: POOL_COMPETITION.id })?.id, POOL_COMPETITION.id);
  assert.equal(findEnvironmentPreset(environments, { name: POOL_COMPETITION.name.toUpperCase() })?.id, POOL_COMPETITION.id);
  assert.equal(findEnvironmentPreset(environments, { name: 'competition' })?.id, POOL_COMPETITION.id);
  assert.equal(findEnvironmentPreset(environments, { name: 'moonlight' }), null);
});

test('preset lookup prioritizes id over mismatched name when both are provided', () => {
  const environments = [DEFAULT_ENVIRONMENT, POOL_COMPETITION];
  const resolved = findEnvironmentPreset(environments, {
    id: DEFAULT_ENVIRONMENT.id,
    name: POOL_COMPETITION.name,
  });
  assert.equal(resolved?.id, DEFAULT_ENVIRONMENT.id);
});

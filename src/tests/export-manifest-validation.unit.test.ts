import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateTransform,
  validateMaterialProperties,
  validateMaterialMaps,
  validateMaterialUVTransform,
  validatePrefabExport,
  validatePathExport,
  validateCollisionZoneExport,
  validateTerrainExport,
  validateCameraPresetExport,
  validateCameraPathExport,
  validateQualitySettingsExport,
  validateExportAsset,
  validateLighting,
  validateExportManifest,
  preflightValidation,
  StrictTransform,
  StrictMaterialProperties,
  StrictExportAssetManifest,
  StrictLighting,
  StrictSceneExportManifest,
} from '../services/ExportManifestValidation';

// ─── Transform Validation ──────────────────────────────────────────────────

test('validateTransform accepts valid transforms', () => {
  const valid: StrictTransform = {
    position: [1, 2, 3],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };
  const result = validateTransform(valid, 'test');
  assert.deepEqual(result, valid);
});

test('validateTransform rejects invalid position', () => {
  assert.throws(
    () => validateTransform({
      position: [NaN, 2, 3],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    }, 'test'),
    /position.*finite/
  );
});

test('validateTransform rejects non-array vectors', () => {
  assert.throws(
    () => validateTransform({
      position: { x: 1, y: 2, z: 3 },
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    }, 'test'),
    /position.*array of 3/
  );
});

test('validateTransform rejects wrong vector length', () => {
  assert.throws(
    () => validateTransform({
      position: [1, 2],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    }, 'test'),
    /position.*array of 3/
  );
});

test('validateTransform rejects negative or zero scale', () => {
  assert.throws(
    () => validateTransform({
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [0, 1, 1],
    }, 'test'),
    /scale\[0\].*positive/
  );

  assert.throws(
    () => validateTransform({
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [-1, 1, 1],
    }, 'test'),
    /scale\[0\].*positive/
  );
});

test('validateTransform rejects Infinity values', () => {
  assert.throws(
    () => validateTransform({
      position: [Infinity, 2, 3],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    }, 'test'),
    /position.*finite/
  );
});

// ─── Material Validation ───────────────────────────────────────────────────

test('validateMaterialProperties accepts valid materials', () => {
  const valid: StrictMaterialProperties = {
    wireframe: false,
    lightIntensity: 1.5,
    castShadow: true,
    receiveShadow: true,
    color: '#ffffff',
    opacity: 1.0,
    roughness: 0.5,
    metalness: 0.0,
    emissiveColor: '#000000',
  };
  const result = validateMaterialProperties(valid, 'test');
  assert.deepEqual(result.wireframe, valid.wireframe);
  assert.deepEqual(result.color, valid.color);
});

test('validateMaterialProperties rejects out-of-range opacity', () => {
  assert.throws(
    () => validateMaterialProperties({
      wireframe: false,
      lightIntensity: 1,
      castShadow: true,
      receiveShadow: true,
      color: '#ffffff',
      opacity: 1.5,  // > 1
      roughness: 0.5,
      metalness: 0.0,
      emissiveColor: '#000000',
    }, 'test'),
    /opacity.*<= 1/
  );

  assert.throws(
    () => validateMaterialProperties({
      wireframe: false,
      lightIntensity: 1,
      castShadow: true,
      receiveShadow: true,
      color: '#ffffff',
      opacity: -0.5,  // < 0
      roughness: 0.5,
      metalness: 0.0,
      emissiveColor: '#000000',
    }, 'test'),
    /opacity.*>= 0/
  );
});

test('validateMaterialProperties rejects out-of-range roughness/metalness', () => {
  assert.throws(
    () => validateMaterialProperties({
      wireframe: false,
      lightIntensity: 1,
      castShadow: true,
      receiveShadow: true,
      color: '#ffffff',
      opacity: 1.0,
      roughness: 2.0,  // > 1
      metalness: 0.0,
      emissiveColor: '#000000',
    }, 'test'),
    /roughness.*<= 1/
  );
});

test('validateMaterialProperties rejects invalid hex colors', () => {
  assert.throws(
    () => validateMaterialProperties({
      wireframe: false,
      lightIntensity: 1,
      castShadow: true,
      receiveShadow: true,
      color: 'not-a-hex',
      opacity: 1.0,
      roughness: 0.5,
      metalness: 0.0,
      emissiveColor: '#000000',
    }, 'test'),
    /color.*valid hex/
  );

  assert.throws(
    () => validateMaterialProperties({
      wireframe: false,
      lightIntensity: 1,
      castShadow: true,
      receiveShadow: true,
      color: '#ffffff',
      opacity: 1.0,
      roughness: 0.5,
      metalness: 0.0,
      emissiveColor: '#fff',  // too short
    }, 'test'),
    /emissiveColor.*valid hex/
  );
});

test('validateMaterialProperties rejects non-boolean flags', () => {
  assert.throws(
    () => validateMaterialProperties({
      wireframe: 'yes',  // should be boolean
      lightIntensity: 1,
      castShadow: true,
      receiveShadow: true,
      color: '#ffffff',
      opacity: 1.0,
      roughness: 0.5,
      metalness: 0.0,
      emissiveColor: '#000000',
    }, 'test'),
    /wireframe.*boolean/
  );
});

test('validateMaterialProperties accepts optional preset fields', () => {
  const result = validateMaterialProperties({
    wireframe: false,
    lightIntensity: 1,
    castShadow: true,
    receiveShadow: true,
    color: '#ffffff',
    opacity: 1.0,
    roughness: 0.5,
    metalness: 0.0,
    emissiveColor: '#000000',
    presetId: 'some-preset',
    presetName: 'Some Preset',
  }, 'test');
  assert.equal(result.presetId, 'some-preset');
});

test('validateMaterialProperties rejects invalid lightIntensity', () => {
  assert.throws(
    () => validateMaterialProperties({
      wireframe: false,
      lightIntensity: -1,  // < 0
      castShadow: true,
      receiveShadow: true,
      color: '#ffffff',
      opacity: 1.0,
      roughness: 0.5,
      metalness: 0.0,
      emissiveColor: '#000000',
    }, 'test'),
    /lightIntensity.*>= 0/
  );
});

// ─── Asset Validation ──────────────────────────────────────────────────────

test('validateExportAsset accepts valid asset', () => {
  const valid: StrictExportAssetManifest = {
    id: 'asset-1',
    name: 'Test Asset',
    type: 'model',
    visible: true,
    locked: false,
    transform: {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    material: {
      wireframe: false,
      lightIntensity: 1,
      castShadow: true,
      receiveShadow: true,
      color: '#ffffff',
      opacity: 1.0,
      roughness: 0.5,
      metalness: 0.0,
      emissiveColor: '#000000',
    },
    version: 1,
  };
  const result = validateExportAsset(valid, 'test');
  assert.equal(result.id, valid.id);
  assert.equal(result.name, valid.name);
});

test('validateExportAsset rejects invalid ID', () => {
  assert.throws(
    () => validateExportAsset({
      id: '',  // empty
      name: 'Test',
      type: 'model',
      visible: true,
      locked: false,
      transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      material: {
        wireframe: false,
        lightIntensity: 1,
        castShadow: true,
        receiveShadow: true,
        color: '#ffffff',
        opacity: 1.0,
        roughness: 0.5,
        metalness: 0.0,
        emissiveColor: '#000000',
      },
      version: 1,
    }, 'test'),
    /id.*non-empty/
  );
});

test('validateExportAsset rejects invalid type enum', () => {
  assert.throws(
    () => validateExportAsset({
      id: 'asset-1',
      name: 'Test',
      type: 'invalid-type',
      visible: true,
      locked: false,
      transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      material: {
        wireframe: false,
        lightIntensity: 1,
        castShadow: true,
        receiveShadow: true,
        color: '#ffffff',
        opacity: 1.0,
        roughness: 0.5,
        metalness: 0.0,
        emissiveColor: '#000000',
      },
      version: 1,
    }, 'test'),
    /type.*model\|environment\|light\|camera/
  );
});

test('validateExportAsset rejects non-JSON-serializable metadata', () => {
  const circular: any = { a: 1 };
  circular.self = circular;

  assert.throws(
    () => validateExportAsset({
      id: 'asset-1',
      name: 'Test',
      type: 'model',
      visible: true,
      locked: false,
      transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      material: {
        wireframe: false,
        lightIntensity: 1,
        castShadow: true,
        receiveShadow: true,
        color: '#ffffff',
        opacity: 1.0,
        roughness: 0.5,
        metalness: 0.0,
        emissiveColor: '#000000',
      },
      metadata: circular,
      version: 1,
    }, 'test'),
    /metadata.*JSON-serializable/
  );
});

test('validateExportAsset accepts valid version numbers', () => {
  const asset: any = {
    id: 'asset-1',
    name: 'Test',
    type: 'model',
    visible: true,
    locked: false,
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    material: {
      wireframe: false,
      lightIntensity: 1,
      castShadow: true,
      receiveShadow: true,
      color: '#ffffff',
      opacity: 1.0,
      roughness: 0.5,
      metalness: 0.0,
      emissiveColor: '#000000',
    },
    version: 100,
  };
  const result = validateExportAsset(asset, 'test');
  assert.equal(result.version, 100);
});

// ─── Lighting Validation ───────────────────────────────────────────────────

test('validateLighting accepts valid lighting', () => {
  const valid: StrictLighting = {
    ambient: 0.3,
    hemisphere: {
      intensity: 0.6,
      color: '#ffffff',
      groundColor: '#2a2b2e',
    },
    directional: {
      intensity: 1.5,
      position: [50, 50, 25],
    },
    shadowSoftness: 1,
    exposure: 1.0,
    toneMapping: 'ACESFilmic',
  };
  const result = validateLighting(valid, 'test');
  assert.equal(result.exposure, valid.exposure);
});

test('validateLighting rejects invalid tone mapping', () => {
  assert.throws(
    () => validateLighting({
      ambient: 0.3,
      hemisphere: {
        intensity: 0.6,
        color: '#ffffff',
        groundColor: '#2a2b2e',
      },
      directional: {
        intensity: 1.5,
        position: [50, 50, 25],
      },
      shadowSoftness: 1,
      exposure: 1.0,
      toneMapping: 'InvalidMapping',
    }, 'test'),
    /toneMapping.*None\|Linear\|Reinhard\|Cineon\|ACESFilmic/
  );
});

test('validateLighting rejects invalid exposure', () => {
  assert.throws(
    () => validateLighting({
      ambient: 0.3,
      hemisphere: {
        intensity: 0.6,
        color: '#ffffff',
        groundColor: '#2a2b2e',
      },
      directional: {
        intensity: 1.5,
        position: [50, 50, 25],
      },
      shadowSoftness: 1,
      exposure: 0,  // must be > 0
      toneMapping: 'ACESFilmic',
    }, 'test'),
    /exposure.*>=/
  );
});

test('validateLighting rejects invalid hemisphere colors', () => {
  assert.throws(
    () => validateLighting({
      ambient: 0.3,
      hemisphere: {
        intensity: 0.6,
        color: 'not-hex',
        groundColor: '#2a2b2e',
      },
      directional: {
        intensity: 1.5,
        position: [50, 50, 25],
      },
      shadowSoftness: 1,
      exposure: 1.0,
      toneMapping: 'ACESFilmic',
    }, 'test'),
    /hemisphere.color.*valid hex/
  );
});

// ─── Full Manifest Validation ──────────────────────────────────────────────

test('validateExportManifest accepts valid manifest', () => {
  const manifest: StrictSceneExportManifest = {
    version: '2.0.0',
    exportDate: new Date().toISOString(),
    scene: {
      lighting: {
        ambient: 0.3,
        hemisphere: {
          intensity: 0.6,
          color: '#ffffff',
          groundColor: '#2a2b2e',
        },
        directional: {
          intensity: 1.5,
          position: [50, 50, 25],
        },
        shadowSoftness: 1,
        exposure: 1.0,
        toneMapping: 'ACESFilmic',
      },
      gridReceiveShadow: true,
    },
    assets: [
      {
        id: 'asset-1',
        name: 'Model 1',
        type: 'model',
        visible: true,
        locked: false,
        transform: {
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        },
        material: {
          wireframe: false,
          lightIntensity: 1,
          castShadow: true,
          receiveShadow: true,
          color: '#ffffff',
          opacity: 1.0,
          roughness: 0.5,
          metalness: 0.0,
          emissiveColor: '#000000',
        },
        version: 1,
      },
    ],
  };
  const result = validateExportManifest(manifest);
  assert.equal(result.version, '2.0.0');
  assert.equal(result.assets.length, 1);
});

test('validateExportManifest rejects wrong version', () => {
  assert.throws(
    () => validateExportManifest({
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      scene: { lighting: {} as any, gridReceiveShadow: true },
      assets: [] as any,
    }),
    /version.*exactly "2.0.0"/
  );
});

test('validateExportManifest rejects invalid export date', () => {
  assert.throws(
    () => validateExportManifest({
      version: '2.0.0',
      exportDate: 'not-a-date',
      scene: { lighting: {} as any, gridReceiveShadow: true },
      assets: [] as any,
    }),
    /exportDate.*ISO 8601/
  );
});

test('validateExportManifest rejects empty assets array', () => {
  assert.throws(
    () => validateExportManifest({
      version: '2.0.0',
      exportDate: new Date().toISOString(),
      scene: {
        lighting: {
          ambient: 0.3,
          hemisphere: { intensity: 0.6, color: '#ffffff', groundColor: '#2a2b2e' },
          directional: { intensity: 1.5, position: [50, 50, 25] },
          shadowSoftness: 1,
          exposure: 1.0,
          toneMapping: 'ACESFilmic',
        },
        gridReceiveShadow: true,
      },
      assets: [],
    }),
    /assets.*at least 1/
  );
});

test('validateExportManifest detects duplicate asset IDs', () => {
  assert.throws(
    () => validateExportManifest({
      version: '2.0.0',
      exportDate: new Date().toISOString(),
      scene: {
        lighting: {
          ambient: 0.3,
          hemisphere: { intensity: 0.6, color: '#ffffff', groundColor: '#2a2b2e' },
          directional: { intensity: 1.5, position: [50, 50, 25] },
          shadowSoftness: 1,
          exposure: 1.0,
          toneMapping: 'ACESFilmic',
        },
        gridReceiveShadow: true,
      },
      assets: [
        {
          id: 'same-id',
          name: 'Asset 1',
          type: 'model',
          visible: true,
          locked: false,
          transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          material: {
            wireframe: false,
            lightIntensity: 1,
            castShadow: true,
            receiveShadow: true,
            color: '#ffffff',
            opacity: 1.0,
            roughness: 0.5,
            metalness: 0.0,
            emissiveColor: '#000000',
          },
          version: 1,
        },
        {
          id: 'same-id',  // duplicate
          name: 'Asset 2',
          type: 'model',
          visible: true,
          locked: false,
          transform: { position: [1, 1, 1], rotation: [0, 0, 0], scale: [1, 1, 1] },
          material: {
            wireframe: false,
            lightIntensity: 1,
            castShadow: true,
            receiveShadow: true,
            color: '#ffffff',
            opacity: 1.0,
            roughness: 0.5,
            metalness: 0.0,
            emissiveColor: '#000000',
          },
          version: 1,
        },
      ] as any,
    } as any),
    /duplicate ID/
  );
});

test('validateExportManifest validates layer references', () => {
  assert.throws(
    () => validateExportManifest({
      version: '2.0.0',
      exportDate: new Date().toISOString(),
      scene: {
        lighting: {
          ambient: 0.3,
          hemisphere: { intensity: 0.6, color: '#ffffff', groundColor: '#2a2b2e' },
          directional: { intensity: 1.5, position: [50, 50, 25] },
          shadowSoftness: 1,
          exposure: 1.0,
          toneMapping: 'ACESFilmic',
        },
        gridReceiveShadow: true,
        layers: [
          { id: 'layer-1', name: 'Layer 1', visible: true, locked: false, order: 0 },
        ],
      },
      assets: [
        {
          id: 'asset-1',
          name: 'Asset',
          type: 'model',
          layerId: 'non-existent-layer',  // references missing layer
          visible: true,
          locked: false,
          transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          material: {
            wireframe: false,
            lightIntensity: 1,
            castShadow: true,
            receiveShadow: true,
            color: '#ffffff',
            opacity: 1.0,
            roughness: 0.5,
            metalness: 0.0,
            emissiveColor: '#000000',
          },
          version: 1,
        },
      ],
    } as any),
    /references non-existent layer/
  );
});

test('validateExportManifest validates parent references', () => {
  assert.throws(
    () => validateExportManifest({
      version: '2.0.0',
      exportDate: new Date().toISOString(),
      scene: {
        lighting: {
          ambient: 0.3,
          hemisphere: { intensity: 0.6, color: '#ffffff', groundColor: '#2a2b2e' },
          directional: { intensity: 1.5, position: [50, 50, 25] },
          shadowSoftness: 1,
          exposure: 1.0,
          toneMapping: 'ACESFilmic',
        },
        gridReceiveShadow: true,
      },
      assets: [
        {
          id: 'asset-1',
          name: 'Asset',
          type: 'model',
          parent: 'non-existent-parent',  // references missing parent
          visible: true,
          locked: false,
          transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          material: {
            wireframe: false,
            lightIntensity: 1,
            castShadow: true,
            receiveShadow: true,
            color: '#ffffff',
            opacity: 1.0,
            roughness: 0.5,
            metalness: 0.0,
            emissiveColor: '#000000',
          },
          version: 1,
        },
      ],
    } as any),
    /references non-existent parent/
  );
});

test('validateExportManifest validates exportSensitiveModels references', () => {
  assert.throws(
    () => validateExportManifest({
      version: '2.0.0',
      exportDate: new Date().toISOString(),
      scene: {
        lighting: {
          ambient: 0.3,
          hemisphere: { intensity: 0.6, color: '#ffffff', groundColor: '#2a2b2e' },
          directional: { intensity: 1.5, position: [50, 50, 25] },
          shadowSoftness: 1,
          exposure: 1.0,
          toneMapping: 'ACESFilmic',
        },
        gridReceiveShadow: true,
      },
      assets: [
        {
          id: 'asset-1',
          name: 'Asset',
          type: 'model',
          visible: true,
          locked: false,
          transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          material: {
            wireframe: false,
            lightIntensity: 1,
            castShadow: true,
            receiveShadow: true,
            color: '#ffffff',
            opacity: 1.0,
            roughness: 0.5,
            metalness: 0.0,
            emissiveColor: '#000000',
          },
          version: 1,
        },
      ],
      exportSensitiveModels: ['non-existent-model'],  // references missing asset
    } as any),
    /references non-existent asset/
  );
});

// ─── Preflight Validation ──────────────────────────────────────────────────

test('preflightValidation accepts valid models', () => {
  const models = [
    {
      id: 'model-1',
      name: 'Model 1',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      type: 'model',
    },
  ];
  assert.doesNotThrow(() => preflightValidation(models));
});

test('preflightValidation rejects empty selection', () => {
  assert.throws(
    () => preflightValidation([]),
    /at least one model/
  );
});

test('preflightValidation rejects model without ID', () => {
  assert.throws(
    () => preflightValidation([
      {
        id: '',  // empty
        name: 'Model',
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
    ]),
    /id.*non-empty/
  );
});

test('preflightValidation rejects model with NaN transform', () => {
  assert.throws(
    () => preflightValidation([
      {
        id: 'model-1',
        name: 'Model',
        position: [NaN, 0, 0],  // NaN
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
    ]),
    /position.*finite/
  );
});

test('preflightValidation rejects model with negative scale', () => {
  assert.throws(
    () => preflightValidation([
      {
        id: 'model-1',
        name: 'Model',
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [-1, 1, 1],  // negative
      },
    ]),
    /scale.*positive/
  );
});

test('preflightValidation rejects model without transform components', () => {
  assert.throws(
    () => preflightValidation([
      {
        id: 'model-1',
        name: 'Model',
        // missing position/rotation/scale
      },
    ]),
    /missing transform/
  );
});

// ─── Phase 3: Extended Systems Tests ───────────────────────────────────────

test('validateMaterialMaps accepts valid texture maps', () => {
  const maps = {
    normalMap: 'textures/normal.png',
    roughnessMap: 'textures/rough.png',
    metalnessMap: 'textures/metal.png',
    emissiveMap: 'textures/emissive.png',
    alphaMap: 'textures/alpha.png',
  };
  const result = validateMaterialMaps(maps, 'test');
  assert.ok(result.normalMap);
  assert.ok(result.roughnessMap);
});

test('validateMaterialMaps rejects non-string maps', () => {
  assert.throws(
    () => validateMaterialMaps({
      normalMap: 123,
    }, 'test'),
    /normalMap.*string or null/
  );
});

test('validateMaterialUVTransform validates tiling and offset', () => {
  const uv = {
    tiling: [2, 3],
    offset: [0.5, 0.5],
    rotation: 0,
  };
  const result = validateMaterialUVTransform(uv, 'test');
  assert.deepEqual(result.tiling, [2, 3]);
});

test('validateMaterialUVTransform rejects negative tiling', () => {
  assert.throws(
    () => validateMaterialUVTransform({
      tiling: [-1, 1],
      offset: [0, 0],
      rotation: 0,
    }, 'test'),
    /tiling.*positive/
  );
});

test('validatePrefabExport validates prefab structure', () => {
  const prefab = {
    id: 'prefab-1',
    name: 'Prefab 1',
    modelIds: ['model-1', 'model-2'],
  };
  const result = validatePrefabExport(prefab, 'test');
  assert.equal(result.id, 'prefab-1');
  assert.equal(result.modelIds.length, 2);
});

test('validatePathExport validates path structure', () => {
  const path = {
    id: 'path-1',
    name: 'Path 1',
    type: 'walkway',
    closed: false,
    width: 2,
    points: [
      { id: 'pt1', position: [0, 0, 0] },
      { id: 'pt2', position: [1, 0, 0] },
    ],
  };
  const result = validatePathExport(path, 'test');
  assert.equal(result.id, 'path-1');
  assert.equal(result.points.length, 2);
});

test('validatePathExport rejects invalid path type', () => {
  assert.throws(
    () => validatePathExport({
      id: 'path-1',
      name: 'Path',
      type: 'invalid',
      closed: false,
      width: 2,
      points: [],
    }, 'test'),
    /path type/
  );
});

test('validateCollisionZoneExport validates zone structure', () => {
  const zone = {
    id: 'zone-1',
    name: 'Zone 1',
    type: 'ground_surface',
    enabled: true,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [5, 1, 5],
    shape: 'box',
    allowedTags: [],
    blockedTags: [],
  };
  const result = validateCollisionZoneExport(zone, 'test');
  assert.equal(result.id, 'zone-1');
});

test('validateTerrainExport accepts optional terrain', () => {
  const terrain = {
    size: 100,
    resolution: 10,
  };
  const result = validateTerrainExport(terrain, 'test');
  assert.equal(result.size, 100);
});

test('validateCameraPresetExport validates camera presets', () => {
  const preset = {
    id: 'cam-1',
    name: 'Camera 1',
    type: 'perspective',
    position: [0, 10, 10],
    rotation: [0, 0, 0],
    target: [0, 0, 0],
    fov: 75,
    near: 0.1,
    far: 1000,
  };
  const result = validateCameraPresetExport(preset, 'test');
  assert.equal(result.fov, 75);
});

test('validateCameraPathExport validates camera animation paths', () => {
  const path = {
    id: 'cam-path-1',
    name: 'Camera Path',
    points: [
      { id: 'kf1', position: [0, 10, 10], target: [0, 0, 0], duration: 0, fov: 75 },
      { id: 'kf2', position: [10, 10, 0], target: [5, 0, 0], duration: 2, fov: 60 },
    ],
    interpolation: 'smooth',
  };
  const result = validateCameraPathExport(path, 'test');
  assert.equal(result.points.length, 2);
});

test('validateQualitySettingsExport validates quality options', () => {
  const quality = {
    shadowMapSize: 2048,
    materialQuality: 'high',
    textureQuality: 'high',
    maxLights: 32,
  };
  const result = validateQualitySettingsExport(quality, 'test');
  assert.equal(result.shadowMapSize, 2048);
});

test('validateExportAsset includes behavior tags and classification', () => {
  const asset = {
    id: 'asset-1',
    name: 'Asset',
    type: 'model',
    visible: true,
    locked: false,
    behaviorTags: ['Decorative', 'Clickable'],
    classification: 'indoor',
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    material: {
      wireframe: false,
      lightIntensity: 1,
      castShadow: true,
      receiveShadow: true,
      color: '#ffffff',
      opacity: 1.0,
      roughness: 0.5,
      metalness: 0.0,
      emissiveColor: '#000000',
    },
    version: 1,
  };
  const result = validateExportAsset(asset, 'test');
  assert.deepEqual(result.behaviorTags, ['Decorative', 'Clickable']);
  assert.equal(result.classification, 'indoor');
});

test('validateExportAsset includes children IDs for hierarchy', () => {
  const asset = {
    id: 'parent-1',
    name: 'Parent',
    type: 'model',
    visible: true,
    locked: false,
    childrenIds: ['child-1', 'child-2'],
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    material: {
      wireframe: false,
      lightIntensity: 1,
      castShadow: true,
      receiveShadow: true,
      color: '#ffffff',
      opacity: 1.0,
      roughness: 0.5,
      metalness: 0.0,
      emissiveColor: '#000000',
    },
    version: 1,
  };
  const result = validateExportAsset(asset, 'test');
  assert.deepEqual(result.childrenIds, ['child-1', 'child-2']);
});

test('validateExportManifest validates prefabs with model references', () => {
  const manifest = {
    version: '2.0.0',
    exportDate: new Date().toISOString(),
    scene: {
      lighting: {
        ambient: 0.3,
        hemisphere: { intensity: 0.6, color: '#ffffff', groundColor: '#2a2b2e' },
        directional: { intensity: 1.5, position: [50, 50, 25] },
        shadowSoftness: 1,
        exposure: 1.0,
        toneMapping: 'ACESFilmic',
      },
      gridReceiveShadow: true,
    },
    assets: [
      {
        id: 'model-1',
        name: 'Model',
        type: 'model',
        visible: true,
        locked: false,
        transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
        material: {
          wireframe: false,
          lightIntensity: 1,
          castShadow: true,
          receiveShadow: true,
          color: '#ffffff',
          opacity: 1.0,
          roughness: 0.5,
          metalness: 0.0,
          emissiveColor: '#000000',
        },
        version: 1,
      },
    ],
    prefabs: [
      {
        id: 'prefab-1',
        name: 'Prefab',
        modelIds: ['model-1'],
      },
    ],
  };
  const result = validateExportManifest(manifest as any);
  assert.ok(result.prefabs);
  assert.equal(result.prefabs.length, 1);
});

test('validateExportManifest detects missing prefab model references', () => {
  assert.throws(
    () => validateExportManifest({
      version: '2.0.0',
      exportDate: new Date().toISOString(),
      scene: {
        lighting: {
          ambient: 0.3,
          hemisphere: { intensity: 0.6, color: '#ffffff', groundColor: '#2a2b2e' },
          directional: { intensity: 1.5, position: [50, 50, 25] },
          shadowSoftness: 1,
          exposure: 1.0,
          toneMapping: 'ACESFilmic',
        },
        gridReceiveShadow: true,
      },
      assets: [
        {
          id: 'model-1',
          name: 'Model',
          type: 'model',
          visible: true,
          locked: false,
          transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          material: {
            wireframe: false,
            lightIntensity: 1,
            castShadow: true,
            receiveShadow: true,
            color: '#ffffff',
            opacity: 1.0,
            roughness: 0.5,
            metalness: 0.0,
            emissiveColor: '#000000',
          },
          version: 1,
        },
      ],
      prefabs: [
        {
          id: 'prefab-1',
          name: 'Prefab',
          modelIds: ['non-existent-model'],
        },
      ],
    } as any),
    /references non-existent model/
  );
});

test('validateExportManifest validates child reference consistency', () => {
  assert.throws(
    () => validateExportManifest({
      version: '2.0.0',
      exportDate: new Date().toISOString(),
      scene: {
        lighting: {
          ambient: 0.3,
          hemisphere: { intensity: 0.6, color: '#ffffff', groundColor: '#2a2b2e' },
          directional: { intensity: 1.5, position: [50, 50, 25] },
          shadowSoftness: 1,
          exposure: 1.0,
          toneMapping: 'ACESFilmic',
        },
        gridReceiveShadow: true,
      },
      assets: [
        {
          id: 'parent-1',
          name: 'Parent',
          type: 'model',
          visible: true,
          locked: false,
          childrenIds: ['non-existent-child'],
          transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          material: {
            wireframe: false,
            lightIntensity: 1,
            castShadow: true,
            receiveShadow: true,
            color: '#ffffff',
            opacity: 1.0,
            roughness: 0.5,
            metalness: 0.0,
            emissiveColor: '#000000',
          },
          version: 1,
        },
      ],
    } as any),
    /references non-existent child/
  );
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateTransform,
  validateMaterialProperties,
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

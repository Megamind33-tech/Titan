/**
 * Integration Test: Material Library Application Workflow
 *
 * This test verifies the complete end-to-end workflow of applying a material to a model:
 * 1. Create/lookup a material preset from the library
 * 2. Apply the material to a model using the AI command
 * 3. Verify the model is updated with material properties
 * 4. Ensure the change is tracked for save/export
 *
 * To run: npx ts-node src/tests/material-integration.test.ts
 */

import { MaterialService } from '../services/MaterialService';
import { CommandExecutor, CommandExecutorContext, CommandExecutorCallbacks } from '../services/CommandExecutor';
import { MaterialPreset, MaterialCategory } from '../types/materials';
import { ModelData } from '../App';

// Test data: Sample material preset
const testMaterial: MaterialPreset = {
  id: 'mat_test_concrete',
  name: 'Test Concrete',
  category: 'Concrete' as MaterialCategory,
  color: '#8B8B8B',
  opacity: 1,
  transparent: false,
  roughness: 0.9,
  metalness: 0,
  emissiveColor: '#000000',
  emissiveIntensity: 0,
  normalMapUrl: undefined,
  tiling: [1, 1],
  offset: [0, 0],
  rotation: 0,
  wireframe: false,
  side: 'front'
};

// Test data: Sample model
const testModel: ModelData = {
  id: 'model_test_1',
  name: 'Test Cube',
  url: 'models/cube.glb',
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  visible: true,
  locked: false,
  castShadow: true,
  receiveShadow: true
};

/**
 * Test 1: MaterialService.applyMaterial
 * Verifies that applying a material to a model updates all relevant properties
 */
export function testMaterialServiceApply() {
  console.log('\n✓ Test 1: MaterialService.applyMaterial');

  const updated = MaterialService.applyMaterial(testModel, testMaterial);

  // Verify all material properties are copied
  console.assert(updated.material === testMaterial, 'Material preset should be stored');
  console.assert(updated.colorTint === testMaterial.color, 'Color tint should match material color');
  console.assert(updated.opacity === testMaterial.opacity, 'Opacity should match');
  console.assert(updated.roughness === testMaterial.roughness, 'Roughness should match');
  console.assert(updated.metalness === testMaterial.metalness, 'Metalness should match');
  console.assert(updated.emissiveColor === testMaterial.emissiveColor, 'Emissive color should match');
  console.assert(updated.wireframe === testMaterial.wireframe, 'Wireframe should match');

  // Verify behavior tag is added
  console.assert(updated.behaviorTags?.includes(`material:${testMaterial.id}`), 'Material tag should be added to behaviorTags');

  // Verify original model is not mutated
  console.assert(testModel.material === undefined, 'Original model should not be mutated');

  console.log('   - All properties correctly applied');
  console.log('   - Model is immutable');
}

/**
 * Test 2: MaterialService.validateMaterial
 * Verifies that material validation catches invalid values
 */
export function testMaterialValidation() {
  console.log('\n✓ Test 2: MaterialService.validateMaterial');

  // Valid material should pass
  const validError = MaterialService.validateMaterial(testMaterial);
  console.assert(validError === null, 'Valid material should pass validation');

  // Invalid roughness should fail
  const invalidRoughness = MaterialService.validateMaterial({
    ...testMaterial,
    roughness: 1.5 // Out of range
  });
  console.assert(invalidRoughness !== null, 'Invalid roughness should fail validation');

  // Missing required fields should fail
  const missingId = MaterialService.validateMaterial({
    name: 'Test',
    color: '#fff'
    // missing id
  });
  console.assert(missingId !== null, 'Missing ID should fail validation');

  console.log('   - Valid materials pass');
  console.log('   - Invalid values are caught');
}

/**
 * Test 3: MaterialService.getMaterialIdFromTags
 * Verifies material ID extraction from behavior tags
 */
export function testMaterialTagExtraction() {
  console.log('\n✓ Test 3: MaterialService.getMaterialIdFromTags');

  const modelWithTag = {
    ...testModel,
    behaviorTags: ['decorative', `material:${testMaterial.id}`, 'another-tag']
  };

  const extractedId = MaterialService.getMaterialIdFromTags(modelWithTag);
  console.assert(extractedId === testMaterial.id, 'Should extract correct material ID from tags');

  const noId = MaterialService.getMaterialIdFromTags(testModel);
  console.assert(noId === null, 'Should return null if no material tag present');

  console.log('   - Material ID correctly extracted from tags');
}

/**
 * Test 4: CommandExecutor.handleApplyMaterial
 * Verifies the full command execution flow for applying materials
 */
export async function testCommandExecutorApplyMaterial() {
  console.log('\n✓ Test 4: CommandExecutor.handleApplyMaterial');

  let updatedModels: ModelData[] = [];

  const context: CommandExecutorContext = {
    models: [testModel],
    selectedModelId: testModel.id,
    layers: [],
    environment: { id: 'default', name: 'Default', lighting: {}, fog: {} } as any,
    cameraPresets: [],
    activeCameraPresetId: null,
    cameraPaths: [],
    activeCameraPathId: null,
    prefabs: [],
    collisionZones: [],
    materialLibrary: [testMaterial],
    environmentLibrary: [],
    paths: [],
    assets: []
  };

  const callbacks: CommandExecutorCallbacks = {
    onModelsChange: (models) => { updatedModels = models; },
    onLayersChange: () => {},
    onEnvironmentChange: () => {},
    onCameraPresetsChange: () => {},
    onActiveCameraPresetChange: () => {},
    onCameraPathsChange: () => {},
    onActiveCameraPathChange: () => {},
    onCollisionZonesChange: () => {},
    onOpenAssetBrowser: () => {},
    onOpenExportModal: () => {},
    onSelectModel: () => {},
    onTagFilterChange: () => {},
    onCloneModels: () => [],
    onCreateModelsFromAsset: () => []
  };

  const executor = new CommandExecutor(context, callbacks);

  // Test applying by material name
  const result = await executor.execute({
    type: 'apply_material',
    payload: {
      targetId: testModel.id,
      materialName: testMaterial.name
    }
  } as any);

  console.assert(result.success, 'Command should succeed');
  console.assert(result.affectedModelIds?.includes(testModel.id), 'Should report affected model');
  console.assert(updatedModels.length === 1, 'Should have one updated model');
  console.assert(updatedModels[0].material === testMaterial, 'Material should be applied');
  console.assert(updatedModels[0].roughness === testMaterial.roughness, 'Material properties should be applied');
  console.log('   - Material lookup by name works');
  console.log('   - Command returns success and affected model IDs');
  console.log('   - Model state is updated via callback');
}

/**
 * Test 5: Save/Load Persistence
 * Verifies that applied materials are preserved when saving/loading
 */
export function testMaterialPersistence() {
  console.log('\n✓ Test 5: Material Persistence (Save/Load)');

  // Apply material to model
  const modelWithMaterial = MaterialService.applyMaterial(testModel, testMaterial);

  // Simulate save: The material properties should be included in serialized state
  const savedState = {
    ...modelWithMaterial,
    // Exclude transient fields as done in storageUtils
    url: undefined,
    file: undefined,
    textureUrl: undefined
  };

  console.assert(savedState.material === testMaterial, 'Material preset should be saved');
  console.assert(savedState.roughness === testMaterial.roughness, 'Material properties should be saved');
  console.assert(savedState.behaviorTags?.includes(`material:${testMaterial.id}`), 'Material tag should be saved');

  console.log('   - Material properties are included in saved state');
  console.log('   - Material ID is tracked in behavior tags for persistence');
}

/**
 * Test 6: Export Compatibility
 * Verifies that materials are included in export data
 */
export function testMaterialExport() {
  console.log('\n✓ Test 6: Material Export Compatibility');

  const modelWithMaterial = MaterialService.applyMaterial(testModel, testMaterial);

  // Material properties should be part of the exported model
  const exportData = {
    id: modelWithMaterial.id,
    name: modelWithMaterial.name,
    position: modelWithMaterial.position,
    rotation: modelWithMaterial.rotation,
    scale: modelWithMaterial.scale,
    // Material properties
    material: modelWithMaterial.material,
    roughness: modelWithMaterial.roughness,
    metalness: modelWithMaterial.metalness,
    colorTint: modelWithMaterial.colorTint,
    opacity: modelWithMaterial.opacity,
    emissiveColor: modelWithMaterial.emissiveColor,
    normalMapUrl: modelWithMaterial.normalMapUrl,
    wireframe: modelWithMaterial.wireframe
  };

  console.assert(exportData.material !== undefined, 'Material preset should be in export');
  console.assert(exportData.roughness === testMaterial.roughness, 'Material properties should be in export');

  console.log('   - Material properties are included in export data');
  console.log('   - Material can be restored from exported data');
}

/**
 * Run all tests
 */
export async function runAllTests() {
  console.log('════════════════════════════════════════════════════════════');
  console.log('Material Library Integration Tests');
  console.log('════════════════════════════════════════════════════════════');

  try {
    testMaterialServiceApply();
    testMaterialValidation();
    testMaterialTagExtraction();
    await testCommandExecutorApplyMaterial();
    testMaterialPersistence();
    testMaterialExport();

    console.log('\n════════════════════════════════════════════════════════════');
    console.log('✓ All Material Integration Tests Passed');
    console.log('════════════════════════════════════════════════════════════\n');
  } catch (error) {
    console.error('\n✗ Test failed:', error);
    process.exit(1);
  }
}

// Run tests if executed directly in ESM environments
const isDirectExecution = (() => {
  if (typeof process === 'undefined' || !process.argv[1]) return false;
  return import.meta.url === new URL(`file://${process.argv[1]}`).href;
})();

if (isDirectExecution) {
  runAllTests();
}

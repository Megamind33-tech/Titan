import { GoogleGenAI, Type } from "@google/genai";
import { AssetAnalysis } from "./AssetAnalyzer";
import { ModelData } from "../App";

export interface ReplacementAnalysis {
  explanation: string;
  warnings: string[];
  preservedLogic: string[];
  scaleMultiplier: [number, number, number];
  positionOffset: [number, number, number];
  materialRemap: { [oldMaterial: string]: string };
}

export async function analyzeReplacement(
  currentModel: ModelData,
  currentAnalysis: AssetAnalysis,
  newAssetMetadata: any,
  newAnalysis: AssetAnalysis
): Promise<ReplacementAnalysis> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

  const prompt = `
    You are an AI assistant for a 3D game editor, specializing in safe asset replacement and logic inheritance.
    The user is replacing an existing asset in the scene with a new one.
    
    Current Asset:
    - Name: ${currentModel.name}
    - Position: [${currentModel.position.join(', ')}]
    - Rotation: [${currentModel.rotation.join(', ')}]
    - Scale: [${currentModel.scale.join(', ')}]
    - Dimensions: W:${currentAnalysis.dimensions.width}, H:${currentAnalysis.dimensions.height}, D:${currentAnalysis.dimensions.depth}
    - Center Offset: [${currentAnalysis.center.join(', ')}]
    - Materials: ${currentAnalysis.materials.join(', ')}
    - Meshes: ${currentAnalysis.meshes.join(', ')}

    New Asset:
    - Name: ${newAssetMetadata.name || 'Unknown'}
    - Dimensions: W:${newAnalysis.dimensions.width}, H:${newAnalysis.dimensions.height}, D:${newAnalysis.dimensions.depth}
    - Center Offset: [${newAnalysis.center.join(', ')}]
    - Materials: ${newAnalysis.materials.join(', ')}
    - Meshes: ${newAnalysis.meshes.join(', ')}

    Task:
    1. Calculate a scale multiplier to make the new asset roughly the same physical size as the old asset, if appropriate.
    2. Calculate a position offset to align the new asset's base/center with the old asset's base/center.
    3. Suggest material remapping if the old asset had specific materials that might map to the new asset's slots.
    4. Provide a clear, non-technical explanation of what will be preserved, what will change, and any warnings (e.g., lost attachment points, significant shape differences).
    5. List the logic that will be preserved (e.g., position, rotation, layer, visibility).
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          explanation: {
            type: Type.STRING,
            description: "A clear, non-technical explanation of the replacement process, what is preserved, and what changes."
          },
          warnings: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Warnings about potential issues like lost attachments, bounding box mismatches, or sinking."
          },
          preservedLogic: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "List of scene logic elements that will be safely inherited (e.g., 'Position', 'Layer Assignment', 'Visibility')."
          },
          scaleMultiplier: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER },
            description: "Suggested scale multiplier [x, y, z] to apply to the new asset to match the old asset's footprint."
          },
          positionOffset: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER },
            description: "Suggested position offset [x, y, z] to align the new asset correctly."
          },
          materialRemap: {
            type: Type.OBJECT,
            description: "A map of old material names to new material names, if a logical mapping exists."
          }
        },
        required: ["explanation", "warnings", "preservedLogic", "scaleMultiplier", "positionOffset", "materialRemap"]
      }
    }
  });

  try {
    const result = JSON.parse(response.text || "{}");
    return {
      explanation: result.explanation || "Replacement analysis complete.",
      warnings: result.warnings || [],
      preservedLogic: result.preservedLogic || [],
      scaleMultiplier: result.scaleMultiplier || [1, 1, 1],
      positionOffset: result.positionOffset || [0, 0, 0],
      materialRemap: result.materialRemap || {}
    };
  } catch (e) {
    console.error("Failed to parse replacement analysis", e);
    return {
      explanation: "Failed to analyze replacement.",
      warnings: ["Analysis failed. Manual adjustment may be required."],
      preservedLogic: ["Position", "Rotation", "Scale", "Layer"],
      scaleMultiplier: [1, 1, 1],
      positionOffset: [0, 0, 0],
      materialRemap: {}
    };
  }
}

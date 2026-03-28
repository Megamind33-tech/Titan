import { GoogleGenAI, Type } from "@google/genai";
import { ModelData } from '../App';
import { Layer } from '../types/layers';
import { MaterialPreset } from '../types/materials';
import { EnvironmentPreset } from '../types/environment';
import { CameraPreset } from '../types/camera';

export type AICommandType = 
  | 'place_asset'
  | 'update_transform'
  | 'replace_asset'
  | 'apply_material'
  | 'swap_texture'
  | 'update_lighting'
  | 'update_camera'
  | 'place_along_path'
  | 'organize_layers'
  | 'lock_hide'
  | 'filter_by_tag'
  | 'update_tags'
  | 'explain'
  | 'suggest_optimization'
  | 'prepare_export'
  | 'unknown';

export interface AICommand {
  type: AICommandType;
  description: string;
  requiresConfirmation: boolean;
  payload: any;
}

export interface AICommandResponse {
  message: string;
  commands: AICommand[];
}

export interface SceneContext {
  models: ModelData[];
  selectedModelId: string | null;
  layers: Layer[];
  environment: EnvironmentPreset;
  activeCameraPresetId: string | null;
  cameraPresets: CameraPreset[];
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const interpretCommand = async (prompt: string, context: SceneContext): Promise<AICommandResponse> => {
  const model = "gemini-3-flash-preview";
  
  const systemInstruction = `
You are a 3D Scene Assistant for a game editor. Your job is to interpret user requests and translate them into structured actions.
You must return a JSON object with a 'message' (your response to the user) and a 'commands' array.

Available command types:
- 'place_asset': Place a new asset (e.g., "add a tree"). Payload: { assetName: string, position?: [x,y,z] }
- 'update_transform': Move, rotate, or scale an object. Payload: { targetId: string, position?: [x,y,z], rotation?: [x,y,z], scale?: [x,y,z] }
- 'replace_asset': Replace an asset. Payload: { targetId: string, newAssetName: string }
- 'apply_material': Apply a material preset. Payload: { targetId: string, materialName: string }
- 'swap_texture': Swap a texture. Payload: { targetId: string, textureUrl: string }
- 'update_lighting': Create or edit lighting (environment). Payload: { presetName: string }
- 'update_camera': Create or switch camera. Payload: { presetName: string }
- 'place_along_path': Place repeated objects along a path. Payload: { assetName: string, pathId: string, count: number }
- 'organize_layers': Move objects to layers. Payload: { targetIds: string[], layerName: string }
- 'lock_hide': Lock or hide elements. Payload: { targetIds: string[], action: 'lock' | 'unlock' | 'hide' | 'show' }
- 'filter_by_tag': Filter scene objects by behavior tag. Payload: { tag: string }
- 'update_tags': Add or remove behavior tags from objects. Payload: { targetIds: string[], tags: string[], action: 'add' | 'remove' }
- 'explain': Explain an object, system, or scene state. Payload: { topic: string }
- 'suggest_optimization': Suggest performance improvements. Payload: { targetId?: string }
- 'prepare_export': Prepare export settings. Payload: { format: string }

Rules:
1. If the user asks to modify an object but doesn't specify which, assume the currently selected object if applicable.
2. If the action is destructive (delete, replace many, global changes), set requiresConfirmation to true.
3. If the user asks a question, use the 'explain' command type and provide the answer in the 'message' field.
4. Always provide a clear 'description' for each command so the user knows what will happen.
5. If you cannot interpret the command, use the 'unknown' type and explain why in the message.

Current Scene Context:
- Selected Object ID: ${context.selectedModelId || 'None'}
- Total Objects: ${context.models.length}
- Objects: ${context.models.map(m => `{ id: "${m.id}", name: "${m.name}", position: [${m.position.join(',')}] }`).join(', ')}
- Layers: ${context.layers.map(l => l.name).join(', ')}
`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            message: {
              type: Type.STRING,
              description: "Your conversational response to the user."
            },
            commands: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: {
                    type: Type.STRING,
                    description: "The type of command."
                  },
                  description: {
                    type: Type.STRING,
                    description: "A clear description of what the command will do."
                  },
                  requiresConfirmation: {
                    type: Type.BOOLEAN,
                    description: "True if the action is destructive or broad."
                  },
                  payload: {
                    type: Type.OBJECT,
                    description: "The specific data needed to execute the command."
                  }
                },
                required: ["type", "description", "requiresConfirmation", "payload"]
              }
            }
          },
          required: ["message", "commands"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from AI");
    
    return JSON.parse(text) as AICommandResponse;
  } catch (error) {
    console.error("Failed to interpret command:", error);
    return {
      message: "I encountered an error trying to understand that request. Please try again.",
      commands: []
    };
  }
};

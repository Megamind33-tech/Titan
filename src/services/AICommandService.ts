import { GoogleGenAI, Type } from "@google/genai";
import { ModelData } from '../App';
import { Layer } from '../types/layers';
import { MaterialPreset } from '../types/materials';
import { EnvironmentPreset } from '../types/environment';
import { CameraPreset } from '../types/camera';
import { CollisionZone } from '../types/collision';

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
  // ─── Collision / Placement commands ────────────────────────────────────
  | 'validate_placement'          // validate selected object against zones
  | 'highlight_invalid_placements'// find & select all invalid objects
  | 'place_in_zone'               // instruct to place objects inside a named zone
  | 'list_zones'                  // describe current zones
  | 'create_zone'                 // create a new zone
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
  collisionZones?: CollisionZone[];
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const interpretCommand = async (
  prompt: string,
  context: SceneContext
): Promise<AICommandResponse> => {
  const model = "gemini-3-flash-preview";

  const zonesText = context.collisionZones && context.collisionZones.length > 0
    ? context.collisionZones
        .map(z => `{ id: "${z.id}", name: "${z.name}", type: "${z.type}", enabled: ${z.enabled} }`)
        .join(', ')
    : 'None defined';

  const systemInstruction = `
You are a 3D Scene Assistant for a game editor. Your job is to interpret user requests and translate them into structured actions.
You must return a JSON object with a 'message' (your response to the user) and a 'commands' array.

Available command types:
- 'place_asset': Place a new asset. Payload: { assetName: string, position?: [x,y,z] }
- 'update_transform': Move, rotate, or scale an object. Payload: { targetId: string, position?: [x,y,z], rotation?: [x,y,z], scale?: [x,y,z] }
- 'replace_asset': Replace an asset. Payload: { targetId: string, newAssetName: string }
- 'apply_material': Apply a material preset. Payload: { targetId: string, materialName: string }
- 'swap_texture': Swap a texture. Payload: { targetId: string, textureUrl: string }
- 'update_lighting': Create or edit lighting. Payload: { presetName: string }
- 'update_camera': Create or switch camera. Payload: { presetName: string }
- 'place_along_path': Place repeated objects along a path. Payload: { assetName: string, pathId: string, count: number }
- 'organize_layers': Move objects to layers. Payload: { targetIds: string[], layerName: string }
- 'lock_hide': Lock or hide elements. Payload: { targetIds: string[], action: 'lock'|'unlock'|'hide'|'show' }
- 'filter_by_tag': Filter scene objects by tag. Payload: { tag: string }
- 'update_tags': Add or remove behavior tags. Payload: { targetIds: string[], tags: string[], action: 'add'|'remove' }
- 'explain': Explain an object or scene state. Payload: { topic: string }
- 'suggest_optimization': Suggest performance improvements. Payload: { targetId?: string }
- 'prepare_export': Prepare export settings. Payload: { format: string }
- 'validate_placement': Validate the selected object\'s placement against collision zones.
  Payload: { targetId: string }
- 'highlight_invalid_placements': Find and flag all objects with invalid or warned placement.
  Payload: {}
- 'place_in_zone': Instruct the user or system to place a set of objects inside a named zone.
  Payload: { targetIds: string[], zoneName: string, zoneType: string }
- 'list_zones': Describe all current collision zones.
  Payload: {}
- 'create_zone': Request creation of a new collision zone.
  Payload: { name: string, type: string, position?: [x,y,z] }

PLACEMENT CONSTRAINT RULES (follow strictly):
- NEVER suggest placing a camera inside a camera_restricted zone.
- NEVER suggest placing a non-water-related object inside a water zone unless the user explicitly asks to override.
- NEVER suggest placing an object inside a no_placement zone.
- For ad boards (Ad Placement tag), always prefer placing inside ad_placement zones.
- For flags (Flag Placement tag), always prefer placing inside flag_placement zones.
- Grounded objects should snap to ground_surface or floor zones.
- If the user says "place only in valid zones", ensure all placement respects zone boundaries.
- If the user asks to find or fix invalid placements, use 'highlight_invalid_placements'.

Rules:
1. If destructive (delete, replace many, global changes), set requiresConfirmation: true.
2. If the user asks a question, use 'explain' and answer in the message field.
3. Always provide a clear description for each command.
4. If you cannot interpret, use 'unknown' and explain why.
5. Respect collision zones — do not suggest placements that violate known constraints.

Current Scene Context:
- Selected Object ID: ${context.selectedModelId || 'None'}
- Total Objects: ${context.models.length}
- Objects: ${context.models.map(m => `{ id: "${m.id}", name: "${m.name}", tags: [${(m.behaviorTags || []).join(',')}], position: [${m.position.join(',')}] }`).join(', ')}
- Layers: ${context.layers.map(l => l.name).join(', ')}
- Collision Zones: ${zonesText}
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
                  type:                 { type: Type.STRING,  description: "The type of command." },
                  description:          { type: Type.STRING,  description: "A clear description of what the command will do." },
                  requiresConfirmation: { type: Type.BOOLEAN, description: "True if the action is destructive or broad." },
                  payload:              { type: Type.OBJECT,  description: "The specific data needed to execute the command." }
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
    if (!text) throw new Error('Empty response from AI');
    return JSON.parse(text) as AICommandResponse;
  } catch (error) {
    console.error('Failed to interpret command:', error);
    return {
      message: "I encountered an error trying to understand that request. Please try again.",
      commands: []
    };
  }
};

# SWIM26 Support Matrix (Titan → SWIM26)

| Capability | Status | Notes |
|---|---|---|
| Node transforms (position/rotation/scale) | **Supported** | Applied directly during runtime assembly. |
| URL asset refs | **Supported** | Validated and routed through SceneLoader adapter. |
| GLB | **Supported** | Primary runtime-loaded format. |
| GLTF | **Supported** | Supported by extension policy. |
| OBJ | **Supported with approximation** | Requires runtime OBJ loader plugin; warning emitted. |
| Material color | **Supported** | Hex color mapped to runtime PBR albedo color. |
| Texture URL | **Supported** | Mapped to runtime albedo texture URL hint. |
| Opacity | **Supported with approximation** | Mapped to alpha; no guarantee of exact shader parity. |
| Roughness | **Supported with approximation** | Mapped to runtime roughness field. |
| Metalness | **Supported with approximation** | Mapped to runtime metallic field. |
| Emissive | **Supported with approximation** | Mapped when parseable color is provided. |
| Material preset parity | **Unsupported** | Presets treated as metadata only (`MATERIAL_PRESET_APPROXIMATED`). |
| Environment clear/background | **Supported** | `backgroundColor` mapped to host clear color. |
| Environment preset ID | **Supported with approximation** | Preset ID stored/propagated; full runtime lighting parity not guaranteed. |
| Path visualization | **Unsupported** | Accepted in data; not rendered (`PATH_VISUALIZATION_NOT_IMPLEMENTED`). |
| Collision/zone runtime behavior | **Runtime-owned** | Not applied by importer/runtime assembly. |
| Gameplay/runtime systems | **Runtime-owned** | Explicitly out of importer/assembler scope. |
| Adapter/profile/session use in handoff | **Supported** | Export/import is bounded by active adapter/bridge/session metadata. |
| Visual screenshot baseline regression | **Supported with approximation** | Deterministic SVG host-output baselines are enforced with token-delta diff artifacts; full Babylon GPU framebuffer screenshot diff remains environment-limited. |
| Real Babylon framebuffer screenshot regression | **Supported with external requirement** | Requires `SWIM26_REAL_SCREENSHOT_CMD` runtime to capture PNG + capture metadata in a real Babylon environment; pass requires host loader evidence + framebuffer capture evidence + screenshot parity. |

## Status legend
- **Supported**: implemented and intended for production use in current scope.
- **Supported with approximation**: implemented but not full parity with target runtime/shader/gameplay behavior.
- For visual verification, "Supported with approximation" specifically means host SceneLoader/runtime paths are verified, but pixel-accurate GPU output parity is not guaranteed in this environment.
- **Unsupported**: explicitly not implemented yet.
- **Runtime-owned**: belongs to SWIM26 runtime gameplay systems, not Titan import pipeline.
- **Supported with external requirement**: integrated in Titan pipeline but requires external runtime/CI capability that may not exist in all environments.

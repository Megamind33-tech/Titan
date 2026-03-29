# PHASE 4-5: SWIM26 Repo Detection & Supported File Ingestion

## PHASE 4 — SWIM26 REPO DETECTION (Enhanced)

### Expanded Detection Signals

The basic detector now supports marker files and dependencies. We can enhance it with:

**Existing Signals (Already Implemented)**
- swim26.manifest.json marker file
- babylon.config.json marker file
- swim26.config.json marker file
- babylonjs in dependencies
- @babylonjs/core in dependencies
- swim26 in dependencies

**Additional Signals to Consider (Out of Phase 1-3 Scope)**
- Folder structure analysis: presence of `/src/scenes/`, `/assets/`, `/games/`
- GitHub topics: "babylon" or "swim26" tags
- README.md mentions of "SWIM26" or "Babylon"
- .babylon scene files (need careful inspection)
- babylon.custom.json or babylon.environment.json
- Babylon-generated metadata files

**Current MVP Approach**
- Stick with marker files and npm dependencies (fast, safe)
- No code execution
- No full-file scanning beyond JSON parsing
- Graceful fallback to generic Titan profile

---

## PHASE 5 — SUPPORTED REPO INGESTION FLOW

### Safe File Import Scope

What we fetch and parse from a SWIM26 repo:

**Always Safe to Fetch**
1. `package.json` - Project metadata, dependencies
2. `swim26.manifest.json` - Scene structure and project data
3. `babylon.config.json` - Runtime configuration hints
4. `swim26.config.json` - Project-level settings
5. `README.md` - Human context (optional)

**Conditional (Rank 2)**
6. Asset metadata files (if separate from actual assets)
7. Camera preset definitions (if in manifest/config)
8. Path/movement definitions (if in manifest)
9. Environment preset selections
10. Collision zone definitions (if in manifest)

**Never Fetch**
- Any .ts, .js, .tsx, .jsx files (code)
- webpack.config.js, vite.config.ts (build config)
- .env, .env.local (secrets)
- node_modules/ (dependencies)
- Build artifacts (dist/, build/)
- .git/ directory

### Import Mapping Process

```
GitHub Repo Ingest
    ↓
Extract Manifest (JSON)
    ↓
Parse Project Metadata
    ├─ Project name, version, description
    ├─ Scene objects and hierarchy
    ├─ Asset references (paths, not files)
    ├─ Environment/camera settings
    ├─ Tags and metadata
    └─ Collision zones / paths (if in manifest)
    ↓
Create Titan Session
    ├─ ProjectSession with correct profile/adapter
    ├─ Load metadata into session
    ├─ Mark as "imported from [repo]"
    └─ Ready for editing
```

### What We Parse

**From manifest files (JSON)**
- Scene structure: objects, transforms, hierarchy
- Asset references: paths and metadata only
- Environment: presets, lighting, camera defaults
- Paths: camera paths, movement definitions
- Tags: behavioral metadata, collision zones
- Metadata: author, version, project info

**What We Do NOT Parse**
- Babylon engine code or initialization logic
- Game logic or event handlers
- Runtime state or networking data
- Procedural/algorithmic scene generation

---

## Implementation Status

**COMPLETED (PHASE 1-3)**
✅ GitHub Connector architecture
✅ URL parsing and validation
✅ File blocking logic
✅ Basic SWIM26 marker detection
✅ Dependency-based detection
✅ ProjectSession creation
✅ Tests for connector and detection

**TODO (PHASE 4-5)**
- Enhanced detection signals (optional for MVP)
- Manifest file parsing and validation
- Imported scene data loading
- Asset reference extraction
- Environment/camera preset loading
- Proper error messages for unsupported repo content

**DEFERRED (PHASE 6-10)**
- UI/UX import flow
- Project activation workflow
- Advanced validation
- Comprehensive testing
- Final honesty pass

---

## Next: UI Components

After implementing manifest parsing, we'll need:

1. **ImportModal** - Main import UI
2. **RepoInputForm** - URL/owner/repo entry
3. **DetectionPreview** - Show detected project type
4. **ImportProgress** - Loading state
5. **ImportResult** - Success/failure feedback

These can be added as new components in `src/components/`.

---

## Success Criteria for Phase 4-5

- [ ] Can parse SWIM26 manifest files
- [ ] Can extract scene data from manifest
- [ ] Can identify asset references without importing files
- [ ] Can create ProjectSession with imported data
- [ ] Handles missing/invalid manifest gracefully
- [ ] Clear error messages for unsupported content
- [ ] No accidental code import

---

## Example: SWIM26 Manifest Structure

```json
{
  "version": "1.0.0",
  "type": "swim26.scene-manifest",
  "projectType": "swim26-babylon",
  "authoredBy": "Titan",
  "authoredContent": {
    "sceneInfo": {
      "name": "Ocean Scene",
      "description": "A scenic ocean environment",
      "version": "1.0.0"
    },
    "objects": [
      {
        "id": "obj-1",
        "name": "Ocean Floor",
        "assetRef": {
          "type": "url",
          "value": "assets/models/ocean-floor.glb"
        },
        "transform": {
          "position": [0, -10, 0],
          "rotation": [0, 0, 0],
          "scale": [1, 1, 1]
        },
        "tags": ["background", "static"],
        "metadata": {
          "receiveShadow": true
        }
      }
    ],
    "environment": {
      "skybox": "pool-competition",
      "fog": {
        "enabled": true,
        "density": 0.01
      }
    },
    "paths": [
      {
        "id": "path-1",
        "name": "Camera Path",
        "type": "camera",
        "points": [
          { "position": [0, 5, 20] },
          { "position": [10, 5, 15] }
        ]
      }
    ]
  },
  "runtimeOwned": [
    "gameplay systems",
    "event bindings"
  ],
  "unsupported": [
    "procedural generation"
  ]
}
```

This is what we parse and import into Titan's ProjectSession.

---

## Next Steps

→ Continue to implement manifest parsing and scene data loading
→ Then move to UI/UX flow (PHASE 7)
→ Then validation and testing (PHASE 8-9)

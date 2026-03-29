# PHASE 1 — GITHUB IMPORT AUDIT
## What Titan Should/Should Not Import from SWIM26 GitHub Repos

**Core Question:** What exact subset of a SWIM26 GitHub repo can Titan safely and usefully ingest without becoming a code editor or breaking project boundaries?

---

## 1. WHAT TITAN SHOULD IMPORT

### Repository Metadata
- **Owner/Repo**: Public GitHub repo identification
- **Branch**: Target branch for import (default: main/master or first available)
- **Optional subpath**: Support imports from subdirectories (e.g., `games/project-x`)

### Project Markers & Detection Signals
Files that indicate a SWIM26/Babylon project:
- `swim26.config.json` - SWIM26 project configuration
- `babylon.config.json` - Babylon runtime configuration
- `swim26.manifest.json` - SWIM26 scene manifest
- `package.json` with dependencies: `babylonjs`, `@babylonjs/core`, or `swim26`
- Asset folders: `assets/`, `public/`, `scenes/`

### Supported Project Data
**Safe for import (Titan-authored domain):**
- **Project metadata** from manifest files:
  - Scene name, description, version
  - Environment/camera/path data (where stored in manifest)
  - Asset references and metadata
  - Scene structure and object hierarchy
  - Tagged metadata (collision zones, prefabs, paths)

- **Supported scene files**:
  - SWIM26 manifest exports (`.swim26.manifest.json`)
  - Babylon scene files (`.babylon` or `.babylon.scene`)
  - Asset reference lists
  - Environment preset references

- **Asset metadata**:
  - Asset names, paths, and references
  - Asset type hints (model, texture, environment)
  - Material/texture associations
  - Only file paths, NOT the actual asset files from repo

- **Optional human-authored data**:
  - Scene name and description
  - Author/project metadata if present
  - Camera preset definitions (if stored in manifest/config)
  - Path definitions for camera/object movement

### Authentication & Access
- **Public repos**: Full read access via GitHub API/raw content URLs
- **Future private repos**: Would require GitHub token (not in this phase)
- **No write access**: Import is read-only from browser

---

## 2. WHAT TITAN MUST NOT IMPORT/EDIT

### Code & Runtime Systems (SWIM26/Babylon Owned)
- **Game logic code**: `*.ts`, `*.js`, `*.tsx` gameplay implementations
- **Runtime bootstrap**: Babylon engine startup code, game loop initialization
- **Networking/state logic**: Multiplayer systems, game state orchestration
- **Event handlers**: Runtime event binding and execution
- **Script execution environment**: Runtime-side script compilation/binding
- **Gameplay systems**: Movement, collision response, game rules

### Source/Development Files (Not Builder Data)
- `.ts`, `.tsx`, `.js` source code (except pure data)
- `.webpack.config.js`, `vite.config.ts`, build configuration
- `.eslintrc`, `.prettier`, linting/formatting config
- `node_modules/` and dependencies
- Build artifacts (`dist/`, `build/`)
- CI/CD workflows (`.github/workflows/`)

### Private/Sensitive Content
- `.env`, `.env.local` environment variables
- API keys, secrets, credentials
- Personal/private game data
- Unpublished assets
- License/copyright content not marked for import

### Unsupported Babylon/Runtime Features
- Procedural geometry generation code
- Babylon-specific physics integrations (not describable in manifest)
- Advanced shader code or custom materials (unless pre-baked)
- Runtime-side performance optimizations
- Engine-specific initialization parameters

---

## 3. SWIM26 REPO DETECTION SIGNALS

A repo is SWIM26/Babylon if it has ANY of:

### Marker Files (Highest Confidence)
- `swim26.config.json` ← SWIM26 project definition
- `babylon.config.json` ← Babylon game project
- `swim26.manifest.json` ← SWIM26 scene data

### Package Dependency Signals
- `babylonjs` in npm dependencies
- `@babylonjs/core` in npm dependencies
- `swim26` in npm dependencies

### Project Hint Signals
- README mentions "SWIM26" or "Babylon.js"
- Folder structure: `/src/scenes/`, `/assets/models/`, `/games/`
- GitHub topics include "babylon" or "swim26"

### Explicit Profile Hint (if provided by user)
- User specifies: "This is a SWIM26 Babylon project"

---

## 4. SUPPORTED FILE INGESTION & SCOPE

### First-Phase Safe Import Scope

**Rank 1 - Always Safe:**
1. `swim26.manifest.json` - Primary scene data
2. `babylon.config.json` - Runtime configuration hints
3. `swim26.config.json` - Project-level settings
4. `package.json` - Dependency/project name only
5. README.md - Project description metadata only

**Rank 2 - Safe if Present:**
6. Asset metadata files (if stored separately from assets)
7. Camera preset definitions (if in config/manifest)
8. Path/movement definitions (if in manifest)
9. Environment preset selections
10. Collision zone definitions (if in manifest)

**Rank 3 - Boundary Check Before Import:**
11. Scene `.babylon` or `.babylon.scene` files - inspect first
12. Custom manifest variants - validate against SWIM26 contract
13. Babylon-exported scene data - ensure no embedded code

**Rank 4 - Explicitly Blocked:**
- Any `.ts`, `.js`, `.tsx` files
- Build config files
- Runtime bootstrap/initialization code
- Procedural/algorithmic scene generation

### What Files Remain Runtime-Owned

After import, these areas stay under SWIM26/Babylon runtime control:
- Gameplay code and logic
- Runtime initialization
- Event bindings and handlers
- Physics/collision response code
- Networking and state management
- Babylon-specific rendering parameters

---

## 5. BROWSER VS. SERVER-SIDE BEHAVIOR

### Browser-Only (No Backend Required for MVP)

**What we CAN do in browser:**
1. **Parse repo URL**: `https://github.com/owner/repo` → owner/repo
2. **Fetch from GitHub API** (public repos):
   - Raw content API: `/repos/{owner}/{repo}/contents/{path}`
   - No authentication required for public repos
3. **Parse manifest/config files**: JSON parsing, validation
4. **Detect project type**: Marker file checks, dependency scanning
5. **Build project session**: In-memory session creation
6. **UI preview**: Show detected project, ask for confirmation

### Backend Help (Future, Out of Scope This Phase)
- Private repo access (would need GitHub token management)
- OAuth GitHub account linking
- Token refresh and secure storage
- Rate limiting protection
- Large file streaming

---

## 6. PRIVATE/PUBLIC REPO ACCESS MODEL

### Phase 1 - PUBLIC REPOS ONLY

**Supported:**
- Any public GitHub repo with SWIM26 markers
- Full read access via GitHub raw content API
- No authentication required
- Rate limited by GitHub (60 req/hour unauthenticated, higher authenticated)

**Not Supported Yet (Deferred):**
- Private repos (requires GitHub token)
- OAuth account linking
- Token-based authenticated access
- User's own private repos
- Organization-private repos

**Honest UI Language:**
```
"GitHub Import (Public Repos Only)

This phase supports importing from public GitHub repositories.
Private repo support is coming in a future update."
```

---

## 7. FIRST SAFE IMPORT SCOPE FOR MVP

### Minimal Viable Scope

1. **Input**: GitHub repo URL or owner/repo name
2. **Fetch**: README.md, package.json, `swim26.manifest.json` (if exists)
3. **Detect**: Is this SWIM26? Use existing profile detection logic
4. **Validate**: Required files present, manifest format valid
5. **Load Session**: Create ProjectSession with detected profile/adapter/bridge
6. **Activate UI**: Open correct Titan workflow (SWIM26 or Generic)
7. **Display Source**: Show imported-from URL and branch for transparency

### Files We MUST Access

- `package.json` - for dependency detection
- `swim26.manifest.json` OR `babylon.config.json` - for scene/project data
- `README.md` - for human context (optional)
- `.github/` metadata - for project signals (optional)

### Files We DO NOT NEED

- Source code files
- Build/config files (except package.json)
- Asset files themselves (only paths)
- Babylon runtime files
- Game logic or scripts

---

## 8. GITHUB AUTH/ACCESS NEEDS FOR PHASE 1

### What We Need
1. **Public repo read access** - via GitHub raw content API
2. **No authentication** - works as-is for public repos
3. **Rate limiting awareness** - handle 60 req/hour limit gracefully
4. **Error recovery** - clear messages when rate limited or repo not found

### What We Don't Need (Yet)
- GitHub API tokens
- OAuth flow
- Secure token storage
- Private repo access
- User account linking
- Workspace/organization scoping

### Rate Limiting Strategy
- Cache manifest data where possible
- Batch file requests
- Graceful degradation if rate limited
- Tell user: "Rate limited. Try again in a few minutes or use authenticated access (coming soon)."

---

## 9. EXPECTED USER FLOW (Happy Path)

```
1. User: "Import from GitHub"
   ↓
2. UI: "Enter repo URL or owner/repo"
   User enters: "babylonjs/Playground" or "https://github.com/babylonjs/Playground"
   ↓
3. System: Fetch repo metadata
   - Detect: Is SWIM26? Check markers, dependencies
   - Result: "SWIM26 Babylon Game" (high confidence) or "Babylon Project" or "Unknown"
   ↓
4. UI: Show detection result + import preview
   - Project name (from manifest or package.json)
   - Detected profile (SWIM26 vs Generic)
   - What will be imported (scene data, assets)
   - What is NOT imported (code, runtime systems)
   ↓
5. User: Confirm import
   ↓
6. System: Create ProjectSession with detected profile/adapter/bridge
   ↓
7. UI: Open correct Titan workflow (SWIM26 or Generic)
   - Load scene data
   - Expose correct capabilities
   - Show imported-from indicator
   ↓
8. User: Can now edit scene in Titan
   - Can see: "Imported from [repo/branch]"
   - Can export back to SWIM26 manifest
```

---

## 10. ERROR CASES & GRACEFUL FALLBACK

### Blocking Errors (Cannot Recover)
- **Invalid URL**: "Please enter a valid GitHub repository URL"
- **Repo not found**: "Repository does not exist or is private"
- **Rate limited**: "GitHub rate limit reached. Try again in a few minutes"
- **No manifest found**: If profile detection confidence is low

### Recoverable Cases (Fallback Available)
- **No SWIM26 markers**: → Fall back to Generic Titan profile
- **Incomplete manifest**: → Import what's available, flag missing data
- **Unknown project type**: → Ask user to select profile (guided recovery)
- **Missing asset references**: → Import scene structure, note missing assets

### User Guidance Text
```
"This doesn't look like a SWIM26 project.

Would you like to:
1. Open it as a Generic Titan Scene (basic model support)
2. Try a different repo
3. Manually specify the project type"
```

---

## SUMMARY: Import/No-Import Boundaries

| Category | Import | Don't Import | Notes |
|----------|--------|--------------|-------|
| **Project Metadata** | ✅ Yes | | Name, description, version |
| **Scene Manifest** | ✅ Yes | | swim26.manifest.json, scene structure |
| **Asset Paths** | ✅ Yes | ❌ Not files | Only file paths and metadata |
| **Environment/Camera** | ✅ Yes | | Presets and configurations |
| **Collision/Tags** | ✅ Yes | | Metadata from manifest |
| **Code** | ❌ No | ✅ Excluded | All .ts, .js, .tsx |
| **Runtime Boot** | ❌ No | ✅ Excluded | Bootstrap, event handlers |
| **Gameplay Logic** | ❌ No | ✅ Excluded | Game rules, AI, networking |
| **Build Config** | ❌ No | ✅ Excluded | webpack, vite, tsconfig |
| **Secrets/Keys** | ❌ No | ✅ Excluded | .env, credentials |
| **Dependencies** | ✅ Detection only | ❌ Not install | Read package.json, don't npm install |

---

## RECOMMENDATIONS FOR PHASE 1 MVP

1. **Start with public repos only** - no auth complexity
2. **Reuse existing profile detection** - don't duplicate logic
3. **Fetch minimal files**: package.json + swim26.manifest.json + README.md
4. **Pre-validate manifest** against known SWIM26 contract
5. **Show transparent UI** about what's imported vs. not
6. **Handle failures gracefully** - fallback to generic profile
7. **Document URL/branch** in project metadata for transparency
8. **Defer OAuth** and token-based access to future phase
9. **Mock GitHub connector** for testing without live API calls
10. **Validate boundaries** - refuse .ts/.js file imports with clear error

---

## NEXT STEPS

→ Move to **PHASE 2: GitHub Connector Architecture**

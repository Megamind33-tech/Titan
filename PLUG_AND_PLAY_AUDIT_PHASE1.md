# Titan Plug-and-Play Audit (Phase 1)

## What currently prevented plug-and-play

1. **Manual runtime assumptions leaked into core flows**
   - Runtime/project intent was previously inferred informally and not encoded in a strict adapter contract.
   - Export and loading behavior could drift from project intent because there was no single source of truth for runtime contract selection.

2. **Project selection had no explicit guided fallback path**
   - Automatic detection existed, but low-confidence fallback had no clear guided selection contract for callers.
   - This forced integrators to know hidden hints or URL tricks instead of following an explicit “pick project type” flow.

3. **Bridge selection was represented as IDs, not executable contracts**
   - A bridge string alone does not enforce capabilities, expected runtime, or supported scene contract.
   - Without bridge-level validation, mismatch risk remains when adding future project types.

4. **SWIM26 support contract was implicit**
   - Adapter metadata declared runtime and formats, but not a typed “Titan-authored vs runtime-owned” authoring boundary.
   - This risks future contributors overextending Titan responsibilities into SWIM26 runtime code.

5. **Project metadata persistence did not enforce safe recovery behavior**
   - Saved metadata exists, but there was no central activation orchestration that reports low-confidence detection and guided choices as first-class outcomes.

## What should be automatic

- Detect likely project type from marker files/dependencies/hints.
- Validate profile/adapter/runtime/scene-contract compatibility before activation.
- Resolve the correct bridge implementation (not just an id string).
- Surface a guided selection contract when confidence is low.
- Keep SWIM26 runtime-owned areas explicit and non-authorable by Titan.

## What should be adapter-driven

- Runtime contract + bridge contract
- Import/export capability exposure
- Authoring scope and unsupported runtime-owned areas
- Editor capability gating and safe fallback behavior

# Phase 2 Round-Trip Identity Contract (Titan ↔ SWIM26)

## Stable identity key

- **Primary key for authored sync:** `authoredId`.
- `authoredId` is exported by Titan (`Swim26ManifestService`) and consumed by importer/runtime sync (`Swim26ManifestImporter`, `Swim26RoundTripSync`).
- This key is used for **create/update/deactivate reconciliation** across repeated import cycles.

## IDs that are NOT sync keys

- Editor/runtime mesh instance IDs (`model.id`, Babylon mesh `id`) are transient and must not be used as round-trip identity.
- Runtime/gameplay IDs and runtime-owned metadata are out of sync scope.

## Scope by content type

- **Authored nodes:** in scope, reconciled by `authoredId`.
- **Parented nodes:** in scope if represented in authored metadata and tied to `authoredId`.
- **Prefab instances:** only their authored scene projection is in scope; runtime prefab logic remains out of scope.
- **Paths:** authored IDs are exported/imported where available.
- **Collision/zone items:** only authored scene subset if represented in supported manifest content.
- **Hierarchy drift:** parent authored-ID mismatches are diagnosed; full hierarchy repair is not guaranteed in this phase.

## Incremental update policy

For each incoming authored node by `authoredId`:

1. **Not found in scene:** create.
2. **Found in scene with authoredId:** update supported authored fields (transform/material hints/asset refs/tags/metadata).
3. **Unchanged supported fields:** skip and report.
4. **Previously imported authoredId missing from new manifest:** deactivate stale authored mesh (do not delete).
5. **Duplicate authoredId in incoming manifest:** keep first, skip later duplicates, report conflict.

## Runtime-owned boundary

- Meshes without `metadata.authoredId` are treated as runtime-owned and are not overwritten by authored sync.
- Runtime-injected metadata is preserved during authored updates.

## Diagnostics contract

Each sync operation reports:

- added/updated/deactivated/skipped counts
- duplicate authored ID conflicts
- machine-readable diagnostic codes

This contract is intentionally limited to the supported authored subset and does not imply full two-way runtime editing.

# GitHub Private Import Scope (Phase 5)

This document defines exactly what Titan supports for private GitHub repository imports in this phase.

## Supported now

- Public repository import (no token required).
- Private repository import via **Personal Access Token (PAT)** passed at import time.
- Token-authenticated metadata/list/file reads through `GitHubConnector`.
- Auth failure classification for:
  - missing auth/private repo access required
  - invalid token
  - insufficient repository scope
  - organization SSO authorization required
  - rate limit

## Security and token handling

- Token is entered in the GitHub import modal as a password field.
- Token is used only for the current import attempt (prepare/import request path).
- Token is **not** persisted into project session payloads or export artifacts.
- Token is not included in connector error contexts.

## Import boundaries (preserved)

Titan imports only builder-relevant supported files (manifest/config/package
metadata and similar scene-import inputs). Titan intentionally does **not**
import gameplay scripts, runtime boot code, networking/state logic, or other
arbitrary source files outside builder scope.

## Not supported in this phase

- OAuth device flow / account linking.
- GitHub App installation auth.
- Token lifecycle management (refresh/rotation workflows).

## UX expectations

- Public import path remains unchanged.
- Private import reuses the same prepare/import/activation path as public import once access succeeds.
- Auth errors are presented with recovery-oriented messages instead of raw connector enum text.
- Repo input, branch, and folder path remain available across auth failures so users can retry without rebuilding context.

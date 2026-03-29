# Titan — Private GitHub Repository Access Model

## First supported private access model

Titan uses a **fine-grained Personal Access Token (PAT)** as its first and
only supported private repository access model.

Fine-grained PATs are GitHub's current recommended token type. They support
explicit per-repository or per-organization scope and are compatible with the
`Bearer` Authorization header, which is required by the GitHub REST API for
fine-grained tokens.

Classic PATs (the older token format) are also accepted technically, but they
are not recommended because they carry broader default permissions and are
harder to scope tightly.

## Minimum required permissions

For private repository import, the fine-grained PAT must have **read-only**
access to the target repository:

- **Repository contents** — read (required to fetch manifest and config files)
- **Repository metadata** — read (required to resolve default branch and
  determine whether the repo is private)

No write permissions are needed or should be granted.

## How the token is used

- The token is passed at import time by the user.
- It is used only for the duration of the current import attempt
  (prepare/import request path).
- It is sent via the `Authorization: Bearer <token>` request header on
  GitHub API and raw content requests.
- It is **not** persisted into project session payloads, export artifacts,
  import history, or any other durable storage.
- It is **not** included in connector error messages, error context objects,
  logs, or debug output.

## Organization and SAML SSO caveats

For private repositories belonging to a GitHub organization that enforces
SAML SSO, a classic PAT must be explicitly authorized for that organization
via GitHub's SSO authorization flow before it can access organization
resources. Fine-grained PATs issued through the organization's app
authorization flow satisfy this automatically.

When Titan detects a `403` response with an `x-github-sso: required` header,
it returns a `SSO_AUTH_REQUIRED` error with a recovery message directing the
user to complete SSO authorization in GitHub.

## Deferred auth modes

The following are explicitly out of scope for this phase and must not be
claimed as supported:

| Mode | Status |
|---|---|
| OAuth device flow / account linking | Deferred |
| GitHub App installation auth | Deferred |
| Token refresh / rotation lifecycle | Deferred |
| Org-scoped fine-grained PAT provisioning UI | Deferred |

## Auth failure classification

The connector classifies GitHub auth failures into distinct, actionable error
types:

| Error type | HTTP condition | Description |
|---|---|---|
| `PRIVATE_REPO_AUTH_REQUIRED` | 404 without token, or private=true without token | Repo is private and no auth was provided |
| `INVALID_TOKEN` | 401 with token | Token is invalid or expired |
| `UNAUTHORIZED` | 401 without token | Auth required but no token supplied |
| `INSUFFICIENT_SCOPE` | 403 + "resource not accessible" message | Token lacks required repository read scope |
| `SSO_AUTH_REQUIRED` | 403 + `x-github-sso: required` header | Org SSO authorization is required for the token |
| `RATE_LIMITED` | 429, or 403 + rate limit message, or `x-ratelimit-remaining: 0` | API rate limit exceeded |
| `REPO_NOT_FOUND` | 404 without distinguishable private signal | Repository does not exist |

## Public repo access

Public repositories do not require a token. The public import path is
additive — providing a token enhances rate limits and enables private access,
but is never required for public repos.

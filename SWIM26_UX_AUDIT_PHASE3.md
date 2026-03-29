# SWIM26 UX Audit (Phase 3)

## What already feels first-class
- SWIM26 appears as an explicit project type in guided selection.
- Adapter/profile/bridge activation can be restored from session metadata.
- Export flow can be filtered by active adapter.

## What still felt generic before this phase
1. SWIM26 session identity was not explicit enough in the always-visible project header.
2. Some controls remained visible even when capabilities made them irrelevant (plugin tab, inspector tab transitions, environment import action).
3. Recovery notices were too terse and did not clearly tell users to re-confirm setup.
4. Export still looked mostly generic; SWIM26 handoff target was not a native selectable export format.

## Where users still had to interpret too much
- Understanding why SWIM26 manifest export was different from generic GLB/OBJ paths.
- Figuring out what adapter/bridge was active without a clear always-visible summary.

## UX target for this phase
For SWIM26 users, Titan should read like “you are in SWIM26 mode” with clear runtime/bridge identity, relevant controls, and a native SWIM26 export target in the same export modal used for normal workflow.

## Where SWIM26 flow was hidden behind generic UI
- Export modal treated SWIM26 like a side-case instead of leading with the runtime handoff target.
- Session status used technical labels that made project type/routing harder to read quickly.

## Where capability gating was too shallow
- Top-level tabs were partially gated, but some action paths were still reachable (plugin tab affordance, material replacement controls).
- Gating was not consistently reinforced through real action points where users click.

## Where export still did not feel native enough
- SWIM26 manifest existed in backend logic but needed stronger UI presentation as the recommended default.
- Export recommendation needed to reflect both adapter and bridge contract, not adapter in isolation.

## Blunt product answer to the core question
Before this pass, SWIM26 users could complete tasks, but Titan still felt like a generic scene tool with SWIM26 bolted on. The product needed stronger “you are in SWIM26 mode” cues, stricter capability-aware actions, and a plainly native SWIM26 runtime export path.

## Hidden assumptions to keep watching
- Export policy must keep using adapter + bridge intersection; adapter-only checks will drift and expose wrong targets later.
- Recovery UX should avoid leaking raw technical failure strings into user-facing banners.
- E2E checks should stay grounded in visible user outcomes (selected export value, visible guidance), not implementation IDs.

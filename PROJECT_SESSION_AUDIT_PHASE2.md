# Project Session Audit (Phase 2)

## What currently prevented a true session-first workflow

1. **No first-class project session object in runtime state**
   - Project identity, profile, adapter, and bridge were computed but not represented as a durable session model with project identity.

2. **No-project startup still felt like a technical default**
   - Titan could load generic defaults silently, but users were not guided through “Create project” vs “Open project”.

3. **Restore behavior focused on scene data, not project lifecycle**
   - Scene restoration existed, but project session recovery and invalid-session recovery paths were not explicit.

4. **Project selection still had hidden mechanics**
   - Detection hints existed in code, but UX-level guided choices were not surfaced in a first-run flow.

5. **UI surfaces still exposed irrelevant capabilities**
   - Tabs/actions could remain visible even when adapter capabilities did not support them.

6. **Export context wasn’t communicated as a project recommendation**
   - Format availability was partly filtered, but recommended format by active profile wasn’t clearly surfaced.

## Key blocker statement

Titan still did not fully feel plug-and-play because users could enter the editor without a clear session context, without guided project setup language, and without consistently capability-gated UI feedback tied to an explicit project session lifecycle.

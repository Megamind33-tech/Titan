# PHASE 7: Full UI/UX Integration Plan

## Objectives

1. Integrate GitHub import into main Titan menu/workflows
2. Add keyboard shortcuts (Ctrl+I / Cmd+I for import)
3. Implement URL history for quick re-imports
4. Add recent imports tracking
5. Create menu-based access (not just Sidebar button)

## Architecture

### New Components to Create

1. **MenuBar** (`src/components/MenuBar.tsx`)
   - File menu with project operations
   - Edit, View menus (prepare for future)
   - Help menu

2. **ProjectMenu** (within MenuBar)
   - New Project
   - Open Project
   - Import from GitHub ← NEW
   - Recent Projects ← Enhanced
   - Export Scene

3. **URL History Service** (`src/services/ImportHistoryService.ts`)
   - Track GitHub URLs imported
   - Store in localStorage
   - Provide suggestions/history

### Implementation Plan

#### Step 1: Create MenuBar Component
- File menu with standard items
- Import from GitHub menu item
- Keyboard shortcuts display
- Styling to match Titan UI

#### Step 2: Add Keyboard Shortcut Support
- Ctrl+I (or Cmd+I on Mac) opens import modal
- useEffect hook in App to listen for keyboard events
- Show hint in menu

#### Step 3: Create URL History Service
- Save GitHub URLs to localStorage
- Return sorted list of recent imports
- Max 10 recent URLs
- Clear history function

#### Step 4: Enhance Import Modal
- Auto-fill with recent URLs
- Suggestions dropdown
- Clear history button

#### Step 5: Recent Imports List
- Track imported projects
- Show in menu
- Quick access to reload previous imports
- Display project metadata

#### Step 6: Integrate with App
- Wire menu callbacks to modal open
- Keyboard shortcut handling
- History persistence
- Recent projects display

## User Workflows

### Workflow 1: First-Time Import
```
Click "File" → "Import from GitHub"
  ↓
Enter repo URL
  ↓
Click import
  ↓
Project loads
```

### Workflow 2: Quick Re-Import
```
Keyboard: Ctrl+I
  ↓
Modal opens with recent URLs
  ↓
Click recent URL
  ↓
Quick import
```

### Workflow 3: Recent Projects
```
Click "File" → "Recent Projects"
  ↓
See list of recently imported projects
  ↓
Click to reload
  ↓
Project restored from localStorage
```

## Files to Create

1. `src/components/MenuBar.tsx` - Main menu bar
2. `src/services/ImportHistoryService.ts` - URL history tracking
3. `src/services/RecentProjectsService.ts` - Project history

## Files to Modify

1. `src/App.tsx` - Menu integration, keyboard shortcuts
2. `src/components/GitHubImportModal.tsx` - Suggestions, history UI
3. `src/Sidebar.tsx` - Keep existing button (for quick access)

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+I / Cmd+I | Open GitHub import modal |
| Ctrl+E / Cmd+E | Open export (existing) |
| Ctrl+Z / Cmd+Z | Undo (existing) |
| Ctrl+Y / Cmd+Y | Redo (existing) |

## UI Layout

```
┌─ File ─────────────────────────┐
│ New Project          [Ctrl+N]   │
│ Open Project         [Ctrl+O]   │
│ ─────────────────────────────── │
│ Import from GitHub   [Ctrl+I]   │ ← NEW
│ ─────────────────────────────── │
│ Recent Projects                 │ ← Enhanced
│   • babylon-playground (3d)     │
│   • swim26-demo (babylon)       │
│   • my-game (babylon)           │
│ ─────────────────────────────── │
│ Export Scene         [Ctrl+E]   │
│ ─────────────────────────────── │
│ Exit                            │
└─────────────────────────────────┘
```

## Implementation Order

1. Create MenuBar component with File menu
2. Add keyboard shortcut handling in App
3. Create URL history service
4. Enhance GitHubImportModal with suggestions
5. Create recent projects service
6. Integrate all pieces
7. Test workflows
8. Add documentation

## Success Criteria

- ✓ MenuBar component renders correctly
- ✓ Ctrl+I opens import modal
- ✓ Recent URLs shown in suggestions
- ✓ Recent projects list works
- ✓ All keyboard shortcuts functional
- ✓ History persists across sessions
- ✓ No breaking changes to existing functionality
- ✓ UI matches Titan design language

## Timeline Estimate

- Create components: 1-2 hours
- Add services: 1 hour
- Integration: 1-2 hours
- Testing: 1 hour
- **Total: 4-6 hours**

## Notes

- Keep existing Sidebar button for quick access
- Menu should be minimalist, matching Titan style
- History stored in localStorage (max 10 items)
- Keyboard shortcuts should be discoverable in UI
- Recent projects should include project metadata

## Why

The teacher settings page at `/teacher/dashboard/settings` currently has some UX issues: the auto-save toggle exists in the interface settings section but is not functional, the save button is disabled when no changes are made, there's no success feedback after saving, and users are not navigated back to the dashboard after saving. This creates a confusing user experience.

## What Changes

1. Remove the "自动保存" (auto-save) toggle from the interface settings section
2. Make the "保存设置" (Save Settings) button always enabled (remove disabled state)
3. Add success message display after clicking save button
4. Add navigation back to teacher dashboard after successful save
5. Remove the `hasChanges` state as it's no longer needed for button enabling

## Capabilities

### New Capabilities
- `teacher-settings-manual-save`: Manual save workflow for teacher settings page with success feedback and navigation

### Modified Capabilities
- None - this is a UI/UX enhancement without backend changes

## Impact

- **Code**: Modify `src/pages/teacher/settings.tsx`
- **Dependencies**: Uses existing `useNavigate` from react-router-dom, existing Ant Design components (Button, message)
- **Routes**: No route changes, settings page remains at `/teacher/dashboard/settings`

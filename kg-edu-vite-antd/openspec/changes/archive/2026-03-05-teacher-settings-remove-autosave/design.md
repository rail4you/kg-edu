## Context

The teacher settings page (`src/pages/teacher/settings.tsx`) has UX issues:
- The auto-save toggle exists in the interface settings but is non-functional
- Save button is disabled when no changes are made, confusing users
- No feedback is shown after saving
- No navigation back to dashboard after saving

The component uses React state for settings management, Ant Design for UI components, and react-router-dom for navigation.

## Goals / Non-Goals

**Goals:**
- Remove non-functional auto-save toggle from UI
- Enable save button always
- Show success message after save
- Navigate to dashboard after save

**Non-Goals:**
- No backend API changes for settings persistence (console.log only)
- No other settings page modifications
- No changes to other user role settings pages

## Decisions

1. **Remove auto-save toggle**: Delete the `renderSettingItem` call for `autoSave` setting in the interface settings card.

2. **Enable save button always**: Remove `disabled={!hasChanges}` prop from the save button. Keep `hasChanges` state only if needed for reset button logic.

3. **Success message**: Use Ant Design's `message.success()` API which is already available in the codebase (used in other pages).

4. **Navigation**: Use existing `useNavigate` hook from react-router-dom to navigate to `/teacher/dashboard` after save.

## Risks / Trade-offs

- [Low Risk] The settings are currently logged to console only - this change doesn't add backend persistence, which is acceptable for this UI-focused task.
- [Trade-off] Users must manually save each time - but this is the intended behavior per requirements.

## ADDED Requirements

### Requirement: Teacher settings manual save
The system SHALL provide a manual save workflow for teacher settings page that enables save button always, shows success feedback, and navigates back to dashboard.

#### Scenario: Save button always enabled
- **WHEN** teacher navigates to settings page at `/teacher/dashboard/settings`
- **THEN** the save button is always enabled (not disabled)

#### Scenario: Save shows success message
- **WHEN** teacher clicks "保存设置" (Save Settings) button
- **THEN** system displays success message "保存成功"

#### Scenario: Navigate to dashboard after save
- **WHEN** teacher successfully saves settings
- **THEN** system navigates to `/teacher/dashboard`

#### Scenario: Auto-save toggle removed
- **WHEN** teacher views the interface settings section
- **THEN** the auto-save toggle is no longer displayed

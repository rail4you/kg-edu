## ADDED Requirements

### Requirement: User can cancel video upload
The system SHALL allow users to cancel an in-progress video upload by clicking a cancel button.

#### Scenario: Cancel during upload
- **WHEN** user clicks "Cancel" button while upload is in progress
- **THEN** the upload request is aborted
- **AND** upload progress stops
- **AND** status shows "Upload cancelled"

#### Scenario: UI state after cancellation
- **WHEN** upload has been cancelled
- **THEN** cancel button is disabled or hidden
- **AND** user can select a new file and start a new upload

#### Scenario: No cancel when not uploading
- **WHEN** user is not currently uploading a video
- **THEN** cancel button is not visible or is disabled

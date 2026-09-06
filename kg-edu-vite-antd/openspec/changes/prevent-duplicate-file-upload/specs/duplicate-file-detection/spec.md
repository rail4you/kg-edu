## ADDED Requirements

### Requirement: Detect duplicate filenames before upload
The system SHALL detect when selected files have the same filename as existing uploaded files in the same course before initiating the upload process.

#### Scenario: No duplicate files
- **WHEN** user selects files for upload and no files have the same filename as existing files in the course
- **THEN** system proceeds with normal upload without any duplicate warning

#### Scenario: Duplicate files detected
- **WHEN** user selects files for upload and at least one file has the same filename as an existing file in the course
- **THEN** system displays a confirmation modal listing all duplicate filenames
- **AND** system allows user to choose between "Skip duplicates" or "Upload anyway (overwrite)"

### Requirement: Skip duplicate files option
When user chooses to skip duplicates, the system SHALL exclude duplicate files from the upload queue and only upload non-duplicate files.

#### Scenario: User skips duplicates
- **WHEN** user selects "Skip duplicates" in the confirmation modal
- **THEN** system removes duplicate files from the upload queue
- **AND** system uploads only the non-duplicate files
- **AND** system shows upload progress for remaining files

### Requirement: Overwrite duplicate files option
When user chooses to upload anyway, the system SHALL proceed with uploading all selected files, overwriting existing files with the same name.

#### Scenario: User chooses to overwrite
- **WHEN** user selects "Upload anyway (overwrite)" in the confirmation modal
- **THEN** system uploads all selected files, replacing any existing files with the same filename
- **AND** system shows upload progress for all files

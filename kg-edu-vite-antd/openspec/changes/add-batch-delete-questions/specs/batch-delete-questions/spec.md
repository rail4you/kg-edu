## ADDED Requirements

### Requirement: Batch delete questions
The system SHALL allow teachers to select multiple questions and delete them in batch from the question management page.

#### Scenario: Batch delete button visibility
- **WHEN** no rows are selected in the question table
- **THEN** the batch delete button SHALL NOT be visible

#### Scenario: Batch delete button appears when rows selected
- **WHEN** user selects one or more rows in the question table
- **THEN** a batch delete button SHALL appear showing the number of selected questions

#### Scenario: Confirmation modal shows selected count
- **WHEN** user clicks the batch delete button
- **THEN** a confirmation modal SHALL open displaying the exact count of questions to be deleted

#### Scenario: Cancel batch delete
- **WHEN** user clicks "Cancel" in the confirmation modal
- **THEN** the modal SHALL close and no questions SHALL be deleted

#### Scenario: Confirm batch delete
- **WHEN** user clicks "Confirm" in the confirmation modal
- **THEN** the system SHALL delete all selected questions sequentially

#### Scenario: Batch delete success
- **WHEN** all selected questions are deleted successfully
- **THEN** a success message SHALL be displayed and the table SHALL refresh

#### Scenario: Batch delete partial failure
- **WHEN** some questions fail to delete (e.g., due to permission or network error)
- **THEN** the system SHALL display a warning message indicating how many succeeded and how many failed

#### Scenario: Selection cleared after deletion
- **WHEN** batch delete completes (success or partial failure)
- **THEN** all row selections SHALL be cleared

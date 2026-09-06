## ADDED Requirements

### Requirement: Exercise hover preview
The system SHALL display a preview popover when the user hovers over an exercise card in the linked exercises list.

#### Scenario: Hover over exercise card
- **WHEN** the user hovers the mouse over an exercise card
- **THEN** a popover appears after a short delay (200ms) showing exercise details

#### Scenario: Popover shows exercise content
- **WHEN** the popover is displayed
- **THEN** it shows the exercise title, question type, and if available, the question content, answer, and explanation

#### Scenario: Popover dismisses on mouse leave
- **WHEN** the user moves the mouse away from the exercise card
- **THEN** the popover disappears

#### Scenario: Unlink button remains clickable
- **WHEN** the user hovers over an exercise card with a popover visible
- **THEN** the user can still click the unlink button without the popover interfering

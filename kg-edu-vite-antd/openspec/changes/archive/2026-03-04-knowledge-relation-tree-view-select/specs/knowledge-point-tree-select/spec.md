## ADDED Requirements

### Requirement: Source knowledge point tree selection
The system SHALL allow users to select source knowledge point from a tree view when creating a knowledge relation.

#### Scenario: Open source knowledge tree
- **WHEN** user clicks on source knowledge point selector in the create relation modal
- **THEN** system displays a tree view showing all knowledge points in hierarchical structure

#### Scenario: Search source knowledge point
- **WHEN** user types in the search input within source knowledge tree
- **THEN** system filters tree nodes that match the search text and highlights matching text

#### Scenario: Select source knowledge point
- **WHEN** user clicks on a knowledge point node in the source tree
- **THEN** system sets the selected knowledge point as the source and displays its name

### Requirement: Target knowledge point tree selection
The system SHALL allow users to select target knowledge point from a tree view when creating a knowledge relation.

#### Scenario: Open target knowledge tree
- **WHEN** user clicks on target knowledge point selector in the create relation modal
- **THEN** system displays a tree view showing all knowledge points in hierarchical structure

#### Scenario: Search target knowledge point
- **WHEN** user types in the search input within target knowledge tree
- **THEN** system filters tree nodes that match the search text and highlights matching text

#### Scenario: Select target knowledge point
- **WHEN** user clicks on a knowledge point node in the target tree
- **THEN** system sets the selected knowledge point as the target and displays its name

### Requirement: Tree view consistency with knowledge management
The knowledge point tree view in the relation page SHALL display and sort knowledge points consistently with the knowledge management page.

#### Scenario: Tree data source
- **WHEN** tree view is rendered
- **THEN** system fetches data from `/api/knowledge/hierarchy/nested` API

#### Scenario: Tree node sorting
- **WHEN** tree nodes are displayed
- **THEN** system sorts nodes by their `sortPath` field in ascending order

#### Scenario: Tree hierarchy display
- **WHEN** knowledge points have parent-child relationships
- **THEN** system displays them as nested tree nodes with proper indentation

### Requirement: Course filtering
The tree view SHALL only show knowledge points belonging to the selected course.

#### Scenario: Course selection
- **WHEN** user selects a course
- **THEN** tree view updates to show only knowledge points from that course

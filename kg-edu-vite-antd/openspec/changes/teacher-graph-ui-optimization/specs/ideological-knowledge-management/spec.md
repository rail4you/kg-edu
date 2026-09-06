## ADDED Requirements

### Requirement: Ideological Graph Knowledge Point Management
The ideological (思政) graph SHALL include a knowledge point management module for creating, editing, and deleting knowledge points.

#### Scenario: Access Knowledge Point Management
- **WHEN** user navigates to the ideological graph page
- **THEN** there SHALL be a way to access the knowledge point management interface
- **AND** user CAN view all knowledge points for the selected course

#### Scenario: Create Knowledge Point
- **WHEN** user clicks "Add Knowledge Point" button
- **THEN** a form SHALL appear for entering knowledge point details
- **AND** user CAN enter name, type, description, and importance level
- **AND** upon submission, the knowledge point SHALL be saved

#### Scenario: Edit Knowledge Point
- **WHEN** user clicks on an existing knowledge point
- **THEN** an edit form SHALL appear pre-filled with the current values
- **AND** user CAN modify any field
- **AND** upon submission, the changes SHALL be saved

#### Scenario: Delete Knowledge Point
- **WHEN** user clicks delete on a knowledge point
- **THEN** a confirmation dialog SHALL appear
- **AND** upon confirmation, the knowledge point SHALL be deleted

### Requirement: Relation Types for Ideological Graph
The ideological graph relation types SHALL use the same types defined in the knowledge-relation page.

#### Scenario: Use Shared Relation Types
- **WHEN** user creates or edits a relation in the ideological graph
- **THEN** the available relation types SHALL be fetched from the same endpoint used by /teacher/dashboard/knowledge-relation
- **AND** the relation types SHALL include: 包含关系 (contain), 属序关系 (order), 相关关系 (related)

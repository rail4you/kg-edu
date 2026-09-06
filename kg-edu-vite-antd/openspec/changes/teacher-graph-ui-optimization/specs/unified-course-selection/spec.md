## ADDED Requirements

### Requirement: Unified Course Selection Component
The system SHALL provide a unified course selection component that maintains a single selected course state shared across all four graph types (knowledge graph, tree graph, circle graph, question graph).

#### Scenario: Course Selection Persists Across Tabs
- **WHEN** user selects a course in the course selector
- **THEN** the selected course SHALL be used by all four graph types
- **AND** switching between graph tabs SHALL NOT reset the selected course

#### Scenario: Course Data Loading
- **WHEN** user selects a course
- **THEN** all four graph types SHALL trigger data loading for the selected course
- **AND** each graph SHALL display its own loading state independently

#### Scenario: No Course Selected
- **WHEN** no course is selected
- **THEN** the graphs SHALL display an empty state prompting user to select a course
- **AND** the course selector SHALL be prominently displayed

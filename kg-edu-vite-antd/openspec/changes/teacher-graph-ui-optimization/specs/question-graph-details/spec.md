## ADDED Requirements

### Requirement: Question Graph Detail View
When user clicks on a question node in the question graph, the system SHALL display a detailed view showing the question content and related knowledge points.

#### Scenario: Click Question Node
- **WHEN** user clicks on a question node in the question graph
- **THEN** a drawer SHALL open displaying the question details

#### Scenario: Question Detail Content
- **WHEN** the question detail drawer is displayed
- **THEN** it SHALL show:
  - Question title/content
  - Question type
  - Question difficulty
  - Answer information (if available)

#### Scenario: Related Knowledge Points
- **WHEN** the question detail drawer is displayed
- **THEN** it SHALL display a list of knowledge points associated with this question
- **AND** each knowledge point SHALL show its name and type

#### Scenario: Close Detail Drawer
- **WHEN** user clicks the close button or clicks outside the drawer
- **THEN** the drawer SHALL close
- **AND** the graph view SHALL remain visible

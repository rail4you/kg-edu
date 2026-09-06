## ADDED Requirements

### Requirement: Knowledge Relation Graph Tab Naming
The "知识图谱" tab SHALL be renamed to "知识关系图谱" to better reflect its functionality of displaying knowledge relationships.

#### Scenario: Tab Display
- **WHEN** the graph page is rendered
- **THEN** the first tab SHALL display "知识关系图谱" instead of "知识图谱"

### Requirement: Dynamic Relation Type Filter
The relation type filter options SHALL be dynamically generated based on the actual relation data present in the graph.

#### Scenario: Filter Options from Real Data
- **WHEN** the knowledge relation graph loads data
- **THEN** the relation type filter options SHALL include only the relation types that exist in the loaded data
- **AND** each option SHALL show the relation type name from the data

#### Scenario: Relation Type Color Coding
- **WHEN** relation types are displayed in the graph
- **THEN** each distinct relation type SHALL be rendered with a different color
- **AND** the colors SHALL be visually distinguishable

#### Scenario: Click to Filter by Relation Type
- **WHEN** user clicks on a relation label in the graph
- **THEN** the graph SHALL filter to show only relationships of that type
- **AND** the filter UI SHALL update to reflect the active filter
- **AND** user CAN click again to clear the filter and show all relationships

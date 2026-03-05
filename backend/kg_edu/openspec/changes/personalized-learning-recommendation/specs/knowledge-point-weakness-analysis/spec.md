## ADDED Requirements

### Requirement: Get knowledge point weakness analysis for student
The system SHALL provide an API to analyze and return knowledge point weakness based on student's exercise answers. The analysis SHALL be calculated from student_exam_answers where the answer is marked as incorrect.

#### Scenario: Student requests weakness analysis
- **WHEN** a student calls the API to get knowledge point weakness for a course
- **THEN** the system SHALL return a list of knowledge points with their error rates, sorted by error rate descending

#### Scenario: No exercise data available
- **WHEN** a student has not answered any exercises for a knowledge point
- **THEN** the system SHALL exclude that knowledge point from the weakness analysis

### Requirement: Calculate knowledge point error rate
The system SHALL calculate error rate for each knowledge point using the formula: error_rate = wrong_answers / total_answers. The error rate SHALL be categorized into levels: high (>0.5), medium (0.3-0.5), low (<=0.3).

#### Scenario: Calculate error rate with multiple attempts
- **WHEN** a student has answered the same exercise multiple times
- **THEN** the system SHALL count each attempt separately in the total

#### Scenario: All answers correct
- **WHEN** a student has answered all exercises correctly for a knowledge point
- **THEN** the error rate SHALL be 0 and marked as "掌握良好"

### Requirement: Get class-level knowledge point weakness for teacher
The system SHALL provide teachers with an aggregated view of knowledge point weakness across all students in their course. The aggregation SHALL show the average error rate per knowledge point.

#### Scenario: Teacher requests class weakness analysis
- **WHEN** a teacher calls the API to get class weakness analysis
- **THEN** the system SHALL return knowledge points sorted by average error rate, showing which知识点 most students struggle with

### Requirement: Filter knowledge points by importance level
The system SHALL allow filtering knowledge points by importance level (hard/important/normal) when providing recommendations. Important knowledge points SHALL be prioritized in recommendations.

#### Scenario: Request weakness for important knowledge points only
- **WHEN** teacher requests weakness analysis with importance_level filter set to "important"
- **THEN** the system SHALL return only knowledge points marked as important or hard

## ADDED Requirements

### Requirement: Get personalized learning recommendations
The system SHALL provide an API to return personalized learning recommendations for a student in a specific course. The recommendations SHALL be categorized into three types: pending (待学习), in_progress (进行中), completed (已完成).

#### Scenario: Student requests learning recommendations
- **WHEN** a student calls the API to get learning recommendations for a course
- **THEN** the system SHALL return recommendations in three categories based on the student's learning history

### Requirement: Recommend pending resources based on peer activity
The system SHALL recommend resources that other students in the same course have viewed frequently but the current student has not viewed. The recommendations SHALL be limited to the top N most viewed resources by peers.

#### Scenario: Recommend resources not yet viewed by student
- **WHEN** calculating pending recommendations
- **THEN** the system SHALL identify resources viewed by at least 3 other students in the same course and exclude resources already viewed by the current user

#### Scenario: Insufficient peer data
- **WHEN** there are fewer than 3 other students who have viewed any resources
- **THEN** the system SHALL fall back to recommending important knowledge points' associated resources

### Requirement: Track in-progress resources
The system SHALL identify resources that the current student has viewed but has not marked as completed. These resources SHALL appear in the "in_progress" category.

#### Scenario: Student has viewed resource but not completed
- **WHEN** a student has activity log entries for viewing a resource
- **THEN** that resource SHALL appear in the in_progress category unless marked completed

### Requirement: Return resource metadata in recommendations
The system SHALL return complete metadata for recommended resources including: resource id, name, type (video/file/exercise), knowledge point it belongs to, and importance level.

#### Scenario: Request recommendations with full metadata
- **WHEN** student requests recommendations
- **THEN** each recommendation SHALL include resource name, type, associated knowledge point name, and importance level

### Requirement: Prioritize important knowledge points in recommendations
The system SHALL prioritize resources associated with knowledge points marked as "important" or "hard" importance level when generating recommendations.

#### Scenario: Prioritize important knowledge points
- **WHEN** generating recommendations
- **THEN** resources linked to important/hard knowledge points SHALL appear before normal importance points

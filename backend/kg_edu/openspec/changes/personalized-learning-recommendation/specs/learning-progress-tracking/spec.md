## ADDED Requirements

### Requirement: Mark recommended resource as completed
The system SHALL provide an API for students to mark a recommended resource as completed. Once marked, the resource SHALL move from "in_progress" to "completed" category in subsequent API responses.

#### Scenario: Student marks resource as completed
- **WHEN** a student calls the completion API for a recommended resource
- **THEN** the system SHALL record the completion timestamp and include the resource in the "completed" category

#### Scenario: Mark non-existent recommendation
- **WHEN** a student attempts to mark a resource as completed that was not recommended
- **THEN** the system SHALL return an error indicating the resource is not in the recommendations

### Requirement: Persist learning recommendations
The system SHALL persist learning recommendations in a database table (user_learning_recommendations) to avoid duplicate recommendations and track completion status across sessions.

#### Scenario: Recommendation persistence
- **WHEN** a recommendation is generated for a student
- **THEN** the recommendation SHALL be saved with status (pending/in_progress/completed) and can be retrieved in subsequent requests

### Requirement: Get learning progress summary
The system SHALL provide a summary endpoint that returns the count of resources in each category: pending, in_progress, and completed.

#### Scenario: Request progress summary
- **WHEN** a student requests learning progress summary
- **THEN** the system SHALL return the count of resources in each category

### Requirement: Remove resource from recommendations when completed
The system SHALL ensure that resources marked as completed do not appear in the "pending" recommendations list in subsequent requests.

#### Scenario: Completed resource not in pending list
- **WHEN** a resource is marked as completed
- **THEN** subsequent calls to get pending recommendations SHALL NOT include that resource

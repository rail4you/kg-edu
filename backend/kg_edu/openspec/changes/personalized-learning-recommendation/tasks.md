## 1. Data Model Setup

- [ ] 1.1 Create user_learning_recommendations Ash resource with fields: user_id, course_id, resource_id, resource_type, status (pending/in_progress/completed), completed_at
- [ ] 1.2 Add code_interface definitions for CRUD operations
- [ ] 1.3 Run mix ash.codegen to generate migration
- [ ] 1.4 Run mix ash.migrate to apply migration

## 2. Knowledge Point Weakness Analysis API

- [ ] 2.1 Create knowledge_point_weakness.ex domain module
- [ ] 2.2 Implement calculate_student_weakness function that queries student_exam_answers and calculates error rate per knowledge point
- [ ] 2.3 Implement calculate_class_weakness function for teacher view (aggregated across students)
- [ ] 2.4 Create by_student action in Knowledge.Resource to get student's weakness analysis
- [ ] 2.5 Create by_course action for teachers to get class weakness analysis

## 3. Resource Recommendation API

- [ ] 3.1 Create learning_recommendation.ex domain module
- [ ] 3.2 Implement get_pending_recommendations function - find resources viewed by peers but not by current user
- [ ] 3.3 Implement get_in_progress_recommendations function - find resources user has viewed but not completed
- [ ] 3.4 Implement get_completed_recommendations function - find resources user marked as completed
- [ ] 3.5 Create list_recommendations action in user_learning_recommendations resource

## 4. Learning Progress Tracking API

- [ ] 4.1 Implement mark_completed action in user_learning_recommendations
- [ ] 4.2 Implement get_progress_summary action returning counts per category
- [ ] 4.3 Add validation: only allow marking resources that exist in recommendations

## 5. API Configuration

- [ ] 5.1 Add JSON:API routes for user_learning_recommendations resource
- [ ] 5.2 Add custom routes for weakness analysis endpoints
- [ ] 5.3 Configure proper authorization policies

## 6. Testing

- [ ] 6.1 Write unit tests for weakness calculation functions
- [ ] 6.2 Write unit tests for recommendation logic
- [ ] 6.3 Test API endpoints with mix test

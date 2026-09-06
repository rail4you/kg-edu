## 1. Unified Course Selection

- [x] 1.1 Create GraphCourseContext for shared course state management
- [x] 1.2 Wrap four graph pages with the context provider
- [x] 1.3 Move course selector to page top, above tabs
- [x] 1.4 Update graph components to consume course from context
- [x] 1.5 Add empty state when no course selected

## 2. Knowledge Relation Graph Enhancements

- [x] 2.1 Rename "知识图谱" tab to "知识关系图谱"
- [x] 2.2 Extract unique relation types from graph data dynamically
- [x] 2.3 Update filter dropdown to use extracted relation types
- [x] 2.4 Add distinct colors for each relation type
- [x] 2.5 Implement click-to-filter on relation labels
- [x] 2.6 Add filter clear functionality

## 3. Question Graph Details

- [x] 3.1 Create QuestionDetailDrawer component
- [x] 3.2 Add click handler to question nodes
- [x] 3.3 Display question content, type, difficulty in drawer
- [x] 3.4 Fetch and display related knowledge points
- [x] 3.5 Add drawer close functionality

## 4. Ideological Graph Knowledge Management

- [x] 4.1 Create knowledge point management page/section
- [x] 4.2 Implement knowledge point CRUD operations
- [x] 4.3 Integrate relation types from /teacher/dashboard/knowledge-relation
- [x] 4.4 Add relationship creation between knowledge points
- [x] 4.5 Style and integrate into ideological graph page

## 5. Testing & Verification

- [x] 5.1 Run lint check: npm run lint
- [x] 5.2 Run build check: npm run build
- [x] 5.3 Verify all four graphs work with unified course selection
- [x] 5.4 Verify relation filter functionality
- [x] 5.5 Verify question detail drawer
- [x] 5.6 Verify ideological knowledge management

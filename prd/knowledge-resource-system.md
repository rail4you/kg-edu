# Knowledge Resource System PRD

## Overview
This document outlines the requirements for implementing a knowledge resource system within the KgEdu platform. The system will allow users to create, manage, and relate knowledge resources with role-based permissions.

## System Requirements

### 1. Knowledge Resource Entity

**Attributes:**
- `name` (string, required) - The name/title of the knowledge resource
- `description` (text, optional) - Detailed description of the knowledge resource
- `course_id` (reference, required) - The course this knowledge resource belongs to
- `created_at` (timestamp, auto) - When the resource was created
- `updated_at` (timestamp, auto) - When the resource was last modified

**Relationships:**
- Each knowledge resource belongs to exactly one course
- A course can have many knowledge resources

### 2. Knowledge Relation Entity

**Attributes:**
- `source_knowledge_id` (reference, required) - The source knowledge resource
- `target_knowledge_id` (reference, required) - The target knowledge resource
- `relation_type` (atom, required) - Type of relationship between knowledge resources
- `created_at` (timestamp, auto) - When the relation was created

**Relation Types:**
- `:pre` - Prerequisite relationship (source must be learned before target)
- `:post` - Post-requisite relationship (source should be learned after target)
- `:related` - General related knowledge
- `:extends` - Source extends or builds upon target
- `:depends_on` - Source depends on target

### 3. Role-Based Permissions

#### Admin Users
- ✅ Create knowledge resources
- ✅ Update knowledge resources
- ✅ Delete knowledge resources
- ✅ Create knowledge relations
- ✅ Update knowledge relations
- ✅ Delete knowledge relations
- ✅ View all knowledge resources and relations

#### Teacher Users
- ✅ Create knowledge resources (in courses they teach)
- ✅ Update knowledge resources (in courses they teach)
- ✅ Delete knowledge resources (only those they created in courses they teach)
- ✅ Create knowledge relations (between resources in courses they teach)
- ✅ Update knowledge relations (only those they created in courses they teach)
- ✅ Delete knowledge relations (only those they created in courses they teach)
- ✅ View all knowledge resources and relations

#### Student Users
- ❌ Create knowledge resources
- ❌ Update knowledge resources
- ❌ Delete knowledge resources
- ❌ Create knowledge relations
- ❌ Update knowledge relations
- ❌ Delete knowledge relations
- ✅ View all knowledge resources and relations

### 4. API Endpoints

#### Knowledge Resources endpoint
use ash json api

### 5. Data Validation

**Knowledge Resource:**
- Name must be unique within a course
- Name must be between 3 and 100 characters
- Description must be less than 1000 characters (if provided)
- Course must exist and be accessible to the user

**Knowledge Relation:**
- Source and target knowledge must exist
- Relation type must be one of the predefined atoms
- Cannot create duplicate relations (same source, target, and type)

### 6. User Interface Requirements

**Knowledge Resource List:**
- Create knowledge resource by course
- Display all knowledge resources in a searchable table
- Show name, description, course, and creation date
- Filter by creation date, name, or course
- Course-specific knowledge resource views

**Knowledge Resource Detail:**
- Show full knowledge resource information
- Display related knowledge resources with relation types
- Show creator information and creation/modification dates

**Relation Management:**
- Interface to create new relations between knowledge resources
- Visual representation of knowledge graph
- Ability to edit or delete existing relations

### 7. Technical Implementation

**Database Schema:**
- `knowledge_resources` table with foreign key to courses
- `knowledge_relations` table with foreign keys to knowledge_resources

**Ash Resources:**
- Authorization policies for role-based access control

**Frontend Components:**
- Knowledge resource list and detail views
- Relation management interface
- Knowledge graph visualization

## Success Criteria

1. Users can create, view, update, and delete knowledge resources based on their role
2. Users can create relationships between knowledge resources
3. Knowledge relationships are properly validated and enforced
4. The system provides a clear view of how knowledge resources are connected
5. Role-based permissions are properly enforced throughout the application
6. The system is performant and can handle a large number of knowledge resources and relations

## Future Enhancements

1. Knowledge graph visualization with interactive exploration
2. Advanced search and filtering capabilities
3. Bulk operations for knowledge resource management
4. Import/export functionality for knowledge resources
5. Versioning and history tracking for knowledge resources
6. Collaborative editing features
7. Integration with course management system
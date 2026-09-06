## ADDED Requirements

### Requirement: Download Chapter Template
The system SHALL allow teachers to download a chapter import template file from the chapter management page.

#### Scenario: Download template successfully
- **WHEN** teacher clicks "下载章节模板" button on the chapter management page
- **THEN** system queries the file template with section "chapter"
- **AND** system downloads the template file to the teacher's device

#### Scenario: Template not found
- **WHEN** teacher clicks "下载章节模板" button but no template exists for section "chapter"
- **THEN** system displays an error message indicating the template is not available

### Requirement: Template Section Management
The system SHALL include "chapter" as a valid template section type in the template management page.

#### Scenario: Chapter section available in template management
- **WHEN** template management page loads
- **THEN** "章节" (chapter) option is visible in the section dropdown alongside other sections like "知识点", "作业" etc.

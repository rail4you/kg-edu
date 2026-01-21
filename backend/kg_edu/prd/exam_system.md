# Exam System - TypeScript RPC Documentation

## Overview

The exam system provides comprehensive functionality for creating, managing, and grading exams with exercises. This document describes the resources, relationships, and TypeScript RPC actions available in the exam system.

## Resources & Relationships

### 1. Exam (考试)

**Description**: Main exam resource representing a test or assessment.

**Relationships**:
- `belongsTo`: `course` - The course this exam belongs to
- `belongsTo`: `createdBy` - User who created the exam (exam creator)
- `hasMany`: `examExercises` - Exercises included in this exam
- `hasMany`: `studentExams` - Student exam records for this exam

**Attributes**:
- `id: UUID` - Primary key
- `title: string` - Exam title (required, min 3 chars)
- `description: string` - Exam description (optional)
- `examType: 'midterm' | 'final' | 'quiz' | 'assignment'` - Type of exam (default: 'quiz')
- `examDate: DateTime` - Scheduled date and time for the exam (optional)
- `durationMinutes: number` - Duration in minutes (default: 60)
- `totalScore: number` - Total score of the exam (auto-calculated)
- `passingScore: number` - Minimum score required to pass (required)
- `createdAt: DateTime` - Creation timestamp
- `updatedAt: DateTime` - Last update timestamp

---

### 2. ExamExercise (考试习题关联)

**Description**: Join table linking exams with exercises, including scoring information.

**Relationships**:
- `belongsTo`: `exam` - The exam this belongs to
- `belongsTo`: `exercise` - The exercise in the exam

**Attributes**:
- `id: UUID` - Primary key
- `points: number` - Points this exercise is worth in the exam (default: 1)
- `order: number` - Order of this exercise in the exam (optional)
- `createdAt: DateTime` - Creation timestamp
- `updatedAt: DateTime` - Last update timestamp

---

### 3. StudentExam (学生考试记录)

**Description**: Records a student's participation in an exam with scores and status.

**Relationships**:
- `belongsTo`: `exam` - The exam being taken
- `belongsTo`: `student` - The student taking the exam (User)
- `hasMany`: `studentExamAnswers` - Student's answers for each exercise

**Attributes**:
- `id: UUID` - Primary key
- `status: 'inProgress' | 'submitted' | 'graded'` - Exam status (default: 'inProgress')
- `score: number` - Total score achieved (default: 0)
- `passed: boolean` - Whether the student passed (default: false)
- `startedAt: DateTime` - When the student started the exam
- `submittedAt: DateTime` - When the student submitted the exam
- `createdAt: DateTime` - Creation timestamp
- `updatedAt: DateTime` - Last update timestamp

---

### 4. StudentExamAnswer (学生习题答案)

**Description**: Stores a student's answer for a specific exercise in an exam.

**Relationships**:
- `belongsTo`: `studentExam` - The student exam this answer belongs to
- `belongsTo`: `examExercise` - The exam exercise being answered
- `belongsTo`: `exercise` - The exercise being answered

**Attributes**:
- `id: UUID` - Primary key
- `answer: string` - The student's answer (optional)
- `pointsEarned: number` - Points earned for this answer (default: 0)
- `graded: boolean` - Whether this answer has been graded (default: false)
- `feedback: string` - Feedback from the grader (optional)
- `answeredAt: DateTime` - When the answer was submitted
- `gradedAt: DateTime` - When the answer was graded
- `createdAt: DateTime` - Creation timestamp
- `updatedAt: DateTime` - Last update timestamp

---

## TypeScript RPC Actions

### Exam Actions

#### 1. listExams
List all exams with optional filtering.

```typescript
// List all exams
const exams = await KgEdu.Knowledge.Exam.listExams()

// List exams for a specific course
const courseExams = await KgEdu.Knowledge.Exam.getExamsByCourse({
  courseId: "course-uuid"
})

// List exams created by a specific user
const myExams = await KgEdu.Knowledge.Exam.getExamsByCreator({
  createdById: "user-uuid"
})
```

#### 2. getExam
Get a specific exam by ID.

```typescript
const exam = await KgEdu.Knowledge.Exam.getExam({
  id: "exam-uuid"
})
```

#### 3. createExam
Create a new exam.

```typescript
const exam = await KgEdu.Knowledge.Exam.createExam({
  title: "期中考试",
  description: "涵盖第1-5章内容",
  examType: "midterm",  // 'midterm' | 'final' | 'quiz' | 'assignment'
  examDate: "2025-01-20T10:00:00Z",
  durationMinutes: 90,
  passingScore: 60,
  courseId: "course-uuid",
  createdById: "teacher-uuid"
})
```

#### 4. updateExam
Update an existing exam.

```typescript
const updatedExam = await KgEdu.Knowledge.Exam.updateExam({
  id: "exam-uuid",
  title: "期中考试（更新版）",
  passingScore: 70
})
```

#### 5. destroyExam
Delete an exam.

```typescript
await KgEdu.Knowledge.Exam.destroyExam({
  id: "exam-uuid"
})
```

#### 6. addExerciseToExam
Add an exercise to an exam with points.

**Important**: After adding exercises, call `calculateTotalScore` to update the exam's total score.

```typescript
// This action is called on the exam resource
const result = await KgEdu.Knowledge.Exam.addExerciseToExam({
  resource: {
    id: "exam-uuid",
    exerciseId: "exercise-uuid",
    points: 10,
    order: 1  // Optional: order in the exam
  }
})

// After adding exercises, recalculate the total score
await KgEdu.Knowledge.Exam.calculateTotalScore({
  examId: "exam-uuid"
})
```

#### 7. removeExerciseFromExam
Remove an exercise from an exam.

**Important**: After removing exercises, call `calculateTotalScore` to update the exam's total score.

```typescript
const result = await KgEdu.Knowledge.Exam.removeExerciseFromExam({
  resource: {
    id: "exam-uuid",
    exerciseId: "exercise-uuid"
  }
})

// After removing exercises, recalculate the total score
await KgEdu.Knowledge.Exam.calculateTotalScore({
  examId: "exam-uuid"
})
```

#### 8. calculateTotalScore
Calculate and update the total score of an exam based on its exercises.

**Important**: Always call this after adding or removing exercises to ensure the exam's `totalScore` is accurate.

```typescript
const result = await KgEdu.Knowledge.Exam.calculateTotalScore({
  examId: "exam-uuid"
})
```

---

### ExamExercise Actions

#### 1. listExamExercises
List all exam-exercise relationships.

```typescript
const examExercises = await KgEdu.Knowledge.ExamExercise.listExamExercises()
```

#### 2. getExercisesByExam
Get all exercises for a specific exam (sorted by order).

```typescript
const exercises = await KgEdu.Knowledge.ExamExercise.getExercisesByExam({
  examId: "exam-uuid"
})
```

#### 3. createExamExercise
Manually create an exam-exercise relationship.

```typescript
const examExercise = await KgEdu.Knowledge.ExamExercise.createExamExercise({
  examId: "exam-uuid",
  exerciseId: "exercise-uuid",
  points: 10,
  order: 1
})
```

#### 4. updateExamExercise
Update points or order for an exam exercise.

```typescript
const updated = await KgEdu.Knowledge.ExamExercise.updateExamExercise({
  id: "exam-exercise-uuid",
  points: 15,
  order: 2
})
```

#### 5. destroyExamExercise
Remove an exam-exercise relationship.

```typescript
await KgEdu.Knowledge.ExamExercise.destroyExamExercise({
  id: "exam-exercise-uuid"
})
```

---

### StudentExam Actions

#### 1. listStudentExams
List all student exams.

```typescript
const studentExams = await KgEdu.Knowledge.StudentExam.listStudentExams()
```

#### 2. getStudentExam
Get a specific student exam by ID.

```typescript
const studentExam = await KgEdu.Knowledge.StudentExam.getStudentExam({
  id: "student-exam-uuid"
})
```

#### 3. getStudentExamsByExam
Get all student exams for a specific exam.

```typescript
const results = await KgEdu.Knowledge.StudentExam.getStudentExamsByExam({
  examId: "exam-uuid"
})
```

#### 4. getStudentExamsByStudent
Get all exams for a specific student.

```typescript
const myExams = await KgEdu.Knowledge.StudentExam.getStudentExamsByStudent({
  studentId: "student-uuid"
})
```

#### 5. getStudentExamForStudent
Get a specific exam for a specific student.

```typescript
const studentExam = await KgEdu.Knowledge.StudentExam.getStudentExamForStudent({
  examId: "exam-uuid",
  studentId: "student-uuid"
})
```

#### 6. startExam
Start an exam for a student. This creates the student exam record and automatically creates empty answer records for all exercises in the exam.

```typescript
const studentExam = await KgEdu.Knowledge.StudentExam.startExam({
  examId: "exam-uuid",
  studentId: "student-uuid"
})

// Returns student exam with status: 'inProgress'
// Automatically creates StudentExamAnswer records for all exercises
```

#### 7. submitExam
Submit a completed exam.

```typescript
const submittedExam = await KgEdu.Knowledge.StudentExam.submitExam({
  id: "student-exam-uuid"
})

// Updates status to 'submitted' and sets submittedAt timestamp
```

#### 8. gradeExam
Grade a student exam by calculating total score from all answers and determining if passed.

```typescript
const gradedExam = await KgEdu.Knowledge.StudentExam.gradeExam({
  studentExamId: "student-exam-uuid"
})

// Calculates total score from all StudentExamAnswer records
// Sets 'passed' to true if score >= passingScore
// Updates status to 'graded'
```

---

### StudentExamAnswer Actions

#### 1. listStudentExamAnswers
List all student exam answers.

```typescript
const answers = await KgEdu.Knowledge.StudentExamAnswer.listStudentExamAnswers()
```

#### 2. getStudentExamAnswer
Get a specific answer by ID.

```typescript
const answer = await KgEdu.Knowledge.StudentExamAnswer.getStudentExamAnswer({
  id: "answer-uuid"
})
```

#### 3. getAnswersByStudentExam
Get all answers for a specific student exam.

```typescript
const answers = await KgEdu.Knowledge.StudentExamAnswer.getAnswersByStudentExam({
  studentExamId: "student-exam-uuid"
})
```

#### 4. submitAnswer
Submit or update an answer for an exercise.

```typescript
const answer = await KgEdu.Knowledge.StudentExamAnswer.submitAnswer({
  id: "student-exam-answer-uuid",
  answer: "My answer to the question"
})

// Updates the 'answer' field and sets 'answeredAt' timestamp
```

#### 5. gradeAnswer
Grade a student's answer and award points. Supports both auto-grading and manual grading.

```typescript
// Auto-grading (compares answer with exercise answer)
const graded = await KgEdu.Knowledge.StudentExamAnswer.gradeAnswer({
  studentExamAnswerId: "answer-uuid"
})

// Manual grading with specific points
const graded = await KgEdu.Knowledge.StudentExamAnswer.gradeAnswer({
  studentExamAnswerId: "answer-uuid",
  awardedPoints: 8,
  feedback: "Good answer, but missing some details"
})

// Updates pointsEarned, sets graded to true, and sets gradedAt timestamp
```

---

## Complete Usage Example

Here's a complete workflow example showing how to use the exam system:

```typescript
// ============================================
// TEACHER WORKFLOW
// ============================================

// 1. Create a new exam
const exam = await KgEdu.Knowledge.Exam.createExam({
  title: "数学期中考试",
  description: "涵盖代数和几何",
  examType: "midterm",
  examDate: "2025-01-20T10:00:00Z",
  durationMinutes: 90,
  passingScore: 60,
  courseId: "math-course-uuid",
  createdById: "teacher-uuid"
})

// 2. Add exercises to the exam
await KgEdu.Knowledge.Exam.addExerciseToExam({
  resource: {
    id: exam.id,
    exerciseId: "exercise-1-uuid",
    points: 10,
    order: 1
  }
})

await KgEdu.Knowledge.Exam.addExerciseToExam({
  resource: {
    id: exam.id,
    exerciseId: "exercise-2-uuid",
    points: 15,
    order: 2
  }
})

// 3. Calculate total score after adding exercises
await KgEdu.Knowledge.Exam.calculateTotalScore({
  examId: exam.id
})

// 4. View exam with total score
const examWithTotal = await KgEdu.Knowledge.Exam.getExam({
  id: exam.id
})
console.log(`Total score: ${examWithTotal.totalScore}`)  // 25

// ============================================
// STUDENT WORKFLOW
// ============================================

// 4. Student starts the exam
const studentExam = await KgEdu.Knowledge.StudentExam.startExam({
  examId: exam.id,
  studentId: "student-uuid"
})
// Status: 'inProgress'
// StudentExamAnswer records automatically created for all exercises

// 5. Get the exercises for this exam
const examExercises = await KgEdu.Knowledge.ExamExercise.getExercisesByExam({
  examId: exam.id
})

// 6. Get student's answer records
const studentAnswers = await KgEdu.Knowledge.StudentExamAnswer.getAnswersByStudentExam({
  studentExamId: studentExam.id
})

// 7. Student submits answers
await KgEdu.Knowledge.StudentExamAnswer.submitAnswer({
  id: studentAnswers[0].id,
  answer: "Student's answer to first question"
})

await KgEdu.Knowledge.StudentExamAnswer.submitAnswer({
  id: studentAnswers[1].id,
  answer: "Student's answer to second question"
})

// 8. Student submits the exam
const submittedExam = await KgEdu.Knowledge.StudentExam.submitExam({
  id: studentExam.id
})
// Status: 'submitted'

// ============================================
// GRADING WORKFLOW
// ============================================

// 9a. Auto-grade individual answers (compares with correct answer)
await KgEdu.Knowledge.StudentExamAnswer.gradeAnswer({
  studentExamAnswerId: studentAnswers[0].id
})

await KgEdu.Knowledge.StudentExamAnswer.gradeAnswer({
  studentExamAnswerId: studentAnswers[1].id
})

// 9b. OR manually grade with custom points and feedback
await KgEdu.Knowledge.StudentExamAnswer.gradeAnswer({
  studentExamAnswerId: studentAnswers[0].id,
  awardedPoints: 8,
  feedback: "Good work!"
})

// 10. Grade the entire exam (calculates total score and pass/fail)
const gradedExam = await KgEdu.Knowledge.StudentExam.gradeExam({
  studentExamId: studentExam.id
})

console.log(`Score: ${gradedExam.score}`)      // e.g., 23
console.log(`Passed: ${gradedExam.passed}`)     // true if score >= 60
console.log(`Status: ${gradedExam.status}`)     // 'graded'

// ============================================
// REPORTING WORKFLOW
// ============================================

// 11. Get all student exams for this exam
const allResults = await KgEdu.Knowledge.StudentExam.getStudentExamsByExam({
  examId: exam.id
})

// 12. Calculate pass rate
const passedCount = allResults.filter(se => se.passed).length
const passRate = (passedCount / allResults.length) * 100
console.log(`Pass rate: ${passRate}%`)

// 13. Get a specific student's exam history
const studentHistory = await KgEdu.Knowledge.StudentExam.getStudentExamsByStudent({
  studentId: "student-uuid"
})
```

---

## Relationship Diagram

```
Exam (考试)
  │
  ├── belongsTo → Course (课程)
  ├── belongsTo → User (创建人/教师)
  │
  ├── hasMany → ExamExercise (考试习题)
  │                │
  │                ├── belongsTo → Exercise (习题)
  │                │
  │                └── hasMany → StudentExamAnswer (学生答案)
  │
  └── hasMany → StudentExam (学生考试记录)
                 │
                 ├── belongsTo → User (学生)
                 │
                 └── hasMany → StudentExamAnswer (学生答案)
```

---

## Tips & Best Practices

1. **Creating Exams**: Always set `passingScore` when creating exams. The `totalScore` defaults to 0 and must be calculated after adding exercises.

2. **Adding Exercises**: Use `addExerciseToExam` to add exercises, then call `calculateTotalScore` to update the exam's total score.

3. **Removing Exercises**: Use `removeExerciseFromExam` to remove exercises, then call `calculateTotalScore` to update the exam's total score.

4. **Starting Exams**: Use `startExam` instead of manually creating StudentExam records. This automatically creates answer records for all exercises.

5. **Grading**: You can grade individual answers first, then call `gradeExam` to calculate the final total. The `gradeExam` action will sum up all `pointsEarned` from the student's answers.

6. **Auto-grading**: For multiple-choice questions, use `gradeAnswer` without specifying points to auto-grade based on the correct answer.

7. **Manual Grading**: For essay questions, manually specify points and feedback when calling `gradeAnswer`.

8. **Error Handling**: Always handle errors from RPC calls, especially when creating or updating records.

```typescript
try {
  const exam = await KgEdu.Knowledge.Exam.createExam({...})
  // Success
} catch (error) {
  console.error("Failed to create exam:", error)
}
```

9. **Workflow**: When creating a new exam with exercises:
   1. Create the exam
   2. Add all exercises using `addExerciseToExam`
   3. Call `calculateTotalScore` once to update the total
   4. Optionally verify the total with `getExam`

---

## Type Definitions

For TypeScript type definitions, see the generated types in your frontend application. The main types are:

```typescript
interface Exam {
  id: string
  title: string
  description?: string
  examType: 'midterm' | 'final' | 'quiz' | 'assignment'
  examDate?: string
  durationMinutes: number
  totalScore: number
  passingScore: number
  courseId?: string
  createdById: string
  createdAt: string
  updatedAt: string
}

interface ExamExercise {
  id: string
  examId: string
  exerciseId: string
  points: number
  order?: number
  createdAt: string
  updatedAt: string
}

interface StudentExam {
  id: string
  examId: string
  studentId: string
  status: 'inProgress' | 'submitted' | 'graded'
  score: number
  passed: boolean
  startedAt?: string
  submittedAt?: string
  createdAt: string
  updatedAt: string
}

interface StudentExamAnswer {
  id: string
  studentExamId: string
  examExerciseId: string
  exerciseId: string
  answer?: string
  pointsEarned: number
  graded: boolean
  feedback?: string
  answeredAt?: string
  gradedAt?: string
  createdAt: string
  updatedAt: string
}
```

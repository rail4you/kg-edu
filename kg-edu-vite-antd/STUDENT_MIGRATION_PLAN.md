# Student Components Migration Plan

## Overview
迁移 minimal-vite-ts 项目中的学生端功能组件到 kg-edu-vite-antd 项目。

## Migration Status: COMPLETED ✅

所有学生端组件已成功迁移！

## Migration Components List

### Phase 1: 核心学习功能 (Priority: High) ✅
| 组件 | 源文件 | 目标文件 | 状态 |
|------|--------|----------|------|
| experiment-courses | minimal-vite-ts/src/pages/student/dashboard/experiment-courses.tsx | src/pages/student/experiment-courses.tsx | ✅ Completed |
| experiment-detail | minimal-vite-ts/src/pages/student/dashboard/experiment-detail.tsx | src/pages/student/experiment-detail.tsx | ✅ Completed |
| exam-courses | minimal-vite-ts/src/pages/student/dashboard/exam-courses.tsx | src/pages/student/exam-courses.tsx | ✅ Completed |
| exam-list | minimal-vite-ts/src/pages/student/dashboard/exam-list.tsx | src/pages/student/exam-list.tsx | ✅ Completed |
| exam-taking | minimal-vite-ts/src/pages/student/dashboard/exam-taking.tsx | src/pages/student/exam-taking.tsx | ✅ Completed |

### Phase 2: 认知与图谱功能 (Priority: High) ✅
| 组件 | 源文件 | 目标文件 | 状态 |
|------|--------|----------|------|
| knowledge-cognitive-goals | minimal-vite-ts/src/pages/student/dashboard/knowledge-cognitive-goals.tsx | src/pages/student/knowledge-cognitive-goals.tsx | ✅ Completed |
| graph-competency | minimal-vite-ts/src/pages/student/dashboard/graph-competency.tsx | src/pages/student/graph-competency.tsx | ✅ Completed |

### Phase 3: 交流与推荐功能 (Priority: Medium) ✅
| 组件 | 源文件 | 目标文件 | 状态 |
|------|--------|----------|------|
| email-qa | minimal-vite-ts/src/pages/student/dashboard/email-qa.tsx | src/pages/student/email-qa.tsx | ✅ Completed |
| learning-recommendations | minimal-vite-ts/src/pages/student/dashboard/learning-recommendations.tsx | src/pages/student/learning-recommendations.tsx | ✅ Completed |
| course-teachers | minimal-vite-ts/src/pages/student/dashboard/course-teachers.tsx | src/pages/student/course-teachers.tsx | ✅ Completed |

### Phase 4: 视频与签到功能 (Priority: Medium) ✅
| 组件 | 源文件 | 目标文件 | 状态 |
|------|--------|----------|------|
| course-video | minimal-vite-ts/src/pages/student/course-video/page.tsx | src/pages/student/course-video.tsx | ✅ Completed |
| check-in | minimal-vite-ts/src/pages/student/check-in/[token]/page.tsx | src/pages/student/check-in.tsx | ✅ Completed |

### Phase 5: 其他 Dashboard 页面 (Priority: Low) ✅
| 组件 | 源文件 | 目标文件 | 状态 |
|------|--------|----------|------|
| graph | minimal-vite-ts/src/pages/dashboard/graph/ | src/pages/student/graph.tsx | ✅ Completed |
| knowledge | minimal-vite-ts/src/pages/dashboard/knowledge/ | src/pages/student/knowledge.tsx | ✅ Completed |
| resource | minimal-vite-ts/src/pages/dashboard/resource/ | src/pages/student/resource.tsx | ✅ Completed |
| chat | minimal-vite-ts/src/pages/dashboard/chat.tsx | src/pages/student/chat.tsx | ✅ Completed |
| course-info | minimal-vite-ts/src/pages/dashboard/course-info/[courseId]/page.tsx | src/pages/student/course-info.tsx | ✅ Completed |

## Route Configuration Updated ✅
App.tsx 已更新，包含所有迁移的学生端路由：

```tsx
<Route path="/dashboard" element={<StudentLayout />}>
  {/* 核心学习功能 */}
  <Route path="experiment-courses" element={<StudentExperimentCourses />} />
  <Route path="experiment-courses/:courseId" element={<StudentExperimentCourses />} />
  <Route path="experiment-detail/:id" element={<StudentExperimentDetail />} />
  <Route path="exam-courses" element={<StudentExamCourses />} />
  <Route path="exam-courses/:courseId" element={<StudentExamCourses />} />
  <Route path="exam-list/:courseId" element={<StudentExamList />} />
  <Route path="exam-taking/:examId" element={<StudentExamTaking />} />
  
  {/* 认知与图谱功能 */}
  <Route path="knowledge-cognitive-goals" element={<StudentKnowledgeCognitiveGoals />} />
  <Route path="graph-competency" element={<StudentGraphCompetency />} />
  <Route path="graph" element={<StudentGraph />} />
  <Route path="knowledge" element={<StudentKnowledge />} />
  
  {/* 交流与推荐功能 */}
  <Route path="email-qa" element={<StudentEmailQA />} />
  <Route path="learning-recommendations" element={<StudentLearningRecommendations />} />
  <Route path="teacher" element={<StudentCourseTeachers />} />
  <Route path="chat" element={<StudentChat />} />
  
  {/* 视频与资源功能 */}
  <Route path="course-video" element={<StudentCourseVideo />} />
  <Route path="resource" element={<StudentResource />} />
  <Route path="course-info/:courseId" element={<StudentCourseInfo />} />
</Route>

{/* 公开签到页面 */}
<Route path="/dashboard/check-in/:tenantSchema/:token" element={<StudentCheckIn />} />
```

## Migration Guidelines (Applied)
1. ✅ 保持组件逻辑不变
2. ✅ 适配 kg-edu-vite-antd 的 API 客户端 (src/lib/)
3. ✅ MUI 组件转换为 Ant Design
4. ✅ 导入路径从 'src/' 改为 '@/'
5. ✅ 认证 hook: useAuthContext → useAuth
6. ✅ 图标从 @mui/icons-material 改为 @ant-design/icons

## Migration Summary
- **Total Components Migrated**: 20
- **Build Status**: ✅ No errors in migrated files
- **Lint Status**: ✅ Only minor unused import warnings (acceptable)

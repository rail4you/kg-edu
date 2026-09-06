import { Routes, Route, Navigate, useParams, useSearchParams, useLocation } from "react-router-dom";
import { useEffect, useLayoutEffect } from "react";
import HomePage from "./pages/home";
import CourseListPage from "./pages/course-list";
import LoginPage from "./pages/login";
import TemplatePage from "./pages/template-page";
import TeacherLayout from "./layouts/teacher-layout";
import StudentLayout from "./layouts/student-layout";
import AdminLayout from "./layouts/admin-layout";

import TeacherDashboard from "./pages/teacher/dashboard";
import TeacherCourse from "./pages/teacher/course";
import TeacherStudentEnrollment from "./pages/teacher/student-enrollment";
import TeacherKnowledgeResource from "./pages/teacher/knowledge-resource";
import TeacherKnowledgeRelation from "./pages/teacher/knowledge-relation";
import TeacherExercise from "./pages/teacher/exercise";
import TeacherExamManagement from "./pages/teacher/exam-management";

import TeacherChapter from "./pages/teacher/chapter";
import TeacherHomework from "./pages/teacher/homework";
import TeacherQuestion from "./pages/teacher/question";
import TeacherFile from "./pages/teacher/file";
import TeacherExamStatistics from "./pages/teacher/exam-statistics";
import TeacherExamGrading from "./pages/teacher/exam-grading";
import TeacherVideo from "./pages/teacher/video";
import TeacherSettings from "./pages/teacher/settings";
import TeacherAiExercise from "./pages/teacher/ai-exercise";
import TeacherAssignCourse from "./pages/teacher/assign-course";
import TeacherGraphKnowledge from "./pages/teacher/graph-knowledge";
import TeacherCourseInfo from "./pages/teacher/course-info";
import TeacherCourseVideo from "./pages/teacher/course-video";
import TeacherCourseEvaluation from "./pages/teacher/course-evaluation";
import TeacherDiscussionSession from "./pages/teacher/discussion-session";
import TeacherExamExercises from "./pages/teacher/exam-exercises";
import TeacherExamGradeDetail from "./pages/teacher/exam-grade-detail";
import TeacherActivitySummary from "./pages/teacher/activity-summary";
import TeacherBookInfo from "./pages/teacher/book-info";
import TeacherCourseDetail from "./pages/teacher/course-detail";
import TeacherCourseCategory from "./pages/teacher/course-category";
import TeacherExperimentManagement from "./pages/teacher/experiment-management";
import TeacherKnowledgeFile from "./pages/teacher/knowledge-file";
import TeacherLearningRecommendations from "./pages/teacher/learning-recommendations";
import TeacherRelationType from "./pages/teacher/relation-type";
import TeacherTeachers from "./pages/teacher/teachers";
import TeacherTemplateManagement from "./pages/teacher/template-management";
import TeacherCheckInManagement from "./pages/teacher/check-in-management";
import TeacherKnowledgeCognitiveGoals from "./pages/teacher/knowledge-cognitive-goals";
import TeacherVirtualResearchRoom from "./pages/teacher/virtual-research-room";
import TeacherApi from "./pages/teacher/api";
import TeacherEmailConfig from "./pages/teacher/email-config";
import TeacherEmailMessages from "./pages/teacher/email-messages";
import TeacherGraphTree from "./pages/teacher/graph-tree";
import TeacherGraphCompetency from "./pages/teacher/graph-competency";
import TeacherGraphIdeological from "./pages/teacher/graph-ideological";
import TeacherGraphQuestion from "./pages/teacher/graph-question";
import TeacherGraphCircle from "./pages/teacher/graph-circle";
import TeacherGraphCourse from "./pages/teacher/graph-course";
import GraphLayout from "./pages/teacher/graph-layout";
import TeacherAiFile from "./pages/teacher/ai-file";
import TeacherAiDiscussion from "./pages/teacher/ai-discussion";
import TeacherAiCommand from "./pages/teacher/ai-command";
import AgentChat from "./pages/agent/chat";
import AIAssistantPage from "./pages/teacher/ai-assistant";
import TeacherManual from "./pages/teacher/manual";
import TeacherLink from "./pages/teacher/link";
// import TeacherLearningStatistics from "./pages/teacher/learning-statistics"; // 删除 mock 组件

import TeacherSummary from "./pages/teacher/summary";
import TeacherStudySummary from "./pages/teacher/study-summary";
import TeacherExperimentDetail from "./pages/teacher/experiment-detail";
import TeacherExperimentForm from "./pages/teacher/experiment-form";
import TeacherVideoUploader from "./pages/teacher/video-uploader";
import TeacherGroupManagement from "./pages/teacher/group-management";
import TeacherGroupTask from "./pages/teacher/group-task";
import TeacherStudentProfile from "./pages/teacher/student-profile";
import TeacherMajorList from "./pages/teacher/major-list";
import TeacherMajorDetail from "./pages/teacher/major-detail";
import TeacherMajorJobs from "./pages/teacher/major-jobs";
import TeacherMajorCompetency from "./pages/teacher/major-competency";
import TeacherMajorCurriculum from "./pages/teacher/major-curriculum";
import TeacherMajorReport from "./pages/teacher/major-report";
import TeacherMajorStudents from "./pages/teacher/major-students";
import TeacherMajorCourses from "./pages/teacher/major-courses";
import TeacherJobList from "./pages/teacher/job-list";
import TeacherJobCompetencyGraphs from "./pages/teacher/job-competency-graphs";
import TeacherJobCompetencyGraphDetail from "./pages/teacher/job-competency-graph-detail";
import TeacherMicroMajorList from "./pages/teacher/micro-major-list";
import TeacherMicroMajorCourses from "./pages/teacher/micro-major-courses";
import TeacherMicroMajorEdit from "./pages/teacher/micro-major-edit";
import ModuleHome from "./pages/teacher/module-home";
import MicroMajorLayout from "./layouts/micro-major-layout";
import MicroMajorDashboard from "./pages/teacher/mm-dashboard";
import MicroMajorCourseDetail from "./pages/teacher/mm-course-detail";
import MicroMajorCourseList from "./pages/teacher/mm-course-list";
import MMCoursesPage from "./pages/teacher/mm-courses-page";
import MMChaptersPage from "./pages/teacher/mm-chapters-page";
import MMVideosPage from "./pages/teacher/mm-videos-page";
import MMExercisesPage from "./pages/teacher/mm-exercises-page";
import MMResourcesPage from "./pages/teacher/mm-resources-page";
import MMChapterContentPage from "./pages/teacher/mm-chapter-content-page";
import MMStudentsPage from "./pages/teacher/mm-students-page";
import MMStudentManagement from "./pages/teacher/mm-student-management";
import MMSettingsPage from "./pages/teacher/mm-settings-page";
import MMHomeworksPage from "./pages/teacher/mm-homeworks-page";
import MMAnalyticsPage from "./pages/teacher/mm-analytics";
import MMCertificateManagement from "./pages/teacher/mm-certificate-management";
import StudentGroupTask from "./pages/student/group-task";


import StudentFront from "./pages/student/front";
import StudentOverview from "./pages/student/overview";
import StudentExperimentCourses from "./pages/student/experiment-courses";
import StudentExperimentDetail from "./pages/student/experiment-detail";
import StudentExamCourses from "./pages/student/exam-courses";
import StudentExamList from "./pages/student/exam-list";
import StudentExamTaking from "./pages/student/exam-taking";
import StudentKnowledgeCognitiveGoals from "./pages/student/knowledge-cognitive-goals";
import StudentGraphCompetency from "./pages/student/graph-competency";
import StudentEmailQA from "./pages/student/email-qa";
import StudentLearningRecommendations from "./pages/student/learning-recommendations";
import StudentCourseTeachers from "./pages/student/course-teachers";
import StudentCourseVideo from "./pages/student/course-video";
import StudentCheckIn from "./pages/student/check-in";
import StudentDiscussion from "./pages/student/discussion";
import StudentDiscussionHub from "./pages/student/discussion-hub";
import StudentGraph from "./pages/student/graph";
import StudentGraphLayer from "./pages/student/graph-layer";
import StudentGraphCategory from "./pages/student/graph-category";
import StudentGroupTaskHub from "./pages/student/group-task-hub";
import StudentInteractionHub from "./pages/student/interaction-hub";
import StudentResource from "./pages/student/resource";
import StudentChat from "./pages/student/chat";
import StudentCourseInfo from "./pages/student/course-info";
import StudentCourseIntro from "./pages/student/course-intro";
import StudentManual from "./pages/student/manual";
import StudentMicroMajors from "./pages/student/micro-majors";
import StudentMMCoursePage from "./pages/student/mm-course-page";
import StudentMMTimeline from "./pages/student/mm-timeline";
import StudentCurriculum from "./pages/student/curriculum";
import MicroMajorsPage from "./pages/micro-majors";
import MicroMajorDetailPage from "./pages/micro-major-detail";
import AdminDashboard from "./pages/admin/dashboard";
import AdminOrganizations from "./pages/admin/organizations";
import AdminAdmins from "./pages/admin/admins";
import AdminTeachers from "./pages/admin/teachers";
import AdminStudents from "./pages/admin/students";
import AdminClasses from "./pages/admin/classes";
import AdminGroups from "./pages/admin/groups";
import AdminPermissions from "./pages/admin/permissions";
import AdminSystem from "./pages/admin/system";
import AdminLogs from "./pages/admin/logs";
import AdminApiKeyConfig from "./pages/admin/api-key-config";
import AdminSiteContent from "./pages/admin/site-content";
import AdminPortalConfig from "./pages/admin/portal-config";
import AdminCourseCategories from "./pages/admin/course-categories";
import AdminBranding from "./pages/admin/branding";
import AdminManual from "./pages/admin/manual";

// 旧路由重定向到新的学生管理页面
function RedirectToStudentMgmt() {
  const { microMajorId } = useParams<{ microMajorId: string }>();
  return <Navigate to={`/micro-major/student-management?mmId=${microMajorId}`} replace />;
}

// 孤立的能力图谱页已整合到课程图谱左侧导航，保留兼容重定向并保留查询参数
function GraphCompetencyRedirect() {
  const [searchParams] = useSearchParams();
  const params = new URLSearchParams(searchParams);
  params.set("main", "knowledge");
  params.set("view", "competency");
  const qs = params.toString();
  return <Navigate to={`/dashboard/graph${qs ? `?${qs}` : ""}`} replace />;
}

function ScrollToTop() {
  const { pathname, search } = useLocation();
  // useLayoutEffect 同步在 DOM 变更后、浏览器绘制前执行，避免先看到错位再闪回顶部的“闪屏”
  useLayoutEffect(() => {
    if ("scrollRestoration" in window.history) {
      try {
        (window.history as unknown as { scrollRestoration: string }).scrollRestoration = "manual";
      } catch {}
    }
    // Chrome 95 兼容：不用 behavior: "smooth"/"instant"（后者在 120+ 才支持），直接同步置顶
    window.scrollTo(0, 0);
    // 兜底：部分浏览器滚动容器是 documentElement/body
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    // ProLayout / student-layout 等内部可滚动容器（overflow:auto）也一并置顶
    const selectors = "[data-scroll-container], [data-outlet-scroll], .ant-layout-content, .ant-pro-layout-content, .ant-pro-layout .ant-layout-content";
    document.querySelectorAll<HTMLElement>(selectors).forEach((el) => {
      el.scrollTop = 0;
    });
    // 兜底：遍历所有 overflow:auto 的元素（教师端 ProLayout 的 flex 容器在部分浏览器下不是上述选择器）
    document.querySelectorAll<HTMLElement>("*").forEach((el) => {
      const style = window.getComputedStyle(el);
      if ((style.overflowY === "auto" || style.overflow === "auto") && el.scrollTop > 0) {
        // 仅对主布局相关的可滚动区域生效，避免误触下拉菜单等
        if (el.clientHeight > 200) {
          el.scrollTop = 0;
        }
      }
    });
  }, [pathname, search]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/courses" element={<CourseListPage />} />
      {/* 固定模板页路由（兼容旧链接），内容由门户配置动态提供 */}
      <Route path="/about" element={<TemplatePage slug="about" />} />
      <Route path="/resources" element={<TemplatePage slug="resources" />} />
      <Route path="/demo" element={<TemplatePage slug="demo" />} />
      <Route path="/textbook" element={<TemplatePage slug="textbook" />} />
      <Route path="/partners" element={<TemplatePage slug="partners" />} />
      {/* 动态模板页（超级管理员新增的页面，访问 /page/<slug>） */}
      <Route path="/page/:slug" element={<TemplatePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/teacher/module-home" element={<ModuleHome />} />
      <Route path="/micro-major" element={<MicroMajorLayout />}>
        {/* Flat routes — sidebar items always navigate here */}
        <Route path="dashboard" element={<MicroMajorDashboard />} />
        <Route path="create" element={<MicroMajorDashboard />} />
        <Route path="courses" element={<MMCoursesPage />} />
        <Route path="chapters" element={<MMChaptersPage />} />
        <Route path="videos" element={<MMVideosPage />} />
        <Route path="exercises" element={<MMExercisesPage />} />
        <Route path="resources" element={<MMResourcesPage />} />
        <Route path="chapter-content" element={<MMChapterContentPage />} />
        <Route path="homework" element={<MMHomeworksPage />} />
        <Route path="analytics" element={<MMAnalyticsPage />} />
        <Route path="student-management" element={<MMStudentManagement />} />

        {/* Legacy path-based routes (backward compatible) */}
        <Route path=":microMajorId/edit" element={<TeacherMicroMajorEdit />} />
        <Route path=":microMajorId/courses" element={<MicroMajorCourseList />} />
        <Route path=":microMajorId/course/:courseId" element={<MicroMajorCourseDetail />} />
        <Route path=":microMajorId/course/:courseId/chapters" element={<MicroMajorCourseDetail />} />
        <Route path=":microMajorId/course/:courseId/videos" element={<MicroMajorCourseDetail />} />
        <Route path=":microMajorId/course/:courseId/exercises" element={<MicroMajorCourseDetail />} />
        <Route path=":microMajorId/course/:courseId/resources" element={<MicroMajorCourseDetail />} />
        <Route path=":microMajorId/students" element={<RedirectToStudentMgmt />} />
        <Route path="certificate-management/:microMajorId" element={<MMCertificateManagement />} />
        <Route path="certificates" element={<MMCertificateManagement />} />
      </Route>
      <Route path="/student/mm-course" element={<StudentMMCoursePage />} />
      <Route path="/student/mm-timeline" element={<StudentMMTimeline />} />
      <Route path="/micro-majors" element={<MicroMajorsPage />} />
      <Route path="/micro-majors/:tenant/:id" element={<MicroMajorDetailPage />} />

      <Route path="/teacher/dashboard" element={<TeacherLayout />}>
        <Route index element={<TeacherDashboard />} />

        <Route path="course" element={<TeacherCourse />} />
        <Route
          path="student-enrollment"
          element={<TeacherStudentEnrollment />}
        />
        <Route
          path="knowledge-resource"
          element={<TeacherKnowledgeResource />}
        />
        <Route
          path="knowledge-relation"
          element={<TeacherKnowledgeRelation />}
        />
        <Route path="exercise" element={<TeacherExercise />} />
        <Route path="exam-management" element={<TeacherExamManagement />} />

        <Route path="chapter" element={<TeacherChapter />} />
        <Route path="homework" element={<TeacherHomework />} />
        <Route path="question" element={<TeacherQuestion />} />
        <Route path="file" element={<TeacherFile />} />
        <Route path="exam-statistics" element={<TeacherExamStatistics />} />
        <Route path="exam-statistics/:examId" element={<TeacherExamStatistics />} />
        <Route path="exam-grading" element={<TeacherExamGrading />} />
        <Route path="exam-grading/:examId" element={<TeacherExamGrading />} />
        <Route path="video" element={<TeacherVideo />} />
        <Route path="settings" element={<TeacherSettings />} />
        <Route path="ai-exercise" element={<TeacherAiExercise />} />
        <Route path="chat" element={<AgentChat />} />
        <Route path="assign-course" element={<TeacherAssignCourse />} />
        <Route path="graph-knowledge" element={<GraphLayout><TeacherGraphKnowledge /></GraphLayout>} />
        <Route path="course-info" element={<TeacherCourseInfo />} />
        <Route path="course-video" element={<TeacherCourseVideo />} />
        <Route path="course-evaluation" element={<TeacherCourseEvaluation />} />
        <Route path="discussion-session" element={<TeacherDiscussionSession />} />
        <Route path="exam-exercises" element={<TeacherExamExercises />} />
        <Route path="exam-exercises/:examId" element={<TeacherExamExercises />} />
        <Route path="exam-grade-detail/:studentExamId" element={<TeacherExamGradeDetail />} />
        <Route path="activity-summary" element={<TeacherActivitySummary />} />
        <Route path="book-info" element={<TeacherBookInfo />} />
        <Route path="course/:courseId" element={<TeacherCourseDetail />} />
        <Route path="course-category" element={<TeacherCourseCategory />} />
        <Route
          path="experiment-management"
          element={<TeacherExperimentManagement />}
        />
        <Route path="knowledge-file" element={<TeacherKnowledgeFile />} />
        <Route
          path="learning-recommendations"
          element={<TeacherLearningRecommendations />}
        />
        <Route path="relation-type" element={<TeacherRelationType />} />
        <Route path="teachers" element={<TeacherTeachers />} />
        <Route
          path="template-management"
          element={<TeacherTemplateManagement />}
        />
        <Route
          path="check-in-management"
          element={<TeacherCheckInManagement />}
        />
        <Route
          path="knowledge-cognitive-goals"
          element={<TeacherKnowledgeCognitiveGoals />}
        />
        <Route
          path="virtual-research-room"
          element={<TeacherVirtualResearchRoom />}
        />
        <Route path="api" element={<TeacherApi />} />
        <Route path="email-config" element={<TeacherEmailConfig />} />
        <Route path="email-messages" element={<TeacherEmailMessages />} />
        <Route path="graph-tree" element={<GraphLayout><TeacherGraphTree /></GraphLayout>} />
        <Route path="graph-competency" element={<GraphLayout><TeacherGraphCompetency /></GraphLayout>} />
        <Route path="graph-ideological" element={<GraphLayout><TeacherGraphIdeological /></GraphLayout>} />
        <Route path="graph-question" element={<GraphLayout><TeacherGraphQuestion /></GraphLayout>} />
        <Route path="graph-circle" element={<GraphLayout><TeacherGraphCircle /></GraphLayout>} />
        <Route path="graph-course" element={<GraphLayout><TeacherGraphCourse /></GraphLayout>} />
        <Route path="ai-file" element={<TeacherAiFile />} />
        <Route path="ai-discussion" element={<TeacherAiDiscussion />} />
        <Route path="ai-command" element={<TeacherAiCommand />} />
        <Route path="ai-assistant" element={<AIAssistantPage />} />
        <Route path="manual" element={<TeacherManual />} />
        <Route path="link" element={<TeacherLink />} />
        <Route path="course-statistics" element={<TeacherSummary />} />
        <Route path="learning-statistics" element={<TeacherStudySummary />} />

        <Route path="summary" element={<TeacherSummary />} />
        <Route path="study-summary" element={<TeacherStudySummary />} />
        <Route path="experiment-detail" element={<TeacherExperimentDetail />} />
        <Route path="experiment-detail/:id" element={<TeacherExperimentDetail />} />
        <Route path="experiment-form" element={<TeacherExperimentForm />} />
        <Route path="experiment-form/:id" element={<TeacherExperimentForm />} />
        <Route path="video-uploader" element={<TeacherVideoUploader />} />
        <Route path="group-management" element={<TeacherGroupManagement />} />
        <Route path="group-task" element={<TeacherGroupTask />} />
        <Route path="student-profile" element={<TeacherStudentProfile />} />
        <Route path="major-list" element={<TeacherMajorList />} />
        <Route path="major-detail/:id" element={<TeacherMajorDetail />} />
        <Route path="major-jobs/:majorId" element={<TeacherMajorJobs />} />
        <Route path="major-competency/:majorId" element={<TeacherMajorCompetency />} />
        <Route path="major-curriculum/:majorId" element={<TeacherMajorCurriculum />} />
        <Route path="major-report/:majorId" element={<TeacherMajorReport />} />
        <Route path="major-students/:majorId" element={<TeacherMajorStudents />} />
        <Route path="major-courses/:majorId" element={<TeacherMajorCourses />} />
        <Route path="job-list" element={<TeacherJobList />} />
        <Route path="job-competency-graphs" element={<TeacherJobCompetencyGraphs />} />
        <Route path="job-competency-graphs/:graphId" element={<TeacherJobCompetencyGraphDetail />} />
        <Route path="micro-major-list" element={<TeacherMicroMajorList />} />
        <Route path="micro-major-edit/:microMajorId" element={<TeacherMicroMajorEdit />} />
        <Route path="micro-major-courses/:microMajorId" element={<TeacherMicroMajorCourses />} />
        <Route path="micro-major-students/:microMajorId" element={<RedirectToStudentMgmt />} />
      </Route>

      <Route path="/dashboard/front" element={<StudentFront />} />
      {/* Student check-in page - publicly accessible without auth */}
      {/* URL format: /student/check-in/:tenantSchema/:token */}
      <Route path="/student/check-in/:tenantSchema/:token" element={<StudentCheckIn />} />
      
      {/* Student discussion page - publicly accessible without auth */}
      {/* URL format: /student/discussion/:tenantSchema/:token */}
      <Route path="/student/discussion/:tenantSchema/:token" element={<StudentDiscussion />} />
      <Route path="/student/group-task/:tenantSchema/:token" element={<StudentGroupTask />} />

      <Route path="/dashboard" element={<StudentLayout />}>
        <Route index element={<Navigate to="/dashboard/overview" replace />} />
        <Route path="overview" element={<StudentOverview />} />
        
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
        <Route path="micro-majors" element={<StudentMicroMajors />} />
        <Route path="graph-competency" element={<GraphCompetencyRedirect />} />
        <Route path="graph" element={<StudentGraph />} />
        <Route path="graph-layer" element={<StudentGraphLayer />} />
        <Route path="graph-category" element={<StudentGraphCategory />} />
        
        {/* 交流与推荐功能 */}
        <Route path="interaction" element={<StudentInteractionHub />} />
        <Route path="interaction/discussion/:token" element={<StudentDiscussion embedded />} />
        <Route path="interaction/task/:token" element={<StudentGroupTask embedded />} />
        {/* Legacy redirects */}
        <Route path="discussions" element={<Navigate to="/dashboard/interaction" replace />} />
        <Route path="group-tasks" element={<Navigate to="/dashboard/interaction" replace />} />
        <Route path="email-qa" element={<StudentEmailQA />} />
        <Route path="learning-recommendations" element={<StudentLearningRecommendations />} />
        <Route path="learning-recommendations/:courseId" element={<StudentLearningRecommendations />} />
        <Route path="teacher" element={<StudentCourseTeachers />} />
        <Route path="chat" element={<StudentChat />} />
        
        {/* 视频与资源功能 */}
        <Route path="course-video" element={<StudentCourseVideo />} />
        <Route path="resource" element={<StudentResource />} />
        <Route path="course-info/:courseId" element={<StudentCourseInfo />} />
        <Route path="intro" element={<StudentCourseIntro />} />
        <Route path="manual" element={<StudentManual />} />
        <Route path="curriculum" element={<StudentCurriculum />} />
        <Route path="curriculum/:majorId" element={<StudentCurriculum />} />
      </Route>

      <Route path="/admin/dashboard" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="organizations" element={<AdminOrganizations />} />
        <Route path="admins" element={<AdminAdmins />} />
        <Route path="teachers" element={<AdminTeachers />} />
        <Route path="students" element={<AdminStudents />} />
        <Route path="classes" element={<AdminClasses />} />
        <Route path="groups" element={<AdminGroups />} />
        <Route path="permissions" element={<AdminPermissions />} />
        <Route path="system" element={<AdminSystem />} />
        <Route path="logs" element={<AdminLogs />} />
        <Route path="api-key-config" element={<AdminApiKeyConfig />} />
        <Route path="site-content" element={<AdminSiteContent />} />
        <Route path="portal-config" element={<AdminPortalConfig />} />
        <Route path="course-categories" element={<AdminCourseCategories />} />
        <Route path="branding" element={<AdminBranding />} />
        <Route path="manual" element={<AdminManual />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}

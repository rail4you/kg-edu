import * as React from 'react';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Card, Button, Typography, Spin, Tag, Alert, Space, Row, Col, Table, Select, Segmented, Popover, Grid, Tooltip } from 'antd';
import { PlayCircleOutlined, RightOutlined, FileTextOutlined, CheckCircleOutlined, ClockCircleOutlined, AppstoreOutlined, UnorderedListOutlined, CalendarOutlined, InfoCircleOutlined, ScheduleOutlined } from '@ant-design/icons';
import { useAuth } from '@/auth/auth-context';
import { getAuthHeaders } from '@/lib/auth';
import { getCurrentTenant } from '@/lib/tenant';
import { myCourses, getExamsByCourse, listCourses, getStudentExamsByStudent } from '@/lib/ash_rpc';
import { themeColors as colors } from "@/styles/theme";

const { Title, Text, Paragraph } = Typography;

interface Course {
  id: string;
  title: string;
  description?: string;
}

interface Exam {
  id: string;
  title: string;
  description?: string;
  examType: 'midterm' | 'final' | 'quiz' | 'assignment';
  examDate?: string;
  deadlineAt?: string;
  durationMinutes: number;
  totalScore: number;
  passingScore: number;
}

interface StudentExam {
  id: string;
  examId: string;
  status: 'in_progress' | 'submitted' | 'graded';
  score: number;
  passed: boolean;
  startedAt?: string;
  submittedAt?: string;
}

export default function ExamCourses() {
  const { useBreakpoint } = Grid;
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { user } = useAuth();
  const navigate = useNavigate();
  const currentTenant = getCurrentTenant();
  const { courseId: urlCourseId } = useParams();
  const [searchParams] = useSearchParams();

  const storedCourseId = localStorage.getItem("selectedCourse");
  const searchCourseId = searchParams.get("courseId");
  // 优先级：URL 路径参数 > 查询参数（来自 front 页面链接） > localStorage
  const courseId = urlCourseId || searchCourseId || storedCourseId || null;

  // 视图状态
  const [viewMode, setViewMode] = useState<'card' | 'list'>('list');
  // 过滤状态
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [passFilter, setPassFilter] = useState<string>('all');

  const { data: enrollmentsResult, isLoading: isLoadingEnrollments } = useQuery({
    queryKey: ['my-courses', user?.id],
    queryFn: async (): Promise<any> => {
      if (!user?.id || courseId) return { data: [] };

      const result = await myCourses({
        tenant: currentTenant?.schemaName || '',
        fields: ['id', 'title', 'description'],
        headers: getAuthHeaders(user)
      });

      console.log('My courses result:', result);
      if (!result.success) {
        console.error('My courses API errors:', (result as any).errors);
      }
      if (result.success && result.data) {
        console.log('My courses data:', result.data);
        console.log('My courses array:', Array.isArray(result.data) ? result.data : ((result.data as any).results || (result.data as any).data || []));
      }

      return result;
    },
    enabled: !!user?.id && !courseId
  });



  const { data: courseData, isLoading: isLoadingCourse } = useQuery({
    queryKey: ['course', courseId],
    queryFn: async (): Promise<any> => {
      if (!courseId) return null;

      console.log('Fetching course details for courseId:', courseId);
      const result = await listCourses({
        tenant: currentTenant?.schemaName || '',
        fields: ['id', 'title', 'description'],
        filter: { id: { eq: courseId } },
        headers: getAuthHeaders(user)
      });

      console.log('Course data result:', result);

      if (result.success && result.data) {
        const courses = Array.isArray(result.data)
          ? result.data
          : ((result.data as any).results || (result.data as any).data || []);

        if (courses.length > 0) {
          return { success: true, data: courses[0] };
        }
      }

      return result;
    },
    enabled: !!courseId && !!user
  });

  const { data: examsResult, isLoading: isLoadingExams } = useQuery({
    queryKey: ['exams', 'course', courseId],
    queryFn: async (): Promise<any> => {
      if (!courseId) return { data: [] };

      console.log('Fetching exams for courseId:', courseId);
      const result = await getExamsByCourse({
        tenant: currentTenant?.schemaName || '',
        fields: ['id', 'title', 'description', 'examType', 'examDate', 'deadlineAt', 'durationMinutes', 'totalScore', 'passingScore'],
        input: { courseId },
        headers: getAuthHeaders(user)
      });

      console.log('Exams result:', result);
      if (!result.success) {
        console.error('Exams API errors:', (result as any).errors);
      }
      return result;
    },
    enabled: !!courseId && !!user
  });

  const { data: studentExamsResult } = useQuery({
    queryKey: ['student-exams', user?.id, courseId],
    queryFn: async (): Promise<any> => {
      if (!user?.id || !courseId) return { success: true, data: [] };

      console.log('Fetching student exams for student:', user.id, 'course:', courseId);
      const result = await getStudentExamsByStudent({
        tenant: currentTenant?.schemaName || '',
        fields: ['id', 'status', 'score', 'passed', 'startedAt', 'submittedAt', { exam: ['id', 'courseId'] }],
        input: { studentId: user.id },
        headers: getAuthHeaders(user)
      });

      console.log('Student exams result:', result);
      return result;
    },
    enabled: !!courseId && !!user
  });

  // 自动绑定「当前课程」：
  // - URL 未带 courseId，且 localStorage 中没有 selectedCourse
  // - 用户只有一门已选课程时，直接跳转到该课程的考试列表（避免出现课程选择界面）
  // 这样登录后首次访问 /dashboard/exam-courses 也能看到当前课程的考试。
  // 多门课程时不再展示课程选择网格，而是提示用户返回首页选择当前课程（与 experiment-courses / learning-recommendations 一致）。
  useEffect(() => {
    // 已经有 courseId 上下文，无需自动绑定
    if (courseId) return;
    // 没有登录或没有当前租户，不做处理
    if (!user?.id || !currentTenant?.schemaName) return;
    // 还在加载选课列表，等加载完再判断
    if (isLoadingEnrollments) return;
    // 加载失败（API 返回 success:false 或无数据）时不跳转，避免误判
    if (!enrollmentsResult?.success || !enrollmentsResult.data) return;

    const enrollments = Array.isArray(enrollmentsResult.data)
      ? (enrollmentsResult.data as any[])
      : ((enrollmentsResult.data as any).results || (enrollmentsResult.data as any).data || []);

    // myCourses 直接返回 Course 列表（非 enrollment 包装），直接过滤有效课程
    const enrolledCourses = (enrollments as any[]).filter((c: any) => c && c.id);

    // 只有一门课时，自动绑定为当前课程并跳转
    if (enrolledCourses.length === 1) {
      const onlyCourse = enrolledCourses[0];
      localStorage.setItem("selectedCourse", onlyCourse.id);
      navigate(`/dashboard/exam-courses/${onlyCourse.id}`, { replace: true });
    }
  }, [
    courseId,
    user?.id,
    currentTenant?.schemaName,
    isLoadingEnrollments,
    enrollmentsResult,
    navigate,
  ]);

  // 辅助函数 - 定义在组件顶层
  const getExamTypeLabel = (examType: Exam['examType']) => {
    const labels: Record<Exam['examType'], string> = {
      midterm: '期中考试',
      final: '期末考试',
      quiz: '测验',
      assignment: '作业'
    };
    return labels[examType];
  };

  const getExamTypeColor = (examType: Exam['examType']) => {
    const typeColors: Record<Exam['examType'], string> = {
      midterm: 'blue',
      final: 'purple',
      quiz: 'cyan',
      assignment: 'default'
    };
    return typeColors[examType];
  };

  // 将 ISO 字符串当作本地时间处理
  const parseLocalDate = (isoString: string): Date => {
    const s = isoString.replace('Z', '');
    return new Date(s);
  };

  // 检查是否超过截止时间
  const isDeadlinePassed = (exam: Exam): boolean => {
    if (!exam.deadlineAt) return false;
    return parseLocalDate(exam.deadlineAt) < new Date();
  };

  // 检查考试时间是否还未到
  const isExamNotStarted = (exam: Exam): boolean => {
    if (!exam.examDate) return false;
    return parseLocalDate(exam.examDate) > new Date();
  };

  // 在组件顶层计算数据 - 遵守 Hooks 规则
  const exams: Exam[] = useMemo(() => {
    if (!courseId || !examsResult?.data) return [];
    return Array.isArray(examsResult.data) ? examsResult.data : [];
  }, [courseId, examsResult]);

  const studentExamMap = useMemo(() => {
    const map = new Map<string, StudentExam>();
    if (!courseId || !studentExamsResult?.success || !studentExamsResult?.data) return map;

    const studentExams = Array.isArray(studentExamsResult.data)
      ? (studentExamsResult.data as any[])
      : [];

    studentExams
      .filter((se: any) => se.exam?.courseId === courseId)
      .forEach((se: any) => {
        const existing = map.get(se.exam.id);
        if (!existing || se.status === 'in_progress' || existing.status !== 'in_progress') {
          map.set(se.exam.id, se);
        }
      });

    return map;
  }, [courseId, studentExamsResult]);

  const getStudentExamStatus = useCallback((exam: Exam) => {
    const studentExam = studentExamMap.get(exam.id);
    if (!studentExam) return { status: 'not_started', label: '未开始', color: 'default' as const };

    switch (studentExam.status) {
      case 'in_progress':
        return { status: 'in_progress', label: '进行中', color: 'processing' as const };
      case 'submitted':
        return { status: 'submitted', label: '待批改', color: 'warning' as const };
      case 'graded':
        return { status: 'graded', label: '已批改', color: 'success' as const };
      default:
        return { status: 'not_started', label: '未开始', color: 'default' as const };
    }
  }, [studentExamMap]);

  // 过滤和排序后的考试列表 - 在顶层使用 useMemo
  const filteredAndSortedExams = useMemo(() => {
    if (exams.length === 0) return [];

    let result = [...exams];

    // 按状态过滤
    if (statusFilter !== 'all') {
      result = result.filter((exam: Exam) => {
        const examStatus = getStudentExamStatus(exam);
        return examStatus.status === statusFilter;
      });
    }

    // 按及格状态过滤（仅对已批改的考试有效）
    if (passFilter !== 'all') {
      result = result.filter((exam: Exam) => {
        const studentExam = studentExamMap.get(exam.id);
        if (!studentExam || studentExam.status !== 'graded') {
          return false;
        }
        return passFilter === 'passed' ? studentExam.passed : !studentExam.passed;
      });
    }

    // 按考试时间倒序排序（越晚的越靠前）
    result.sort((a: Exam, b: Exam) => {
      const dateA = a.examDate ? new Date(a.examDate).getTime() : 0;
      const dateB = b.examDate ? new Date(b.examDate).getTime() : 0;
      return dateB - dateA;
    });

    return result;
  }, [exams, statusFilter, passFilter, studentExamMap, getStudentExamStatus]);

  // 计算已完成数量
  const completedCount = useMemo(() => {
    let count = 0;
    studentExamMap.forEach((se: StudentExam) => {
      if (se.status === 'graded') count++;
    });
    return count;
  }, [studentExamMap]);

  if (isLoadingEnrollments || (courseId && (isLoadingCourse || isLoadingExams))) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (courseId) {
    console.log('Mode 1: Showing exams for specific course, courseId:', courseId);
    console.log('courseData:', courseData);
    console.log('examsResult:', examsResult);

    if (!courseData?.data) {
      console.log('Course data not loaded yet or failed');
      if (!isLoadingCourse) {
        return (
          <div style={{ padding: 24 }}>
            <Alert message="无法加载课程信息" type="error" />
          </div>
        );
      }
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <Spin size="large" />
        </div>
      );
    }

    const course = courseData.data;

    console.log('Rendering course exams view, course:', course.title);
    console.log('Exams count:', exams.length);
    console.log('Student exams:', Array.from(studentExamMap.entries()));

    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: colors.background }}>
        <div style={{ flexGrow: 1, overflow: 'auto', padding: isMobile ? '12px' : '24px 32px' }}>
          {/* 紧凑统计卡片 */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr 1fr', gap: isMobile ? 6 : 16, marginBottom: isMobile ? 8 : 20 }}>
            {[
              { label: '考试系统', val: exams.length, icon: <ScheduleOutlined />, color: colors.primary, sub: `已完成 ${completedCount} · 进行中 ${exams.filter(e => getStudentExamStatus(e).status === 'in_progress').length}` },
              { label: '可用考试', val: exams.length, icon: <CalendarOutlined />, color: colors.primary, sub: '' },
              { label: '已完成', val: completedCount, icon: <CheckCircleOutlined />, color: '#10B981', sub: '' },
              { label: '未完成', val: exams.length - completedCount, icon: <ClockCircleOutlined />, color: '#D16900', sub: '' },
            ].map((item, i) => (
              <div key={i} style={{
                background: i === 0 ? 'rgba(37,115,230,0.04)' : '#fff',
                borderRadius: isMobile ? 10 : 12,
                padding: isMobile ? '8px 10px' : 20,
                display: 'flex',
                alignItems: 'center',
                gap: isMobile ? 8 : 14,
                boxShadow: i === 0 ? '0 1px 4px rgba(37,115,230,0.08)' : '0 1px 3px rgba(0,0,0,0.04)',
                border: i === 0 ? '1px solid rgba(37,115,230,0.08)' : 'none',
              }}>
                <div style={{
                  width: isMobile ? 36 : 48, height: isMobile ? 36 : 48, borderRadius: isMobile ? 10 : 14,
                  background: i === 0 ? `linear-gradient(135deg, ${colors.primary}18 0%, ${colors.primary}08 100%)` : '#f5f5f5',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {React.cloneElement(item.icon as React.ReactElement, { style: { fontSize: isMobile ? 16 : 22, color: item.color } })}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: isMobile ? 20 : 32, fontWeight: 700, lineHeight: 1.15, color: colors.textPrimary }}>
                    {item.val}
                  </div>
                  <div style={{ fontSize: isMobile ? 10 : 12, color: colors.textSecondary }}>
                    {item.label}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 考试列表 */}
          <div style={{
            background: '#FFFFFF', borderRadius: 12,
            padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            {/* 标题 + 过滤器 */}
            <div style={{
              display: 'flex', flexDirection: isMobile ? 'column' : 'row',
              alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between',
              marginBottom: isMobile ? 10 : 16, gap: 8,
            }}>
              <div>
                <h2 style={{
                  fontSize: isMobile ? 16 : 18, fontWeight: 700,
                  fontFamily: "'Manrope', sans-serif",
                  color: colors.textPrimary, margin: 0,
                }}>
                  考试列表
                </h2>
                <p style={{ fontSize: isMobile ? 12 : 13, color: colors.textSecondary, margin: '4px 0 0' }}>
                  {course.title} 的全部考试
                </p>
              </div>
              <Space size="middle" wrap>
                <Segmented
                  value={viewMode}
                  onChange={(value) => setViewMode(value as 'card' | 'list')}
                  options={[
                    { value: 'card', icon: <AppstoreOutlined /> },
                    { value: 'list', icon: <UnorderedListOutlined /> },
                  ]}
                />
                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  style={{ width: 140 }}
                  options={[
                    { value: 'all', label: '全部状态' },
                    { value: 'not_started', label: '未开始' },
                    { value: 'in_progress', label: '进行中' },
                    { value: 'submitted', label: '待批改' },
                    { value: 'graded', label: '已批改' },
                  ]}
                />
                <Select
                  value={passFilter}
                  onChange={setPassFilter}
                  style={{ width: 140 }}
                  options={[
                    { value: 'all', label: '全部结果' },
                    { value: 'passed', label: '及格' },
                    { value: 'failed', label: '不及格' },
                  ]}
                />
              </Space>
            </div>

          {filteredAndSortedExams.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <Text type="secondary">{exams.length === 0 ? '该课程暂无考试' : '没有符合筛选条件的考试'}</Text>
            </div>
          ) : viewMode === 'card' ? (
            <Row gutter={[24, 24]}>
              {filteredAndSortedExams.map((exam: Exam) => {
                const examStatus = getStudentExamStatus(exam);
                const studentExam = studentExamMap.get(exam.id);
                const deadlinePassed = isDeadlinePassed(exam);
                const examNotStarted = isExamNotStarted(exam);

                return (
                  <Col key={exam.id} xs={24} sm={12} lg={8} xl={6}>
                    <Card
                      hoverable
                      style={{ 
                        height: '100%', 
                        borderRadius: 8,
                        border: '1px solid #e8e8e8',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                      }}
                      styles={{ body: { padding: 0 } }}
                    >
                      <div style={{ padding: '20px 20px 16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <Tag 
                            color={getExamTypeColor(exam.examType)}
                            style={{ margin: 0, borderRadius: 4 }}
                          >
                            {getExamTypeLabel(exam.examType)}
                          </Tag>
                          <Tag 
                            color={examStatus.color}
                            icon={examStatus.status === 'graded' ? <CheckCircleOutlined /> : (examStatus.status === 'in_progress' ? <ClockCircleOutlined /> : undefined)}
                            style={{ borderRadius: 4 }}
                          >
                            {examStatus.label}
                          </Tag>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Text strong style={{ fontSize: 16 }}>
                            {exam.title}
                          </Text>
                          {exam.description && (
                            <Popover content={<div style={{ maxWidth: 200 }}>{exam.description}</div>} trigger="hover">
                              <InfoCircleOutlined style={{ color: '#8c8c8c', cursor: 'pointer' }} />
                            </Popover>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: 24, padding: '12px 0', borderTop: '1px solid #f0f0f0', borderBottom: '1px solid #f0f0f0', marginTop: 12 }}>
                          <div>
                            <div style={{ fontSize: 12, color: '#8c8c8c' }}>时长</div>
                            <div style={{ fontSize: 15, fontWeight: 500 }}>{exam.durationMinutes} 分钟</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 12, color: '#8c8c8c' }}>总分</div>
                            <div style={{ fontSize: 15, fontWeight: 600, color: colors.primary }}>{exam.totalScore || 0}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 12, color: '#8c8c8c' }}>及格线</div>
                            <div style={{ fontSize: 15, fontWeight: 500, color: '#faad14' }}>{exam.passingScore || 0}</div>
                          </div>
                          {studentExam && studentExam.status === 'graded' && (
                            <div>
                              <div style={{ fontSize: 12, color: '#8c8c8c' }}>得分</div>
                              <div style={{ fontSize: 15, fontWeight: 600, color: studentExam.passed ? '#52c41a' : '#ff4d4f' }}>
                                {studentExam.score}
                              </div>
                            </div>
                          )}
                        </div>

                        <div style={{ marginTop: 16 }}>
                          {exam.examDate && (
                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, fontSize: 13, color: '#595959' }}>
                              <CalendarOutlined style={{ marginRight: 8, color: colors.primary }} />
                              <span>考试时间：{exam.examDate.replace('T', ' ').substring(0, 16)}</span>
                            </div>
                          )}
                          {exam.deadlineAt && (
                            <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, color: deadlinePassed ? '#ff4d4f' : '#595959' }}>
                              <ClockCircleOutlined style={{ marginRight: 8, color: deadlinePassed ? '#ff4d4f' : colors.primary }} />
                              <span>截止时间：{exam.deadlineAt.replace('T', ' ').substring(0, 16)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ padding: '8px 20px 16px', background: '#fafafa', borderTop: '1px solid #f0f0f0' }}>
                        {deadlinePassed && examStatus.status === 'not_started' && (
                          <Button
                            block
                            icon={<ClockCircleOutlined />}
                            disabled
                          >
                            已过截止时间
                          </Button>
                        )}
                        {examNotStarted && examStatus.status === 'not_started' && !deadlinePassed && (
                          <Button
                            block
                            icon={<ClockCircleOutlined />}
                            disabled
                          >
                            考试时间未到
                          </Button>
                        )}
                        {!deadlinePassed && !examNotStarted && examStatus.status === 'not_started' && (
                          <Button
                            type="primary"
                            block
                            icon={<PlayCircleOutlined />}
                            style={{ height: 40, fontSize: 14 }}
                            onClick={() => navigate(`/dashboard/exam-taking/${exam.id}`)}
                          >
                            开始考试
                          </Button>
                        )}
                        {examStatus.status === 'in_progress' && (
                          <Button
                            type="primary"
                            block
                            icon={<PlayCircleOutlined />}
                            style={{ height: 40, fontSize: 14, background: '#faad14', borderColor: '#faad14' }}
                            onClick={() => navigate(`/dashboard/exam-taking/${exam.id}`)}
                          >
                            继续考试
                          </Button>
                        )}
                        {examStatus.status === 'submitted' && (
                          <Button
                            block
                            disabled
                          >
                            待批改
                          </Button>
                        )}
                        {examStatus.status === 'graded' && (
                          <Button
                            block
                            icon={<FileTextOutlined />}
                            onClick={() => navigate(`/dashboard/exam-taking/${exam.id}?mode=view`)}
                          >
                            查看成绩
                          </Button>
                        )}
                      </div>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          ) : (
            // 列表视图
            <Card styles={{ body: { padding: isMobile ? 0 : undefined } }}>
              <div style={{ overflowX: 'auto' }}>
              <Table
                dataSource={filteredAndSortedExams}
                rowKey="id"
                pagination={false}
                size={isMobile ? 'small' : 'middle'}
                columns={[
                  {
                    title: isMobile ? '名称' : '考试名称',
                    dataIndex: 'title',
                    key: 'title',
                    render: (text: string, exam: Exam) => (
                      <Space size={4} style={{ maxWidth: "100%" }}>
                        <Tooltip title={text} mouseEnterDelay={0.3}>
                          <Text strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>{text}</Text>
                        </Tooltip>
                        <Tag color={getExamTypeColor(exam.examType)} style={{ flexShrink: 0 }}>
                          {getExamTypeLabel(exam.examType)}
                        </Tag>
                      </Space>
                    ),
                  },
                  {
                    title: isMobile ? '状态' : '考试状态',
                    key: 'status',
                    render: (_: any, exam: Exam) => {
                      const examStatus = getStudentExamStatus(exam);
                      return (
                        <Tag
                          color={examStatus.color}
                          icon={examStatus.status === 'graded' ? <CheckCircleOutlined /> : (examStatus.status === 'in_progress' ? <ClockCircleOutlined /> : undefined)}
                        >
                          {examStatus.label}
                        </Tag>
                      );
                    },
                  },
                  {
                    title: isMobile ? '时间' : '考试时间',
                    dataIndex: 'examDate',
                    key: 'examDate',
                    responsive: ['md'],
                    render: (date: string) => date ? date.replace('T', ' ').substring(0, 19) : '-',
                  },
                  {
                    title: isMobile ? '截止' : '截止时间',
                    dataIndex: 'deadlineAt',
                    key: 'deadlineAt',
                    responsive: ['md'],
                    render: (date: string, exam: Exam) => {
                      const passed = isDeadlinePassed(exam);
                      return date ? (
                        <Text type={passed ? 'danger' : undefined}>
                          {date.replace('T', ' ').substring(0, 19)}
                        </Text>
                      ) : '-';
                    },
                  },
                  {
                    title: '时长',
                    dataIndex: 'durationMinutes',
                    key: 'durationMinutes',
                    responsive: ['md'],
                    render: (minutes: number) => `${minutes} 分钟`,
                  },
                  {
                    title: isMobile ? '得分/及格' : '总分/及格分',
                    key: 'scores',
                    responsive: ['md'],
                    render: (_: any, exam: Exam) => `${exam.totalScore || 0} / ${exam.passingScore || 0}`,
                  },
                  {
                    title: '得分',
                    key: 'score',
                    responsive: ['md'],
                    render: (_: any, exam: Exam) => {
                      const studentExam = studentExamMap.get(exam.id);
                      if (!studentExam || studentExam.status === 'in_progress') return '-';
                      return (
                        <Text strong style={{ color: studentExam.passed ? '#52c41a' : '#ff4d4f' }}>
                          {studentExam.score} 分
                        </Text>
                      );
                    },
                  },
                  {
                    title: '结果',
                    key: 'passed',
                    responsive: ['md'],
                    render: (_: any, exam: Exam) => {
                      const studentExam = studentExamMap.get(exam.id);
                      if (!studentExam || studentExam.status !== 'graded') return '-';
                      return (
                        <Tag color={studentExam.passed ? 'success' : 'error'}>
                          {studentExam.passed ? '及格' : '不及格'}
                        </Tag>
                      );
                    },
                  },
                  {
                    title: '操作',
                    key: 'action',
                    render: (_: any, exam: Exam) => {
                      const examStatus = getStudentExamStatus(exam);
                      const deadlinePassed = isDeadlinePassed(exam);
                      const examNotStarted = isExamNotStarted(exam);
                      if (deadlinePassed && examStatus.status === 'not_started') {
                        return (
                          <Button size="small" disabled icon={<ClockCircleOutlined />}>
                            已过截止时间
                          </Button>
                        );
                      }
                      if (examNotStarted && examStatus.status === 'not_started' && !deadlinePassed) {
                        return (
                          <Button size="small" disabled icon={<ClockCircleOutlined />}>
                            考试时间未到
                          </Button>
                        );
                      }
                      if (examStatus.status === 'not_started') {
                        return (
                          <Button
                            type="primary"
                            size="small"
                            icon={<PlayCircleOutlined />}
                            onClick={() => navigate(`/dashboard/exam-taking/${exam.id}`)}
                          >
                            开始考试
                          </Button>
                        );
                      }
                      if (examStatus.status === 'in_progress') {
                        return (
                          <Button
                            type="primary"
                            size="small"
                            icon={<PlayCircleOutlined />}
                            style={{ background: '#faad14', borderColor: '#faad14' }}
                            onClick={() => navigate(`/dashboard/exam-taking/${exam.id}`)}
                          >
                            继续考试
                          </Button>
                        );
                      }
                      return (
                        <Button size="small" disabled>
                          {examStatus.status === 'graded' ? '已完成' : '待批改'}
                        </Button>
                      );
                    },
                  },
                ]}
              />
              </div>
            </Card>
          )}
          </div>
        </div>
      </div>
    );
  }

  // 无课程上下文：不再展示“可选课程”网格，避免用户在多门选课间跳转
  // 需通过当前课程入口进入（与 experiment-courses / learning-recommendations 一致）
  // 若清空了 selectedCourse，则提示用户返回首页选择课程，而非展示全部已选/全部课程供跳转
  return (
    <div style={{ padding: 48, textAlign: 'center' }}>
      <Alert
        message="未选择当前课程"
        description="请先通过首页或课程门面页选择一门课程，再查看该课程的考试。"
        type="info"
        showIcon
        style={{ maxWidth: 560, margin: '0 auto' }}
      />
      <Button type="primary" style={{ marginTop: 16 }} onClick={() => navigate('/dashboard')}>
        返回首页选择课程
      </Button>
    </div>
  );
}

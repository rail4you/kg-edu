import { useQuery } from '@tanstack/react-query';
import { Typography, Button, Spin, Alert, Row, Col, Empty, Space } from 'antd';
import { PlayCircleOutlined, ArrowLeftOutlined, CameraOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/auth-context';
import { getCurrentTenant } from '@/lib/tenant';
import { getExamsByCourse } from '@/lib/ash_rpc';
import { getHeaders, extractArrayData } from '@/utils/api-helpers';
import { PageHead, ProtoTag } from "@/components/proto";
import ExamMonitorModal from "@/components/exam/ExamMonitorModal";

const { Text } = Typography;

interface Exam {
  id: string;
  title: string;
  description?: string;
  examType: 'midterm' | 'final' | 'quiz' | 'assignment';
  examDate?: string;
  durationMinutes: number;
  totalScore: number;
  passingScore: number;
}

export default function ExamList() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { courseId } = useParams();
  const currentTenant = getCurrentTenant();
  const [monitorExam, setMonitorExam] = useState<Exam | null>(null);

  const { data: examsResult, isLoading, error } = useQuery({
    queryKey: ['exams', 'course', courseId],
    queryFn: async () => {
      if (!courseId) return [];

      const result = await getExamsByCourse({
        tenant: currentTenant?.schemaName || '',
        input: { courseId },
        fields: ['id', 'title', 'description', 'examType', 'examDate', 'durationMinutes', 'totalScore', 'passingScore'],
        headers: getHeaders(user)
      });

      return extractArrayData(result);
    },
    enabled: !!courseId && !!user
  });

  const getExamTypeLabel = (examType: Exam['examType']) => {
    const labels: Record<Exam['examType'], string> = {
      midterm: '期中考试',
      final: '期末考试',
      quiz: '测验',
      assignment: '作业'
    };
    return labels[examType];
  };

  if (authLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!courseId) {
    return (
      <div style={{ padding: 24 }}>
        <Alert type="error" message="课程ID缺失" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <Alert type="error" message={`加载考试列表失败: ${(error as Error).message}`} />
      </div>
    );
  }

  const exams = examsResult || [];

  return (
    <div className="pu-page">
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(-1)}
        style={{ paddingLeft: 0, marginBottom: 6 }}
      >
        返回
      </Button>
      <PageHead
        title="课程考试"
        description={`共 ${exams.length} 场可用考试，选择一场开始作答。`}
      />

      {exams.length === 0 ? (
        <div className="pu-card" style={{ padding: 48, textAlign: 'center' }}>
          <Empty description="该课程暂无考试" />
        </div>
      ) : (
        <Row gutter={[20, 20]}>
          {exams.map((exam: Exam) => (
            <Col xs={24} sm={12} lg={8} xl={6} key={exam.id}>
              <section
                className="pu-card"
                style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 20 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 14 }}>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 650, color: '#202f47', lineHeight: 1.5, flex: 1 }}>
                    {exam.title}
                  </h3>
                  <ProtoTag tone={exam.examType === 'final' ? 'amber' : 'blue'}>
                    {getExamTypeLabel(exam.examType)}
                  </ProtoTag>
                </div>

                {exam.description && (
                  <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.8, marginBottom: 14 }}>
                    {exam.description}
                  </p>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto', flexGrow: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#64748b' }}>考试时长</span>
                    <Text strong>{exam.durationMinutes} 分钟</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#64748b' }}>总分</span>
                    <Text strong>{exam.totalScore || 100} 分</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#64748b' }}>及格分</span>
                    <Text strong>{exam.passingScore || 0} 分</Text>
                  </div>
                  {exam.examDate && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, gap: 12 }}>
                      <span style={{ color: '#64748b', whiteSpace: 'nowrap' }}>考试时间</span>
                      <Text strong style={{ textAlign: 'right' }}>{new Date(exam.examDate).toLocaleString('zh-CN')}</Text>
                    </div>
                  )}
                </div>

                <Space style={{ marginTop: 18, width: '100%' }} direction="vertical" size={8}>
                  <Button
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    onClick={() => navigate(`/dashboard/exam-taking/${exam.id}`)}
                    style={{ width: '100%' }}
                  >
                    开始考试
                  </Button>
                  <Button
                    icon={<CameraOutlined />}
                    onClick={() => setMonitorExam(exam)}
                    style={{ width: '100%' }}
                  >
                    监控
                  </Button>
                </Space>
              </section>
            </Col>
          ))}
        </Row>
      )}

      <ExamMonitorModal
        open={!!monitorExam}
        exam={monitorExam ? { id: monitorExam.id, title: monitorExam.title } : null}
        onClose={() => setMonitorExam(null)}
      />
    </div>
  );
}

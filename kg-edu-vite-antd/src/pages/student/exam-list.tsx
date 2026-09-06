import { useQuery } from '@tanstack/react-query';
import { Card, Typography, Button, Tag, Spin, Alert, Row, Col, Empty } from 'antd';
import { PlayCircleOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/auth-context';
import { getCurrentTenant } from '@/lib/tenant';
import { getExamsByCourse } from '@/lib/ash_rpc';
import { getHeaders, extractArrayData } from '@/utils/api-helpers';
import { themeColors as colors } from "@/styles/theme";

const { Title, Text } = Typography;

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

  const getExamTypeColor = (examType: Exam['examType']) => {
    const colors: Record<Exam['examType'], string> = {
      midterm: 'blue',
      final: 'purple',
      quiz: 'cyan',
      assignment: 'default'
    };
    return colors[examType];
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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#F8F9FA' }}>
      <div style={{ padding: 24, background: 'white', borderBottom: '1px solid #e0e0e0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate(-1)}
            >
              返回
            </Button>
            <Title level={2} style={{ margin: 0, fontWeight: 700, color: '#333' }}>
              课程考试
            </Title>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
          <div>
            <Title level={1} style={{ margin: 0, color: colors.primary }}>{exams.length}</Title>
            <Text type="secondary">可用考试</Text>
          </div>
        </div>
      </div>

      <div style={{ flexGrow: 1, padding: 24 }}>
        {exams.length === 0 ? (
          <Card style={{ padding: 32, textAlign: 'center' }}>
            <Empty description="该课程暂无考试" />
          </Card>
        ) : (
          <Row gutter={[24, 24]}>
            {exams.map((exam: Exam) => (
              <Col xs={24} sm={12} lg={8} xl={6} key={exam.id}>
                <Card
                  hoverable
                  style={{ height: '100%' }}
                  styles={{ body: { display: 'flex', flexDirection: 'column', flexGrow: 1 } }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <Title level={5} style={{ margin: 0, fontWeight: 600, flex: 1, marginRight: 8 }}>
                      {exam.title}
                    </Title>
                    <Tag color={getExamTypeColor(exam.examType)}>
                      {getExamTypeLabel(exam.examType)}
                    </Tag>
                  </div>

                  {exam.description && (
                    <Text type="secondary" style={{ marginBottom: 16, display: 'block' }}>
                      {exam.description}
                    </Text>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16, flexGrow: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text type="secondary">考试时长:</Text>
                      <Text strong>{exam.durationMinutes} 分钟</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text type="secondary">总分:</Text>
                      <Text strong>{exam.totalScore || 0} 分</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text type="secondary">及格分:</Text>
                      <Text strong>{exam.passingScore || 0} 分</Text>
                    </div>
                    {exam.examDate && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text type="secondary">考试时间:</Text>
                        <Text strong>{new Date(exam.examDate).toLocaleString('zh-CN')}</Text>
                      </div>
                    )}
                  </div>

                  <Button
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    onClick={() => navigate(`/dashboard/exam-taking/${exam.id}`)}
                    style={{ marginTop: 16, width: '100%' }}
                  >
                    开始考试
                  </Button>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </div>
    </div>
  );
}

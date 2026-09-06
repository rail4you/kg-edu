import * as React from 'react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  Button,
  Typography,
  Space,
  Input,
  Spin,
  Alert,
  Divider,
  Tag,
  Radio,
  Select,
  Progress,
  Modal,
  List,
  Checkbox,
  Tooltip,
  Grid,
  Row,
  Col,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  BookOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/auth/auth-context';
import { getCurrentTenant } from '@/lib/tenant';
import { getAuthHeaders } from '@/lib/auth';
import {
  getExam,
  getAnswersByStudentExam,
  continueOrStartExam,
  getInProgressExam,
  getStudentExamsByStudent,
} from '@/lib/ash_rpc';
import { themeColors as colors } from "@/styles/theme";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface ExerciseOption {
  id: string;
  label: string;
  value: string;
}

interface ExerciseAnswer {
  studentExamAnswerId: string;
  exerciseId: string;
  questionContent: string;
  questionType: string;
  points: number;
  answer: string;
  order?: number;
  options?: ExerciseOption[];
}

const QUESTION_TYPES = {
  multiple_choice: { label: '选择题', color: '#52c41a', icon: '📝', required: true },
  essay: { label: '问答题', color: '#fa8c16', icon: '✍️', required: false },
  fill_blank: { label: '填空题', color: '#722ed1', icon: '✏️', required: true },
  true_false: { label: '判断题', color: colors.primary, icon: '🔍', required: true },
  text: { label: '文本题', color: '#757575', icon: '📄', required: false },
} as const;

type QuestionType = keyof typeof QUESTION_TYPES;

const MultipleChoiceOptions: React.FC<{
  options: ExerciseOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}> = ({ options, value, onChange, disabled }) => {
  if (!options || options.length === 0) {
    return <Alert type="warning" message="该选择题没有可用选项" style={{ marginTop: 8 }} />;
  }

  return (
    <Radio.Group value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {options.map((option, index) => (
          <div
            key={option.id || index}
            onClick={() => !disabled && onChange(option.value)}
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              cursor: disabled ? 'not-allowed' : 'pointer',
              border: `1.5px solid ${value === option.value ? colors.primary : '#e0e0e0'}`,
              backgroundColor: value === option.value ? '#e6f7ff' : '#fff',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Radio value={option.value} style={{ marginRight: 0 }}>
              <span />
            </Radio>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 24, height: 24, borderRadius: '50%',
              background: value === option.value ? colors.primary : '#f0f0f0',
              color: value === option.value ? '#fff' : '#666',
              fontSize: 12, fontWeight: 700,
              flexShrink: 0,
            }}>
              {String.fromCharCode(65 + index)}
            </span>
            <span style={{ fontSize: 14, color: '#333', fontWeight: value === option.value ? 600 : 400 }}>
              {option.label || option.value}
            </span>
          </div>
        ))}
      </div>
    </Radio.Group>
  );
};

const FillBlankInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
  return (
    <Input
      placeholder="请输入答案"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={{ marginTop: 8 }}
    />
  );
};

const TrueFalseOptions: React.FC<{
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
  return (
    <Radio.Group value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      <Row gutter={16}>
        <Col span={12}>
          <Card
            size="small"
            onClick={() => !disabled && onChange('true')}
            style={{
              textAlign: 'center',
              cursor: disabled ? 'not-allowed' : 'pointer',
              borderColor: value === 'true' ? '#52c41a' : '#E0E0E0',
              backgroundColor: value === 'true' ? '#f6ffed' : '#fff',
            }}
            hoverable={!disabled}
          >
            <Radio value="true">
              <Space direction="vertical" size={0}>
                <Text type={value === 'true' ? 'success' : 'secondary'} style={{ fontSize: 24 }}>
                  ✓
                </Text>
                <Text strong>正确</Text>
              </Space>
            </Radio>
          </Card>
        </Col>
        <Col span={12}>
          <Card
            size="small"
            onClick={() => !disabled && onChange('false')}
            style={{
              textAlign: 'center',
              cursor: disabled ? 'not-allowed' : 'pointer',
              borderColor: value === 'false' ? '#ff4d4f' : '#E0E0E0',
              backgroundColor: value === 'false' ? '#fff2f0' : '#fff',
            }}
            hoverable={!disabled}
          >
            <Radio value="false">
              <Space direction="vertical" size={0}>
                <Text type={value === 'false' ? 'danger' : 'secondary'} style={{ fontSize: 24 }}>
                  ✗
                </Text>
                <Text strong>错误</Text>
              </Space>
            </Radio>
          </Card>
        </Col>
      </Row>
    </Radio.Group>
  );
};

const EssayInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        position: 'absolute', top: 6, right: 8,
        fontSize: 11, color: '#bbb',
        pointerEvents: 'none',
      }}>
        {value.length} 字
      </div>
      <TextArea
        rows={5}
        placeholder="请输入你的答案..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          borderRadius: 8,
          fontSize: 14,
          lineHeight: 1.6,
          resize: 'vertical',
        }}
      />
    </div>
  );
};

const QuestionCard: React.FC<{
  answer: ExerciseAnswer;
  index: number;
  answers: Record<string, string>;
  onAnswerChange: (id: string, value: string) => void;
  disabled: boolean;
}> = ({ answer, index, answers, onAnswerChange, disabled }) => {
  const typeConfig = QUESTION_TYPES[answer.questionType as QuestionType] || QUESTION_TYPES.text;
  const currentAnswer = answers[answer.studentExamAnswerId] || '';
  const isAnswered = currentAnswer.trim() !== '';

  const renderInput = () => {
    switch (answer.questionType) {
      case 'multiple_choice':
        return (
          <MultipleChoiceOptions
            options={answer.options || []}
            value={currentAnswer}
            onChange={(value) => onAnswerChange(answer.studentExamAnswerId, value)}
            disabled={disabled}
          />
        );
      case 'fill_blank':
        return (
          <FillBlankInput
            value={currentAnswer}
            onChange={(value) => onAnswerChange(answer.studentExamAnswerId, value)}
            disabled={disabled}
          />
        );
      case 'true_false':
        return (
          <TrueFalseOptions
            value={currentAnswer}
            onChange={(value) => onAnswerChange(answer.studentExamAnswerId, value)}
            disabled={disabled}
          />
        );
      case 'essay':
      default:
        return (
          <EssayInput
            value={currentAnswer}
            onChange={(value) => onAnswerChange(answer.studentExamAnswerId, value)}
            disabled={disabled}
          />
        );
    }
  };

  return (
    <Card
      id={`question-${answer.studentExamAnswerId}`}
      style={{
        marginBottom: 12,
        borderRadius: 10,
        borderLeft: `4px solid ${isAnswered ? '#52c41a' : typeConfig.color}`,
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}
      styles={{ body: { padding: 16 } }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        <span style={{
          fontSize: 12, fontWeight: 700, color: '#fff',
          background: 'linear-gradient(135deg, #2573e6, #1a5cc8)',
          padding: '2px 10px', borderRadius: 4,
          lineHeight: '22px',
        }}>
          第 {index + 1} 题
        </span>
        <span style={{
          fontSize: 12, fontWeight: 600,
          backgroundColor: typeConfig.color + '18',
          color: typeConfig.color,
          padding: '2px 10px', borderRadius: 4,
          lineHeight: '22px',
          border: `1px solid ${typeConfig.color}30`,
        }}>
          {typeConfig.icon} {typeConfig.label}
        </span>
        <span style={{
          fontSize: 12, fontWeight: 500,
          color: '#888',
          padding: '2px 8px', borderRadius: 4,
          background: '#f5f5f5',
          lineHeight: '22px',
        }}>
          {answer.points} 分
        </span>
        {typeConfig.required && (
          <span style={{
            fontSize: 12, fontWeight: 600,
            color: '#d48806',
            padding: '2px 8px', borderRadius: 4,
            background: '#fff7e6',
            lineHeight: '22px',
          }}>
            必答
          </span>
        )}
        {isAnswered && (
          <span style={{
            fontSize: 12, fontWeight: 600,
            color: '#52c41a',
            padding: '2px 8px', borderRadius: 4,
            background: '#f6ffed',
            lineHeight: '22px',
          }}>
            ✓ 已作答
          </span>
        )}
      </div>

      <div style={{
        fontSize: 14, lineHeight: 1.7,
        color: '#1a1a1a',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        marginBottom: 12,
        padding: '8px 12px',
        background: '#fafbfc',
        borderRadius: 6,
      }}>
        {answer.questionContent}
      </div>

      <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
        {renderInput()}
      </div>
    </Card>
  );
};

const QuestionNavigator: React.FC<{
  answers: ExerciseAnswer[];
  currentAnswers: Record<string, string>;
  activeType: string;
  onTypeChange: (type: string) => void;
  onQuestionClick: (id: string) => void;
}> = ({ answers, currentAnswers, activeType, onTypeChange, onQuestionClick }) => {
  const stats = useMemo(() => {
    const result: Record<string, { total: number; answered: number }> = {};

    answers.forEach((answer) => {
      const type = answer.questionType;
      if (!result[type]) {
        result[type] = { total: 0, answered: 0 };
      }
      result[type].total++;
      if (currentAnswers[answer.studentExamAnswerId]?.trim()) {
        result[type].answered++;
      }
    });

    return result;
  }, [answers, currentAnswers]);

  const questionTypes = useMemo(() => {
    const types = new Set<string>();
    answers.forEach((a) => types.add(a.questionType));
    return Array.from(types);
  }, [answers]);

  return (
    <Card style={{ position: 'sticky', top: 20 }}>
      <Title level={5} style={{ marginBottom: 16 }}>
        答题进度
      </Title>

      <Select
        style={{ width: '100%', marginBottom: 16 }}
        value={activeType}
        onChange={onTypeChange}
        options={[
          {
            value: 'all',
            label: (
              <Space>
                <span>📋</span>
                <span>全部题目 ({answers.length})</span>
              </Space>
            ),
          },
          ...questionTypes.map((type) => {
            const config = QUESTION_TYPES[type as QuestionType] || QUESTION_TYPES.text;
            const stat = stats[type] || { total: 0, answered: 0 };
            return {
              value: type,
              label: (
                <Space>
                  <span>{config.icon}</span>
                  <span>
                    {config.label} (已答 {stat.answered}/{stat.total})
                  </span>
                </Space>
              ),
            };
          }),
        ]}
      />

      <Card
        size="small"
        style={{
          marginBottom: 16,
          backgroundColor: (activeType === 'all' ? '#757575' : QUESTION_TYPES[activeType as QuestionType]?.color || '#757575') + '10',
          borderColor: (activeType === 'all' ? '#757575' : QUESTION_TYPES[activeType as QuestionType]?.color || '#757575') + '40',
        }}
      >
        <Space>
          <span style={{ fontSize: 20 }}>
            {activeType === 'all' ? '📋' : QUESTION_TYPES[activeType as QuestionType]?.icon}
          </span>
          <Text strong style={{ color: activeType === 'all' ? '#757575' : QUESTION_TYPES[activeType as QuestionType]?.color }}>
            {activeType === 'all'
              ? `全部题目 (${answers.length})`
              : (() => {
                  const config = QUESTION_TYPES[activeType as QuestionType] || QUESTION_TYPES.text;
                  const stat = stats[activeType] || { total: 0, answered: 0 };
                  return `${config.label} (已答 ${stat.answered}/${stat.total})`;
                })()}
          </Text>
        </Space>
      </Card>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
        {answers.map((answer, index) => {
          const isAnswered = !!currentAnswers[answer.studentExamAnswerId]?.trim();
          const isActive = activeType === 'all' || activeType === answer.questionType;
          const typeConfig = QUESTION_TYPES[answer.questionType as QuestionType] || QUESTION_TYPES.text;

          if (!isActive) return null;

          return (
            <Tooltip key={answer.studentExamAnswerId} title={`第 ${index + 1} 题`}>
              <Button
                size="small"
                onClick={() => onQuestionClick(answer.studentExamAnswerId)}
                style={{
                  width: 40,
                  height: 40,
                  fontWeight: 600,
                  backgroundColor: isAnswered ? '#52c41a' : '#f0f0f0',
                  color: isAnswered ? '#fff' : 'inherit',
                  border: `2px solid ${isAnswered ? '#52c41a' : typeConfig.color}`,
                }}
              >
                {index + 1}
              </Button>
            </Tooltip>
          );
        })}
      </div>

      <Divider />

      <Title level={5} style={{ marginBottom: 12 }}>
        答题统计
      </Title>
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Text type="secondary">总题数</Text>
          <Text strong>{answers.length}</Text>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Text type="secondary">已作答</Text>
          <Tag color="success">{Object.values(currentAnswers).filter((v) => v?.trim()).length}</Tag>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Text type="secondary">未作答</Text>
          <Tag color="error">{answers.length - Object.values(currentAnswers).filter((v) => v?.trim()).length}</Tag>
        </div>
      </Space>

      <div style={{ marginTop: 16 }}>
        <Text type="secondary" style={{ marginBottom: 8, display: 'block' }}>
          按题型统计
        </Text>
        <Space direction="vertical" style={{ width: '100%' }} size={4}>
          {questionTypes.map((type) => {
            const config = QUESTION_TYPES[type as QuestionType];
            const stat = stats[type] || { total: 0, answered: 0 };
            return (
              <div key={type} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Space size={4}>
                  <span>{config?.icon}</span>
                  <Text type="secondary">{config?.label}</Text>
                </Space>
                <Text type="secondary">
                  {stat.answered}/{stat.total}
                </Text>
              </div>
            );
          })}
        </Space>
      </div>
    </Card>
  );
};

const EXAM_STATE_PREFIX = 'exam_state_';
const getExamStateKey = (examId: string, userId: string) =>
  `${EXAM_STATE_PREFIX}${examId}_${userId}`;

interface ExamState {
  examId: string;
  userId: string;
  studentExamId: string | null;
  startTime: number;
  answers: Record<string, string>;
  lastSaved: number;
}

const saveExamState = (
  examId: string,
  userId: string,
  state: Omit<ExamState, 'examId' | 'userId' | 'lastSaved'>
) => {
  try {
    const key = getExamStateKey(examId, userId);
    const fullState: ExamState = {
      ...state,
      examId,
      userId,
      lastSaved: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(fullState));
  } catch (error) {
    console.error('Failed to save exam state:', error);
  }
};

const loadExamState = (examId: string, userId: string): ExamState | null => {
  try {
    const key = getExamStateKey(examId, userId);
    const data = localStorage.getItem(key);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load exam state:', error);
  }
  return null;
};

const clearExamState = (examId: string, userId: string) => {
  try {
    const key = getExamStateKey(examId, userId);
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Failed to clear exam state:', error);
  }
};

export default function ExamTaking() {
  const { useBreakpoint } = Grid;
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { examId } = useParams();
  const [searchParams] = useSearchParams();
  const viewMode = searchParams.get('mode') === 'view';
  const currentTenant = getCurrentTenant();

  const [studentExamId, setStudentExamId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [activeType, setActiveType] = useState<string>('all');
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [unansweredQuestions, setUnansweredQuestions] = useState<ExerciseAnswer[]>([]);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [examStartTime] = useState<number>(() => {
    if (!examId || !user?.id) return Date.now();
    const savedState = loadExamState(examId, user.id);
    return savedState?.startTime || Date.now();
  });

  const isInitializingRef = useRef(false);

  const { data: examData, isLoading: isLoadingExam } = useQuery({
    queryKey: ['exam', examId],
    queryFn: async () => {
      if (!examId) return null;
      const result = await getExam({
        tenant: currentTenant?.schemaName || '',
        fields: [
          'id',
          'title',
          'description',
          'examType',
          'examDate',
          'deadlineAt',
          'durationMinutes',
          'totalScore',
          'passingScore',
        ],
        input: { id: examId },
        headers: getAuthHeaders(user),
      });
      return result;
    },
    enabled: !!examId && !!user,
  });

  const { data: studentExamData } = useQuery({
    queryKey: ['student-exam-status', examId, user?.id],
    queryFn: async () => {
      if (!examId || !user?.id) return null;
      const result = await getStudentExamsByStudent({
        tenant: currentTenant?.schemaName || '',
        fields: ['id', 'status', 'score', 'passed', 'startedAt', 'submittedAt', { exam: ['id', 'courseId'] }],
        input: { studentId: user.id },
        headers: getAuthHeaders(user),
      });
      return result;
    },
    enabled: !!examId && !!user,
  });

  const currentStudentExam = useMemo(() => {
    if (!studentExamData?.success || !studentExamData?.data) return null;
    const exams = Array.isArray(studentExamData.data) ? studentExamData.data : [];
    return exams.find((se: any) => se.exam?.id === examId);
  }, [studentExamData, examId]);

  const startOrContinueMutation = useMutation({
    mutationFn: async () => {
      if (!examId || !user?.id) {
        throw new Error('Missing examId or userId');
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...getAuthHeaders(user),
      };

      const startPayload = {
        action: 'continue_or_start_exam',
        tenant: currentTenant?.schemaName || '',
        input: {
          examId: examId,
          studentId: user.id,
        },
      };

      const startResponse = await fetch('/rpc/run', {
        method: 'POST',
        headers,
        body: JSON.stringify(startPayload),
      });

      const startResult = await startResponse.json();

      if (!startResult.success) {
        throw new Error('Failed to start or continue exam');
      }

      const payload = {
        action: 'get_in_progress_exam',
        tenant: currentTenant?.schemaName || '',
        input: {
          studentId: user.id,
          examId: examId,
        },
        fields: ['id', 'status', 'startedAt', 'submittedAt', 'examId'],
      };

      const response = await fetch('/rpc/run', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      return response.json();
    },
    onMutate: () => setIsInitializing(true),
    onSuccess: (result) => {
      if (result.success && result.data) {
        const studentExamData = Array.isArray(result.data) ? result.data[0] : result.data;
        if (studentExamData?.id) {
          setStudentExamId(studentExamData.id);
        }
      }
    },
    onError: () => setIsInitializing(false),
    onSettled: () => setIsInitializing(false),
  });

  const { data: answersResult, isLoading: isLoadingAnswers } = useQuery({
    queryKey: ['student-exam-answers', studentExamId],
    queryFn: async () => {
      if (!studentExamId) return { success: true, data: [] };
      const result = await getAnswersByStudentExam({
        tenant: currentTenant?.schemaName || '',
        fields: [
          'id',
          'answer',
          'pointsEarned',
          'graded',
          { exam_exercise: ['points', 'order'] },
          { exercise: ['id', 'title', 'questionContent', 'questionType', 'options'] },
        ],
        input: { studentExamId },
        headers: getAuthHeaders(user),
      });
      return result;
    },
    enabled: !!studentExamId,
    retry: 1,
  });

  const submitExamMutation = useMutation({
    mutationFn: async ({
      studentExamId,
      answers,
    }: {
      studentExamId: string;
      answers: Record<string, string>;
    }) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...getAuthHeaders(user),
      };

      const payload = {
        action: 'submit_exam',
        tenant: currentTenant?.schemaName || '',
        input: {
          studentExamId: studentExamId,
          answers: answers,
        },
        fields: ['id', 'status', 'submittedAt'],
      };

      const response = await fetch('/rpc/run', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.errors?.[0]?.message || 'Failed to submit exam');
      }

      return response.json();
    },
    onSuccess: () => {
      if (examId && user?.id) {
        clearExamState(examId, user.id);
      }
      queryClient.invalidateQueries({ queryKey: ['student-exam', examId, user?.id] });
      message.success('考试提交成功');
      navigate('/dashboard/exam-courses');
    },
  });

  useEffect(() => {
    if (answersResult?.success && answersResult.data) {
      const answerMap: Record<string, string> = {};
      const dataArray = Array.isArray(answersResult.data) ? answersResult.data : [];

      dataArray.forEach((answer: any) => {
        if (answer.answer) {
          answerMap[answer.id] = answer.answer;
        }
      });

      if (examId && user?.id) {
        const savedState = loadExamState(examId, user.id);
        if (savedState?.answers) {
          Object.assign(answerMap, savedState.answers);
        }
      }

      setAnswers(answerMap);
    }
  }, [answersResult, examId, user?.id]);

  useEffect(() => {
    if (examId && user?.id && studentExamId && Object.keys(answers).length > 0) {
      saveExamState(examId, user.id, {
        studentExamId,
        startTime: examStartTime,
        answers,
      });
    }
  }, [answers, examId, user?.id, studentExamId, examStartTime]);

  const handleAnswerChange = (studentExamAnswerId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [studentExamAnswerId]: value }));
  };

  const checkUnansweredQuestions = (): ExerciseAnswer[] => {
    return exerciseAnswers.filter((answer) => {
      const typeConfig = QUESTION_TYPES[answer.questionType as QuestionType];
      if (!typeConfig?.required) return false;
      return !answers[answer.studentExamAnswerId]?.trim();
    });
  };

  const handleSubmitExam = () => {
    if (!studentExamId) return;

    const unanswered = checkUnansweredQuestions();
    setUnansweredQuestions(unanswered);
    setSubmitModalOpen(true);
  };

  const confirmSubmit = () => {
    if (!studentExamId) return;
    setIsSubmitting(true);
    setSubmitModalOpen(false);
    submitExamMutation.mutate({ studentExamId, answers });
  };

  const scrollToQuestion = (id: string) => {
    const element = document.getElementById(`question-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  useEffect(() => {
    if (isInitializingRef.current || studentExamId || isInitializing) return;
    if (examId && user?.id) {
      if (viewMode && currentStudentExam?.id) {
        setStudentExamId(currentStudentExam.id);
      } else if (!viewMode) {
        isInitializingRef.current = true;
        startOrContinueMutation.mutate();
      }
    }
  }, [examId, user?.id, studentExamId, viewMode, currentStudentExam]);

  useEffect(() => {
    if (viewMode) return;
    if (examData?.success && examData.data?.durationMinutes && studentExamId) {
      const duration = examData.data.durationMinutes * 60 * 1000;
      const endTime = examStartTime + duration;

      const initialRemaining = Math.ceil((endTime - Date.now()) / 1000);
      if (initialRemaining <= 0) {
        handleSubmitExam();
        return;
      }
      setTimeRemaining(initialRemaining);

      const timer = setInterval(() => {
        const remaining = endTime - Date.now();
        if (remaining <= 0) {
          clearInterval(timer);
          handleSubmitExam();
        } else {
          setTimeRemaining(Math.ceil(remaining / 1000));
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [examData, studentExamId, examStartTime]);

  if (!examId) {
    return (
      <div style={{ padding: 24 }}>
        <Alert type="error" message="考试ID缺失" />
      </div>
    );
  }

  if (isLoadingExam || isInitializing) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!examData?.success || !examData.data) {
    return (
      <div style={{ padding: 24 }}>
        <Alert type="error" message="加载考试失败" />
      </div>
    );
  }

  const exam = examData.data;

  // 检查是否超过截止时间
  const isDeadlinePassed = exam.deadlineAt && new Date(exam.deadlineAt) < new Date();

  // 如果已超过截止时间且没有开始考试，显示提示
  if (isDeadlinePassed && !studentExamId) {
    return (
      <div style={{ padding: 24, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Card style={{ maxWidth: 500, textAlign: 'center' }}>
          <ClockCircleOutlined style={{ fontSize: 64, color: '#ff4d4f', marginBottom: 24 }} />
          <Title level={3} style={{ marginBottom: 16 }}>已过截止时间</Title>
          <Paragraph type="secondary" style={{ marginBottom: 24 }}>
            该考试的截止时间是 {exam.deadlineAt.replace('T', ' ').substring(0, 19)}，您已无法参加此考试。
          </Paragraph>
          <Button
            type="primary"
            onClick={() => navigate('/dashboard/exam-courses')}
            size="large"
            icon={<ArrowLeftOutlined />}
            style={{
              borderRadius: 8,
              fontWeight: 600,
              height: 42,
              boxShadow: '0 2px 8px rgba(37,115,230,0.25)',
            }}
          >
            返回考试列表
          </Button>
        </Card>
      </div>
    );
  }

  let answersArray: any[] = [];
  if (answersResult?.success && answersResult?.data) {
    if (Array.isArray(answersResult.data)) {
      answersArray = answersResult.data;
    }
  }

  const exerciseAnswers: ExerciseAnswer[] = answersArray
    .map((answer: any) => {
      let options: ExerciseOption[] | undefined;
      if (answer.exercise?.options) {
        try {
          const optionsData =
            typeof answer.exercise.options === 'string'
              ? JSON.parse(answer.exercise.options)
              : answer.exercise.options;
          if (optionsData?.choices && Array.isArray(optionsData.choices)) {
            options = optionsData.choices.map((choice: string, index: number) => ({
              id: String(index),
              label: choice,
              value: String(index),
            }));
          }
        } catch (e) {
          console.error('Failed to parse options:', e);
        }
      }

      return {
        studentExamAnswerId: answer.id,
        exerciseId: answer.exercise?.id || '',
        questionContent: answer.exercise?.questionContent || '',
        questionType: answer.exercise?.questionType || 'text',
        points: answer.examExercise?.points || 0,
        answer: answer.answer || '',
        order: answer.examExercise?.order || 0,
        options,
      };
    })
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const filteredAnswers =
    activeType === 'all'
      ? exerciseAnswers
      : exerciseAnswers.filter((a) => a.questionType === activeType);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const answeredCount = Object.values(answers).filter((v) => v?.trim()).length;
  const progress = exerciseAnswers.length > 0 ? (answeredCount / exerciseAnswers.length) * 100 : 0;

  const questionNumberMap = new Map<string, number>();
  exerciseAnswers.forEach((answer, index) => {
    questionNumberMap.set(answer.studentExamAnswerId, index + 1);
  });

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f8f9fa',
        overflow: 'hidden',
      }}
    >
      <Card style={{ borderRadius: 0 }} styles={{ body: { padding: isMobile ? '8px 12px' : '12px 24px' } }}>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 8 : 0 }}>
          <Space style={{ justifyContent: 'space-between', width: isMobile ? '100%' : 'auto' }}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} size={isMobile ? 'small' : 'middle'} style={{ fontWeight: 500 }}>
              {isMobile ? '' : '返回'}
            </Button>
            <div style={{ minWidth: 0 }}>
              <Title level={isMobile ? 5 : 5} style={{ margin: 0, fontSize: isMobile ? 14 : 16 }} ellipsis>
                {exam.title}
              </Title>
              <Text type="secondary" style={{ fontSize: isMobile ? 11 : 13 }}>
                共 {exerciseAnswers.length} 题 | 总分 {exam.totalScore || 0} 分
              </Text>
            </div>
          </Space>

          <Space style={{ justifyContent: 'flex-end', width: isMobile ? '100%' : 'auto' }}>
            {timeRemaining > 0 && (
              <Tag
                icon={<ClockCircleOutlined />}
                color={timeRemaining < 300 ? 'error' : 'processing'}
                style={{ fontSize: isMobile ? 12 : 14, padding: isMobile ? '2px 6px' : '4px 8px' }}
              >
                {isMobile ? formatTime(timeRemaining) : `剩余时间: ${formatTime(timeRemaining)}`}
              </Tag>
            )}
            <Button
              type="primary"
              onClick={handleSubmitExam}
              loading={isSubmitting || submitExamMutation.isPending}
              icon={<CheckCircleOutlined />}
              size={isMobile ? 'small' : 'middle'}
              style={{
                background: 'linear-gradient(135deg, #52c41a, #389e0d)',
                borderColor: '#389e0d',
                borderRadius: 8,
                fontWeight: 600,
                boxShadow: '0 2px 8px rgba(82,196,26,0.3)',
              }}
            >
              {isMobile ? '提交' : '提交考试'}
            </Button>
          </Space>
        </div>

        <div style={{ marginTop: isMobile ? 8 : 12, display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 12 }}>
          <Progress
            percent={Math.round(progress)}
            status={progress === 100 ? 'success' : 'active'}
            style={{ flex: 1 }}
            size={isMobile ? 'small' : 'default'}
          />
          <Text type="secondary" style={{ minWidth: isMobile ? 60 : 100, fontSize: isMobile ? 11 : 13 }}>
            {answeredCount}/{exerciseAnswers.length}
          </Text>
        </div>
      </Card>

      <div style={{ flexGrow: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', overflow: 'hidden', minHeight: 0 }}>
        <div style={{ flexGrow: 1, overflowY: 'auto', padding: isMobile ? 12 : 24 }}>
          {isLoadingAnswers ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <Spin size="large" />
            </div>
          ) : exerciseAnswers.length === 0 ? (
            <Card style={{ textAlign: 'center' }}>
              <Text type="secondary">该考试暂无题目</Text>
            </Card>
          ) : (
            <div style={{ maxWidth: 800, margin: '0 auto' }}>
              {activeType !== 'all' && (
                <Card style={{ marginBottom: 16, backgroundColor: '#e6f7ff' }}>
                  <Title level={5} style={{ margin: 0 }}>
                    {QUESTION_TYPES[activeType as QuestionType]?.icon}{' '}
                    {QUESTION_TYPES[activeType as QuestionType]?.label}
                  </Title>
                  <Text type="secondary">共 {filteredAnswers.length} 题</Text>
                </Card>
              )}

              {filteredAnswers.map((answer, index) => (
                <QuestionCard
                  key={answer.studentExamAnswerId}
                  answer={answer}
                  index={exerciseAnswers.indexOf(answer)}
                  answers={answers}
                  onAnswerChange={handleAnswerChange}
                  disabled={viewMode || submitExamMutation.isPending}
                />
              ))}

              {!viewMode && (
                <Card style={{ marginTop: 16, textAlign: 'center', borderRadius: 10, background: '#fafbfc' }} styles={{ body: { padding: 16 } }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
                    <div style={{
                      flex: 1, height: 6, borderRadius: 3,
                      background: '#e8e8e8', overflow: 'hidden',
                      maxWidth: 240,
                    }}>
                      <div style={{
                        height: '100%', borderRadius: 3,
                        background: 'linear-gradient(90deg, #2573e6, #52c41a)',
                        width: `${Math.round(progress)}%`,
                        transition: 'width 0.3s',
                      }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#666', whiteSpace: 'nowrap' }}>
                      {answeredCount}/{exerciseAnswers.length}
                    </span>
                  </div>
                  <Button
                    type="primary"
                    size="large"
                    block={isMobile}
                    onClick={handleSubmitExam}
                    loading={isSubmitting || submitExamMutation.isPending}
                    icon={<CheckCircleOutlined />}
                    style={{
                      background: 'linear-gradient(135deg, #52c41a, #389e0d)',
                      borderColor: '#389e0d',
                      borderRadius: 8,
                      height: isMobile ? 42 : 44,
                      fontWeight: 600,
                      fontSize: 15,
                      boxShadow: '0 3px 12px rgba(82,196,26,0.3)',
                    }}
                  >
                    提交考试
                  </Button>
                  {answeredCount < exerciseAnswers.length && (
                    <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                      还有 {exerciseAnswers.length - answeredCount} 题未作答
                    </div>
                  )}
                </Card>
              )}
            </div>
          )}
        </div>

        {/* 移动端：答题进度切换按钮 */}
        {isMobile && (
          <div style={{ flexShrink: 0, background: '#fff', borderBottom: '1px solid #eee' }}>
            <div
              onClick={() => setShowMobileNav(!showMobileNav)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <Space size={6}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 24, height: 24, borderRadius: 6,
                  background: '#2573e610', color: '#2573e6', fontSize: 12,
                }}>📋</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>
                  答题进度
                </span>
                <span style={{ fontSize: 12, color: '#999' }}>
                  {answeredCount}/{exerciseAnswers.length}
                </span>
              </Space>
              <span style={{
                fontSize: 11, color: '#2573e6', fontWeight: 500,
                transform: showMobileNav ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s',
              }}>
                ▼
              </span>
            </div>
            {showMobileNav && (
              <div style={{ padding: '4px 12px 12px', maxHeight: 160, overflow: 'auto' }}>
                <QuestionNavigator
                  answers={exerciseAnswers}
                  currentAnswers={answers}
                  activeType={activeType}
                  onTypeChange={setActiveType}
                  onQuestionClick={(id) => { scrollToQuestion(id); setShowMobileNav(false); }}
                />
              </div>
            )}
          </div>
        )}
        {/* 桌面端：固定显示答题导航 */}
        {!isMobile && (
          <div style={{ width: 280, padding: 16, overflow: 'auto' }}>
            <QuestionNavigator
              answers={exerciseAnswers}
              currentAnswers={answers}
              activeType={activeType}
              onTypeChange={setActiveType}
              onQuestionClick={scrollToQuestion}
            />
          </div>
        )}
      </div>

      <Modal
        open={submitModalOpen}
        onCancel={() => setSubmitModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setSubmitModalOpen(false)}>
            {unansweredQuestions.length > 0 ? '继续作答' : '取消'}
          </Button>,
          <Button
            key="submit"
            type="primary"
            danger={unansweredQuestions.length > 0}
            onClick={confirmSubmit}
            icon={unansweredQuestions.length > 0 ? <WarningOutlined /> : <CheckCircleOutlined />}
            style={unansweredQuestions.length === 0 ? { backgroundColor: '#52c41a', borderColor: '#52c41a' } : {}}
          >
            {unansweredQuestions.length > 0 ? '仍要提交' : '确认提交'}
          </Button>,
        ]}
        width={isMobile ? '92%' : 520}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          {unansweredQuestions.length > 0 ? (
            <>
              <Alert
                type="warning"
                message={`您有 ${unansweredQuestions.length} 道必答题尚未作答，建议完成后再提交！`}
              />
              <Text strong>未作答的必答题：</Text>
              <List
                size="small"
                bordered
                dataSource={unansweredQuestions}
                style={{ maxHeight: 200, overflow: 'auto' }}
                renderItem={(q) => {
                  const typeConfig = QUESTION_TYPES[q.questionType as QuestionType];
                  const questionNumber = questionNumberMap.get(q.studentExamAnswerId) ?? 0;
                  return (
                    <List.Item>
                      <Space>
                        <Checkbox checked={false} disabled />
                        <div>
                          <Text strong>
                            第 {questionNumber} 题 - {typeConfig?.label}
                          </Text>
                          <br />
                          <Text type="secondary" ellipsis style={{ maxWidth: 300 }}>
                            {q.questionContent.slice(0, 50) +
                              (q.questionContent.length > 50 ? '...' : '')}
                          </Text>
                        </div>
                      </Space>
                    </List.Item>
                  );
                }}
              />
            </>
          ) : (
            <Alert type="success" message="所有必答题已作答，可以提交考试！" />
          )}
          <Text type="secondary">
            答题进度: {answeredCount}/{exerciseAnswers.length} ({Math.round(progress)}%)
          </Text>
        </Space>
      </Modal>
    </div>
  );
}

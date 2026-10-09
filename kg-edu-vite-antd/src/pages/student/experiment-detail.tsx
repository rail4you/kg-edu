import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import {
  Button,
  Typography,
  Tag,
  Spin,
  Divider,
  Alert,
  Space,
  Grid,
} from 'antd';
import {
  ArrowLeftOutlined,
  CloudOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  ReadOutlined,
  BulbOutlined,
  ClockCircleOutlined,
  BookOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/auth/auth-context';
import { getAuthHeaders } from '@/lib/auth';
import {
  getExperiment,
  listExperimentKnowledgeResources,
  listExperimentAbilities,
} from '@/lib/ash_rpc';
import { PageHead } from '@/components/proto';

const { Text, Paragraph } = Typography;
const { useBreakpoint } = Grid;

interface Course {
  id: string;
  title: string;
}

interface Chapter {
  id: string;
  title: string;
}

interface KnowledgeResource {
  id: string;
  name: string;
}

interface MainAbility {
  id: string;
  name: string;
}

interface SubAbility {
  id: string;
  name: string;
  mainAbility?: MainAbility;
}

interface ExperimentAbility {
  id: string;
  abilityType: string;
  mainAbility?: MainAbility;
  subAbility?: SubAbility;
}

interface ExperimentDetail {
  id: string;
  title: string;
  description?: string;
  experimentType: 'online' | 'offline';
  durationHours?: number;
  difficultyLevel: 'easy' | 'medium' | 'hard';
  status: 'draft' | 'published' | 'archived';
  sortOrder?: number;
  objectives?: string;
  requirements?: string;
  equipment?: string;
  guideTitle?: string;
  guideUrl?: string;
  course?: Course;
  chapter?: Chapter;
}

export default function ExperimentDetail() {
  const { user, tenant, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const screens = useBreakpoint();

  const { data: experiment, isLoading } = useQuery({
    queryKey: ['experiment', id],
    queryFn: async () => {
      if (!id) return null;

      const result = await getExperiment({
        tenant: tenant || '',
        fields: [
          'id',
          'title',
          'description',
          'experimentType',
          'durationHours',
          'difficultyLevel',
          'status',
          'sortOrder',
          'objectives',
          'requirements',
          'equipment',
          'guideTitle',
          'guideUrl',
          { course: ['id', 'title'] },
          { chapter: ['id', 'title'] },
        ],
        filter: { id: { eq: id } },
        headers: getAuthHeaders(user),
      });

      if (result.success && result.data) {
        return result.data;
      }
      return null;
    },
    enabled: !!id && !!user,
  });

  const { data: knowledgeResourcesData } = useQuery({
    queryKey: ['experiment-knowledge-resources', id],
    queryFn: async () => {
      if (!id) return [];

      const result = await listExperimentKnowledgeResources({
        tenant: tenant || '',
        fields: ['id', { knowledgeResource: ['id', 'name'] }],
        filter: { experiment: { id: { eq: id } } },
        headers: getAuthHeaders(user),
      });

      if (result.success && result.data) {
        const items = Array.isArray(result.data)
          ? result.data
          : (result.data as any).results || (result.data as any).data || [];
        return items.map((item: any) => item.knowledgeResource).filter(Boolean);
      }
      return [];
    },
    enabled: !!id && !!user,
  });

  const { data: experimentAbilitiesData } = useQuery({
    queryKey: ['experiment-abilities', id],
    queryFn: async () => {
      if (!id) return [];

      const result = await listExperimentAbilities({
        tenant: tenant || '',
        fields: [
          'id',
          'abilityType',
          { mainAbility: ['id', 'name'] },
          { subAbility: ['id', 'name', { mainAbility: ['id', 'name'] }] },
        ],
        filter: { experiment: { id: { eq: id } } },
        headers: getAuthHeaders(user),
      });

      if (result.success && result.data) {
        const items = Array.isArray(result.data)
          ? result.data
          : (result.data as any).results || (result.data as any).data || [];
        return items;
      }
      return [];
    },
    enabled: !!id && !!user,
  });

  if (authLoading || isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ padding: 24 }}>
        <Text type="danger">用户未登录，请登录以访问实验。</Text>
      </div>
    );
  }

  if (!experiment) {
    return (
      <div style={{ padding: 24 }}>
        <Alert message="实验不存在或已被删除。" type="info" />
        <Button style={{ marginTop: 16 }} onClick={() => navigate(-1)}>
          返回
        </Button>
      </div>
    );
  }

  const expData: ExperimentDetail = Array.isArray(experiment) ? experiment[0] : experiment;

  const knowledgeResources: KnowledgeResource[] = knowledgeResourcesData || [];
  const experimentAbilities: ExperimentAbility[] = experimentAbilitiesData || [];

  const getExperimentTypeLabel = (type: ExperimentDetail['experimentType']) => {
    return type === 'online' ? '线上实验' : '线下实验';
  };

  const getExperimentTypeIcon = (type: ExperimentDetail['experimentType']) => {
    return type === 'online' ? <CloudOutlined /> : <ExperimentOutlined />;
  };

  const getDifficultyLevelLabel = (level: ExperimentDetail['difficultyLevel']) => {
    const labels: Record<ExperimentDetail['difficultyLevel'], string> = {
      easy: '简单',
      medium: '中等',
      hard: '困难',
    };
    return labels[level];
  };

  const getDifficultyLevelColor = (level: ExperimentDetail['difficultyLevel']) => {
    const colors: Record<ExperimentDetail['difficultyLevel'], string> = {
      easy: 'success',
      medium: 'warning',
      hard: 'error',
    };
    return colors[level];
  };

  const getStatusLabel = (status: ExperimentDetail['status']) => {
    const labels: Record<ExperimentDetail['status'], string> = {
      draft: '草稿',
      published: '已发布',
      archived: '已归档',
    };
    return labels[status];
  };

  const mainAbilities =
    experimentAbilities
      ?.filter((ea) => ea.abilityType === 'main_ability')
      .map((ea) => ea.mainAbility)
      .filter(Boolean) || [];

  const subAbilities =
    experimentAbilities
      ?.filter((ea) => ea.abilityType === 'sub_ability')
      .map((ea) => ea.subAbility)
      .filter(Boolean) || [];

  return (
    <div className="pu-page">
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ marginBottom: 10 }}>
        返回
      </Button>
      <PageHead
        title={expData.title}
        description={expData.description || '实验项目信息与关联知识、能力目标。'}
      />
      <div>
        <div className="pu-stack">
          <section className="pu-card">
            <div className="pu-section-title" style={{ marginBottom: 16 }}>
              实验状态
            </div>
            <Space wrap size={[8, 8]}>
              <Tag icon={getExperimentTypeIcon(expData.experimentType)} color="blue" style={{ padding: '4px 8px' }}>
                {getExperimentTypeLabel(expData.experimentType)}
              </Tag>
              <Tag color={getDifficultyLevelColor(expData.difficultyLevel)} style={{ padding: '4px 8px' }}>
                {getDifficultyLevelLabel(expData.difficultyLevel)}
              </Tag>
              <Tag style={{ padding: '4px 8px' }}>{getStatusLabel(expData.status)}</Tag>
              {expData.durationHours && (
                <Tag icon={<ClockCircleOutlined />} style={{ padding: '4px 8px' }}>
                  预计 {expData.durationHours} 小时
                </Tag>
              )}
              {expData.sortOrder !== undefined && (
                <Tag style={{ padding: '4px 8px' }}>排序: {expData.sortOrder}</Tag>
              )}
            </Space>
          </section>

          <section className="pu-card">
            <div className="pu-section-title" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ReadOutlined />
              所属课程
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: screens.md ? 'repeat(2, 1fr)' : '1fr', gap: 16 }}>
              <div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                  课程名称
                </Text>
                <Text strong>{expData.course?.title || '-'}</Text>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                  所属章节
                </Text>
                <Text strong>{expData.chapter?.title || '未分配'}</Text>
              </div>
            </div>
          </section>

          {(expData.objectives || expData.requirements || expData.equipment) && (
            <section className="pu-card">
              <div className="pu-section-title" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileTextOutlined />
                实验详情
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: screens.md ? 'repeat(2, 1fr)' : '1fr', gap: 24 }}>
                {expData.objectives && (
                  <div>
                    <Text type="secondary" style={{ fontWeight: 500, display: 'block', marginBottom: 8 }}>
                      实验目标
                    </Text>
                    <Paragraph style={{ lineHeight: 1.6, marginBottom: 0 }}>{expData.objectives}</Paragraph>
                  </div>
                )}
                {expData.requirements && (
                  <div>
                    <Text type="secondary" style={{ fontWeight: 500, display: 'block', marginBottom: 8 }}>
                      实验要求
                    </Text>
                    <Paragraph style={{ lineHeight: 1.6, marginBottom: 0 }}>{expData.requirements}</Paragraph>
                  </div>
                )}
                {expData.equipment && (
                  <div style={{ gridColumn: expData.objectives && expData.requirements ? '1 / -1' : 'auto' }}>
                    <Text type="secondary" style={{ fontWeight: 500, display: 'block', marginBottom: 8 }}>
                      所需设备/环境
                    </Text>
                    <Paragraph style={{ lineHeight: 1.6, marginBottom: 0 }}>{expData.equipment}</Paragraph>
                  </div>
                )}
              </div>
            </section>
          )}

          {expData.guideUrl && (
            <section className="pu-card">
              <div className="pu-section-title" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <BookOutlined />
                实验指导书
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 16,
                  background: '#f0f8f4',
                  borderRadius: 10,
                  border: '1px solid #b7e0cd',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <FileTextOutlined style={{ color: '#52c41a', fontSize: 32 }} />
                  <div>
                    <Text strong style={{ display: 'block' }}>
                      {expData.guideTitle || '实验指导书'}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      点击下载查看完整指导书
                    </Text>
                  </div>
                </div>
                <Button
                  type="primary"
                  style={{ background: '#52c41a', borderColor: '#52c41a' }}
                  icon={<DownloadOutlined />}
                  href={expData.guideUrl}
                  target="_blank"
                >
                  下载
                </Button>
              </div>
            </section>
          )}

          <section className="pu-card">
            <div className="pu-section-title" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BulbOutlined />
              关联知识点 ({knowledgeResources.length})
            </div>
            {knowledgeResources.length > 0 ? (
              <Space wrap size={[8, 8]}>
                {knowledgeResources.map((kr) => (
                  <Tag key={kr.id} style={{ fontSize: 14 }}>
                    {kr.name}
                  </Tag>
                ))}
              </Space>
            ) : (
              <Alert message="该实验暂无关联知识点" type="info" style={{ marginTop: 8 }} />
            )}
          </section>

          <section className="pu-card">
            <div className="pu-section-title" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BulbOutlined />
              关联能力目标 ({mainAbilities.length + subAbilities.length})
            </div>

            {mainAbilities.length > 0 ? (
              <div style={{ marginBottom: subAbilities.length > 0 ? 16 : 0 }}>
                <Text type="secondary" style={{ fontWeight: 500, display: 'block', marginBottom: 8 }}>
                  主能力 ({mainAbilities.length})
                </Text>
                <Space wrap size={[8, 8]}>
                  {mainAbilities.map((ability) => (
                    <Tag key={ability.id} color="blue">
                      {ability.name}
                    </Tag>
                  ))}
                </Space>
              </div>
            ) : (
              <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                暂无主能力
              </Text>
            )}

            <Divider style={{ margin: '16px 0' }} />

            {subAbilities.length > 0 ? (
              <div>
                <Text type="secondary" style={{ fontWeight: 500, display: 'block', marginBottom: 8 }}>
                  子能力 ({subAbilities.length})
                </Text>
                <Space wrap size={[8, 8]}>
                  {subAbilities.map((ability) => (
                    <Tag key={ability.id} color="purple">
                      {ability.mainAbility
                        ? `${ability.name} (${ability.mainAbility.name})`
                        : ability.name}
                    </Tag>
                  ))}
                </Space>
              </div>
            ) : (
              <Text type="secondary" style={{ display: 'block' }}>
                暂无子能力
              </Text>
            )}

            {mainAbilities.length === 0 && subAbilities.length === 0 && (
              <Alert message="该实验暂无关联能力目标" type="info" style={{ marginTop: 8 }} />
            )}
          </section>

          <div className="pu-note">
            提示：本实验平台仅提供实验信息查看功能。实验提交、进度跟踪等功能将在后续版本中提供。
          </div>
        </div>
      </div>
    </div>
  );
}

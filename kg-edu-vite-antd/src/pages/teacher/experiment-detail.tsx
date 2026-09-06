import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Typography,
  Button,
  Tag,
  Spin,
  Alert,
  Space,
  Popconfirm,
} from "antd";
import {
  ArrowLeftOutlined,
  EditOutlined,
  DeleteOutlined,
  CloudOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  LinkOutlined,
  BookOutlined,
  BulbOutlined,
} from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import {
  getExperiment,
  destroyExperiment,
  listExperimentKnowledgeResources,
  listExperimentAbilities,
} from "@/lib/ash_rpc";
import { useEditPermission } from "@/hooks/use-edit-permission";

const { Title, Text } = Typography;

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
  description?: string | null;
  experimentType: "online" | "offline";
  durationHours?: number | null;
  difficultyLevel: "easy" | "medium" | "hard";
  status: "draft" | "published" | "archived";
  sortOrder?: number | null;
  objectives?: string | null;
  requirements?: string | null;
  equipment?: string | null;
  guideTitle?: string | null;
  guideUrl?: string | null;
  course?: Course | null;
  chapter?: Chapter | null;
}

export default function ExperimentDetail() {
  const { user, tenant, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { id } = useParams();
  const { canEdit } = useEditPermission();

  const { data: experiment, isLoading } = useQuery({
    queryKey: ["experiment", id],
    queryFn: async () => {
      if (!id) return null;

      const result = await getExperiment({
        tenant: tenant || "",
        fields: [
          "id",
          "title",
          "description",
          "experimentType",
          "durationHours",
          "difficultyLevel",
          "status",
          "sortOrder",
          "objectives",
          "requirements",
          "equipment",
          "guideTitle",
          "guideUrl",
          { course: ["id", "title"] },
          { chapter: ["id", "title"] },
        ],
        filter: { id: { eq: id } },
        headers: getAuthHeaders(user) as Record<string, string>,
      });

      if (result.success && result.data) {
        return result.data;
      }
      return null;
    },
    enabled: !!id && !!user,
  });

  const { data: knowledgeResourcesData = [] } = useQuery({
    queryKey: ["experiment-knowledge-resources", id],
    queryFn: async () => {
      if (!id) return [];

      const result = await listExperimentKnowledgeResources({
        tenant: tenant || "",
        fields: ["id", { knowledgeResource: ["id", "name"] }],
        filter: { experiment: { id: { eq: id } } },
        headers: getAuthHeaders(user) as Record<string, string>,
      });

      if (result.success && result.data) {
        const data = result.data as any;
        const items = Array.isArray(data)
          ? data
          : data.results || data.data || [];
        return items.map((item: any) => item.knowledgeResource).filter(Boolean);
      }
      return [];
    },
    enabled: !!id && !!user,
  });

  const { data: experimentAbilitiesData = [] } = useQuery({
    queryKey: ["experiment-abilities", id],
    queryFn: async () => {
      if (!id) return [];

      const result = await listExperimentAbilities({
        tenant: tenant || "",
        fields: [
          "id",
          "abilityType",
          { mainAbility: ["id", "name"] },
          { subAbility: ["id", "name", { mainAbility: ["id", "name"] }] },
        ],
        filter: { experiment: { id: { eq: id } } },
        headers: getAuthHeaders(user) as Record<string, string>,
      });

      if (result.success && result.data) {
        const data = result.data as any;
        const items = Array.isArray(data)
          ? data
          : data.results || data.data || [];
        return items;
      }
      return [];
    },
    enabled: !!id && !!user,
  });

  const handleDelete = async () => {
    if (!id) return;

    const result = await destroyExperiment({
      tenant: tenant || "",
      primaryKey: id,
      headers: getAuthHeaders(user) as Record<string, string>,
    });

    if (result.success) {
      queryClient.invalidateQueries({ queryKey: ["experiments"] });
      navigate("/teacher/dashboard/experiment-management");
    } else {
      alert(
        "删除失败：" +
          (result.errors?.map((e) => e.message).join(", ") || "未知错误"),
      );
    }
  };

  if (authLoading || isLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ padding: 24 }}>
        <Alert message="用户未登录，请登录以访问实验管理。" type="error" />
      </div>
    );
  }

  if (!experiment) {
    return (
      <div style={{ padding: 24 }}>
        <Alert message="实验不存在或已被删除。" type="info" />
        <Button
          style={{ marginTop: 16 }}
          onClick={() => navigate("/teacher/dashboard/experiment-management")}
        >
          返回实验列表
        </Button>
      </div>
    );
  }

  const expData: ExperimentDetail = Array.isArray(experiment)
    ? experiment[0]
    : experiment;

  const knowledgeResources: KnowledgeResource[] = knowledgeResourcesData || [];
  const experimentAbilities: ExperimentAbility[] =
    experimentAbilitiesData || [];

  const getExperimentTypeLabel = (type: ExperimentDetail["experimentType"]) => {
    return type === "online" ? "线上实验" : "线下实验";
  };

  const getExperimentTypeIcon = (type: ExperimentDetail["experimentType"]) => {
    return type === "online" ? <CloudOutlined /> : <ExperimentOutlined />;
  };

  const getDifficultyLevelLabel = (
    level: ExperimentDetail["difficultyLevel"],
  ) => {
    const labels: Record<ExperimentDetail["difficultyLevel"], string> = {
      easy: "简单",
      medium: "中等",
      hard: "困难",
    };
    return labels[level];
  };

  const getDifficultyLevelColor = (
    level: ExperimentDetail["difficultyLevel"],
  ) => {
    const colors: Record<ExperimentDetail["difficultyLevel"], string> = {
      easy: "green",
      medium: "orange",
      hard: "red",
    };
    return colors[level];
  };

  const getStatusLabel = (status: ExperimentDetail["status"]) => {
    const labels: Record<ExperimentDetail["status"], string> = {
      draft: "草稿",
      published: "已发布",
      archived: "已归档",
    };
    return labels[status];
  };

  const getStatusColor = (status: ExperimentDetail["status"]) => {
    const colors: Record<ExperimentDetail["status"], string> = {
      draft: "default",
      published: "blue",
      archived: "cyan",
    };
    return colors[status];
  };

  const mainAbilities =
    (experimentAbilities
      ?.filter((ea) => ea.abilityType === "main_ability")
      .map((ea) => ea.mainAbility)
      .filter((a): a is MainAbility => Boolean(a)) as MainAbility[]) || [];

  const subAbilities =
    (experimentAbilities
      ?.filter((ea) => ea.abilityType === "sub_ability")
      .map((ea) => ea.subAbility)
      .filter((a): a is SubAbility => Boolean(a)) as SubAbility[]) || [];

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#f5f5f5",
      }}
    >
      <div
        style={{
          padding: 24,
          backgroundColor: "white",
          borderBottom: "1px solid #e0e0e0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/teacher/dashboard/experiment-management")}
          >
            返回
          </Button>
          <div style={{ flexGrow: 1 }}>
            <Title
              level={3}
              style={{ margin: 0, fontWeight: 700, color: "#333" }}
            >
              {expData.title}
            </Title>
            {expData.description && (
              <Text type="secondary" style={{ display: "block", marginTop: 4 }}>
                {expData.description}
              </Text>
            )}
          </div>
        </div>
      </div>

      <div style={{ flexGrow: 1, padding: 24, overflow: "auto" }}>
        <div
          style={{
            maxWidth: 1000,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <Card>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <Title level={5} style={{ margin: 0, fontWeight: 600 }}>
                实验状态
              </Title>
              <Space>
                <Button
                  icon={<EditOutlined />}
                  onClick={() => navigate(`/teacher/dashboard/experiment-form/${id}`)}
                  style={canEdit ? undefined : { display: "none" }}
                >
                  编辑
                </Button>
                <Popconfirm
                  title="确定要删除这个实验吗？此操作不可撤销。"
                  onConfirm={handleDelete}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button danger icon={<DeleteOutlined />} style={canEdit ? undefined : { display: "none" }}>
                    删除
                  </Button>
                </Popconfirm>
              </Space>
            </div>
            <Space size={[8, 8]} wrap>
              <Tag
                color="blue"
                icon={getExperimentTypeIcon(expData.experimentType)}
              >
                {getExperimentTypeLabel(expData.experimentType)}
              </Tag>
              <Tag color={getDifficultyLevelColor(expData.difficultyLevel)}>
                {getDifficultyLevelLabel(expData.difficultyLevel)}
              </Tag>
              <Tag color={getStatusColor(expData.status)}>
                {getStatusLabel(expData.status)}
              </Tag>
              {expData.durationHours && (
                <Tag>预计 {expData.durationHours} 小时</Tag>
              )}
              {expData.sortOrder !== undefined && (
                <Tag>排序: {expData.sortOrder}</Tag>
              )}
            </Space>
          </Card>

          <Card>
            <Title level={5} style={{ marginBottom: 16, fontWeight: 600 }}>
              <BookOutlined style={{ marginRight: 8 }} />
              所属课程
            </Title>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 16,
              }}
            >
              <div>
                <Text
                  type="secondary"
                  style={{ display: "block", marginBottom: 4 }}
                >
                  课程名称
                </Text>
                <Text strong>{expData.course?.title || "-"}</Text>
              </div>
              <div>
                <Text
                  type="secondary"
                  style={{ display: "block", marginBottom: 4 }}
                >
                  所属章节
                </Text>
                <Text strong>{expData.chapter?.title || "未分配"}</Text>
              </div>
            </div>
          </Card>

          {(expData.objectives ||
            expData.requirements ||
            expData.equipment) && (
            <Card>
              <Title level={5} style={{ marginBottom: 16, fontWeight: 600 }}>
                <FileTextOutlined style={{ marginRight: 8 }} />
                实验详情
              </Title>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: 24,
                }}
              >
                {expData.objectives && (
                  <div>
                    <Text
                      type="secondary"
                      style={{
                        display: "block",
                        marginBottom: 8,
                        fontWeight: 500,
                      }}
                    >
                      🎯 实验目标
                    </Text>
                    <Text style={{ lineHeight: 1.6 }}>
                      {expData.objectives}
                    </Text>
                  </div>
                )}
                {expData.requirements && (
                  <div>
                    <Text
                      type="secondary"
                      style={{
                        display: "block",
                        marginBottom: 8,
                        fontWeight: 500,
                      }}
                    >
                      📋 实验要求
                    </Text>
                    <Text style={{ lineHeight: 1.6 }}>
                      {expData.requirements}
                    </Text>
                  </div>
                )}
                {expData.equipment && (
                  <div
                    style={{
                      gridColumn:
                        expData.objectives && expData.requirements
                          ? "1 / -1"
                          : "auto",
                    }}
                  >
                    <Text
                      type="secondary"
                      style={{
                        display: "block",
                        marginBottom: 8,
                        fontWeight: 500,
                      }}
                    >
                      🔧 所需设备/环境
                    </Text>
                    <Text style={{ lineHeight: 1.6 }}>{expData.equipment}</Text>
                  </div>
                )}
              </div>
            </Card>
          )}

          {(expData.guideTitle || expData.guideUrl) && (
            <Card>
              <Title level={5} style={{ marginBottom: 16, fontWeight: 600 }}>
                <FileTextOutlined style={{ marginRight: 8 }} />
                实验指导书
              </Title>
              <a
                href={expData.guideUrl || expData.guideTitle}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#1890ff" }}
              >
                {expData.guideTitle || "点击查看指导书"}
              </a>
            </Card>
          )}

          <Card>
            <Title level={5} style={{ marginBottom: 16, fontWeight: 600 }}>
              <BulbOutlined style={{ marginRight: 8 }} />
              关联知识点 ({knowledgeResources.length})
            </Title>
            {knowledgeResources.length > 0 ? (
              <Space size={[8, 8]} wrap>
                {knowledgeResources.map((kr) => (
                  <Tag key={kr.id}>{kr.name}</Tag>
                ))}
              </Space>
            ) : (
              <Alert
                message="该实验暂无关联知识点"
                type="info"
                style={{ marginTop: 8 }}
              />
            )}
          </Card>

          <Card>
            <Title level={5} style={{ marginBottom: 16, fontWeight: 600 }}>
              <BulbOutlined style={{ marginRight: 8 }} />
              关联能力目标 ({mainAbilities.length + subAbilities.length})
            </Title>

            {mainAbilities.length > 0 ? (
              <div style={{ marginBottom: subAbilities.length > 0 ? 16 : 0 }}>
                <Text
                  type="secondary"
                  style={{ display: "block", marginBottom: 8, fontWeight: 500 }}
                >
                  主能力 ({mainAbilities.length})
                </Text>
                <Space size={[8, 8]} wrap>
                  {mainAbilities.map((ability) => (
                    <Tag key={ability.id} color="blue">
                      {ability.name}
                    </Tag>
                  ))}
                </Space>
              </div>
            ) : (
              <Text
                type="secondary"
                style={{ display: "block", marginBottom: 8 }}
              >
                暂无主能力
              </Text>
            )}

            {subAbilities.length > 0 ? (
              <div>
                <Text
                  type="secondary"
                  style={{ display: "block", marginBottom: 8, fontWeight: 500 }}
                >
                  子能力 ({subAbilities.length})
                </Text>
                <Space size={[8, 8]} wrap>
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
              <Text
                type="secondary"
                style={{ display: "block", marginBottom: 8 }}
              >
                暂无子能力
              </Text>
            )}

            {mainAbilities.length === 0 && subAbilities.length === 0 && (
              <Alert
                message="该实验暂无关联能力目标"
                type="info"
                style={{ marginTop: 8 }}
              />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

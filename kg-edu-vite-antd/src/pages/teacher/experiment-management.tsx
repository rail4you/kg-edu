import * as React from "react";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Button,
  Typography,
  Tag,
  Space,
  Table,
  Spin,
  Popconfirm,
  Input,
  List,
  Empty,
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  DashboardOutlined,
  CloudOutlined,
  ExperimentOutlined,
  BookOutlined,
  ArrowLeftOutlined,
  SearchOutlined,
  FileTextOutlined
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import { getHeaders } from "@/utils/api-helpers";
import {
  getExperimentsByCourse,
  destroyExperiment,
} from "@/lib/ash_rpc";
import { useCurrentCourse } from "@/hooks/use-current-course";
import { CurrentCourseSwitch } from "@/components/teacher/current-course-switch";
import ActionDropdown from "@/components/ActionDropdown";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { AppPage, StatGrid, ProtoCard, ProtoTabs, ProtoEmpty } from "@/components/proto";

const { Text } = Typography;

interface Experiment {
  id: string;
  title: string;
  description?: string;
  experimentType: "online" | "offline";
  durationHours?: number;
  difficultyLevel: "easy" | "medium" | "hard";
  status: "draft" | "published" | "archived";
  courseId?: string;
  courseName?: string;
  chapterId?: string;
  chapterName?: string;
  knowledgeResourcesCount?: number;
  guideUrl?: string | null;
  guideTitle?: string | null;
}

export default function ExperimentManagement() {
  const { user, loading: authLoading } = useAuth();
  const currentTenant = getCurrentTenant();
  const tenant = currentTenant?.schemaName || "";
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { canEdit } = useEditPermission();
  const [searchText, setSearchText] = useState("");
  const { courses, courseId: selectedCourseId } = useCurrentCourse();
  const [subtab, setSubtab] = useState("all");

  // 获取选中课程的实验列表
  const { data: experimentsResult, isLoading } = useQuery({
    queryKey: ["experiments", "course", selectedCourseId, tenant],
    queryFn: async () => {
      if (!selectedCourseId) {
        return { data: [] };
      }

      const result = await getExperimentsByCourse({
        tenant,
        fields: [
          "id",
          "title",
          "description",
          "experimentType",
          "durationHours",
          "difficultyLevel",
          "status",
          "sortOrder",
          "knowledgeResourcesCount",
          "guideUrl",
          "guideTitle",
          { course: ["id", "title"] },
          { chapter: ["id", "title"] },
        ],
        input: { courseId: selectedCourseId },
        headers: getHeaders(user),
      });

      if (result.success && result.data) {
        const experiments = Array.isArray(result.data)
          ? result.data
          : (result.data as any).results || (result.data as any).data || [];
        return {
          data: experiments.map((exp: any) => ({
            ...exp,
            courseName: exp.course?.title || "",
            chapterName: exp.chapter?.title || "",
          })),
        };
      }
      return { data: [] };
    },
    enabled: !!user && !!selectedCourseId && !!tenant,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return destroyExperiment({
        tenant,
        primaryKey: id,
        headers: getHeaders(user),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["experiments"] });
    },
  });

  if (authLoading) {
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
      <AppPage className="experiment-management-wrap" title="实验管理">
<style>{`@media(max-width:768px){.experiment-management-wrap{padding:12px!important}.experiment-management-wrap .ant-table-cell{padding:6px 4px!important}}`}</style>
        <Text type="danger">用户未登录，请登录以访问实验管理。</Text>
      </AppPage>
    );
  }

  const getExperimentTypeLabel = (type: Experiment["experimentType"]) => {
    return type === "online" ? "线上" : "线下";
  };

  const getExperimentTypeIcon = (type: Experiment["experimentType"]) => {
    return type === "online" ? (
      <CloudOutlined style={{ marginRight: 4 }} />
    ) : (
      <ExperimentOutlined style={{ marginRight: 4 }} />
    );
  };

  const getDifficultyLevelLabel = (level: Experiment["difficultyLevel"]) => {
    const labels: Record<Experiment["difficultyLevel"], string> = {
      easy: "简单",
      medium: "中等",
      hard: "困难",
    };
    return labels[level];
  };

  const getDifficultyLevelColor = (
    level: Experiment["difficultyLevel"],
  ): string => {
    const colors: Record<Experiment["difficultyLevel"], string> = {
      easy: "green",
      medium: "orange",
      hard: "red",
    };
    return colors[level];
  };

  const getStatusLabel = (status: Experiment["status"]) => {
    const labels: Record<Experiment["status"], string> = {
      draft: "草稿",
      published: "已发布",
      archived: "已归档",
    };
    return labels[status];
  };

  const getStatusColor = (status: Experiment["status"]): string => {
    const colors: Record<Experiment["status"], string> = {
      draft: "default",
      published: "blue",
      archived: "cyan",
    };
    return colors[status];
  };

  const experiments = experimentsResult?.data || [];
  const stats = {
    total: experiments.length,
    published: experiments.filter((e: Experiment) => e.status === "published")
      .length,
    draft: experiments.filter((e: Experiment) => e.status === "draft").length,
  };

  const filteredExperiments = experiments.filter((exp: Experiment) =>
    exp.title.toLowerCase().includes(searchText.toLowerCase()),
  );

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  const handleGuideClick = (url: string) => {
    if (url) {
      window.open(url, '_blank');
    }
  };

  const columns: ColumnsType<Experiment> = [
    {
      title: "实验名称",
      dataIndex: "title",
      key: "title",
      width: 200,
      render: (text: string) => (
        <Tooltip title={text} mouseEnterDelay={0.3}>
          <Text strong style={{ fontWeight: 600, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{text}</Text>
        </Tooltip>
      ),
      align: "left",
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status: Experiment["status"]) => (
        <Tag color={getStatusColor(status)}>{getStatusLabel(status)}</Tag>
      ),
      align: "left",
    },
    {
      title: "类型",
      dataIndex: "experimentType",
      key: "experimentType",
      width: 100,
      render: (type: Experiment["experimentType"]) => (
        <Space size={4}>
          {getExperimentTypeIcon(type)}
          <Tag>{getExperimentTypeLabel(type)}</Tag>
        </Space>
      ),
    },
    {
      title: "所属课程",
      dataIndex: "courseName",
      key: "courseName",
      width: 150,
      render: (text: string) => text || "-",
    },
    {
      title: "难度",
      dataIndex: "difficultyLevel",
      key: "difficultyLevel",
      width: 100,
      render: (level: Experiment["difficultyLevel"]) => (
        <Tag color={getDifficultyLevelColor(level)}>
          {getDifficultyLevelLabel(level)}
        </Tag>
      ),
    },
    {
      title: "学时",
      dataIndex: "durationHours",
      key: "durationHours",
      width: 80,
      render: (hours: number) => (hours ? `${hours}h` : "-"),
    },
    {
      title: "知识点",
      dataIndex: "knowledgeResourcesCount",
      key: "knowledgeResourcesCount",
      width: 80,
      render: (count: number) => count || 0,
    },
    {
      title: "指导书",
      key: "guideUrl",
      width: 80,
      render: (_, record) =>
        record.guideUrl ? (
          <Tooltip title={record.guideTitle || "实验指导书"}>
            <a
              onClick={() => handleGuideClick(record.guideUrl!)}
              style={{ cursor: "pointer", color: "#1890ff", fontSize: 16 }}
            >
              <FileTextOutlined />
            </a>
          </Tooltip>
        ) : (
          "-"
        ),
    },
    {
      title: "操作",
      key: "action",
      width: 80,
      render: (_, record) => {
        const items = [
          {
            key: "view",
            label: "查看详情",
            icon: <EyeOutlined />,
            onClick: () => navigate(`/teacher/dashboard/experiment-detail/${record.id}`),
          },
          ...(canEdit
            ? [
                {
                  key: "edit",
                  label: "编辑",
                  icon: <EditOutlined />,
                  onClick: () => navigate(`/teacher/dashboard/experiment-form/${record.id}`),
                },
                { type: "divider" as const },
                {
                  key: "delete",
                  label: "删除",
                  icon: <DeleteOutlined />,
                  danger: true,
                  onClick: () => deleteMutation.mutate(record.id),
                },
              ]
            : []),
        ];
        return <ActionDropdown items={items} />;
      },
    },
  ];

  return (
    <AppPage
      title="实验管理"
      description="管理各课程的实验内容与指导书"
      breadcrumb={<>智慧课程&nbsp;&nbsp;/&nbsp;&nbsp;实验管理</>}
      actions={<CurrentCourseSwitch />}
    >
      {selectedCourse && (
        <StatGrid
          columns={3}
          items={[
            { label: "总实验数", value: stats.total, icon: <ExperimentOutlined /> },
            { label: "已发布", value: stats.published, icon: <CloudOutlined /> },
            { label: "草稿", value: stats.draft, icon: <ExperimentOutlined /> },
          ]}
        />
      )}

      <ProtoCard>
        <ProtoTabs
          items={[
            { id: "all", label: "全部记录" },
            { id: "recent", label: "最近更新" },
          ]}
          active={subtab}
          onChange={setSubtab}
        />
        <div className="pu-filters">
          <Input
            className="pu-search"
            placeholder="搜索实验名称"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
          />
          <Button onClick={() => setSearchText("")}>重置</Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate("/teacher/dashboard/experiment-form/new")}
            style={{ marginLeft: "auto", ...(canEdit ? {} : { display: "none" }) }}
          >
            创建实验
          </Button>
        </div>

        {!selectedCourseId ? (
          <ProtoEmpty title="请先选择课程" description="选择课程以查看其实验内容。" />
        ) : filteredExperiments.length === 0 ? (
          <ProtoEmpty title="暂无实验" description="点击右上角「创建实验」开始。" />
        ) : (
          <>
            <Table
              columns={columns}
              dataSource={filteredExperiments}
              rowKey="id"
              loading={isLoading}
              pagination={false}
              size="middle"
            />
            <div className="pu-table-footer">
              <span>共 {filteredExperiments.length} 条</span>
            </div>
          </>
        )}
      </ProtoCard>
    </AppPage>
  );
}
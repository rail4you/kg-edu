import React, { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Typography,
  Button,
  Table,
  Space,
  Tag,
  Modal,
  message,
  Popconfirm,
  Select,
  Spin,
  Empty,
  Avatar,
  Rate,
  Input,
} from "antd";
import {
  DeleteOutlined,
  MessageOutlined,
  UserOutlined,
  EyeOutlined,
  StarOutlined,
  ArrowLeftOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import {
  listDiscussions,
  listDiscussionsByCourse,
  deleteDiscussion,
} from "@/lib/ash_rpc";
import type { DiscussionResourceSchema } from "@/lib/ash_rpc";
import { getAuthHeaders } from "@/lib/auth";
import { useCourses } from "@/hooks/use-courses";
import { ReadonlyActionButton } from "@/components/readonly-action-button";
import { AppPage, StatGrid, ProtoCard, ProtoTabs, ProtoEmpty } from "@/components/proto";

const { Text, Paragraph } = Typography;
const { Option } = Select;

export default function CourseEvaluationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const currentTenant = getCurrentTenant();
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [subtab, setSubtab] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedDiscussion, setSelectedDiscussion] =
    useState<DiscussionResourceSchema | null>(null);

  const tenant = currentTenant?.schemaName || "";

  // 获取课程列表
  const { courses, loading: coursesLoading } = useCourses({
    fields: ["id", "title"],
  });

  // 自动选择第一个课程
  useEffect(() => {
    if (courses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, selectedCourseId]);

  // 获取当前选中课程的评价列表
  const { data: discussionsData, isLoading: discussionsLoading } = useQuery({
    queryKey: ["discussions-manage", tenant, selectedCourseId],
    queryFn: async () => {
      if (selectedCourseId) {
        const result = await listDiscussionsByCourse({
          tenant,
          input: { courseId: selectedCourseId },
          fields: [
            "id",
            "title",
            "content",
            "rating",
            "status",
            "insertedAt",
            { user: ["id", "name", "email"] },
          ],
          headers: getAuthHeaders(user),
        });
        return result;
      } else {
        const result = await listDiscussions({
          tenant,
          fields: [
            "id",
            "title",
            "content",
            "rating",
            "status",
            "insertedAt",
            { user: ["id", "name", "email"] },
          ],
          headers: getAuthHeaders(user),
        });
        return result;
      }
    },
    enabled: !!tenant && !!user && !!selectedCourseId,
  });

  const discussions: DiscussionResourceSchema[] = discussionsData?.success
    ? Array.isArray(discussionsData.data)
      ? discussionsData.data
      : (discussionsData.data as any)?.results || []
    : [];

  // 计算统计数据（使用与列表一致的默认值逻辑）
  const stats = useMemo(() => {
    const totalCount = discussions.length;
    // 如果 rating 为 null，则使用默认值 5（与列表显示一致）
    const totalRating = discussions.reduce((sum, d) => sum + (d.rating || 5), 0);
    const averageRating = totalCount > 0 ? totalRating / totalCount : 0;
    return { totalCount, averageRating };
  }, [discussions]);

  // 删除评价
  const deleteMutation = useMutation({
    mutationFn: async (discussionId: string) => {
      const result = await deleteDiscussion({
        tenant,
        primaryKey: discussionId,
        fields: ["id"],
        headers: getAuthHeaders(user),
      });
      if (!result.success) {
        throw new Error((result as any).errors?.[0]?.message || "删除失败");
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["discussions-manage", tenant, selectedCourseId],
      });
      message.success("删除成功");
    },
    onError: (error: any) => {
      message.error(error?.message || "删除失败");
    },
  });

  // 查看课程评价详情
  const handleViewDiscussion = (discussion: DiscussionResourceSchema) => {
    setSelectedDiscussion(discussion);
    setViewModalVisible(true);
  };

  // 表格列定义
  const columns = [
    {
      title: "评分",
      dataIndex: "rating",
      key: "rating",
      align: "left" as const,
      width: 160,
      render: (rating: number | null) => (
        <div style={{ display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
          <Rate disabled value={rating || 5} style={{ fontSize: 14 }} />
          <Text>{rating || 5} 分</Text>
        </div>
      ),
    },
    {
      title: "评价内容",
      dataIndex: "content",
      key: "content",
      align: "left" as const,
      width: 200,
      ellipsis: true,
      render: (content: string) => (
        <Text type="secondary" style={{ fontSize: 13 }} ellipsis={{ tooltip: true }}>
          {content}
        </Text>
      ),
    },
    {
      title: "发布者",
      dataIndex: "user",
      key: "user",
      align: "left" as const,
      width: 140,
      render: (user: any) => (
        <Space size={6} style={{ whiteSpace: "nowrap" }}>
          <Avatar size="small" icon={<UserOutlined />} />
          <Text ellipsis={{ tooltip: user?.name || user?.email }} style={{ maxWidth: 90 }}>
            {user?.name || user?.email?.split("@")[0] || "匿名"}
          </Text>
        </Space>
      ),
    },
    {
      title: "发布时间",
      dataIndex: "insertedAt",
      key: "insertedAt",
      width: 100,
      render: (date: string) =>
        date ? new Date(date).toLocaleDateString("zh-CN") : "-",
    },
    {
      title: "操作",
      key: "action",
      width: 120,
      render: (_: any, record: DiscussionResourceSchema) => (
        <Space size={4}>
          <Button
            type="link"
            size="small"
            onClick={() => handleViewDiscussion(record)}
          >
            查看
          </Button>
          <Popconfirm
            title="确定删除此评价？"
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <ReadonlyActionButton type="link" size="small" danger>删除</ReadonlyActionButton>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (authLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: 400,
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return (
      <AppPage title="课程评价管理">
        <Text>请先登录</Text>
      </AppPage>
    );
  }

  if (!currentTenant?.schemaName) {
    return (
      <AppPage title="课程评价管理">
        <Text>未选择租户，请先选择组织</Text>
      </AppPage>
    );
  }

  return (
    <AppPage
      title="课程评价管理"
      description="查看与管理学生课程评价"
      breadcrumb={<>智慧课程&nbsp;&nbsp;/&nbsp;&nbsp;课程评价管理</>}
    >
      <StatGrid
        columns={2}
        items={[
          { label: "当前课程评价次数", value: stats.totalCount, unit: "次", icon: <MessageOutlined /> },
          { label: "当前课程平均评分", value: stats.averageRating.toFixed(1), unit: "分", icon: <StarOutlined /> },
        ]}
      />

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
          <Select
            value={selectedCourseId || undefined}
            onChange={setSelectedCourseId}
            style={{ width: 240 }}
            allowClear
            placeholder="全部课程"
            loading={coursesLoading}
            options={courses.map((course) => ({ value: course.id, label: course.title }))}
          />
          <Input
            className="pu-search"
            placeholder="搜索评价内容"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
          />
          <Button onClick={() => setSearchText("")}>重置</Button>
        </div>

        {(() => {
          const q = searchText.trim().toLowerCase();
          const filtered = (discussions || []).filter(
            (d: DiscussionResourceSchema) => !q || (d.content || "").toLowerCase().includes(q),
          );
          if (filtered.length === 0) {
            return (
              <ProtoEmpty
                title={selectedCourseId ? "暂无课程评价" : "请先选择课程"}
                description="可切换课程查看学生评价。"
              />
            );
          }
          return (
            <>
              <Table
                columns={columns}
                dataSource={filtered}
                rowKey="id"
                loading={discussionsLoading}
                size="middle"
                pagination={false}
              />
              <div className="pu-table-footer">
                <span>共 {filtered.length} 条课程评价</span>
              </div>
            </>
          );
        })()}
      </ProtoCard>

      {/* 查看课程评价详情 Modal */}
      <Modal
        title="课程评价详情"
        open={viewModalVisible}
        onCancel={() => {
          setViewModalVisible(false);
          setSelectedDiscussion(null);
        }}
        footer={[
          <Button
            key="close"
            onClick={() => {
              setViewModalVisible(false);
              setSelectedDiscussion(null);
            }}
          >
            关闭
          </Button>,
          <Popconfirm
            key="delete"
            title="确定删除此课程评价？"
            onConfirm={() => {
              if (selectedDiscussion) {
                deleteMutation.mutate(selectedDiscussion.id);
                setViewModalVisible(false);
                setSelectedDiscussion(null);
              }
            }}
            okText="确定"
            cancelText="取消"
          >
            <ReadonlyActionButton danger>删除</ReadonlyActionButton>
          </Popconfirm>,
        ]}
        width={600}
      >
        {selectedDiscussion && (
          <div>
            {/* 评分显示 */}
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ marginRight: 12 }}>评分：</Text>
              <Rate disabled value={selectedDiscussion.rating || 5} style={{ fontSize: 20 }} />
              <Text style={{ marginLeft: 12, color: "#666", fontSize: 16 }}>
                {selectedDiscussion.rating || 5} 分
              </Text>
            </div>
            <div style={{ marginBottom: 16 }}>
              <Space split={<Tag />}>
                <Space>
                  <Avatar size="small" icon={<UserOutlined />} />
                  <Text>
                    {(selectedDiscussion as any).user?.name ||
                      (selectedDiscussion as any).user?.email ||
                      "匿名用户"}
                  </Text>
                </Space>
                <Text type="secondary">
                  {selectedDiscussion.insertedAt
                    ? new Date(selectedDiscussion.insertedAt).toLocaleString("zh-CN")
                    : ""}
                </Text>
              </Space>
            </div>
            <Paragraph
              style={{
                background: "#f5f5f5",
                padding: 16,
                borderRadius: 8,
                whiteSpace: "pre-wrap",
              }}
            >
              {selectedDiscussion.content}
            </Paragraph>
          </div>
        )}
      </Modal>
    </AppPage>
  );
}

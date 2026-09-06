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
  Statistic,
  Row,
  Col,
} from "antd";
import {
  DeleteOutlined,
  MessageOutlined,
  UserOutlined,
  EyeOutlined,
  StarOutlined,
  ArrowLeftOutlined
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

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

export default function CourseEvaluationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const currentTenant = getCurrentTenant();
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
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
      align: "center" as const,
      width: 100,
      render: (date: string) =>
        date ? new Date(date).toLocaleDateString("zh-CN") : "-",
    },
    {
      title: "操作",
      key: "action",
      align: "center" as const,
      width: 120,
      render: (_: any, record: DiscussionResourceSchema) => (
        <Space size={4}>
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => handleViewDiscussion(record)}
          />
          <Popconfirm
            title="确定删除此评价？"
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <ReadonlyActionButton type="text" danger icon={<DeleteOutlined />} />
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
      <div style={{ padding: 24, textAlign: "center" }}>
        <Text>请先登录</Text>
      </div>
    );
  }

  if (!currentTenant?.schemaName) {
    return (
      <div style={{ padding: 24 }}>
        <Text>未选择租户，请先选择组织</Text>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "8px 0",
          borderBottom: "1px solid #f0f0f0",
          gap: 12,
        }}
      >
        <Button
          className="teacher-page-back-btn"
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/teacher/dashboard")}
          style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
        />
        <MessageOutlined style={{ fontSize: 24, color: "#1890ff" }} />
        <Title level={4} style={{ margin: 0 }}>
          课程评价管理
        </Title>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginTop: 24, marginBottom: 24 }}>
        <Col span={12}>
          <Card>
            <Statistic
              title="当前课程评价次数"
              value={stats.totalCount}
              prefix={<MessageOutlined />}
              suffix="次"
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card>
            <Statistic
              title="当前课程平均评分"
              value={stats.averageRating}
              precision={1}
              prefix={<StarOutlined />}
              suffix="分"
            />
          </Card>
        </Col>
      </Row>

      {/* 筛选和列表 */}
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Text strong>选择课程查看评价：</Text>
          <Select
            value={selectedCourseId}
            onChange={setSelectedCourseId}
            style={{ width: 200 }}
            allowClear
            placeholder="全部课程"
            loading={coursesLoading}
          >
            {courses.map((course) => (
              <Option key={course.id} value={course.id}>
                {course.title}
              </Option>
            ))}
          </Select>
        </Space>
      </div>

      <Card>
        <Table
          className="theme-table"
          columns={columns}
          dataSource={discussions}
          rowKey="id"
          loading={discussionsLoading}
          title={() => (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Space>
                <Text strong>课程评价列表</Text>
              </Space>
            </div>
          )}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条课程评价`,
          }}
          locale={{
            emptyText: selectedCourseId ? (
              <Empty description="暂无课程评价" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Empty description="请先选择一个课程" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ),
          }}
        />
      </Card>

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
    </div>
  );
}

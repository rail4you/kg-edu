import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Typography,
  Table,
  Button,
  Modal,
  Input,
  Select,
  Tag,
  Alert,
  message,
  Space,
  Form,
  Popconfirm,
  Tooltip,
} from "antd";
import type { TableProps } from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  LinkOutlined,
  ArrowLeftOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  listLinks,
  deleteLink,
  createLink,
  type ListLinksFields,
  type CreateLinkFields,
} from "@/lib/ash_rpc";
import { useCourses } from "@/hooks/use-courses";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { extractArrayData } from "@/utils/api-helpers";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";
import { AppPage, ProtoCard, ProtoEmpty } from "@/components/proto";

const { Text } = Typography;

const LINK_FIELDS: ListLinksFields = [
  "id",
  "title",
  "url",
  "category",
  "courseId",
  "knowledgeResourceId",
];

type LinkType = {
  id: string;
  title: string;
  url: string;
  category: string | null;
  courseId: string;
  knowledgeResourceId: string | null;
};

type LinkFormValues = {
  title: string;
  url: string;
  category?: string;
};

type LinkListResponse = {
  count?: number;
  results?: LinkType[];
};

const getMutationErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === "object" && error !== null) {
    const maybeError = error as {
      message?: string;
      errors?: Array<{ message?: string }>;
    };
    if (maybeError.errors?.[0]?.message) return maybeError.errors[0].message;
    if (maybeError.message) return maybeError.message;
  }
  return fallback;
};

export default function LinkPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [searchText, setSearchText] = useState("");
  const [form] = Form.useForm();

  const queryClient = useQueryClient();
  const { user } = useAuth();
  const currentTenant = getCurrentTenant();
  const tenant = currentTenant?.schemaName || "";
  const { canEdit } = useEditPermission();

  const { courses, loading: coursesLoading } = useCourses({
    fields: ["id", "title", "description"],
  });
  const activeCourseId = selectedCourseId || courses[0]?.id || "";

  const {
    data: linksData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["links", tenant, page, activeCourseId],
    queryFn: async () => {
      const baseFilter = { courseId: { eq: activeCourseId } };

      const response = await listLinks({
        tenant,
        fields: LINK_FIELDS,
        filter: baseFilter,
        page: { limit: 10, offset: (page - 1) * 10, count: true },
        headers: getAuthHeaders(user) as Record<string, string>,
      });

      if (response.success) {
        return response.data;
      }
      throw new Error("Failed to fetch links");
    },
    enabled: !!tenant && !!user && !!activeCourseId,
  });

  const linkList = extractArrayData(linksData);
  const totalCount = (linksData as LinkListResponse | undefined)?.count || 0;

  const createMutation = useMutation({
    mutationFn: (values: LinkFormValues) =>
      createLink({
        tenant: tenant,
        input: {
          title: values.title,
          url: values.url,
          category: values.category,
          courseId: activeCourseId,
        },
        fields: LINK_FIELDS as CreateLinkFields,
        headers: getAuthHeaders(user) as Record<string, string>,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["links", tenant],
      });
      message.success("链接添加成功");
      setAddDialogOpen(false);
      form.resetFields();
    },
    onError: (error: unknown) => {
      message.error(getMutationErrorMessage(error, "链接添加失败"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (linkId: string) =>
      deleteLink({
        tenant: tenant,
        primaryKey: linkId,
        headers: getAuthHeaders(user) as Record<string, string>,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["links", tenant],
      });
      message.success("链接删除成功");
    },
    onError: (error: unknown) => {
      message.error(getMutationErrorMessage(error, "链接删除失败"));
    },
  });

  const handleAdd = (values: LinkFormValues) => {
    createMutation.mutate(values);
  };

  const handleDelete = (linkId: string) => {
    deleteMutation.mutate(linkId);
  };

  const handleOpenLink = (url: string) => {
    if (url) {
      let fullUrl = url;
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        fullUrl = "https://" + url;
      }
      window.open(fullUrl, "_blank", "noopener,noreferrer");
    }
  };

  const getCategoryColor = (category: string | null): string => {
    if (!category) return "default";
    const categoryLower = category.toLowerCase();
    if (categoryLower.includes("视频") || categoryLower.includes("video")) return "purple";
    if (categoryLower.includes("文档") || categoryLower.includes("doc")) return "blue";
    if (categoryLower.includes("文档") || categoryLower.includes("book")) return "green";
    if (categoryLower.includes("工具") || categoryLower.includes("tool")) return "orange";
    return "default";
  };

  const columns: TableProps<LinkType>["columns"] = [
    {
      title: "标题",
      dataIndex: "title",
      key: "title",
      onCell: () => ({ style: { verticalAlign: "middle" } }),
      render: (_: string, record: LinkType) => (
        <Space wrap size={4} style={{ maxWidth: "100%" }}>
          <Tooltip title={record.title} mouseEnterDelay={0.3}>
            <Text strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>{record.title}</Text>
          </Tooltip>
          {record.category && (
            <Tag color={getCategoryColor(record.category)} style={{ marginInlineEnd: 0, flexShrink: 0 }}>
              {record.category}
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: "链接",
      dataIndex: "url",
      key: "url",
      onCell: () => ({ style: { verticalAlign: "middle", paddingInline: "2px" } }),
      render: (url: string) => (
        <Tooltip title={url}>
          <a
            onClick={(e) => {
              e.preventDefault();
              handleOpenLink(url);
            }}
            style={{ fontFamily: "monospace", fontSize: 12, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {url}
          </a>
        </Tooltip>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 120,
      render: (_: unknown, record: LinkType) => (
        <Space size={4}>
          <Button
            type="link"
            size="small"
            onClick={() => handleOpenLink(record.url)}
          >
            打开
          </Button>
          <Popconfirm
            title="确定删除此链接?"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <ReadonlyActionButton
              type="link"
              size="small"
              danger
              loading={deleteMutation.isPending}
            >
              删除
            </ReadonlyActionButton>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (!tenant) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          type="warning"
          message="未选择租户或租户配置不完整"
          description="请先选择一个租户（组织）才能管理链接资源。如果已选择租户但仍显示此消息，请联系管理员确保租户配置了正确的数据库模式。"
          showIcon
        />
      </div>
    );
  }

  return (
    <AppPage
      title="链接管理"
      description="管理课程相关外部资源链接"
      breadcrumb={<>智慧课程&nbsp;&nbsp;/&nbsp;&nbsp;链接管理</>}
      actions={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setAddDialogOpen(true)}
          disabled={!activeCourseId}
          style={canEdit ? undefined : { display: "none" }}
        >
          添加链接
        </Button>
      }
    >
      <style>{`@media(max-width:768px){.link-course-select{flex-direction:column!important;width:100%!important}.link-course-select .ant-select{width:100%!important}}`}</style>

      <ProtoCard>
        {error && (
          <Alert
            type="error"
            message={error instanceof Error ? error.message : "Failed to load links"}
            style={{ marginBottom: 16 }}
            showIcon
          />
        )}

        <div className="pu-filters">
          <Select
            value={activeCourseId || undefined}
            onChange={(value) => {
              setSelectedCourseId(value || "");
              setPage(1);
            }}
            loading={coursesLoading}
            placeholder="请选择课程"
            style={{ width: 240 }}
            allowClear
            options={(Array.isArray(courses) ? courses : []).map((course: { id: string; title: string }) => ({
              value: course.id,
              label: course.title,
            }))}
          />
          <Input
            className="pu-search"
            placeholder="搜索链接标题或地址"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
          />
          <Button onClick={() => setSearchText("")}>重置</Button>
        </div>

        {(() => {
          const q = searchText.trim().toLowerCase();
          const filtered = (linkList || []).filter(
            (l: LinkType) =>
              !q ||
              (l.title || "").toLowerCase().includes(q) ||
              (l.url || "").toLowerCase().includes(q),
          );
          if (filtered.length === 0) {
            return (
              <ProtoEmpty
                title={activeCourseId ? "暂无链接" : "请先选择课程"}
                description="可切换课程，或点击右上角「添加链接」。"
              />
            );
          }
          return (
            <>
              <Table
                columns={columns}
                dataSource={filtered}
                rowKey="id"
                loading={isLoading}
                size="middle"
                pagination={false}
              />
              <div className="pu-table-footer">
                <span>共 {filtered.length} 条</span>
              </div>
            </>
          );
        })()}
      </ProtoCard>

      <Modal
        title="添加链接"
        open={addDialogOpen}
        onCancel={() => {
          setAddDialogOpen(false);
          form.resetFields();
        }}
        footer={null}
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAdd}
          initialValues={{
            category: "",
          }}
        >
          {activeCourseId ? (
            <Alert
              type="info"
              style={{ marginBottom: 16 }}
              message={
                <div>
                  <Text type="secondary">添加到课程:</Text>
                  <br />
                  <Text strong>
                    {courses.find((c: { id: string; title: string }) => c.id === activeCourseId)?.title}
                  </Text>
                </div>
              }
            />
          ) : (
            <Alert
              type="warning"
              message="请先选择一个课程后再添加链接"
              style={{ marginBottom: 16 }}
              showIcon
            />
          )}

          <Form.Item
            name="title"
            label="标题"
            rules={[
              { required: true, message: "请输入链接标题" },
              { max: 100, message: "标题不能超过100个字符" },
            ]}
          >
            <Input placeholder="输入链接标题" maxLength={100} />
          </Form.Item>

          <Form.Item
            name="url"
            label="链接地址"
            rules={[
              { required: true, message: "请输入链接地址" },
              { type: "url", message: "请输入有效的URL地址" },
            ]}
          >
            <Input placeholder="https://example.com" />
          </Form.Item>

          <Form.Item name="category" label="分类">
            <Select placeholder="选择分类（可选）" allowClear>
              <Select.Option value="视频">视频</Select.Option>
              <Select.Option value="文档">文档</Select.Option>
              <Select.Option value="书籍">书籍</Select.Option>
              <Select.Option value="工具">工具</Select.Option>
              <Select.Option value="网站">网站</Select.Option>
              <Select.Option value="其他">其他</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space style={{ width: "100%", justifyContent: "flex-end" }}>
              <Button
                onClick={() => {
                  setAddDialogOpen(false);
                  form.resetFields();
                }}
              >
                取消
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                disabled={!activeCourseId}
                loading={createMutation.isPending}
              >
                添加
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </AppPage>
  );
}

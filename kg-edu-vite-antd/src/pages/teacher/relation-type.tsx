import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Typography,
  Button,
  Modal,
  Input,
  Tag,
  Spin,
  Alert,
  Table,
  Space,
  Popconfirm,
  message,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  listRelationTypes,
  createRelationType,
  destroyRelationType,
} from "@/lib/ash_rpc";
import { getAuthHeaders } from "@/lib/auth";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";

const { Title, Text } = Typography;

interface RelationTypeFormData {
  name: string;
  displayName: string;
  description: string;
}

interface RelationType {
  id: string;
  name: string;
  displayName: string;
  description?: string | null;
}

export default function RelationTypeManagementPage() {
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const currentTenant = getCurrentTenant();
  const { canEdit } = useEditPermission();

  const [createModalOpen, setCreateModalOpen] = React.useState(false);
  const [formData, setFormData] = React.useState<RelationTypeFormData>({
    name: "",
    displayName: "",
    description: "",
  });
  const [searchQuery, setSearchQuery] = React.useState("");

  const {
    data: relationTypesData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["relation-types"],
    queryFn: async () => {
      const headers = getAuthHeaders(user) as Record<string, string>;

      const result = await listRelationTypes({
        tenant: currentTenant?.schemaName || "",
        fields: ["id", "name", "displayName", "description"],
        sort: "displayName",
        headers,
      });

      if (result.success && result.data) {
        const data = result.data as any;
        if (Array.isArray(data)) {
          return data;
        } else if (Array.isArray(data.results)) {
          return data.results;
        } else if (Array.isArray(data.data)) {
          return data.data;
        }
      }
      throw new Error("Failed to fetch relation types");
    },
    enabled: !!user,
  });

  const createRelationTypeMutation = useMutation({
    mutationFn: async (relationTypeData: RelationTypeFormData) => {
      const headers = getAuthHeaders(user) as Record<string, string>;

      const result = await createRelationType({
        tenant: currentTenant?.schemaName || "",
        input: relationTypeData,
        fields: ["id", "name", "displayName", "description"],
        headers,
      });

      if (result.success) {
        return result.data;
      }
      throw new Error("Failed to create relation type");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["relation-types"] });
      setCreateModalOpen(false);
      setFormData({ name: "", displayName: "", description: "" });
      message.success("关系类型创建成功");
    },
    onError: (error: any) => {
      message.error(`创建失败: ${error.message}`);
    },
  });

  const deleteRelationTypeMutation = useMutation({
    mutationFn: async (id: string) => {
      const headers = getAuthHeaders(user) as Record<string, string>;

      const result = await destroyRelationType({
        tenant: currentTenant?.schemaName || "",
        primaryKey: id,
        headers,
      });

      if (result.success) {
        return result.data;
      }
      throw new Error("Failed to delete relation type");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["relation-types"] });
      message.success("关系类型删除成功");
    },
    onError: (error: any) => {
      message.error(`删除失败: ${error.message}`);
    },
  });

  if (authLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}
      >
        <Spin size="large" />
        <Text style={{ marginLeft: 12 }}>正在检查认证状态...</Text>
      </div>
    );
  }

  if (!user) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}
      >
        <Title level={3} style={{ marginBottom: 12, color: "#ff4d4f" }}>
          用户未登录
        </Title>
        <Text style={{ marginBottom: 16 }}>请登录以访问关系类型管理。</Text>
        <Button type="primary" href="/auth/jwt/sign-in">
          登录
        </Button>
      </div>
    );
  }

  const relationTypes = relationTypesData || [];

  const filteredRelationTypes = relationTypes.filter(
    (relationType: RelationType) =>
      relationType.displayName
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      relationType.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (relationType.description &&
        relationType.description
          .toLowerCase()
          .includes(searchQuery.toLowerCase())),
  );

  const handleCreateRelationType = () => {
    if (!formData.name || !formData.displayName) {
      message.error("请填写必填字段");
      return;
    }

    createRelationTypeMutation.mutate(formData);
  };

  const handleDeleteRelationType = (id: string) => {
    deleteRelationTypeMutation.mutate(id);
  };

  const resetForm = () => {
    setFormData({ name: "", displayName: "", description: "" });
  };

  const columns = [
    {
      title: "显示名称",
      dataIndex: "displayName",
      key: "displayName",
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: "系统名称",
      dataIndex: "name",
      key: "name",
      render: (text: string) => <Text code>{text}</Text>,
    },
    {
      title: "描述",
      dataIndex: "description",
      key: "description",
      render: (text: string) => (
        <Text ellipsis style={{ maxWidth: 200 }}>
          {text || "-"}
        </Text>
      ),
    },
    {
      title: "操作",
      key: "action",
      render: (_: any, record: RelationType) => (
        <Popconfirm
          title="确认删除"
          description={
            <div>
              <p>确定要删除关系类型 "{record.displayName}" 吗？</p>
              <p style={{ color: "#ff4d4f" }}>
                注意：删除关系类型后，使用该类型的知识关系可能需要重新配置。
              </p>
            </div>
          }
          onConfirm={() => handleDeleteRelationType(record.id)}
          okText="删除"
          cancelText="取消"
          okButtonProps={{
            danger: true,
            loading: deleteRelationTypeMutation.isPending,
          }}
        >
          <ReadonlyActionButton type="text" danger icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <Title level={3} style={{ margin: 0, color: "#1890ff" }}>
          关系类型管理
        </Title>
        <Space>
          <Input
            placeholder="搜索关系类型..."
            prefix={<SearchOutlined />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 250 }}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              resetForm();
              setCreateModalOpen(true);
            }}
            style={canEdit ? undefined : { display: "none" }}
          >
            创建关系类型
          </Button>
        </Space>
      </div>

      <Card>
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ fontSize: 16 }}>
            关系类型列表
          </Text>
          <Tag color="blue" style={{ marginLeft: 8 }}>
            {filteredRelationTypes.length} 个
          </Tag>
        </div>

        {isLoading && (
          <div
            style={{ display: "flex", justifyContent: "center", padding: 32 }}
          >
            <Spin />
          </div>
        )}

        {error && (
          <Alert
            type="error"
            message={`加载关系类型失败: ${(error as Error).message}`}
            style={{ marginBottom: 16 }}
          />
        )}

        {!isLoading && !error && relationTypes.length === 0 && (
          <Alert
            type="info"
            message="暂无关系类型，点击「创建关系类型」按钮开始添加"
          />
        )}

        {!isLoading && !error && relationTypes.length > 0 && (
          <Table
            columns={columns}
            dataSource={filteredRelationTypes}
            rowKey="id"
            pagination={false}
          />
        )}

        {filteredRelationTypes.length === 0 &&
          searchQuery &&
          relationTypes.length > 0 && (
            <div style={{ textAlign: "center", padding: 32 }}>
              <Text type="secondary">
                没有找到匹配 "{searchQuery}" 的关系类型
              </Text>
            </div>
          )}
      </Card>

      <Modal
        title="创建关系类型"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={handleCreateRelationType}
        okText="创建"
        cancelText="取消"
        confirmLoading={createRelationTypeMutation.isPending}
        okButtonProps={{ disabled: !formData.displayName || !formData.name }}
      >
        <div style={{ marginBottom: 16 }}>
          <Text>
            显示名称 <Text type="danger">*</Text>
          </Text>
          <Input
            placeholder="用户友好的显示名称，如：前置知识、后置知识"
            value={formData.displayName}
            onChange={(e) =>
              setFormData({ ...formData, displayName: e.target.value })
            }
            style={{ marginTop: 8 }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <Text>
            系统名称 <Text type="danger">*</Text>
          </Text>
          <Input
            placeholder="系统内部使用的唯一标识，如：prerequisite、postrequisite"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            style={{ marginTop: 8 }}
          />
        </div>
        <div>
          <Text>描述</Text>
          <Input.TextArea
            rows={3}
            placeholder="关系的详细说明（可选）"
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            style={{ marginTop: 8 }}
          />
        </div>
      </Modal>
    </div>
  );
}

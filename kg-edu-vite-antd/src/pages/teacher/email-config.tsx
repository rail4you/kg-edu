import * as React from "react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Table,
  Button,
  Typography,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Spin,
  Alert,
  Popconfirm,
  message,
  Tooltip,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  MailOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { ReadonlyActionButton } from "@/components/readonly-action-button";
import {
  listUsers,
  createEmailConfig,
  updateEmailConfig,
  deleteEmailConfig,
  listEmailConfigs,
  getEmailConfigByUser,
} from "@/lib/ash_rpc";

const { Title, Text } = Typography;

interface Teacher {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  emailConfig?: EmailConfig;
}

interface EmailConfig {
  id: string;
  userId: string;
  emailAddress: string;
  senderName: string;
  apiKey: string;
}

interface FormValues {
  emailAddress: string;
  senderName: string;
  apiKey: string;
}

export default function EmailConfigManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const currentTenant = getCurrentTenant();
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [existingConfig, setExistingConfig] = useState<EmailConfig | null>(
    null,
  );
  const [form] = Form.useForm<FormValues>();

  const tenant = currentTenant?.schemaName || "";
  const headers = getAuthHeaders(user) as Record<string, string>;

  const { data: teachersResult = [], isLoading: teachersLoading } = useQuery({
    queryKey: ["teachers", "organization"],
    queryFn: async () => {
      const result = await listUsers({
        tenant,
        fields: ["id", "name", "email", "role"],
        filter: { role: { eq: "teacher" } },
        sort: "name",
        headers,
      });

      if (result.success && result.data) {
        return Array.isArray(result.data) ? result.data as Teacher[] : [];
      }
      throw new Error("Failed to fetch teachers");
    },
    enabled: !!tenant && !!user,
  });

  const { data: emailConfigsResult = [] } = useQuery({
    queryKey: ["email-configs", "all"],
    queryFn: async () => {
      const result = await listEmailConfigs({
        tenant,
        fields: ["id", { user: ["id"] }, "emailAddress", "senderName"],
        page: { limit: 100, offset: 0 },
        headers,
      });

      if (result.success && result.data) {
        const configs = Array.isArray(result.data)
          ? result.data
          : result.data.results || [];
        return configs as any[];
      }
      return [];
    },
    enabled: !!tenant && !!user,
  });

  const createMutation = useMutation({
    mutationFn: async (data: { teacherId: string; config: FormValues }) => {
      const result = await createEmailConfig({
        tenant,
        fields: ["id", "emailAddress", "senderName"],
        input: {
          userId: data.teacherId,
          emailAddress: data.config.emailAddress,
          senderName: data.config.senderName,
          apiKey: data.config.apiKey,
        },
        headers,
      });
      return result;
    },
    onSuccess: () => {
      message.success("邮箱配置创建成功");
      queryClient.invalidateQueries({ queryKey: ["email-configs"] });
      handleCloseConfigDialog();
    },
    onError: (error: any) => {
      message.error(error?.message || "创建失败");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { configId: string; config: FormValues }) => {
      const result = await updateEmailConfig({
        tenant,
        fields: ["id", "emailAddress", "senderName"],
        primaryKey: data.configId,
        input: {
          emailAddress: data.config.emailAddress,
          senderName: data.config.senderName,
          apiKey: data.config.apiKey,
        },
        headers,
      });
      return result;
    },
    onSuccess: () => {
      message.success("邮箱配置更新成功");
      queryClient.invalidateQueries({ queryKey: ["email-configs"] });
      handleCloseConfigDialog();
    },
    onError: (error: any) => {
      message.error(error?.message || "更新失败");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (configId: string) => {
      const result = await deleteEmailConfig({
        tenant,
        primaryKey: configId,
        headers,
      });
      return result;
    },
    onSuccess: () => {
      message.success("邮箱配置删除成功");
      queryClient.invalidateQueries({ queryKey: ["email-configs"] });
    },
    onError: (error: any) => {
      message.error(error?.message || "删除失败");
    },
  });

  const handleOpenConfigDialog = async (teacher: Teacher) => {
    setSelectedTeacher(teacher);

    const configResult = await getEmailConfigByUser({
      tenant,
      fields: ["id", "emailAddress", "senderName", "apiKey"],
      input: { userId: teacher.id },
      headers,
    });

    if (
      configResult.success &&
      configResult.data &&
      Array.isArray(configResult.data) &&
      configResult.data.length > 0
    ) {
      const config = configResult.data[0] as any;
      setExistingConfig({
        id: config.id,
        userId: teacher.id,
        emailAddress: config.emailAddress,
        senderName: config.senderName,
        apiKey: config.apiKey || "",
      });
      form.setFieldsValue({
        emailAddress: config.emailAddress,
        senderName: config.senderName,
        apiKey: config.apiKey || "",
      });
    } else {
      setExistingConfig(null);
      form.setFieldsValue({
        emailAddress: teacher.email || "",
        senderName: teacher.name || "",
        apiKey: "",
      });
    }

    setConfigDialogOpen(true);
  };

  const handleCloseConfigDialog = () => {
    setConfigDialogOpen(false);
    setSelectedTeacher(null);
    setExistingConfig(null);
    form.resetFields();
  };

  const handleSubmit = async (values: FormValues) => {
    if (!selectedTeacher) return;

    if (existingConfig) {
      updateMutation.mutate({
        configId: existingConfig.id,
        config: values,
      });
    } else {
      createMutation.mutate({
        teacherId: selectedTeacher.id,
        config: values,
      });
    }
  };

  const handleDelete = (configId: string) => {
    deleteMutation.mutate(configId);
  };

  const userConfigMap = React.useMemo(() => {
    const map = new Map<string, EmailConfig>();
    if (emailConfigsResult) {
      emailConfigsResult.forEach((config: any) => {
        if (config.user?.id) {
          map.set(config.user.id, {
            id: config.id,
            userId: config.user.id,
            emailAddress: config.emailAddress,
            senderName: config.senderName,
            apiKey: "",
          });
        }
      });
    }
    return map;
  }, [emailConfigsResult]);

  const teachersWithConfigs = React.useMemo(() => {
    if (!teachersResult) return [];
    return teachersResult.map((teacher: any) => ({
      ...teacher,
      emailConfig: userConfigMap.get(teacher.id),
    }));
  }, [teachersResult, userConfigMap]);

  const columns: ColumnsType<Teacher> = [
    {
      title: "姓名",
      dataIndex: "name",
      key: "name",
      width: 200,
      render: (name: string) => name || "未设置",
    },
    {
      title: "用户邮箱",
      dataIndex: "email",
      key: "email",
      width: 250,
      render: (email: string) => email || "未设置",
    },
    {
      title: "邮箱配置状态",
      key: "configStatus",
      width: 150,
      render: (_: any, record: Teacher) => {
        const hasConfig = !!record.emailConfig;
        return (
          <Tag color={hasConfig ? "success" : "default"}>
            {hasConfig ? "已配置" : "未配置"}
          </Tag>
        );
      },
    },
    {
      title: "配置的邮箱地址",
      key: "configuredEmail",
      width: 250,
      render: (_: any, record: Teacher) =>
        record.emailConfig?.emailAddress || "-",
    },
    {
      title: "发件人名称",
      key: "senderName",
      width: 200,
      render: (_: any, record: Teacher) =>
        record.emailConfig?.senderName || "-",
    },
    {
      title: "操作",
      key: "action",
      width: 200,
      render: (_: any, record: Teacher) => (
        <Space>
          <ReadonlyActionButton
            size="small"
            icon={record.emailConfig ? <EditOutlined /> : <PlusOutlined />}
            onClick={() => handleOpenConfigDialog(record)}
          >
            {record.emailConfig ? "修改" : "配置"}
          </ReadonlyActionButton>
          {record.emailConfig && (
            <Popconfirm
              title="确定要删除此邮箱配置吗?"
              onConfirm={() => handleDelete(record.emailConfig!.id)}
              okText="确定"
              cancelText="取消"
            >
              <ReadonlyActionButton size="small" danger icon={<DeleteOutlined />}>
                删除
              </ReadonlyActionButton>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  if (!user) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          type="error"
          message="用户未登录"
          description="请登录以访问邮箱配置管理。"
          showIcon
        />
      </div>
    );
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          padding: 24,
          borderBottom: "1px solid #f0f0f0",
          backgroundColor: "#fff",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <MailOutlined
              style={{ marginRight: 12, fontSize: 32, color: "#1890ff" }}
            />
            <Title level={3} style={{ margin: 0 }}>
              邮箱配置管理
            </Title>
          </div>
        </div>
        <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
          为组织内的教师配置发送邮件所需的邮箱设置。每个教师只能配置一个邮箱。
        </Text>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Text type="secondary">
            已配置: {userConfigMap.size} / {teachersWithConfigs.length} 位教师
          </Text>
        </div>
      </div>

      <div style={{ flex: 1, padding: 24, overflow: "auto" }}>
        <Card style={{ height: "100%" }}>
          {teachersLoading ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                minHeight: 300,
              }}
            >
              <Spin size="large" />
            </div>
          ) : (
            <Table
              columns={columns}
              dataSource={teachersWithConfigs}
              rowKey="id"
              pagination={{
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条`,
                defaultPageSize: 10,
              }}
            />
          )}
        </Card>
      </div>

      <Modal
        title={
          existingConfig
            ? `编辑邮箱配置 - ${selectedTeacher?.name}`
            : `配置邮箱 - ${selectedTeacher?.name}`
        }
        open={configDialogOpen}
        onCancel={handleCloseConfigDialog}
        footer={null}
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="emailAddress"
            label="邮箱地址"
            rules={[
              { required: true, message: "请输入邮箱地址" },
              { type: "email", message: "请输入有效的邮箱地址" },
            ]}
          >
            <Input placeholder="example@domain.com" />
          </Form.Item>
          <Form.Item
            name="senderName"
            label="发件人名称"
            rules={[{ required: true, message: "请输入发件人名称" }]}
          >
            <Input placeholder="张三" />
          </Form.Item>
          <Form.Item
            name="apiKey"
            label="API密钥"
            rules={[{ required: true, message: "请输入API密钥" }]}
            extra="请输入邮件服务提供商提供的API密钥"
          >
            <Input.Password placeholder="输入邮件服务提供商的API密钥" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
            <Space>
              <Button onClick={handleCloseConfigDialog}>取消</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={createMutation.isPending || updateMutation.isPending}
              >
                {existingConfig ? "更新" : "创建"}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

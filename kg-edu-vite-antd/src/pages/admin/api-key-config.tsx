import { useState } from "react";
import {
  Card,
  Form,
  Input,
  Button,
  Space,
  Typography,
  App,
  Alert,
  Descriptions,
  Tag,
  Spin,
  Tooltip,
} from "antd";
import {
  KeyOutlined,
  SaveOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  CopyOutlined,
  WarningOutlined,
  LinkOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { useResponsive } from "@/hooks/use-responsive";

const { Text } = Typography;

const QWEN_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";

interface ApiKeyConfig {
  id: string;
  provider: string;
  apiKey: string;
  baseUrl: string | null;
}

async function fetchQwenConfig(): Promise<ApiKeyConfig | null> {
  const resp = await fetch("/rpc/run", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      action: "get_api_key_config",
      input: { provider: "qwen" },
      fields: ["id", "provider", "apiKey", "baseUrl"],
    }),
  });
  if (!resp.ok) return null;
  const result = await resp.json();
  if (result.success && result.data && result.data.length > 0) {
    return {
      id: result.data[0].id,
      provider: result.data[0].provider,
      apiKey: result.data[0].apiKey || "",
      baseUrl: result.data[0].baseUrl || null,
    };
  }
  return null;
}

async function upsertQwenConfig(apiKey: string): Promise<boolean> {
  const resp = await fetch("/rpc/run", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      action: "update_api_key_config",
      input: {
        provider: "qwen",
        api_key: apiKey,
      },
      fields: ["id", "provider", "apiKey", "baseUrl"],
    }),
  });
  if (!resp.ok) return false;
  const result = await resp.json();
  return result.success === true;
}

function maskKey(key: string): string {
  if (key.length <= 8) return "••••••••";
  return key.slice(0, 4) + "••••••••" + key.slice(-4);
}

async function copyToClipboard(text: string, message: any) {
  try {
    await navigator.clipboard.writeText(text);
    message.success("已复制到剪贴板");
  } catch {
    message.error("复制失败");
  }
}

export default function ApiKeyConfigPage() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [showKey, setShowKey] = useState(false);
  const { isMobile } = useResponsive();

  const isSuperAdmin = user?.role === "super_admin";

  const {
    data: config,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["api_key_config", "qwen"],
    queryFn: fetchQwenConfig,
    enabled: isSuperAdmin,
  });

  const saveMutation = useMutation({
    mutationFn: (apiKey: string) => upsertQwenConfig(apiKey),
    onSuccess: (success) => {
      if (success) {
        message.success("Qwen API Key 已保存并生效！");
        queryClient.invalidateQueries({ queryKey: ["api_key_config"] });
      } else {
        message.error("保存失败，请重试");
      }
    },
    onError: (error: any) => {
      message.error(error?.message || "保存失败");
    },
  });

  if (!isSuperAdmin) {
    return (
      <div style={{ padding: isMobile ? 12 : 24 }}>
        <Alert
          type="error"
          message="权限不足"
          description="只有超级管理员可以管理 API Key 配置"
        />
      </div>
    );
  }

  return (
    <div style={{ padding: isMobile ? 12 : 24 }}>
      <Card
        title={
          <Space wrap size={isMobile ? 2 : 4} style={{ fontSize: isMobile ? 13 : 14 }}>
            <ApiOutlined style={{ color: "#1677ff", fontSize: isMobile ? 14 : 16 }} />
            <span>{isMobile ? "Qwen" : "通义千问 (Qwen)"}</span>
            <Tag color="blue" style={{ fontSize: isMobile ? 10 : 12, lineHeight: isMobile ? "18px" : "22px", padding: isMobile ? "0 4px" : undefined }}>DashScope</Tag>
            {config ? (
              <Tag color="green" icon={<CheckCircleOutlined />} style={{ fontSize: isMobile ? 10 : 12, lineHeight: isMobile ? "18px" : "22px", padding: isMobile ? "0 4px" : undefined }}>已配置</Tag>
            ) : (
              <Tag color="orange" icon={<WarningOutlined />} style={{ fontSize: isMobile ? 10 : 12, lineHeight: isMobile ? "18px" : "22px", padding: isMobile ? "0 4px" : undefined }}>未配置</Tag>
            )}
          </Space>
        }
        size={isMobile ? "small" : "default"}
        style={{ marginBottom: isMobile ? 16 : 24 }}
        styles={{ body: { padding: isMobile ? 12 : 24 } }}
      >
        <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          <div>
            <Text type="secondary" style={{ fontSize: isMobile ? 11 : 12, display: "block", marginBottom: 4, fontWeight: 500 }}>
              API Base URL
            </Text>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: isMobile ? "6px 10px" : "8px 12px",
                background: "#f5f5f5",
                borderRadius: 6,
                border: "1px solid #e8e8e8",
                overflow: "hidden",
              }}
            >
              <LinkOutlined style={{ color: "#999", fontSize: 13, flexShrink: 0 }} />
              <Text
                code
                style={{
                  flex: 1,
                  fontSize: isMobile ? 12 : 13,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  minWidth: 0,
                  background: "transparent",
                  border: "none",
                  padding: 0,
                }}
                title={QWEN_BASE_URL}
              >
                {QWEN_BASE_URL}
              </Text>
              <Tooltip title="复制">
                <Button
                  type="text"
                  size="small"
                  icon={<CopyOutlined style={{ fontSize: 13 }} />}
                  onClick={() => copyToClipboard(QWEN_BASE_URL, message)}
                  style={{ flexShrink: 0, color: "#999" }}
                />
              </Tooltip>
            </div>
            <Text type="secondary" style={{ fontSize: isMobile ? 11 : 12, marginTop: 4, display: "block", color: "#999" }}>
              Base URL 为固定值，无需修改
            </Text>
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: isMobile ? 11 : 12, display: "block", marginBottom: 4, fontWeight: 500 }}>
              模型
            </Text>
            <Text style={{ fontSize: isMobile ? 13 : 14 }}>qwen-plus (默认) / qwen-max (高能力)</Text>
          </div>
        </div>

        {isLoading ? (
          <div style={{ textAlign: "center", padding: 24 }}>
            <Spin tip="加载中..." />
          </div>
        ) : isError ? (
          <Alert
            type="error"
            message="加载失败"
            description="无法从服务器获取 API Key 配置"
            style={{ marginBottom: 16 }}
          />
        ) : null}

        {/* Current key display */}
        {config && (
          <div
            style={{
              marginBottom: isMobile ? 16 : 24,
              padding: isMobile ? "10px 12px" : "12px 16px",
              background: "#f6f8fa",
              borderRadius: 8,
              border: "1px solid #e8e8e8",
            }}
          >
            <Text type="secondary" style={{ fontSize: isMobile ? 11 : 12, marginBottom: 4, display: "block" }}>
              当前 API Key
            </Text>
            <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
              <Text
                code
                style={{
                  flex: 1,
                  fontSize: isMobile ? 13 : 14,
                  userSelect: showKey ? "text" : "none",
                  letterSpacing: showKey ? 0 : 2,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  minWidth: 0,
                  background: "transparent",
                  border: "none",
                  padding: 0,
                }}
                title={showKey ? config.apiKey : maskKey(config.apiKey)}
              >
                {showKey ? config.apiKey : maskKey(config.apiKey)}
              </Text>
              <Space size={2} style={{ flexShrink: 0 }}>
                <Tooltip title={showKey ? "隐藏" : "显示"}>
                  <Button
                    type="text"
                    size="small"
                    icon={showKey ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                    onClick={() => setShowKey(!showKey)}
                    style={{ fontSize: isMobile ? 13 : 14 }}
                  />
                </Tooltip>
                <Tooltip title="复制">
                  <Button
                    type="text"
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => copyToClipboard(config.apiKey, message)}
                    style={{ fontSize: isMobile ? 13 : 14 }}
                  />
                </Tooltip>
              </Space>
            </div>
          </div>
        )}

        {/* Edit form */}
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => saveMutation.mutate(values.apiKey)}
          initialValues={{ apiKey: config?.apiKey || "" }}
        >
          <Form.Item
            name="apiKey"
            label={<span style={{ fontSize: isMobile ? 13 : 14 }}>更换 API Key</span>}
            rules={[{ required: true, message: "请输入 Qwen API Key" }]}
          >
            <Input.Password
              placeholder="输入新的 DashScope API Key (sk-...)"
              visibilityToggle
              size={isMobile ? "middle" : "large"}
              prefix={<KeyOutlined />}
              style={{ fontSize: isMobile ? 13 : 14 }}
            />
          </Form.Item>

          <Form.Item>
            <Space wrap style={{ width: isMobile ? "100%" : undefined }}>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={saveMutation.isPending}
                size={isMobile ? "middle" : "large"}
                block={isMobile}
              >
                保存并应用
              </Button>
              <Button
                onClick={() => form.resetFields()}
                disabled={saveMutation.isPending}
                block={isMobile}
                size={isMobile ? "middle" : "middle"}
              >
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>

        <Alert
          type="info"
          message={<span style={{ fontSize: isMobile ? 13 : 14 }}>说明</span>}
          description={
            <div style={{ fontSize: isMobile ? 12 : 13, lineHeight: 1.6 }}>
              API Key 保存后<strong>立即生效</strong>，无需重启服务。
              系统会优先使用数据库中保存的 Key，数据库无配置时回退到环境变量。
              <br />
              获取 API Key:{" "}
              <a
                href="https://bailian.console.aliyun.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                阿里云百炼控制台
              </a>
            </div>
          }
          style={{ marginTop: isMobile ? 12 : 16 }}
        />
      </Card>
    </div>
  );
}

import { useState } from "react";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";
import {
  Card,
  Typography,
  Button,
  Row,
  Col,
  Tag,
  Table,
  Tabs,
  Input,
  Select,
  Space,
  Tooltip,
  Alert,
  Statistic,
} from "antd";
import type { TabsProps, TableProps } from "antd";
import {
  ApiOutlined,
  KeyOutlined,
  FileTextOutlined,
  BarChartOutlined,
  DownloadOutlined,
  PlusOutlined,
  PlayCircleOutlined,
  SettingOutlined,
  CopyOutlined,
  ReloadOutlined,
  DeleteOutlined,
  EyeOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  ThunderboltOutlined,
  DashboardOutlined,
} from "@ant-design/icons";

const { Title, Text } = Typography;

interface ApiEndpoint {
  id: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  description: string;
  category: string;
  status: "active" | "inactive" | "deprecated";
  lastCalled?: string;
  callCount: number;
  avgResponseTime: number;
}

interface ApiKey {
  id: string;
  name: string;
  key: string;
  permissions: string[];
  status: "active" | "inactive";
  createdAt: string;
  lastUsed?: string;
  callCount: number;
}

interface ApiLog {
  id: string;
  endpoint: string;
  method: string;
  status: number;
  responseTime: number;
  timestamp: string;
  ip: string;
  userAgent: string;
}

const MOCK_ENDPOINTS: ApiEndpoint[] = [
  {
    id: "1",
    method: "GET",
    path: "/api/courses",
    description: "获取所有课程列表",
    category: "课程管理",
    status: "active",
    lastCalled: "2024-01-15T10:30:00Z",
    callCount: 1250,
    avgResponseTime: 120,
  },
  {
    id: "2",
    method: "POST",
    path: "/api/courses",
    description: "创建新课程",
    category: "课程管理",
    status: "active",
    lastCalled: "2024-01-15T09:45:00Z",
    callCount: 45,
    avgResponseTime: 350,
  },
  {
    id: "3",
    method: "GET",
    path: "/api/students",
    description: "获取学生列表",
    category: "用户管理",
    status: "active",
    lastCalled: "2024-01-15T11:20:00Z",
    callCount: 890,
    avgResponseTime: 95,
  },
  {
    id: "4",
    method: "POST",
    path: "/api/assignments",
    description: "创建作业",
    category: "作业管理",
    status: "active",
    lastCalled: "2024-01-15T08:15:00Z",
    callCount: 78,
    avgResponseTime: 280,
  },
  {
    id: "5",
    method: "GET",
    path: "/api/analytics/dashboard",
    description: "获取仪表板数据",
    category: "数据分析",
    status: "active",
    lastCalled: "2024-01-15T11:55:00Z",
    callCount: 2100,
    avgResponseTime: 150,
  },
];

const MOCK_API_KEYS: ApiKey[] = [
  {
    id: "1",
    name: "教学管理系统",
    key: "ak_test_4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c",
    permissions: ["read", "write"],
    status: "active",
    createdAt: "2024-01-01T00:00:00Z",
    lastUsed: "2024-01-15T10:30:00Z",
    callCount: 3420,
  },
  {
    id: "2",
    name: "移动应用访问",
    key: "ak_test_3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a",
    permissions: ["read"],
    status: "active",
    createdAt: "2024-01-05T00:00:00Z",
    lastUsed: "2024-01-15T09:15:00Z",
    callCount: 1280,
  },
];

const MOCK_API_LOGS: ApiLog[] = [
  {
    id: "1",
    endpoint: "/api/courses",
    method: "GET",
    status: 200,
    responseTime: 120,
    timestamp: "2024-01-15T11:55:23Z",
    ip: "192.168.1.100",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  },
  {
    id: "2",
    endpoint: "/api/students",
    method: "GET",
    status: 200,
    responseTime: 95,
    timestamp: "2024-01-15T11:54:15Z",
    ip: "192.168.1.101",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  },
  {
    id: "3",
    endpoint: "/api/assignments",
    method: "POST",
    status: 201,
    responseTime: 280,
    timestamp: "2024-01-15T11:52:42Z",
    ip: "192.168.1.102",
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
  },
];

const getMethodColor = (method: string): string => {
  switch (method) {
    case "GET":
      return "green";
    case "POST":
      return "blue";
    case "PUT":
      return "orange";
    case "DELETE":
      return "red";
    case "PATCH":
      return "purple";
    default:
      return "default";
  }
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case "active":
      return "green";
    case "inactive":
      return "red";
    case "deprecated":
      return "orange";
    default:
      return "default";
  }
};

const getStatusIcon = (status: number) => {
  if (status >= 200 && status < 300)
    return <CheckCircleOutlined style={{ color: "#52c41a" }} />;
  if (status >= 400 && status < 500)
    return <ExclamationCircleOutlined style={{ color: "#faad14" }} />;
  if (status >= 500)
    return <CloseCircleOutlined style={{ color: "#ff4d4f" }} />;
  return <InfoCircleOutlined style={{ color: "#1890ff" }} />;
};

const getStatusColorForCode = (status: number): string => {
  if (status >= 200 && status < 300) return "green";
  if (status >= 400 && status < 500) return "orange";
  if (status >= 500) return "red";
  return "default";
};

export default function ApiManagementPage() {
  const { canEdit } = useEditPermission();
  const [endpoints] = useState<ApiEndpoint[]>(MOCK_ENDPOINTS);
  const [apiKeys] = useState<ApiKey[]>(MOCK_API_KEYS);
  const [apiLogs] = useState<ApiLog[]>(MOCK_API_LOGS);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const endpointColumns: TableProps<ApiEndpoint>["columns"] = [
    {
      title: "方法",
      dataIndex: "method",
      key: "method",
      width: 80,
      render: (method: string) => (
        <Tag color={getMethodColor(method)}>{method}</Tag>
      ),
    },
    {
      title: "路径",
      dataIndex: "path",
      key: "path",
      render: (path: string) => (
        <Tooltip title={path} mouseEnterDelay={0.3}>
          <Text code style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{path}</Text>
        </Tooltip>
      ),
    },
    {
      title: "描述",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
    },
    {
      title: "分类",
      dataIndex: "category",
      key: "category",
      render: (category: string) => <Tag>{category}</Tag>,
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{status}</Tag>
      ),
    },
    {
      title: "调用次数",
      dataIndex: "callCount",
      key: "callCount",
      render: (count: number) => count.toLocaleString(),
    },
    {
      title: "平均响应时间",
      dataIndex: "avgResponseTime",
      key: "avgResponseTime",
      render: (time: number) => `${time}ms`,
    },
    {
      title: "最后调用",
      dataIndex: "lastCalled",
      key: "lastCalled",
      render: (time: string) =>
        time ? new Date(time).toLocaleString() : "从未调用",
    },
    {
      title: "操作",
      key: "action",
      render: () => (
        <Space>
          <Tooltip title="测试">
            <Button type="text" size="small" icon={<PlayCircleOutlined />} />
          </Tooltip>
          <Tooltip title="文档">
            <Button type="text" size="small" icon={<FileTextOutlined />} />
          </Tooltip>
          <Tooltip title="设置">
            <Button type="text" size="small" icon={<SettingOutlined />} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const logColumns: TableProps<ApiLog>["columns"] = [
    {
      title: "时间",
      dataIndex: "timestamp",
      key: "timestamp",
      render: (time: string) => (
        <Text type="secondary">{new Date(time).toLocaleString()}</Text>
      ),
    },
    {
      title: "端点",
      dataIndex: "endpoint",
      key: "endpoint",
      render: (endpoint: string) => <Text code>{endpoint}</Text>,
    },
    {
      title: "方法",
      dataIndex: "method",
      key: "method",
      render: (method: string) => (
        <Tag color={getMethodColor(method)}>{method}</Tag>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (status: number) => (
        <Space>
          {getStatusIcon(status)}
          <Tag color={getStatusColorForCode(status)}>{status}</Tag>
        </Space>
      ),
    },
    {
      title: "响应时间",
      dataIndex: "responseTime",
      key: "responseTime",
      render: (time: number) => `${time}ms`,
    },
    {
      title: "IP 地址",
      dataIndex: "ip",
      key: "ip",
      render: (ip: string) => <Text type="secondary">{ip}</Text>,
    },
    {
      title: "操作",
      key: "action",
      render: () => (
        <Tooltip title="查看详情">
          <Button type="text" size="small" icon={<EyeOutlined />} />
        </Tooltip>
      ),
    },
  ];

  const filteredEndpoints = endpoints
    .filter(
      (ep) =>
        searchTerm === "" ||
        ep.path.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    .filter(
      (ep) => selectedCategory === "all" || ep.category === selectedCategory,
    );

  const renderEndpointsTab = () => (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 16 }}>
        <Input
          placeholder="搜索 API 端点..."
          prefix={<SearchOutlined />}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: 300 }}
        />
        <Select
          value={selectedCategory}
          onChange={setSelectedCategory}
          style={{ width: 150 }}
          options={[
            { value: "all", label: "全部分类" },
            { value: "课程管理", label: "课程管理" },
            { value: "用户管理", label: "用户管理" },
            { value: "作业管理", label: "作业管理" },
            { value: "数据分析", label: "数据分析" },
          ]}
        />
      </Space>
      <Table
        columns={endpointColumns}
        dataSource={filteredEndpoints}
        rowKey="id"
        pagination={{
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
      />
    </div>
  );

  const renderApiKeysTab = () => (
    <div style={{ padding: 16 }}>
      <Alert
        message="API Keys 用于程序化访问教师工作台数据。请妥善保管您的 API Keys，不要在代码中暴露。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />
      <Space direction="vertical" style={{ width: "100%" }} size="middle">
        {apiKeys.map((apiKey) => (
          <Card key={apiKey.id} size="small">
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ flex: 1 }}>
                <Space style={{ marginBottom: 8 }}>
                  <Text strong>{apiKey.name}</Text>
                  <Tag color={getStatusColor(apiKey.status)}>
                    {apiKey.status}
                  </Tag>
                </Space>
                <div style={{ marginBottom: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    API Key:
                  </Text>
                  <div
                    style={{
                      marginTop: 4,
                      padding: 8,
                      background: "#f5f5f5",
                      borderRadius: 4,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <Text code style={{ flex: 1 }}>
                      {apiKey.key.slice(0, 20)}...{apiKey.key.slice(-10)}
                    </Text>
                    <Button type="text" size="small" icon={<CopyOutlined />} />
                  </div>
                </div>
                <Row gutter={16}>
                  <Col span={6}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      权限:
                    </Text>
                    <div style={{ marginTop: 4 }}>
                      {apiKey.permissions.map((permission) => (
                        <Tag key={permission}>{permission}</Tag>
                      ))}
                    </div>
                  </Col>
                  <Col span={6}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      创建时间:
                    </Text>
                    <div style={{ marginTop: 4 }}>
                      {new Date(apiKey.createdAt).toLocaleDateString()}
                    </div>
                  </Col>
                  <Col span={6}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      最后使用:
                    </Text>
                    <div style={{ marginTop: 4 }}>
                      {apiKey.lastUsed
                        ? new Date(apiKey.lastUsed).toLocaleDateString()
                        : "从未使用"}
                    </div>
                  </Col>
                  <Col span={6}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      调用次数:
                    </Text>
                    <div style={{ marginTop: 4 }}>
                      {apiKey.callCount.toLocaleString()}
                    </div>
                  </Col>
                </Row>
              </div>
              <Space direction="vertical">
                <ReadonlyActionButton type="text" icon={<ReloadOutlined />} />
                <ReadonlyActionButton type="text" danger icon={<DeleteOutlined />} />
              </Space>
            </div>
          </Card>
        ))}
      </Space>
    </div>
  );

  const renderLogsTab = () => (
    <div style={{ padding: 16 }}>
      <Table
        columns={logColumns}
        dataSource={apiLogs}
        rowKey="id"
        pagination={{
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
      />
    </div>
  );

  const renderStatsTab = () => (
    <div style={{ padding: 48, textAlign: "center" }}>
      <BarChartOutlined
        style={{ fontSize: 64, color: "#bfbfbf", marginBottom: 16 }}
      />
      <Title level={5}>使用统计</Title>
      <Text type="secondary">详细的 API 使用统计图表和报告正在开发中...</Text>
    </div>
  );

  const tabItems: TabsProps["items"] = [
    {
      key: "endpoints",
      label: (
        <span>
          <ApiOutlined />
          API 端点
        </span>
      ),
      children: renderEndpointsTab(),
    },
    {
      key: "keys",
      label: (
        <span>
          <KeyOutlined />
          API Keys
        </span>
      ),
      children: renderApiKeysTab(),
    },
    {
      key: "logs",
      label: (
        <span>
          <FileTextOutlined />
          调用日志
        </span>
      ),
      children: renderLogsTab(),
    },
    {
      key: "stats",
      label: (
        <span>
          <BarChartOutlined />
          使用统计
        </span>
      ),
      children: renderStatsTab(),
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
        <div>
          <Title level={3} style={{ margin: 0, marginBottom: 4 }}>
            API 管理
          </Title>
          <Text type="secondary">管理和监控教师工作台的 API 接口使用情况</Text>
        </div>
        <Space>
          <Button icon={<DownloadOutlined />}>导出文档</Button>
          <Button type="primary" icon={<PlusOutlined />} style={canEdit ? undefined : { display: "none" }}>
            生成 API Key
          </Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="API 端点"
              value={endpoints.length}
              prefix={<ApiOutlined style={{ color: "#1890ff" }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="API Keys"
              value={apiKeys.length}
              prefix={<KeyOutlined style={{ color: "#52c41a" }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="总调用次数"
              value={endpoints.reduce((sum, ep) => sum + ep.callCount, 0)}
              prefix={<ThunderboltOutlined style={{ color: "#faad14" }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="平均响应时间"
              value={Math.round(
                endpoints.reduce((sum, ep) => sum + ep.avgResponseTime, 0) /
                  endpoints.length,
              )}
              suffix="ms"
              prefix={<DashboardOutlined style={{ color: "#722ed1" }} />}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs items={tabItems} />
      </Card>
    </div>
  );
}

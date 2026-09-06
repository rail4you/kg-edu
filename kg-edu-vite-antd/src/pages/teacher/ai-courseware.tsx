import React, { useState } from "react";
import {
  Card,
  Row,
  Col,
  Typography,
  Button,
  Input,
  Tabs,
  Table,
  Tag,
  Space,
  Avatar,
  List,
  Progress,
  Switch,
  message,
  Upload,
  FloatButton,
  Statistic,
  Divider,
  Tooltip,
} from "antd";
import type { UploadProps } from "antd";
import {
  PlusOutlined,
  UploadOutlined,
  SearchOutlined,
  FilterOutlined,
  FileTextOutlined,
  StarOutlined,
  BookOutlined,
  CloudUploadOutlined,
  PlayCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  DownloadOutlined,
  ReloadOutlined,
  SettingOutlined,
  SafetyOutlined,
  ThunderboltOutlined,
  DatabaseOutlined,
  BulbOutlined,
  ApiOutlined,
  SyncOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";

const { Title, Text } = Typography;

interface Courseware {
  id: string;
  title: string;
  subject: string;
  grade: string;
  type: "教案" | "课件" | "试题" | "其他";
  status: "已生成" | "已上传" | "处理中" | "已完成";
  createdAt: string;
  fileSize?: string;
  aiGenerated?: boolean;
  description?: string;
}

interface AISettings {
  aiGeneration: {
    enabled: boolean;
    autoSave: boolean;
    defaultTemplate: string;
    maxTokens: number;
    temperature: number;
  };
  downloadSettings: {
    allowDownload: boolean;
    requireAuth: boolean;
    maxDownloadPerDay: number;
    formats: string[];
    watermark: boolean;
  };
  performanceSettings: {
    cacheEnabled: boolean;
    batchSize: number;
    maxConcurrentRequests: number;
    timeout: number;
  };
  ragSettings: {
    enabled: boolean;
    autoIndexing: boolean;
    chunkSize: number;
    similarity: number;
    maxDocuments: number;
  };
  privacySettings: {
    dataRetention: number;
    anonymizeData: boolean;
    shareAnalytics: boolean;
    encryptionEnabled: boolean;
  };
}

export default function AICoursewarePage() {
  const { user } = useAuth();
  const tenant = getCurrentTenant()?.schemaName;
  const { canEdit } = useEditPermission();

  const [activeTab, setActiveTab] = useState("0");
  const [searchTerm, setSearchTerm] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const [aiSettings, setAiSettings] = useState<AISettings>({
    aiGeneration: {
      enabled: true,
      autoSave: false,
      defaultTemplate: "auto",
      maxTokens: 2000,
      temperature: 0.7,
    },
    downloadSettings: {
      allowDownload: true,
      requireAuth: true,
      maxDownloadPerDay: 50,
      formats: ["pdf", "docx", "pptx"],
      watermark: false,
    },
    performanceSettings: {
      cacheEnabled: true,
      batchSize: 10,
      maxConcurrentRequests: 5,
      timeout: 30000,
    },
    ragSettings: {
      enabled: true,
      autoIndexing: true,
      chunkSize: 1000,
      similarity: 0.8,
      maxDocuments: 1000,
    },
    privacySettings: {
      dataRetention: 365,
      anonymizeData: true,
      shareAnalytics: false,
      encryptionEnabled: true,
    },
  });

  const [coursewareList, setCoursewareList] = useState<Courseware[]>([
    {
      id: "1",
      title: "大学数学 - 高等数学微积分教案",
      subject: "数学",
      grade: "大学一年级",
      type: "教案",
      status: "已生成",
      createdAt: "2024-01-15 10:30",
      aiGenerated: true,
      description: "涵盖微积分的基本概念、极限、导数和积分",
    },
    {
      id: "2",
      title: "大学计算机 - Python编程基础课件",
      subject: "计算机科学",
      grade: "大学二年级",
      type: "课件",
      status: "已上传",
      createdAt: "2024-01-14 14:20",
      fileSize: "5.2MB",
    },
    {
      id: "3",
      title: "大学物理 - 量子力学入门试题",
      subject: "物理",
      grade: "大学三年级",
      type: "试题",
      status: "处理中",
      createdAt: "2024-01-15 09:15",
      aiGenerated: true,
    },
    {
      id: "4",
      title: "大学经济学 - 宏观经济学理论框架",
      subject: "经济学",
      grade: "大学四年级",
      type: "其他",
      status: "已完成",
      createdAt: "2024-01-13 16:45",
    },
  ]);

  const handleGenerateCourseware = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const newCourseware: Courseware = {
        id: Date.now().toString(),
        title: `AI生成 - ${new Date().toLocaleString()} 大学教案`,
        subject: "数据结构",
        grade: "大学二年级",
        type: "教案",
        status: "已完成",
        createdAt: new Date().toISOString(),
        aiGenerated: true,
        description: "AI智能生成的大学专业课程教案",
      };
      setCoursewareList([newCourseware, ...coursewareList]);
      setIsGenerating(false);
      message.success("教案生成成功");
    }, 3000);
  };

  const handleSettingChange = (
    category: keyof AISettings,
    field: string,
    value: unknown,
  ) => {
    setAiSettings((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value,
      },
    }));
  };

  const handleSaveSettings = () => {
    message.success("设置已保存！");
  };

  const columns = [
    {
      title: "标题",
      dataIndex: "title",
      key: "title",
      render: (text: string, record: Courseware) => (
        <Space size={4} style={{ maxWidth: "100%" }}>
          {record.aiGenerated && (
            <Tag color="blue" icon={<StarOutlined />} style={{ fontSize: 10, flexShrink: 0 }}>
              AI
            </Tag>
          )}
          <Tooltip title={text} mouseEnterDelay={0.3}>
            <Text strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>{text}</Text>
          </Tooltip>
        </Space>
      ),
    },
    {
      title: "学科",
      dataIndex: "subject",
      key: "subject",
      width: 100,
    },
    {
      title: "年级",
      dataIndex: "grade",
      key: "grade",
      width: 120,
    },
    {
      title: "类型",
      dataIndex: "type",
      key: "type",
      width: 100,
      render: (type: string) => <Tag>{type}</Tag>,
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status: string) => {
        const statusConfig: Record<string, string> = {
          已生成: "success",
          已上传: "processing",
          处理中: "warning",
          已完成: "success",
        };
        return <Tag color={statusConfig[status] || "default"}>{status}</Tag>;
      },
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 150,
      render: (date: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {new Date(date).toLocaleString()}
        </Text>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 150,
      render: (_: unknown, record: Courseware) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            style={{ color: "#1890ff" }}
          />
          <ReadonlyActionButton
            type="text"
            size="small"
            icon={<EditOutlined />}
            style={{ color: "#52c41a" }}
          />
          <Button
            type="text"
            size="small"
            icon={<DownloadOutlined />}
            style={{ color: "#722ed1" }}
          />
          <ReadonlyActionButton type="text" size="small" danger icon={<DeleteOutlined />} />
        </Space>
      ),
    },
  ];

  const uploadProps: UploadProps = {
    name: "file",
    multiple: true,
    accept: ".pdf,.doc,.docx,.ppt,.pptx",
    beforeUpload: () => false,
    onChange: (info) => {
      console.log("Upload files:", info.fileList);
    },
  };

  const templates = [
    { title: "高等数学微积分教案模板", type: "数学" },
    { title: "数据结构与算法教案", type: "计算机" },
    { title: "大学英语写作教学课件", type: "英语" },
    { title: "大学物理实验课件模板", type: "物理" },
  ];

  const parsingFiles = [
    { name: "高等数学教材-极限理论.pdf", status: "已完成", progress: 100 },
    { name: "计算机网络协议分析.pptx", status: "解析中", progress: 65 },
    { name: "机械工程实验手册.doc", status: "等待中", progress: 0 },
  ];

  const tabItems = [
    {
      key: "0",
      label: "资源管理",
      children: (
        <Card>
          <Space style={{ width: "100%", marginBottom: 16 }} size="middle">
            <Input
              placeholder="搜索教案、课件..."
              prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: 300 }}
            />
            <Button icon={<FilterOutlined />}>筛选</Button>
            <Button icon={<UploadOutlined />} style={canEdit ? undefined : { display: "none" }}>上传文件</Button>
          </Space>
          <Table
            columns={columns}
            dataSource={coursewareList}
            rowKey="id"
            pagination={false}
            style={{ minHeight: 500 }}
          />
        </Card>
      ),
    },
    {
      key: "1",
      label: "AI生成",
      children: (
        <Row gutter={24}>
          <Col xs={24} md={12}>
            <Card title="快速生成教案">
              <Space
                direction="vertical"
                style={{ width: "100%" }}
                size="middle"
              >
                <Input
                  placeholder="例如：大学数学微积分基础"
                  addonBefore="课程主题"
                />
                <Input placeholder="例如：大学一年级" addonBefore="年级" />
                <Input placeholder="例如：高等数学" addonBefore="学科" />
                <div>
                  <Text
                    type="secondary"
                    style={{ marginBottom: 4, display: "block" }}
                  >
                    具体要求
                  </Text>
                  <Input.TextArea
                    rows={3}
                    placeholder="请描述您的具体需求..."
                  />
                </div>
                <Button
                  type="primary"
                  block
                  onClick={handleGenerateCourseware}
                  loading={isGenerating}
                  icon={<StarOutlined />}
                  style={canEdit ? undefined : { display: "none" }}
                >
                  {isGenerating ? "正在生成中..." : "生成教案"}
                </Button>
                {isGenerating && (
                  <div>
                    <Text
                      type="secondary"
                      style={{ display: "block", marginBottom: 8 }}
                    >
                      AI正在分析需求并生成教案...
                    </Text>
                    <Progress percent={50} status="active" showInfo={false} />
                  </div>
                )}
              </Space>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card title="生成模板">
              <List
                dataSource={templates}
                renderItem={(item, index) => (
                  <div key={index}>
                    <List.Item
                      actions={[
                        <Button key="use" size="small" style={canEdit ? undefined : { display: "none" }}>
                          使用
                        </Button>,
                      ]}
                    >
                      <List.Item.Meta
                        title={item.title}
                        description={item.type}
                      />
                    </List.Item>
                    {index < templates.length - 1 && (
                      <Divider style={{ margin: 0 }} />
                    )}
                  </div>
                )}
              />
            </Card>
          </Col>
        </Row>
      ),
    },
    {
      key: "2",
      label: "知识库解析",
      children: (
        <Row gutter={24}>
          <Col xs={24} md={12}>
            <Card title="RAG知识库解析">
              {canEdit && (
              <Upload.Dragger {...uploadProps} style={{ marginBottom: 16 }}>
                <p className="ant-upload-drag-icon">
                  <CloudUploadOutlined
                    style={{ fontSize: 48, color: "#bfbfbf" }}
                  />
                </p>
                <p className="ant-upload-text" style={{ fontSize: 16 }}>
                  拖拽或点击上传文件
                </p>
                <p className="ant-upload-hint">
                  支持 PDF, DOC, DOCX, PPT, PPTX 格式
                </p>
              </Upload.Dragger>
              )}
              <Text type="secondary" style={{ marginTop: 8, display: "block" }}>
                上传的文件将自动进行文档解析和向量化处理
              </Text>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card title="解析状态">
              <List
                dataSource={parsingFiles}
                renderItem={(file, index) => (
                  <div key={index}>
                    <List.Item>
                      <List.Item.Meta
                        title={file.name}
                        description={
                          <div>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {file.status}
                            </Text>
                            <Progress
                              percent={file.progress}
                              size="small"
                              style={{ marginTop: 4 }}
                            />
                          </div>
                        }
                      />
                      <Text type="secondary">{file.progress}%</Text>
                    </List.Item>
                    {index < parsingFiles.length - 1 && (
                      <Divider style={{ margin: 0 }} />
                    )}
                  </div>
                )}
              />
            </Card>
          </Col>
        </Row>
      ),
    },
    {
      key: "3",
      label: "统计分析",
      children: (
        <Row gutter={24}>
          <Col xs={12} md={6}>
            <Card>
              <Statistic
                title="使用统计"
                value={156}
                suffix="次"
                valueStyle={{ color: "#1890ff" }}
              />
              <Text type="secondary">本月生成次数</Text>
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card>
              <Statistic
                title="知识库大小"
                value={2300}
                suffix="个"
                valueStyle={{ color: "#52c41a" }}
              />
              <Text type="secondary">文档数量</Text>
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card>
              <Statistic
                title="平均质量"
                value={4.8}
                suffix="/5.0"
                valueStyle={{ color: "#faad14" }}
              />
              <Text type="secondary">评分</Text>
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card>
              <Statistic
                title="节省时间"
                value={12}
                suffix="小时"
                valueStyle={{ color: "#722ed1" }}
              />
              <Text type="secondary">本月累计</Text>
            </Card>
          </Col>
        </Row>
      ),
    },
    {
      key: "4",
      label: (
        <span>
          <SettingOutlined /> AI课程设置
        </span>
      ),
      children: (
        <div>
          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Card
                title={
                  <Space>
                    <StarOutlined style={{ color: "#1890ff" }} /> AI生成设置
                  </Space>
                }
              >
                <Space
                  direction="vertical"
                  style={{ width: "100%" }}
                  size="middle"
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text strong>启用AI生成功能</Text>
                    <Switch
                      checked={aiSettings.aiGeneration.enabled}
                      onChange={(v) =>
                        handleSettingChange("aiGeneration", "enabled", v)
                      }
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text>自动保存生成的内容</Text>
                    <Switch
                      checked={aiSettings.aiGeneration.autoSave}
                      onChange={(v) =>
                        handleSettingChange("aiGeneration", "autoSave", v)
                      }
                    />
                  </div>
                  <Input
                    addonBefore="最大Token数量"
                    type="number"
                    value={aiSettings.aiGeneration.maxTokens}
                    onChange={(e) =>
                      handleSettingChange(
                        "aiGeneration",
                        "maxTokens",
                        parseInt(e.target.value),
                      )
                    }
                  />
                  <Input
                    addonBefore="创意度 (0-1)"
                    type="number"
                    min={0}
                    max={1}
                    step={0.1}
                    value={aiSettings.aiGeneration.temperature}
                    onChange={(e) =>
                      handleSettingChange(
                        "aiGeneration",
                        "temperature",
                        parseFloat(e.target.value),
                      )
                    }
                  />
                </Space>
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card
                title={
                  <Space>
                    <DownloadOutlined style={{ color: "#52c41a" }} /> 下载管理
                  </Space>
                }
              >
                <Space
                  direction="vertical"
                  style={{ width: "100%" }}
                  size="middle"
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text strong>允许下载</Text>
                    <Switch
                      checked={aiSettings.downloadSettings.allowDownload}
                      onChange={(v) =>
                        handleSettingChange(
                          "downloadSettings",
                          "allowDownload",
                          v,
                        )
                      }
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text>需要身份验证</Text>
                    <Switch
                      checked={aiSettings.downloadSettings.requireAuth}
                      onChange={(v) =>
                        handleSettingChange(
                          "downloadSettings",
                          "requireAuth",
                          v,
                        )
                      }
                    />
                  </div>
                  <Input
                    addonBefore="每日最大下载次数"
                    type="number"
                    value={aiSettings.downloadSettings.maxDownloadPerDay}
                    onChange={(e) =>
                      handleSettingChange(
                        "downloadSettings",
                        "maxDownloadPerDay",
                        parseInt(e.target.value),
                      )
                    }
                  />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text>添加水印</Text>
                    <Switch
                      checked={aiSettings.downloadSettings.watermark}
                      onChange={(v) =>
                        handleSettingChange("downloadSettings", "watermark", v)
                      }
                    />
                  </div>
                  <Text type="secondary">
                    支持格式: {aiSettings.downloadSettings.formats.join(", ")}
                  </Text>
                </Space>
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card
                title={
                  <Space>
                    <ThunderboltOutlined style={{ color: "#faad14" }} />{" "}
                    性能优化
                  </Space>
                }
              >
                <Space
                  direction="vertical"
                  style={{ width: "100%" }}
                  size="middle"
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text strong>启用缓存</Text>
                    <Switch
                      checked={aiSettings.performanceSettings.cacheEnabled}
                      onChange={(v) =>
                        handleSettingChange(
                          "performanceSettings",
                          "cacheEnabled",
                          v,
                        )
                      }
                    />
                  </div>
                  <Input
                    addonBefore="批处理大小"
                    type="number"
                    value={aiSettings.performanceSettings.batchSize}
                    onChange={(e) =>
                      handleSettingChange(
                        "performanceSettings",
                        "batchSize",
                        parseInt(e.target.value),
                      )
                    }
                  />
                  <Input
                    addonBefore="最大并发请求"
                    type="number"
                    value={aiSettings.performanceSettings.maxConcurrentRequests}
                    onChange={(e) =>
                      handleSettingChange(
                        "performanceSettings",
                        "maxConcurrentRequests",
                        parseInt(e.target.value),
                      )
                    }
                  />
                </Space>
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card
                title={
                  <Space>
                    <BulbOutlined style={{ color: "#722ed1" }} /> RAG知识库
                  </Space>
                }
              >
                <Space
                  direction="vertical"
                  style={{ width: "100%" }}
                  size="middle"
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text strong>启用RAG功能</Text>
                    <Switch
                      checked={aiSettings.ragSettings.enabled}
                      onChange={(v) =>
                        handleSettingChange("ragSettings", "enabled", v)
                      }
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text>自动索引</Text>
                    <Switch
                      checked={aiSettings.ragSettings.autoIndexing}
                      onChange={(v) =>
                        handleSettingChange("ragSettings", "autoIndexing", v)
                      }
                    />
                  </div>
                  <Input
                    addonBefore="文档分块大小"
                    type="number"
                    value={aiSettings.ragSettings.chunkSize}
                    onChange={(e) =>
                      handleSettingChange(
                        "ragSettings",
                        "chunkSize",
                        parseInt(e.target.value),
                      )
                    }
                  />
                  <Input
                    addonBefore="相似度阈值"
                    type="number"
                    min={0}
                    max={1}
                    step={0.1}
                    value={aiSettings.ragSettings.similarity}
                    onChange={(e) =>
                      handleSettingChange(
                        "ragSettings",
                        "similarity",
                        parseFloat(e.target.value),
                      )
                    }
                  />
                </Space>
              </Card>
            </Col>
            <Col xs={24}>
              <Card
                title={
                  <Space>
                    <SafetyOutlined style={{ color: "#ff4d4f" }} /> 隐私与安全
                  </Space>
                }
              >
                <Row gutter={24}>
                  <Col xs={24} md={8}>
                    <Input
                      addonBefore="数据保留天数"
                      type="number"
                      value={aiSettings.privacySettings.dataRetention}
                      onChange={(e) =>
                        handleSettingChange(
                          "privacySettings",
                          "dataRetention",
                          parseInt(e.target.value),
                        )
                      }
                    />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      数据在服务器保留的天数
                    </Text>
                  </Col>
                  <Col xs={24} md={8}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginTop: 8,
                      }}
                    >
                      <Text>数据匿名化</Text>
                      <Switch
                        checked={aiSettings.privacySettings.anonymizeData}
                        onChange={(v) =>
                          handleSettingChange(
                            "privacySettings",
                            "anonymizeData",
                            v,
                          )
                        }
                      />
                    </div>
                  </Col>
                  <Col xs={24} md={8}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginTop: 8,
                      }}
                    >
                      <Text>数据加密</Text>
                      <Switch
                        checked={aiSettings.privacySettings.encryptionEnabled}
                        onChange={(v) =>
                          handleSettingChange(
                            "privacySettings",
                            "encryptionEnabled",
                            v,
                          )
                        }
                      />
                    </div>
                  </Col>
                </Row>
              </Card>
            </Col>
          </Row>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: 24,
            }}
          >
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSaveSettings}
              style={canEdit ? { minWidth: 120 } : { display: "none" }}
            >
              保存设置
            </Button>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={4} style={{ marginBottom: 4 }}>
              AI教案课件知识库
            </Title>
            <Text type="secondary">
              智能生成和管理您的教学资源，支持AI辅助创建和RAG知识库解析
            </Text>
          </Col>
          <Col>
            <Button type="primary" icon={<ReloadOutlined />}>
              刷新知识库
            </Button>
          </Col>
        </Row>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} md={6}>
          <Card>
            <Space>
              <Avatar
                style={{ backgroundColor: "#1890ff" }}
                icon={<FileTextOutlined />}
              />
              <div>
                <Statistic
                  title={null}
                  value={coursewareList.length}
                  valueStyle={{ fontSize: 24, fontWeight: 600 }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  总资源数
                </Text>
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Space>
              <Avatar
                style={{ backgroundColor: "#52c41a" }}
                icon={<StarOutlined />}
              />
              <div>
                <Statistic
                  title={null}
                  value={
                    coursewareList.filter((item) => item.aiGenerated).length
                  }
                  valueStyle={{ fontSize: 24, fontWeight: 600 }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  AI生成
                </Text>
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Space>
              <Avatar
                style={{ backgroundColor: "#722ed1" }}
                icon={<BookOutlined />}
              />
              <div>
                <Statistic
                  title={null}
                  value={4}
                  valueStyle={{ fontSize: 24, fontWeight: 600 }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  学科覆盖
                </Text>
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Space>
              <Avatar
                style={{ backgroundColor: "#faad14" }}
                icon={<CloudUploadOutlined />}
              />
              <div>
                <Statistic
                  title={null}
                  value="12.5MB"
                  valueStyle={{ fontSize: 24, fontWeight: 600 }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  存储空间
                </Text>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

      {canEdit && (
      <FloatButton
        icon={<PlusOutlined />}
        type="primary"
        style={{ right: 24, bottom: 24 }}
      />
      )}
    </div>
  );
}

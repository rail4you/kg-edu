import * as React from "react"
import { useNavigate } from "react-router-dom";
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Table,
  Button,
  Typography,
  Tag,
  Modal,
  Input,
  Space,
  Spin,
  message,
  Popconfirm,
  Tooltip,
  QRCode,
  Row,
  Col,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  PlusOutlined,
  EyeOutlined,
  CloseOutlined,
  QrcodeOutlined,
  CopyOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  TeamOutlined,
  ArrowLeftOutlined
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import {
  listSessions,
  createSession,
  closeSession,
  getRecordsBySession,
} from "@/lib/ash_rpc";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";

const { Title, Text } = Typography;
const { TextArea } = Input;

interface CheckInSession {
  id: string;
  title: string;
  description?: string;
  status: "active" | "closed";
  token?: string;
  startedAt: string;
  endedAt?: string;
  createdBy?: {
    id: string;
    name?: string;
  };
  checkInRecords?: any[];
}

interface CheckInRecord {
  id: string;
  userId: string;
  userName?: string;
  checkedInAt: string;
  location?: string;
}

const copyToClipboard = (text: string): boolean => {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).catch(() => {});
    return true;
  }

  const textElement = document.createElement("span");
  textElement.textContent = text;
  textElement.style.position = "fixed";
  textElement.style.left = "-9999px";
  textElement.style.top = "-9999px";
  textElement.style.whiteSpace = "pre";
  textElement.style.userSelect = "text";

  document.body.appendChild(textElement);

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(textElement);
  selection?.removeAllRanges();
  selection?.addRange(range);

  try {
    const successful = document.execCommand("copy");
    selection?.removeAllRanges();
    document.body.removeChild(textElement);
    return successful;
  } catch (err) {
    selection?.removeAllRanges();
    document.body.removeChild(textElement);
    return false;
  }
};

export default function CheckInManagement() {
  const navigate = useNavigate();
  const { user, tenant, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { canEdit } = useEditPermission();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [recordsDialogOpen, setRecordsDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<CheckInSession | null>(
    null,
  );
  const [formData, setFormData] = useState({
    title: "",
    description: "",
  });

  const { data: sessionsResult, isLoading } = useQuery({
    queryKey: ["checkin-sessions", user?.id, tenant],
    queryFn: async () => {
      const result = await listSessions({
        tenant: tenant!,
        fields: [
          "id",
          "title",
          "description",
          "status",
          "token",
          "startedAt",
          "endedAt",
          { createdBy: ["id", "name"] },
          { checkInRecords: ["id"] },
        ],
        filter: { createdBy: { id: { eq: user!.id } } },
        sort: "-startedAt",
        headers: getAuthHeaders(user) as Record<string, string>,
      });

      if (result.success && result.data) {
        const data = result.data as any;
        const sessions = Array.isArray(data)
          ? data
          : data.results || data.data || [];
        return { data: sessions };
      }
      return { data: [] };
    },
    enabled: !!user && !!tenant,
  });

  const { data: recordsResult, isLoading: recordsLoading } = useQuery({
    queryKey: ["checkin-records", selectedSession?.id, tenant],
    queryFn: async () => {
      if (!selectedSession) return { data: [] };

      const result = await getRecordsBySession({
        tenant: tenant!,
        fields: [
          "id",
          "userId",
          "checkedInAt",
          "location",
          { user: ["id", "name", "email"] },
        ],
        input: { sessionId: selectedSession.id },
        sort: "-checkedInAt",
        headers: getAuthHeaders(user) as Record<string, string>,
      });

      if (result.success && result.data) {
        const records = Array.isArray(result.data) ? result.data : [];
        return {
          data: records.map((record: any) => ({
            ...record,
            userName: record.user?.name || record.user?.email || "Unknown",
          })),
        };
      }
      return { data: [] };
    },
    enabled: !!selectedSession && !!user && !!tenant,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return createSession({
        tenant: tenant!,
        fields: ["id", "title", "description", "status", "token", "startedAt"],
        input: {
          title: data.title,
          description: data.description || undefined,
          createdById: user!.id,
        },
        headers: getAuthHeaders(user) as Record<string, string>,
      });
    },
    onSuccess: () => {
      message.success("签到创建成功");
      queryClient.invalidateQueries({ queryKey: ["checkin-sessions"] });
      setDialogOpen(false);
      setFormData({ title: "", description: "" });
    },
    onError: (error: any) => {
      message.error(error?.message || "创建失败");
    },
  });

  const closeMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return closeSession({
        tenant: tenant!,
        fields: ["id", "status", "endedAt"],
        primaryKey: sessionId,
        headers: getAuthHeaders(user) as Record<string, string>,
      });
    },
    onSuccess: () => {
      message.success("签到已关闭");
      queryClient.invalidateQueries({ queryKey: ["checkin-sessions"] });
    },
    onError: (error: any) => {
      message.error(error?.message || "关闭失败");
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
      <div className="check-in-management-wrap" style={{ padding: 24 }}>
<style>{`@media(max-width:768px){.check-in-management-wrap{padding:12px!important}.check-in-management-wrap .ant-table-cell{padding:6px 4px!important}}`}</style>
        <Text type="danger">用户未登录，请登录以访问签到管理。</Text>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="check-in-management-wrap" style={{ padding: 24 }}>
<style>{`@media(max-width:768px){.check-in-management-wrap{padding:12px!important}.check-in-management-wrap .ant-table-cell{padding:6px 4px!important}}`}</style>
        <Text type="danger">未选择组织，请重新登录并选择组织。</Text>
      </div>
    );
  }

  const getStatusLabel = (status: CheckInSession["status"]) => {
    return status === "active" ? "进行中" : "已关闭";
  };

  const getStatusColor = (status: CheckInSession["status"]) => {
    return status === "active" ? "green" : "default";
  };

  const handleViewRecords = (session: CheckInSession) => {
    setSelectedSession(session);
    setRecordsDialogOpen(true);
  };

  const handleViewQRCode = (session: CheckInSession) => {
    setSelectedSession(session);
    setQrDialogOpen(true);
  };

  const getCheckInUrl = (token?: string) => {
    return `${window.location.origin}/student/check-in/${tenant}/${token || ""}`;
  };

  const handleCopy = (text?: string, label?: string) => {
    if (!text) return;
    const success = copyToClipboard(text);
    if (success) {
      message.success(`${label || "内容"}已复制到剪贴板`);
    } else {
      message.error("复制失败，请手动复制");
    }
  };

  const handleFormSubmit = () => {
    if (!formData.title.trim()) {
      message.error("请输入签到名称");
      return;
    }
    createMutation.mutate(formData);
  };

  const columns: TableColumnsType<CheckInSession> = [
    {
      title: "签到名称",
      dataIndex: "title",
      key: "title",
      width: 200,
      render: (text: string) => (
        <Tooltip title={text} mouseEnterDelay={0.3}>
          <Text strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{text}</Text>
        </Tooltip>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 120,
      align: "left",
      render: (status: CheckInSession["status"]) => (
        <Tag color={getStatusColor(status)}>{getStatusLabel(status)}</Tag>
      ),
    },
    {
      title: "签到人数",
      key: "checkInCount",
      width: 120,
      align: "center",
      render: (_: any, record: CheckInSession) => (
        <Text>{record.checkInRecords?.length || 0} 人</Text>
      ),
    },
    {
      title: "创建时间",
      dataIndex: "startedAt",
      key: "startedAt",
      width: 180,
      align: "center",
      render: (date: string) =>
        date ? new Date(date).toLocaleString("zh-CN") : "-",
    },
    {
      title: "操作",
      key: "action",
      width: 200,
      align: "center",
      render: (_: any, record: CheckInSession) => (
        <Space>
          {record.status === "active" && record.token && (
            <Tooltip title="查看二维码">
              <Button
                type="text"
                icon={<QrcodeOutlined style={{ color: "#52c41a" }} />}
                onClick={() => handleViewQRCode(record)}
              />
            </Tooltip>
          )}
          <Tooltip title="查看签到记录">
            <Button
              type="text"
              icon={<EyeOutlined style={{ color: "#1890ff" }} />}
              onClick={() => handleViewRecords(record)}
            />
          </Tooltip>
          {record.status === "active" && (
            <Popconfirm
              title="确定要关闭这个签到吗？"
              onConfirm={() => closeMutation.mutate(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Tooltip title="关闭签到">
                <ReadonlyActionButton
                  type="text"
                  icon={<CloseOutlined style={{ color: "#faad14" }} />}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const recordColumns: TableColumnsType<CheckInRecord> = [
    {
      title: "姓名",
      dataIndex: "userName",
      key: "userName",
    },
    {
      title: "签到时间",
      dataIndex: "checkedInAt",
      key: "checkedInAt",
      render: (date: string) => new Date(date).toLocaleString("zh-CN"),
    },
  ];

  const sessions = sessionsResult?.data || [];
  const activeCount = sessions.filter(
    (s: CheckInSession) => s.status === "active",
  ).length;
  const closedCount = sessions.filter(
    (s: CheckInSession) => s.status === "closed",
  ).length;
  const totalCheckIns = sessions.reduce(
    (sum: number, s: CheckInSession) => sum + (s.checkInRecords?.length || 0),
    0,
  );

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#f5f5f5",
      }}
    >
      <div
        style={{
          padding: "16px 24px",
          background: "white",
          borderBottom: "1px solid #e0e0e0",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: 16,
            gap: 12,
          }}
        >
          <PlayCircleOutlined style={{ fontSize: 24, color: "#1890ff" }} />
                    <Button
            className="teacher-page-back-btn"
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/teacher/dashboard")}
            style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
          />
<Title level={4} style={{ margin: 0 }}>
            签到管理
          </Title>
        </div>

        <Row gutter={[16, 16]}>
          <Col xs={8}>
            <Card size="small" style={{ borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ 
                  width: 40, 
                  height: 40, 
                  borderRadius: 8, 
                  background: 'linear-gradient(135deg, #1890ff 0%, #69c0ff 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <PlayCircleOutlined style={{ fontSize: 20, color: '#fff' }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#8c8c8c' }}>进行中</div>
                  <div style={{ fontSize: 24, fontWeight: 600, color: '#1890ff' }}>{activeCount}</div>
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={8}>
            <Card size="small" style={{ borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ 
                  width: 40, 
                  height: 40, 
                  borderRadius: 8, 
                  background: 'linear-gradient(135deg, #8c8c8c 0%, #bfbfbf 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <CheckCircleOutlined style={{ fontSize: 20, color: '#fff' }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#8c8c8c' }}>已关闭</div>
                  <div style={{ fontSize: 24, fontWeight: 600, color: '#666' }}>{closedCount}</div>
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={8}>
            <Card size="small" style={{ borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ 
                  width: 40, 
                  height: 40, 
                  borderRadius: 8, 
                  background: 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <TeamOutlined style={{ fontSize: 20, color: '#fff' }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#8c8c8c' }}>总签到人次</div>
                  <div style={{ fontSize: 24, fontWeight: 600, color: '#52c41a' }}>{totalCheckIns}</div>
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      </div>

      <div style={{ flexGrow: 1, padding: 24 }}>
        <Card style={{ height: "100%" }}>
          <Table
            className="theme-table"
            columns={columns}
            dataSource={sessions}
            rowKey="id"
            loading={isLoading}
            title={() => (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setDialogOpen(true)}
                    style={canEdit ? undefined : { display: "none" }}
                  >
                    发起签到
                  </Button>
                </Space>
              </div>
            )}
            pagination={{
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
            }}
          />
        </Card>
      </div>

      <Modal
        title="发起签到"
        open={dialogOpen}
        onCancel={() => setDialogOpen(false)}
        onOk={handleFormSubmit}
        okText="发起签到"
        cancelText="取消"
        confirmLoading={createMutation.isPending}
        okButtonProps={{ disabled: !formData.title }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            marginTop: 16,
          }}
        >
          <div>
            <Text>
              签到名称 <Text type="danger">*</Text>
            </Text>
            <Input
              placeholder="例如：第1周课程签到"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              style={{ marginTop: 8 }}
            />
          </div>
          <div>
            <Text>签到说明</Text>
            <TextArea
              rows={3}
              placeholder="可选：添加签到说明或备注"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              style={{ marginTop: 8 }}
            />
          </div>
        </div>
      </Modal>

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{selectedSession?.title} - 签到记录</span>
            {selectedSession?.token && (
              <>
                <Tag icon={<QrcodeOutlined />} color="blue">
                  签到码: {selectedSession.token}
                </Tag>
                <Button
                  type="text"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => handleCopy(selectedSession.token, "签到码")}
                />
              </>
            )}
          </div>
        }
        open={recordsDialogOpen}
        onCancel={() => {
          setRecordsDialogOpen(false);
          setSelectedSession(null);
        }}
        footer={
          <Button onClick={() => setRecordsDialogOpen(false)}>关闭</Button>
        }
        width={700}
      >
        <div style={{ marginTop: 16 }}>
          <Text type="secondary">
            共 {recordsResult?.data?.length || 0} 人签到
          </Text>
          <Table
            className="theme-table"
            columns={recordColumns}
            dataSource={recordsResult?.data || []}
            rowKey="id"
            loading={recordsLoading}
            style={{ marginTop: 16 }}
            pagination={false}
            locale={{ emptyText: "暂无签到记录" }}
          />
        </div>
      </Modal>

      <Modal
        title="签到二维码"
        open={qrDialogOpen}
        onCancel={() => {
          setQrDialogOpen(false);
          setSelectedSession(null);
        }}
        footer={<Button onClick={() => setQrDialogOpen(false)}>关闭</Button>}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
            marginTop: 16,
          }}
        >
          {selectedSession?.token && (
            <>
              <div style={{ textAlign: "center" }}>
                <Title level={5} style={{ marginBottom: 8 }}>
                  {selectedSession.title}
                </Title>
                {selectedSession.description && (
                  <Text type="secondary">{selectedSession.description}</Text>
                )}
              </div>
              <div style={{ padding: 16 }}>
                <QRCode
                  value={getCheckInUrl(selectedSession.token)}
                  size={250}
                />
              </div>
              <div style={{ textAlign: "center", width: "100%" }}>
                <Text type="secondary">签到链接</Text>
                <div
                  style={{
                    padding: 12,
                    background: "#f5f5f5",
                    borderRadius: 4,
                    wordBreak: "break-all",
                    marginTop: 8,
                    marginBottom: 8,
                  }}
                >
                  <Text
                    style={{
                      color: "#1890ff",
                      fontFamily: "monospace",
                      fontSize: 14,
                    }}
                  >
                    {getCheckInUrl(selectedSession.token)}
                  </Text>
                </div>
                <Button
                  icon={<CopyOutlined />}
                  onClick={() =>
                    handleCopy(getCheckInUrl(selectedSession.token), "签到链接")
                  }
                >
                  复制链接
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  Row,
  Col,
  Typography,
  Progress,
  Tag,
  Table,
  Button,
  Space,
  List,
  Descriptions,
  Spin,
} from "antd";
import {
  ReloadOutlined,
  CloudServerOutlined,
  DatabaseOutlined,
  ApiOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useResponsive } from "@/hooks/use-responsive";

const { Title, Text } = Typography;

// ── Types ───────────────────────────────────────────────────────────

interface SystemInfo {
  memory: {
    total_bytes: number;
    total_mb: number;
    processes_bytes: number;
    atom_bytes: number;
    binary_bytes: number;
    ets_bytes: number;
    code_bytes: number;
  };
  cpu: {
    utilization?: number;
    load_1min?: string;
    load_5min?: string;
    load_15min?: string;
    cores?: number;
    source: string;
  };
  disk: {
    size?: string;
    used?: string;
    available?: string;
    capacity?: string;
    mount?: string;
    error?: string;
  };
  system: {
    architecture: string;
    otp_release: string;
    version: string;
    scheduler_count: number;
    port_count: number;
  };
  process_count: number;
  uptime_ms: number;
  node: string;
}

// ── Helpers ─────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes > 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
  if (bytes > 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  return (bytes / 1024).toFixed(1) + " KB";
}

function formatUptime(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}天`);
  if (hours > 0) parts.push(`${hours}小时`);
  parts.push(`${mins}分钟`);
  return parts.join(" ");
}

function getProgressColor(value: number) {
  if (value >= 90) return "#ff4d4f";
  if (value >= 70) return "#faad14";
  return "#52c41a";
}

function getHealthTag(value: number) {
  if (value >= 90) return <Tag color="error">高负载</Tag>;
  if (value >= 70) return <Tag color="warning">注意</Tag>;
  return <Tag color="success">正常</Tag>;
}

const diskCapacity = (cap: string) => {
  const v = parseInt(cap);
  return isNaN(v) ? 0 : v;
};

// ── Component ───────────────────────────────────────────────────────

export default function SystemStatus() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { isMobile } = useResponsive();

  const fetchInfo = useCallback(async () => {
    try {
      const token = sessionStorage.getItem("jwt_access_token");
      const resp = await fetch("/api/admin/system-info", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const result = await resp.json();
      if (result.success) {
        setInfo(result.data);
        setError(null);
      } else {
        setError("数据获取失败");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setLastUpdate(new Date());
    }
  }, []);

  useEffect(() => {
    fetchInfo();
  }, [fetchInfo]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchInfo, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchInfo]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <Spin size="large" tip="加载系统信息..." />
      </div>
    );
  }

  if (error || !info) {
    return (
      <Card>
        <Title level={4}>系统状态监控</Title>
        <Text type="danger">加载失败: {error || "未知错误"}</Text>
        <br />
        <Button onClick={fetchInfo} style={{ marginTop: 16 }}>重试</Button>
      </Card>
    );
  }

  const memUsagePct = info.memory.total_bytes > 0
    ? Math.round(((info.memory.processes_bytes + info.memory.binary_bytes + info.memory.ets_bytes) / info.memory.total_bytes) * 100)
    : 0;
  const diskPct = info.disk.capacity ? diskCapacity(info.disk.capacity) : 0;

  return (
    <div>
      {/* 顶部工具行：更新时间 + 刷新控制 */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 16,
        }}
      >
        {isMobile ? (
          <>
            <div style={{ fontSize: 12, color: "#999" }}>
              更新: {lastUpdate.toLocaleTimeString()}
            </div>
            <Button onClick={() => setAutoRefresh(!autoRefresh)} size="small">
              {autoRefresh ? "停止自动刷新" : "自动刷新"}
            </Button>
            <Button icon={<ReloadOutlined />} onClick={fetchInfo} size="small">
              刷新
            </Button>
          </>
        ) : (
          <Space wrap>
            <Text type="secondary">更新: {lastUpdate.toLocaleTimeString()}</Text>
            <Button onClick={() => setAutoRefresh(!autoRefresh)} size="small">
              {autoRefresh ? "停止自动刷新" : "自动刷新"}
            </Button>
            <Button icon={<ReloadOutlined />} onClick={fetchInfo}>
              刷新
            </Button>
          </Space>
        )}
      </div>

      {/* Metrics cards */}
      <Row gutter={[12, 12]} style={{ marginBottom: isMobile ? 16 : 24 }}>
        <Col xs={12} sm={12} lg={6}>
          <Card size={isMobile ? "small" : "default"} styles={{ body: { padding: isMobile ? 12 : 20 } }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <Title level={5} style={{ margin: 0, fontSize: isMobile ? 13 : 14 }}>
                <CloudServerOutlined style={{ marginRight: 8 }} />
                CPU
              </Title>
              {info.cpu.utilization !== undefined
                ? getHealthTag(info.cpu.utilization)
                : <Tag>无数据</Tag>}
            </div>
            <Title level={isMobile ? 4 : 2} style={{ color: "#1677ff", margin: 0 }}>
              {info.cpu.utilization !== undefined ? `${info.cpu.utilization}%` : "—"}
            </Title>
            <Progress
              percent={info.cpu.utilization ?? 0}
              showInfo={false}
              strokeColor={getProgressColor(info.cpu.utilization ?? 0)}
              style={{ marginTop: 12 }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              {info.cpu.load_1min && info.cpu.load_5min && info.cpu.load_15min
                ? `负载 ${info.cpu.load_1min} / ${info.cpu.load_5min} / ${info.cpu.load_15min}`
                : `${info.system.scheduler_count} 核心 · ${info.cpu.source}`}
            </Text>
          </Card>
        </Col>

        <Col xs={12} sm={12} lg={6}>
          <Card size={isMobile ? "small" : "default"} styles={{ body: { padding: isMobile ? 12 : 20 } }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <Title level={5} style={{ margin: 0, fontSize: isMobile ? 13 : 14 }}>
                <DatabaseOutlined style={{ marginRight: 8 }} />
                内存
              </Title>
              {getHealthTag(memUsagePct)}
            </div>
            <Title level={isMobile ? 4 : 2} style={{ color: "#13c2c2", margin: 0 }}>
              {memUsagePct}%
            </Title>
            <Progress percent={memUsagePct} showInfo={false} strokeColor={getProgressColor(memUsagePct)} style={{ marginTop: 12 }} />
            <Text type="secondary" style={{ fontSize: 11 }}>
              进程 {formatBytes(info.memory.processes_bytes)} · ETS {formatBytes(info.memory.ets_bytes)}
            </Text>
          </Card>
        </Col>

        <Col xs={12} sm={12} lg={6}>
          <Card size={isMobile ? "small" : "default"} styles={{ body: { padding: isMobile ? 12 : 20 } }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <Title level={5} style={{ margin: 0, fontSize: isMobile ? 13 : 14 }}>💾 磁盘</Title>
              {info.disk.error ? <Tag color="error">不可用</Tag> : getHealthTag(diskPct)}
            </div>
            {info.disk.error ? (
              <Text type="danger">无法获取磁盘信息</Text>
            ) : (
              <>
                <Title level={isMobile ? 4 : 2} style={{ color: "#faad14", margin: 0 }}>
                  {info.disk.capacity || "—"}
                </Title>
                <Progress percent={diskPct} showInfo={false} strokeColor={getProgressColor(diskPct)} style={{ marginTop: 12 }} />
                <Text type="secondary" style={{ fontSize: 11 }}>
                  已用 {info.disk.used} · 可用 {info.disk.available}
                </Text>
              </>
            )}
          </Card>
        </Col>

        <Col xs={12} sm={12} lg={6}>
          <Card size={isMobile ? "small" : "default"} styles={{ body: { padding: isMobile ? 12 : 20 } }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <Title level={5} style={{ margin: 0, fontSize: isMobile ? 13 : 14 }}>
                <ApiOutlined style={{ marginRight: 8 }} />
                进程
              </Title>
              <Tag color="success">运行中</Tag>
            </div>
            <Title level={isMobile ? 4 : 2} style={{ color: "#722ed1", margin: 0 }}>
              {info.process_count}
            </Title>
            <Space direction="vertical" size={0} style={{ marginTop: 12 }}>
              <Text type="secondary" style={{ fontSize: 11 }}>端口: {info.system.port_count}</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>运行: {formatUptime(info.uptime_ms)}</Text>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* System info */}
      <Row gutter={[12, 12]} align="stretch">
        <Col xs={24} lg={14} style={{ display: "flex" }}>
          <Card
            title={
              <>
                <SettingOutlined /> 系统信息
              </>
            }
            style={{ width: "100%" }}
          >
            <Descriptions
              column={isMobile ? 1 : 2}
              size="small"
              bordered
            >
              <Descriptions.Item label="架构">{info.system.architecture}</Descriptions.Item>
              <Descriptions.Item label="OTP 版本">{info.system.otp_release}</Descriptions.Item>
              <Descriptions.Item label="节点">{info.node}</Descriptions.Item>
              <Descriptions.Item label="调度器数量">{info.system.scheduler_count}</Descriptions.Item>
              <Descriptions.Item label="文件系统">{
                info.disk.filesystem || "—"
              }</Descriptions.Item>
              <Descriptions.Item label="挂载点">{
                info.disk.mount || "—"
              }</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={10} style={{ display: "flex" }}>
          <Card title="内存分布" style={{ width: "100%" }}>
            <List size="small" dataSource={[
              { label: "进程内存", value: info.memory.processes_bytes, color: "#1677ff" },
              { label: "二进制", value: info.memory.binary_bytes, color: "#13c2c2" },
              { label: "代码", value: info.memory.code_bytes, color: "#52c41a" },
              { label: "ETS 表", value: info.memory.ets_bytes, color: "#faad14" },
              { label: "原子", value: info.memory.atom_bytes, color: "#722ed1" },
              { label: "总计", value: info.memory.total_bytes, color: "#eb2f96" },
            ]} renderItem={(item) => (
              <List.Item>
                <Text>{item.label}</Text>
                <Space>
                  <Progress
                    percent={info.memory.total_bytes > 0
                      ? Math.round((item.value / info.memory.total_bytes) * 100)
                      : 0}
                    size="small"
                    strokeColor={item.color}
                    style={{ width: 80 }}
                    showInfo={false}
                  />
                  <Text strong style={{ color: item.color }}>{formatBytes(item.value)}</Text>
                </Space>
              </List.Item>
            )} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

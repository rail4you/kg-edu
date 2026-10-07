import { useCallback, useEffect, useState } from "react";
import {
  App,
  Button,
  Card,
  Empty,
  Input,
  List,
  Modal,
  Space,
  Tag,
  Typography,
} from "antd";
import { PlusOutlined, LoginOutlined } from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import {
  createPracticeSession,
  fetchMyPracticeSessions,
  type PracticeSession,
} from "@/lib/practice-session";
import PracticeSessionRoom from "./PracticeSessionRoom";

const { Text } = Typography;

/** 教师端：创建/管理「互动故事」共享会话；租户内学生均可直接加入 */
export default function TeacherSessionManager() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const tenant = getCurrentTenant()?.schemaName || "";
  const headers = getAuthHeaders(user) as Record<string, string>;

  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [activeToken, setActiveToken] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id || !tenant) return;
    const res = await fetchMyPracticeSessions("teacher", user.id, tenant, headers);
    if (res.ok) setSessions(res.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, tenant]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (!tenant) {
      message.error("未选择租户");
      return;
    }
    setCreating(true);
    try {
      const res = await createPracticeSession(
        { title: title.trim() || "互动故事课堂", teacherId: user?.id, tenant },
        headers
      );
      if (res.ok && res.data) {
        setTitle("");
        setSessions((prev) => [res.data!, ...prev]);
        setActiveToken(res.data.token);
        message.success("已创建会话，租户内学生可直接进入");
      } else {
        message.error(res.error || "创建失败");
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card>
      <Space style={{ marginBottom: 8 }}>
        <Input
          placeholder="会话标题（可选）"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ width: 220 }}
        />
        <Button type="primary" icon={<PlusOutlined />} loading={creating} onClick={create}>
          创建会话
        </Button>
      </Space>
      <Text type="secondary" style={{ fontSize: 13, display: "block" }}>
        创建后，本租户的学生在「智慧功能 → 互动故事」中即可看到并进入同一房间；这里是与学生的纯聊天互动（无 AI 参与），
        你点击“AI 评分并生成报告”或“手动改分”后，学生端同步可见分数与报告。
      </Text>

      <div style={{ marginTop: 12 }}>
        {sessions.length === 0 ? (
          <Empty description="暂无会话，点击右上角创建" />
        ) : (
          <List
            dataSource={sessions}
            renderItem={(s) => (
              <List.Item
                actions={[
                  <Button
                    key="enter"
                    size="small"
                    type="primary"
                    icon={<LoginOutlined />}
                    onClick={() => setActiveToken(s.token)}
                  >
                    进入房间
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Text strong>{s.title || "互动故事课堂"}</Text>
                      {s.status === "evaluated" && <Tag color="purple">已评分 {s.score} 分</Tag>}
                    </Space>
                  }
                  description={s.report ? s.report.slice(0, 80) : "尚无评估报告"}
                />
              </List.Item>
            )}
          />
        )}
      </div>

      <Modal
        title="互动故事房间"
        open={!!activeToken}
        onCancel={() => {
          setActiveToken(null);
          load();
        }}
        footer={null}
        width={760}
        destroyOnClose
      >
        {activeToken && user?.id && (
          <PracticeSessionRoom
            token={activeToken}
            role="teacher"
            userId={user.id}
            tenant={tenant}
            headers={headers}
            onExit={() => {
              setActiveToken(null);
              load();
            }}
          />
        )}
      </Modal>
    </Card>
  );
}

import { useState } from "react";
import { Button, Empty, Input, Modal, Popconfirm, Spin, message } from "antd";
import { CloseOutlined } from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listResearchRoomMessages,
  createResearchRoomMessage,
  markResearchRoomMessageRead,
  deleteResearchRoomMessage,
} from "@/lib/ash_rpc";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import "./virtual-research-room.css";

/* ────────────────────── types ────────────────────── */

interface ResearchMessage {
  id: string;
  title: string;
  content: string;
  authorLabel?: string | null;
  readStatus: "unread" | "read";
  participated: boolean;
  postedAt: string;
}

type TabId = "all" | "unread" | "mine";

const TABS: { id: TabId; label: string }[] = [
  { id: "all", label: "全部消息" },
  { id: "unread", label: "未读消息" },
  { id: "mine", label: "我参与的" },
];

function formatPostedAt(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const hhmm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return `今天 ${hhmm}`;
  if (d.toDateString() === yesterday.toDateString()) return `昨天 ${hhmm}`;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hhmm}`;
}

/* ────────────────────── component ────────────────────── */

export default function VirtualResearchRoom() {
  const { user, tenant } = useAuth();
  const queryClient = useQueryClient();
  const headers = getAuthHeaders(user) as Record<string, string>;

  const [tab, setTab] = useState<TabId>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [active, setActive] = useState<ResearchMessage | null>(null);
  const [reply, setReply] = useState("");
  const [replying, setReplying] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["researchRoomMessages", tenant],
    queryFn: async () => {
      const res = await listResearchRoomMessages({
        tenant,
        fields: [
          "id",
          "title",
          "content",
          "authorLabel",
          "readStatus",
          "participated",
          "postedAt",
        ],
        page: { limit: 100, offset: 0 },
        headers,
      });      if (res.success) {
        const payload = res.data as unknown;
        if (Array.isArray(payload)) return payload as ResearchMessage[];
        const nested = (payload as { results?: ResearchMessage[] })?.results;
        return Array.isArray(nested) ? nested : [];
      }
      return [];
    },
    enabled: !!tenant && !!user,
  });

  const messages = data ?? [];
  const filtered = messages.filter((m) => {
    if (tab === "unread") return m.readStatus === "unread";
    if (tab === "mine") return m.participated;
    return true;
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["researchRoomMessages", tenant] });

  const handleCreate = async () => {
    if (!draftTitle.trim() || !draftContent.trim()) {
      message.warning("请填写标题和内容");
      return;
    }
    setSubmitting(true);
    const res = await createResearchRoomMessage({
      tenant,
      input: {
        title: draftTitle.trim(),
        content: draftContent.trim(),
        authorLabel: user?.displayName || "教师",
        authorId: user?.id,
        participated: true,
      },
      fields: ["id"],
      headers,
    });
    setSubmitting(false);
    if (res.success) {
      message.success("已发布讨论");
      setCreateOpen(false);
      setDraftTitle("");
      setDraftContent("");
      refresh();
    } else {
      message.error("发布失败，请稍后重试");
    }
  };

  const openMessage = async (m: ResearchMessage) => {
    setActive(m);
    setReply("");
    if (m.readStatus === "unread") {
      await markResearchRoomMessageRead({
        tenant,
        primaryKey: m.id,
        fields: ["id"],
        headers,
      });
      refresh();
    }
  };

  const handleReply = async () => {    if (!active || !reply.trim()) {
      message.warning("请输入回复内容");
      return;
    }
    setReplying(true);
    const res = await createResearchRoomMessage({
      tenant,
      input: {
        title: `回复：${active.title}`,
        content: reply.trim(),
        authorLabel: user?.displayName || "教师",
        authorId: user?.id,
        participated: true,
      },
      fields: ["id"],
      headers,
    });
    setReplying(false);
    if (res.success) {
      message.success("已回复");
      setActive(null);
      setReply("");
      refresh();
    } else {
      message.error("回复失败，请稍后重试");
    }
  };

  const handleDelete = async (id: string) => {
    const res = await deleteResearchRoomMessage({
      tenant,
      primaryKey: id,
      headers,
    });
    if (res.success) {
      message.success("已删除");
      if (active?.id === id) setActive(null);
      refresh();
    } else {
      message.error("删除失败，请稍后重试");
    }
  };

  return (
    <div className="virtual-room">
      <div className="pu-breadcrumb">智慧课程&nbsp;&nbsp;/&nbsp;&nbsp;虚拟教研室</div>
      <div className="page-head">
        <div>
          <h1>虚拟教研室</h1>
          <p>让教学沟通围绕课程与具体问题展开。</p>
        </div>
        <div className="row">
          <Button type="primary" onClick={() => setCreateOpen(true)}>
            发布讨论
          </Button>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? "active" : ""}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Spin>
          <div style={{ minHeight: 200 }} />
        </Spin>
      ) : (
        <div className="grid two">
          <div className="card">
            {filtered.length === 0 ? (
              <Empty description="暂无消息" style={{ padding: "40px 0" }} />
            ) : (
              filtered.map((m) => (
                <div className="item" key={m.id}>
                  <span className="avatar">
                    {(m.authorLabel || "通").charAt(0)}
                  </span>
                  <div className="item__body">
                    <h3>{m.title}</h3>
                    <small>
                      {m.authorLabel || "课程教学团队"} · {formatPostedAt(m.postedAt)}
                    </small>
                    <p>{m.content}</p>
                    <Button onClick={() => openMessage(m)}>查看与回复</Button>
                  </div>
                  <div className="item__side">
                    <Popconfirm
                      title="删除这条消息？"
                      description="删除后不可恢复。"
                      okText="删除"
                      cancelText="取消"
                      okButtonProps={{ danger: true }}
                      onConfirm={() => handleDelete(m.id)}
                    >
                      <button type="button" className="item__delete" aria-label="删除消息" title="删除">
                        <CloseOutlined />
                      </button>
                    </Popconfirm>
                  </div>
                </div>
              ))
            )}
          </div>

          <section className="card">
            <h2>交流提示</h2>
            <p className="muted" style={{ margin: "20px 0" }}>
              描述具体的课程、章节与问题，有助于获得更准确的反馈。
            </p>
            <div className="note">
              此处发布的内容只在原型内展示，不会发送邮件或通知真实用户。
            </div>
          </section>
        </div>
      )}

      {/* 发布讨论 */}
      <Modal
        title="发布讨论"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        confirmLoading={submitting}
        okText="发布"
        cancelText="取消"
        destroyOnClose
      >
        <Input
          placeholder="讨论标题"
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          style={{ marginBottom: 12 }}
        />
        <Input.TextArea
          placeholder="描述具体的课程、章节与问题"
          value={draftContent}
          onChange={(e) => setDraftContent(e.target.value)}
          rows={5}
        />
      </Modal>

      {/* 查看与回复 */}
      <Modal
        title={active?.title}
        open={!!active}
        onCancel={() => setActive(null)}
        onOk={handleReply}
        confirmLoading={replying}
        okText="回复"
        cancelText="关闭"
        destroyOnClose
      >
        {active && (
          <>
            <small style={{ color: "#64748b" }}>
              {active.authorLabel || "课程教学团队"} · {formatPostedAt(active.postedAt)}
            </small>
            <p style={{ margin: "14px 0", lineHeight: 1.8, color: "#202f47" }}>
              {active.content}
            </p>
            <Input.TextArea
              placeholder="写下你的回复…"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={4}
            />
          </>
        )}
      </Modal>
    </div>
  );
}

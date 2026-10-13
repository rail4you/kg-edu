import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppPage, ProtoCard, ProtoEmpty, ProtoTabs } from "@/components/proto";
import {
  Button,
  Col,
  Empty,
  Image,
  Modal,
  Popconfirm,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import {
  CameraOutlined,
  UserOutlined,
  VideoCameraOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import { getAuthHeaders } from "@/lib/auth";
import { listFaceChecks, listUsers, destroyFaceCheck } from "@/lib/ash_rpc";
import { extractArrayData } from "@/utils/api-helpers";
import {
  listProctorExams,
  listProctorStudents,
  listProctorSnapshots,
  captureProctorSnapshot,
  type ProctorStudent,
  type ProctorSnapshot,
} from "@/lib/proctor-api";

const { Text } = Typography;

const FRESH_MS = 15_000;

const SCENE_LABEL: Record<string, string> = {
  entry: "进入课程",
  video_start: "视频开始",
  video_playing: "播放/暂停",
  video_resume: "继续播放",
  video_end: "视频结束",
  timed: "定时抓拍",
  random: "随机抓拍",
};

interface FaceCheck {
  id: string;
  userId: string | null;
  scene: string;
  result: "pass" | "fail";
  snapshotUrl: string | null;
  courseId: string | null;
  videoId: string | null;
  videoTitle: string | null;
  note: string | null;
}

function isFresh(s: ProctorStudent) {
  if (!s.active || !s.last_frame_at) return false;
  return Date.now() - new Date(s.last_frame_at).getTime() < FRESH_MS;
}

function formatTime(v?: string | null) {
  if (!v) return "-";
  try {
    return new Date(v).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return "-";
  }
}

function MonitorPreview({
  student,
  onClick,
  height = 150,
}: {
  student: ProctorStudent;
  onClick?: () => void;
  height?: number;
}) {
  const live = isFresh(student);
  return (
    <div
      onClick={onClick}
      style={{
        position: "relative",
        width: "100%",
        height,
        background: "#0b1220",
        borderRadius: 8,
        overflow: "hidden",
        cursor: onClick ? "pointer" : "default",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {student.last_frame_url ? (
        <img
          src={student.last_frame_url}
          alt={student.student_name}
          style={{ width: "100%", height: "100%", objectFit: "cover", opacity: live ? 1 : 0.45 }}
        />
      ) : (
        <div style={{ color: "rgba(255,255,255,0.5)", textAlign: "center" }}>
          <UserOutlined style={{ fontSize: 34 }} />
          <div style={{ marginTop: 6, fontSize: 12 }}>未开启监控</div>
        </div>
      )}
      {student.last_frame_url && !live && (
        <Tag color="default" style={{ position: "absolute", top: 8, left: 8, margin: 0 }}>
          画面已暂停
        </Tag>
      )}
      {live && (
        <Tag color="red" style={{ position: "absolute", top: 8, left: 8, margin: 0 }}>
          ● 监控中
        </Tag>
      )}
      <Tag
        color={student.snapshot_count > 0 ? "blue" : "default"}
        style={{ position: "absolute", bottom: 8, right: 8, margin: 0 }}
      >
        {student.snapshot_count} 张
      </Tag>
    </div>
  );
}

function ExamPanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<ProctorStudent | null>(null);
  const [autoSeconds, setAutoSeconds] = useState<number>(0);
  const autoTimer = useRef<number | null>(null);

  const examsQuery = useQuery({
    queryKey: ["proctor-exams"],
    queryFn: () => listProctorExams(user),
  });

  useEffect(() => {
    if (!selectedExamId && examsQuery.data && examsQuery.data.length > 0) {
      setSelectedExamId(examsQuery.data[0].id);
    }
  }, [examsQuery.data, selectedExamId]);

  const selectedExam = useMemo(
    () => examsQuery.data?.find((e) => e.id === selectedExamId) ?? null,
    [examsQuery.data, selectedExamId]
  );

  const studentsQuery = useQuery({
    queryKey: ["proctor-students", selectedExamId],
    enabled: !!selectedExamId,
    refetchInterval: selectedExamId ? 3000 : false,
    queryFn: () => listProctorStudents(selectedExamId!, user),
  });

  const snapshotsQuery = useQuery({
    queryKey: ["proctor-snapshots", selectedExamId],
    enabled: !!selectedExamId,
    refetchInterval: selectedExamId ? 8000 : false,
    queryFn: () => listProctorSnapshots(selectedExamId!, user),
  });

  const students = studentsQuery.data ?? [];
  const snapshots = snapshotsQuery.data ?? [];

  const liveStudent = useMemo(
    () => (selectedStudent ? students.find((s) => s.student_id === selectedStudent.student_id) ?? selectedStudent : null),
    [students, selectedStudent]
  );

  const studentSnapshots = useMemo(
    () => (liveStudent ? snapshots.filter((s) => s.student_id === liveStudent.student_id) : []),
    [snapshots, liveStudent]
  );

  const doCapture = async (student: ProctorStudent, source: "manual" | "auto") => {
    if (!selectedExamId) return;
    try {
      await captureProctorSnapshot(
        {
          examId: selectedExamId,
          studentId: student.student_id,
          studentName: student.student_name,
          source,
        },
        user
      );
      queryClient.invalidateQueries({ queryKey: ["proctor-snapshots", selectedExamId] });
      queryClient.invalidateQueries({ queryKey: ["proctor-students", selectedExamId] });
      if (source === "manual") message.success(`已抓拍 ${student.student_name}`);
    } catch (e: any) {
      message.error(e?.message || "抓拍失败");
    }
  };

  useEffect(() => {
    if (autoTimer.current) {
      window.clearInterval(autoTimer.current);
      autoTimer.current = null;
    }
    if (liveStudent && autoSeconds > 0) {
      autoTimer.current = window.setInterval(() => {
        doCapture(liveStudent, "auto");
      }, autoSeconds * 1000);
    }
    return () => {
      if (autoTimer.current) window.clearInterval(autoTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveStudent?.student_id, autoSeconds, selectedExamId]);

  const liveCount = students.filter(isFresh).length;

  return (
    <>
      <ProtoCard>
        <div className="pu-filters">
          <Select
            style={{ width: 320 }}
            value={selectedExamId ?? undefined}
            onChange={setSelectedExamId}
            loading={examsQuery.isLoading}
            placeholder="请选择一场考试"
            options={(examsQuery.data ?? []).map((e) => ({
              value: e.id,
              label: `${e.title}（${e.status === "ongoing" ? "进行中" : "已结束"}）`,
            }))}
          />
        </div>

        {selectedExam && (
          <div
            style={{
              display: "flex",
              gap: 32,
              flexWrap: "wrap",
              marginBottom: 16,
              padding: "12px 16px",
              background: "#f6f8fc",
              borderRadius: 10,
            }}
          >
            <Statistic title="考生人数" value={selectedExam.student_count} suffix="人" valueStyle={{ fontSize: 18 }} />
            <Statistic
              title="监控中"
              value={liveCount}
              suffix={`/ ${students.length}`}
              valueStyle={{ fontSize: 18, color: liveCount > 0 ? "#cf1322" : undefined }}
            />
            <Statistic title="抓拍记录" value={snapshots.length} suffix="条" valueStyle={{ fontSize: 18 }} />
            <Statistic title="考场" value={selectedExam.room} valueStyle={{ fontSize: 18 }} />
          </div>
        )}

        {!selectedExamId ? (
          <ProtoEmpty title="请选择考试" description="选择监考考试以查看学生监控画面。" />
        ) : studentsQuery.isLoading ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Spin />
          </div>
        ) : students.length === 0 ? (
          <ProtoEmpty title="暂无考生" description="该考试暂无分配的学生。" />
        ) : (
          <Row gutter={[16, 16]}>
            {students.map((s) => (
              <Col xs={24} sm={12} md={8} xl={6} key={s.student_id}>
                <div className="pu-card" style={{ padding: 12 }}>
                  <MonitorPreview student={s} onClick={() => setSelectedStudent(s)} height={160} />
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <Text strong ellipsis style={{ display: "block" }}>{s.student_name}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>{s.seat}</Text>
                    </div>
                    <Button
                      size="small"
                      icon={<CameraOutlined />}
                      disabled={!s.last_frame_url}
                      onClick={() => doCapture(s, "manual")}
                    >
                      抓拍
                    </Button>
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        )}
      </ProtoCard>

      <ProtoCard title="抓拍记录">
        {snapshots.length === 0 ? (
          <Empty description="暂无抓拍记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Table
            size="middle"
            rowKey="id"
            dataSource={snapshots}
            pagination={{ pageSize: 8 }}
            scroll={{ x: 720 }}
            columns={[
              {
                title: "画面",
                dataIndex: "image_url",
                width: 120,
                render: (v: string, r: ProctorSnapshot) =>
                  v ? (
                    <Image
                      src={v}
                      width={96}
                      height={64}
                      style={{ objectFit: "cover", borderRadius: 6 }}
                      preview={{ src: v }}
                      alt={r.student_name || "抓拍"}
                    />
                  ) : (
                    <Text type="secondary">-</Text>
                  ),
              },
              {
                title: "学生",
                dataIndex: "student_name",
                width: 140,
                render: (v: string) => <Text strong>{v || "未知学生"}</Text>,
              },
              {
                title: "抓拍时间",
                dataIndex: "captured_at",
                width: 200,
                render: (v: string) => (
                  <Space size={6}>
                    <ClockCircleOutlined style={{ color: "#94a3b8" }} />
                    {formatTime(v)}
                  </Space>
                ),
              },
              {
                title: "方式",
                dataIndex: "source",
                width: 100,
                render: (v: string) =>
                  v === "auto" ? <Tag color="blue">自动</Tag> : <Tag color="green">手动</Tag>,
              },
            ]}
          />
        )}
      </ProtoCard>

      <Modal
        open={!!liveStudent}
        onCancel={() => {
          setSelectedStudent(null);
          setAutoSeconds(0);
        }}
        width={720}
        footer={null}
        title={
          liveStudent ? (
            <Space>
              <VideoCameraOutlined />
              {liveStudent.student_name}
              <Text type="secondary" style={{ fontWeight: 400, fontSize: 13 }}>{liveStudent.seat}</Text>
            </Space>
          ) : (
            "学生监控"
          )
        }
      >
        {liveStudent && (
          <>
            <MonitorPreview student={liveStudent} height={380} />

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
                marginTop: 16,
              }}
            >
              <Space>
                <Button
                  type="primary"
                  icon={<CameraOutlined />}
                  disabled={!liveStudent.last_frame_url}
                  onClick={() => doCapture(liveStudent, "manual")}
                >
                  抓拍当前画面
                </Button>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  最近画面：{formatTime(liveStudent.last_frame_at)}
                </Text>
              </Space>

              <Space>
                <Text type="secondary">自动抓拍</Text>
                <Segmented
                  value={autoSeconds}
                  onChange={(v) => setAutoSeconds(v as number)}
                  options={[
                    { label: "关闭", value: 0 },
                    { label: "5 秒", value: 5 },
                    { label: "10 秒", value: 10 },
                    { label: "30 秒", value: 30 },
                  ]}
                />
              </Space>
            </div>

            <div style={{ marginTop: 20 }}>
              <Text strong>抓拍记录（{studentSnapshots.length}）</Text>
              {studentSnapshots.length === 0 ? (
                <Empty description="暂无抓拍" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ marginTop: 12 }} />
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12, maxHeight: 220, overflowY: "auto" }}>
                  {studentSnapshots.map((sn) => (
                    <Image
                      key={sn.id}
                      src={sn.image_url || ""}
                      width={120}
                      height={90}
                      style={{ objectFit: "cover", borderRadius: 6 }}
                      preview={{ src: sn.image_url || "" }}
                      alt="抓拍"
                      placeholder
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </Modal>
    </>
  );
}

function VideoFacePanel() {
  const { user } = useAuth();
  const tenant = getCurrentTenant()?.schemaName || "";
  const queryClient = useQueryClient();
  const [view, setView] = useState<"table" | "group">("group");

  const faceChecksQuery = useQuery({
    queryKey: ["face-checks", tenant],
    enabled: !!tenant,
    refetchInterval: 15000,
    queryFn: async () => {
      const r = await listFaceChecks({
        tenant,
        fields: ["id", "userId", "scene", "result", "snapshotUrl", "courseId", "videoId", "videoTitle", "note"],
        headers: getAuthHeaders(user),
      });
      return extractArrayData(r) as FaceCheck[];
    },
  });

  const checks = faceChecksQuery.data ?? [];

  const userIds = useMemo(
    () => Array.from(new Set(checks.map((c) => c.userId).filter(Boolean))) as string[],
    [checks]
  );

  const usersQuery = useQuery({
    queryKey: ["face-check-users", tenant, userIds.join(",")],
    enabled: !!tenant && userIds.length > 0,
    queryFn: async () => {
      const r = await listUsers({
        tenant,
        fields: ["id", "name", "email"],
        filter: { id: { in: userIds } },
        headers: getAuthHeaders(user),
      });
      return extractArrayData(r) as { id: string; name?: string; email?: string }[];
    },
  });

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    (usersQuery.data ?? []).forEach((u) => m.set(u.id, u.name || u.email || u.id.slice(0, 8)));
    return m;
  }, [usersQuery.data]);

  const grouped = useMemo(() => {
    const m = new Map<string, FaceCheck[]>();
    checks.forEach((c) => {
      const key = c.userId || "unknown";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(c);
    });
    return Array.from(m.entries()).map(([uid, list]) => ({ uid, list }));
  }, [checks]);

  const failCount = checks.filter((c) => c.result === "fail").length;

  const handleDelete = async (id: string) => {
    try {
      const r = await destroyFaceCheck({ tenant, primaryKey: id, headers: getAuthHeaders(user) });
      if ((r as any).success === false) throw new Error("删除失败");
      message.success("已删除");
      queryClient.invalidateQueries({ queryKey: ["face-checks", tenant] });
    } catch (e: any) {
      message.error(e?.message || "删除失败");
    }
  };

  if (faceChecksQuery.isLoading) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <Spin />
      </div>
    );
  }

  return (
    <>
      <ProtoCard>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: "4px 0 12px", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
            <Statistic title="抓拍总数" value={checks.length} suffix="条" valueStyle={{ fontSize: 18 }} />
            <Statistic title="涉及学生" value={grouped.length} suffix="人" valueStyle={{ fontSize: 18 }} />
            <Statistic
              title="识别失败"
              value={failCount}
              suffix="条"
              valueStyle={{ fontSize: 18, color: failCount > 0 ? "#cf1322" : undefined }}
            />
          </div>
          <Segmented
            value={view}
            onChange={(v) => setView(v as "table" | "group")}
            options={[
              { label: "卡片", value: "group" },
              { label: "表格", value: "table" },
            ]}
          />
        </div>

        {checks.length === 0 ? (
          <ProtoEmpty title="暂无视频抓拍" description="学生在观看视频并开启人脸监控后，抓拍记录会同步到这里。" />
        ) : view === "table" ? (
          <Table
            rowKey="id"
            dataSource={checks}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 900 }}
            columns={[
              {
                title: "画面",
                dataIndex: "snapshotUrl",
                width: 120,
                render: (v: string) =>
                  v ? (
                    <Image src={v} width={96} height={64} style={{ objectFit: "cover", borderRadius: 6 }} preview={{ src: v }} alt="抓拍" />
                  ) : (
                    <Text type="secondary">-</Text>
                  ),
              },
              {
                title: "学生",
                dataIndex: "userId",
                width: 150,
                render: (v: string) => <Text strong>{nameById.get(v) || (v ? `用户 ${v.slice(0, 8)}` : "未知")}</Text>,
              },
              {
                title: "视频",
                dataIndex: "videoTitle",
                width: 160,
                ellipsis: true,
                render: (v: string) => v || "-",
              },
              {
                title: "场景",
                dataIndex: "scene",
                width: 120,
                render: (v: string) => <Tag color="blue">{SCENE_LABEL[v] || v}</Tag>,
              },
              {
                title: "结果",
                dataIndex: "result",
                width: 90,
                render: (v: string) => (
                  <Tag color={v === "pass" ? "green" : "red"}>{v === "pass" ? "通过" : "失败"}</Tag>
                ),
              },
              {
                title: "时间",
                dataIndex: "note",
                width: 130,
                render: (v: string) => v || "-",
              },
              {
                title: "操作",
                key: "action",
                width: 100,
                render: (_: any, r: FaceCheck) => (
                  <Popconfirm title="删除该抓拍记录？" onConfirm={() => handleDelete(r.id)}>
                    <Button size="small" danger icon={<DeleteOutlined />}>
                      删除
                    </Button>
                  </Popconfirm>
                ),
              },
            ]}
          />
        ) : (
          grouped.map(({ uid, list }) => (
            <div key={uid} className="pu-card" style={{ padding: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <Space>
                  <UserOutlined />
                  <Text strong>{nameById.get(uid) || `用户 ${uid.slice(0, 8)}`}</Text>
                  <Tag color="blue">{list.length} 条</Tag>
                  {list.some((c) => c.result === "fail") && <Tag color="red">有失败</Tag>}
                </Space>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {list.map((c) => (
                  <div key={c.id} style={{ width: 150 }}>
                    {c.snapshotUrl ? (
                      <Image
                        src={c.snapshotUrl}
                        width={150}
                        height={100}
                        style={{ objectFit: "cover", borderRadius: 6 }}
                        preview={{ src: c.snapshotUrl }}
                        alt="抓拍"
                      />
                    ) : (
                      <div
                        style={{
                          width: 150,
                          height: 100,
                          background: "#0b1220",
                          borderRadius: 6,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "rgba(255,255,255,0.4)",
                          fontSize: 12,
                        }}
                      >
                        无画面
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                      <Tag color={c.result === "pass" ? "green" : "red"} style={{ margin: 0 }}>
                        {c.result === "pass" ? "通过" : "失败"}
                      </Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}>{SCENE_LABEL[c.scene] || c.scene}</Text>
                    </div>
                    {c.videoTitle && (
                      <Text
                        type="secondary"
                        title={c.videoTitle}
                        style={{ fontSize: 11, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      >
                        {c.videoTitle}
                      </Text>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Text type="secondary" style={{ fontSize: 11 }}>{c.note || ""}</Text>
                      <Popconfirm title="删除该抓拍记录？" onConfirm={() => handleDelete(c.id)}>
                        <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </ProtoCard>
    </>
  );
}

export default function FaceCheck() {
  const { loading: authLoading } = useAuth();
  const [tab, setTab] = useState<"video" | "exam">("video");

  if (authLoading) {
    return (
      <AppPage title="考试监考抓拍" description="加载中">
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
          <Spin size="large" />
        </div>
      </AppPage>
    );
  }

  return (
    <AppPage
      title="人脸识别抓拍"
      description="考试监考（实时摄像头）与视频学习（人脸识别）抓拍记录"
      breadcrumb={<>智慧课程&nbsp;&nbsp;/&nbsp;&nbsp;人脸抓拍</>}
    >
      <ProtoTabs
        items={[
          { id: "video", label: "视频抓拍" },
          { id: "exam", label: "考试抓拍" },
        ]}
        active={tab}
        onChange={(v) => setTab(v)}
      />
      {tab === "exam" ? <ExamPanel /> : <VideoFacePanel />}
    </AppPage>
  );
}

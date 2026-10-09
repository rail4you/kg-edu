import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Collapse, Empty, Grid, Input, List, message, Row, Col, Select, Space, Spin, Tag, Typography } from "antd";
import { BookOutlined, ClockCircleOutlined, DownloadOutlined, FileOutlined, FileTextOutlined, FolderOutlined, PlayCircleOutlined, VideoCameraOutlined, CheckCircleFilled, CloseCircleFilled, EyeOutlined, ApartmentOutlined } from "@ant-design/icons";
import { getMicroMajorCourse, getMmCourseFullHierarchy, listMmVideosByChapter, listMmExercisesByChapter, listMmExercisesByCourse, listMmResourcesByChapter, listMmHomeworksByCourse, submitMmHomework, listMmHomeworkSubmissionsByStudent, logMmVideoView, logMmExerciseSubmit, logMmResourceDownload } from "@/lib/ash_rpc";
import { extractArrayData } from "@/utils/api-helpers";
import { useAuth } from "@/auth/auth-context";
import { themeColors as colors } from "@/styles/theme";
import { ProtoTag } from "@/components/proto";
import FilePreview from "@/components/FilePreview";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface StudentMMCourseProps { tenant: string; mmCourseId: string; mmId: string; headers: Record<string, string>; }
interface MMCourse { id: string; title: string; description?: string | null; imageUrl?: string | null; semester?: string | null; semesterHours?: number | null; credits?: number | null; major?: string | null; }
interface ChapterRow { id: string; title: string; path?: string | null; sortOrder?: number | null; parentChapterId?: string | null; subchapters?: ChapterRow[]; }
interface VideoItem { id: string; title?: string | null; assetId?: string | null; playbackId?: string | null; duration?: number | null; thumbnail?: string | null; }
interface ExerciseItem { id: string; title: string; questionContent: string; questionType: string; microMajorChapterId?: string | null; options?: any; answer?: string | null; answerExplanation?: string | null; }
interface ResourceItem { id: string; filename: string; path: string; size: number; fileType: string; microMajorChapterId?: string | null; }

interface HomeworkItem {
  id: string;
  title: string;
  content?: string | null;
  score?: string | null;
  microMajorChapterId?: string | null;
  microMajorCourseId: string;
}

interface SubmissionItem {
  id: string;
  microMajorHomeworkId: string;
  studentId: string;
  submissionContent: string;
  score?: string | null;
  teacherComment?: string | null;
  status: "submitted" | "graded";
  teacherId?: string | null;
  insertedAt?: string;
}

const QTYPE: Record<string, string> = { multiple_choice: "单选题", multiple_response: "多选题", true_false: "判断题", fill_in_blank: "填空题", essay: "问答题", term_definition: "名词解释", case_study: "案例分析" };

const genNum = (p: string | null): string => { if (!p) return ""; const n: string[] = []; for (let i = p.length; i >= 4; i -= 4) { const s = p.slice(Math.max(0, i - 4), i); const c = p.length === 4 ? s.charAt(2) : s.slice(-1); if (c && c !== "0") n.unshift(c); } return n.join("."); };

const flt = (chs: ChapterRow[], lv = 0): (ChapterRow & { level: number })[] => { const r: (ChapterRow & { level: number })[] = []; for (const c of chs) { r.push({ ...c, level: lv }); if (c.subchapters) r.push(...flt(c.subchapters, lv + 1)); } return r; };

const parseOpts = (o: any) => { if (!o) return { choices: [""], correctAnswer: 0, correctAnswers: [] as number[] }; try { const p = typeof o === "string" ? JSON.parse(o) : o; return { choices: p.choices || [""], correctAnswer: p.correctAnswer ?? 0, correctAnswers: p.correctAnswers || [] }; } catch { return { choices: [""], correctAnswer: 0, correctAnswers: [] }; } };

const fmtSz = (b: number) => { if (!b) return "-"; if (b < 1024) return `${b} B`; if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`; return `${(b / (1024 * 1024)).toFixed(1)} MB`; };

const lStyle: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: "#8C8F93", marginBottom: 4 };
const vStyle: React.CSSProperties = { background: "#F8F9FC", borderRadius: 8, padding: "10px 14px", minHeight: 44 };
const tStyle: React.CSSProperties = { fontSize: 14, color: "#202f47" };

const TABS = [
  { key: "intro", label: "课程介绍", icon: <BookOutlined /> },
  { key: "videos", label: "视频学习", icon: <VideoCameraOutlined /> },
  { key: "content", label: "教学资源", icon: <FileTextOutlined /> },
  { key: "homework", label: "作业", icon: <FileTextOutlined /> },
];

const pillStyle = (act: boolean): React.CSSProperties => ({
  display: "flex", alignItems: "center", gap: 6, padding: "8px 18px",
  cursor: "pointer", borderRadius: 20, border: "none", transition: "all 0.15s",
  background: act ? colors.primary : "transparent",
  color: act ? "#fff" : colors.textSecondary,
  fontWeight: act ? 600 : 400, fontSize: 13,
});

export default function StudentMMCourse({ tenant, mmCourseId, mmId, headers }: StudentMMCourseProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const bp = Grid.useBreakpoint();
  const mobile = !bp.md;
  const [tab, setTab] = useState("intro");
  const [subTab, setSubTab] = useState("files");
  const [cid, setCid] = useState<string | null>(null);
  const [vid, setVid] = useState<VideoItem | null>(null);
  const [ans, setAns] = useState<Record<string, any>>({});
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [pf, setPf] = useState<{ url: string; name: string; type: string } | null>(null);

  const { data: course, isLoading } = useQuery({
    queryKey: ["smmc", mmCourseId], queryFn: async () => {
      const r = await getMicroMajorCourse({ tenant, input: { id: mmCourseId }, fields: ["id", "title", "description", "imageUrl", "semester", "semesterHours", "credits", "major"], headers });
      return r.success && r.data ? r.data as MMCourse : null;
    }, enabled: !!mmCourseId,
  });

  const { data: tree = [] } = useQuery({
    queryKey: ["smmt", mmCourseId], queryFn: async () => {
      const r = await getMmCourseFullHierarchy({ tenant, input: { microMajorCourseId: mmCourseId }, fields: ["id", "title", "sortOrder", "path", "parentChapterId", { subchapters: ["id", "title", "sortOrder", "path", "parentChapterId"] }], headers });
      return r.success && r.data ? extractArrayData(r) as ChapterRow[] : [];
    }, enabled: !!mmCourseId,
  });
  const flat = useMemo(() => flt(tree), [tree]);

  const { data: vids = [] } = useQuery({
    queryKey: ["smmv", mmCourseId, cid], queryFn: async () => {
      if (!cid) return []; const r = await listMmVideosByChapter({ tenant, input: { microMajorChapterId: cid }, fields: ["id", "title", "assetId", "playbackId", "duration", "thumbnail"], headers });
      return r.success && r.data ? extractArrayData(r) as VideoItem[] : [];
    }, enabled: !!cid,
  });

  const { data: exs = [] } = useQuery({
    queryKey: ["smme", mmCourseId], queryFn: async () => {
      if (!mmCourseId) return [];
      const res = await listMmExercisesByCourse({ tenant, input: { microMajorCourseId: mmCourseId }, fields: ["id", "title", "questionContent", "questionType", "options", "answer", "answerExplanation", "microMajorChapterId"], headers });
      return res.success && res.data ? extractArrayData(res) as ExerciseItem[] : [];
    }, enabled: !!mmCourseId,
  });

  const { data: ress = [] } = useQuery({
    queryKey: ["smmr", mmCourseId], queryFn: async () => {
      const r: ResourceItem[] = []; for (const ch of flat) { const res = await listMmResourcesByChapter({ tenant, input: { microMajorChapterId: ch.id }, fields: ["id", "filename", "path", "size", "fileType", "description", "microMajorChapterId"], headers }); if (res.success && res.data) r.push(...(extractArrayData(res) as ResourceItem[])); } return r;
    }, enabled: flat.length > 0,
  });

  const exMap = useMemo(() => { const m: Record<string, ExerciseItem[]> = {}; for (const e of exs) { const k = e.microMajorChapterId || "_"; if (!m[k]) m[k] = []; m[k].push(e); } return m; }, [exs]);
  const resMap = useMemo(() => { const m: Record<string, ResourceItem[]> = {}; for (const r of ress) { const k = r.microMajorChapterId || "_"; if (!m[k]) m[k] = []; m[k].push(r); } return m; }, [ress]);

  // Fetch course homeworks
  const { data: homeworks = [] } = useQuery({
    queryKey: ["smmh", mmCourseId],
    queryFn: async () => {
      if (!mmCourseId) return [];
      const r = await listMmHomeworksByCourse({
        tenant,
        input: { microMajorCourseId: mmCourseId },
        fields: ["id", "title", "content", "score", "microMajorChapterId", "microMajorCourseId"],
        headers,
      });
      return r.success && r.data ? extractArrayData(r) as HomeworkItem[] : [];
    },
    enabled: !!mmCourseId,
  });

  // Fetch student's homework submissions
  const { data: mySubmissions = [] } = useQuery({
    queryKey: ["smmhsub", mmCourseId, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const r = await listMmHomeworkSubmissionsByStudent({
        tenant,
        input: { studentId: user.id },
        fields: ["id", "microMajorHomeworkId", "studentId", "submissionContent", "score", "teacherComment", "status", "insertedAt"],
        headers,
      });
      return r.success && r.data ? extractArrayData(r) as SubmissionItem[] : [];
    },
    enabled: !!user?.id,
  });

  const subMap = useMemo(() => {
    const m: Record<string, SubmissionItem> = {};
    for (const s of mySubmissions) {
      if (s.microMajorHomeworkId && !m[s.microMajorHomeworkId]) {
        m[s.microMajorHomeworkId] = s;
      }
    }
    return m;
  }, [mySubmissions]);

  const [hwAns, setHwAns] = useState<Record<string, string>>({});
  const [submittingHw, setSubmittingHw] = useState<Record<string, boolean>>({});

  const handleSubmitHomework = async (homework: HomeworkItem) => {
    const content = hwAns[homework.id];
    if (!content || !content.trim()) {
      message.warning("请填写作业内容再提交");
      return;
    }
    setSubmittingHw(p => ({ ...p, [homework.id]: true }));
    try {
      await submitMmHomework({
        tenant,
        input: {
          microMajorHomeworkId: homework.id,
          studentId: user!.id,
          submissionContent: content,
        },
        fields: ["id", "status"],
        headers,
      });
      message.success("作业提交成功");
      queryClient.invalidateQueries({ queryKey: ["smmhsub", mmCourseId, user?.id] });
      setHwAns(p => ({ ...p, [homework.id]: "" }));
    } catch {
      message.error("作业提交失败");
    } finally {
      setSubmittingHw(p => ({ ...p, [homework.id]: false }));
    }
  };

  const submitEx = (ex: ExerciseItem) => {
    setDone(p => ({ ...p, [ex.id]: true })); message.success("已提交答案");
    if (user && course) {
      let corr: boolean | undefined;
      const isC = ["multiple_choice", "multiple_response", "true_false"].includes(ex.questionType);
      if (isC) { const o = parseOpts(ex.options); const a = ans[ex.id]; if (a !== undefined && a !== null) { corr = ex.questionType === "multiple_response" ? JSON.stringify((o.correctAnswers || []).sort()) === JSON.stringify((a as number[] || []).sort()) : a === o.correctAnswer; } }
      logMmExerciseSubmit({ tenant, input: { userId: user.id, exerciseId: ex.id, answer: String(ans[ex.id] ?? ""), isCorrect: corr, microMajorCourseId: mmCourseId, microMajorCourseTitle: course.title, microMajorId: mmId, microMajorName: course.major || "" }, fields: ["id"], headers }).catch(() => {});
    }
  };

  const dl = (r: ResourceItem) => { const a = document.createElement("a"); a.href = r.path; a.download = r.filename; a.click(); if (user && course) logMmResourceDownload({ tenant, input: { userId: user.id, resourceId: r.id, microMajorCourseId: mmCourseId, microMajorCourseTitle: course.title, microMajorId: mmId, microMajorName: course.major || "" }, fields: ["id"], headers }).catch(() => {}); };

  const renderEx = (ex: ExerciseItem) => {
    const a = ans[ex.id]; const d = done[ex.id]; const o = parseOpts(ex.options);
    return (<div key={ex.id} style={{ border: "1px solid var(--pu-line)", borderRadius: 12, padding: 16, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}><ProtoTag tone="blue">{QTYPE[ex.questionType] || ex.questionType}</ProtoTag><span style={{ fontWeight: 600, color: "var(--pu-ink)" }}>{ex.title}</span></div>
      <p style={{ whiteSpace: "pre-wrap", margin: "0 0 12px", color: "var(--pu-ink)", fontSize: 14, lineHeight: 1.8 }}>{ex.questionContent}</p>
      {ex.questionType === "multiple_choice" && (<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{o.choices.filter(Boolean).map((c: string, i: number) => { const cor = i === o.correctAnswer, sel = a === i; let bd = "var(--pu-line)", bg = "#fff"; if (d && cor) { bd = "#52c41a"; bg = "#f6ffed"; } else if (d && sel && !cor) { bd = "#ff4d4f"; bg = "#fff2f0"; } else if (sel) { bd = "#2859df"; bg = "#edf2ff"; } return (<div key={i} style={{ padding: "6px 12px", border: `1px solid ${bd}`, borderRadius: 6, background: bg, cursor: d ? "default" : "pointer", display: "flex", alignItems: "center", gap: 8 }} onClick={() => { if (!d) { setAns(p => ({ ...p, [ex.id]: i })); } }}><div style={{ width: 16, height: 16, borderRadius: "50%", border: sel ? "5px solid #2859df" : "1px solid var(--pu-line)", flexShrink: 0, background: sel ? "#fff" : "#fff", transition: "all 0.15s" }} /><span>{String.fromCharCode(65 + i)}. {c}</span>{d && cor && <CheckCircleFilled style={{ color: "#52c41a", marginLeft: "auto" }} />}{d && sel && !cor && <CloseCircleFilled style={{ color: "#ff4d4f", marginLeft: "auto" }} />}</div>); })}</div>)}
      {ex.questionType === "multiple_response" && (<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{o.choices.filter(Boolean).map((c: string, i: number) => { const selArr: number[] = Array.isArray(a) ? a : []; const sel = selArr.includes(i); const cor = (o.correctAnswers || []).includes(i); let bd = "var(--pu-line)", bg = "#fff"; if (d && cor) { bd = "#52c41a"; bg = "#f6ffed"; } else if (d && sel && !cor) { bd = "#ff4d4f"; bg = "#fff2f0"; } else if (sel) { bd = "#2859df"; bg = "#edf2ff"; } return (<div key={i} style={{ padding: "6px 12px", border: `1px solid ${bd}`, borderRadius: 6, background: bg, cursor: d ? "default" : "pointer", display: "flex", alignItems: "center", gap: 8 }} onClick={() => { if (!d) { const next = [...selArr]; const idx = next.indexOf(i); if (idx >= 0) { next.splice(idx, 1); } else { next.push(i); } setAns(p => ({ ...p, [ex.id]: next })); } }}><div style={{ width: 16, height: 16, borderRadius: 4, border: sel ? "5px solid #2859df" : "1px solid var(--pu-line)", flexShrink: 0, background: sel ? "#edf2ff" : "#fff", transition: "all 0.15s" }} /><span>{String.fromCharCode(65 + i)}. {c}</span>{d && cor && <CheckCircleFilled style={{ color: "#52c41a", marginLeft: "auto" }} />}{d && sel && !cor && <CloseCircleFilled style={{ color: "#ff4d4f", marginLeft: "auto" }} />}</div>); })}</div>)}
      {ex.questionType === "true_false" && (<div style={{ display: "flex", gap: 12 }}>{[0, 1].map(i => { const lb = i === 0 ? "正确" : "错误", cor = i === o.correctAnswer, sel = a === i; let bd = "var(--pu-line)", bg = "#fff"; if (d && cor) { bd = "#52c41a"; bg = "#f6ffed"; } else if (d && sel && !cor) { bd = "#ff4d4f"; bg = "#fff2f0"; } else if (sel) { bd = "#2859df"; bg = "#edf2ff"; } return <div key={i} style={{ padding: "6px 24px", border: `1px solid ${bd}`, borderRadius: 6, background: bg, cursor: d ? "default" : "pointer", display: "flex", alignItems: "center", gap: 8 }} onClick={() => { if (!d) setAns(p => ({ ...p, [ex.id]: i })); }}><div style={{ width: 16, height: 16, borderRadius: "50%", border: sel ? "5px solid #2859df" : "1px solid var(--pu-line)", flexShrink: 0, background: "#fff", transition: "all 0.15s" }} />{lb}</div>; })}</div>)}
      {["fill_in_blank", "essay", "term_definition", "case_study"].includes(ex.questionType) && (<div><TextArea rows={ex.questionType === "case_study" ? 4 : 2} value={a || ""} onChange={e => setAns(p => ({ ...p, [ex.id]: e.target.value }))} placeholder="请输入答案..." disabled={d} style={{ marginBottom: 8 }} />{d && ex.answer && (<Card size="small" style={{ background: "#f6ffed", marginTop: 8 }}><Space><CheckCircleFilled style={{ color: "#52c41a" }} /><Text strong>参考答案：</Text></Space><Paragraph style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{ex.answer}</Paragraph>{ex.answerExplanation && <><Text strong>解析：</Text><Paragraph style={{ whiteSpace: "pre-wrap" }}>{ex.answerExplanation}</Paragraph></>}</Card>)}</div>)}
      {d && ex.answerExplanation && !["multiple_choice", "true_false", "fill_in_blank", "essay", "term_definition", "case_study"].includes(ex.questionType) && (<Card size="small" style={{ marginTop: 8, background: "#fffbe6" }}><Text strong>解析：</Text><Paragraph style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{ex.answerExplanation}</Paragraph></Card>)}
      {!d && <Button type="primary" onClick={() => submitEx(ex)} disabled={ex.questionType === "multiple_response" ? (!Array.isArray(a) || a.length === 0) : (a === undefined || a === null || a === "")} style={{ marginTop: 4 }}>提交答案</Button>}
    </div>);
  };

  if (isLoading) return <div style={{ display: "flex", justifyContent: "center", padding: 80 }}><Spin size="large" /></div>;
  if (!course) return <Empty description="课程未找到" style={{ padding: 80 }} />;

  return (
    <div>
      {/* 课程头部 */}
      <div className="pu-card" style={{ marginBottom: 12, display: "flex", gap: mobile ? 12 : 20, alignItems: "center" }}>
        <div style={{
          width: mobile ? 56 : 80,
          height: mobile ? 56 : 80,
          borderRadius: 12,
          flexShrink: 0,
          background: course.imageUrl ? `url(${course.imageUrl}) center/cover no-repeat` : "linear-gradient(135deg, #2859df, #1846bc)",
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: mobile ? 18 : 22, fontWeight: 650, color: "var(--pu-ink)" }}>{course.title}</h2>
          <p style={{
            margin: "6px 0 0", color: "var(--pu-muted)", fontSize: mobile ? 13 : 14, lineHeight: 1.7,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>{course.description}</p>
          <div className="pu-tags" style={{ marginTop: 10 }}>
            {course.major && <ProtoTag tone="blue">{course.major}</ProtoTag>}
            {course.semester && <ProtoTag tone="gray">{course.semester}</ProtoTag>}
            {course.credits != null && <ProtoTag tone="gray">{course.credits} 学分</ProtoTag>}
            {course.semesterHours != null && <ProtoTag tone="gray">{course.semesterHours} 学时</ProtoTag>}
          </div>
        </div>
      </div>

      {/* 标签页 */}
      <div className="pu-tabs">
        {TABS.map(t => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className={`pu-tabs__item${tab === t.key ? " is-active" : ""}`}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}
          >
            <span style={{ fontSize: 15, lineHeight: 1 }}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* 内容 */}
      <div className="pu-card" style={{ padding: mobile ? 16 : 24, minHeight: 300 }}>

        {tab === "intro" && (
          <div>
            <div className="pu-section-title">基本信息</div>
            <div className="pu-info">
              {[
                { label: "课程标题", value: course.title },
                { label: "专业", value: course.major || "未指定" },
                { label: "学期", value: course.semester || "未指定" },
                { label: "学分", value: course.credits ?? "-" },
                { label: "学时", value: course.semesterHours ?? "-" },
              ].map((row) => (
                <div className="pu-info__row" key={row.label}>
                  <span className="pu-info__label">{row.label}</span>
                  <span className="pu-info__value">{row.value}</span>
                </div>
              ))}
            </div>
            <div className="pu-section-title" style={{ marginTop: 24 }}>课程章节</div>
            {flat.map(ch => (
              <div key={ch.id} style={{ padding: `9px 12px 9px ${12 + ch.level * 18}px`, display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--pu-line-soft)" }}>
                <FolderOutlined style={{ color: "var(--pu-blue)", fontSize: 14, flexShrink: 0 }} />
                <span style={{ fontSize: 14, color: "var(--pu-ink)" }}>{genNum(ch.path) ? `${genNum(ch.path)} ` : ""}{ch.title}</span>
              </div>
            ))}
          </div>)}

        {tab === "videos" && (mobile ? (
          /* 移动端：章节下拉 + 视频列表 */
          <div>
            <Select
              style={{ width: "100%", marginBottom: 12 }}
              placeholder="选择章节"
              value={cid}
              onChange={(val) => { setCid(val); setVid(null); }}
              options={flat.map(ch => ({ label: `${genNum(ch.path) ? genNum(ch.path) + " " : ""}${ch.title}`, value: ch.id }))}
            />
            {!cid ? (
              <Empty description="请选择章节" />
            ) : (
              <>
                {vid && (
                  <div style={{ marginBottom: 12 }}>
                    <video controls style={{ width: "100%", borderRadius: 10 }}
                      src={vid.playbackId || vid.assetId || undefined}
                      poster={vid.thumbnail || undefined}
                      onPlay={() => { if (user && course) logMmVideoView({ tenant, input: { userId: user.id, videoId: vid.id, microMajorCourseId: mmCourseId, microMajorCourseTitle: course.title, microMajorId: mmId, microMajorName: course.major || "" }, fields: ["id"], headers }).catch(() => {}); }}
                    />
                    <div style={{ marginTop: 6 }}><Text strong style={{ fontSize: 14 }}>{vid.title || "未命名视频"}</Text></div>
                  </div>
                )}
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#202f47" }}>视频列表 ({vids.length})</div>
                {vids.map(v => (
                  <div key={v.id} onClick={() => setVid(v)}
                    style={{
                      padding: "8px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                      borderRadius: 8, marginBottom: 6,
                      background: vid?.id === v.id ? "#eaf0ff" : "#fafafa",
                      border: vid?.id === v.id ? `1px solid ${colors.primary}44` : "1px solid transparent",
                    }}>
                    {v.thumbnail ? (
                      <img src={v.thumbnail} alt="" style={{ width: 72, height: 44, borderRadius: 6, objectFit: "cover" }} />
                    ) : (
                      <VideoCameraOutlined style={{ fontSize: 24, color: colors.primary }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 13 }} ellipsis>{v.title || "未命名视频"}</Text>
                      {v.duration && (
                        <div><Text type="secondary" style={{ fontSize: 11 }}>{Math.floor(v.duration / 60)}:{Math.floor(v.duration % 60).toString().padStart(2, "0")}</Text></div>
                      )}
                    </div>
                    <PlayCircleOutlined style={{ color: colors.primary, fontSize: 20 }} />
                  </div>
                ))}
              </>
            )}
          </div>
        ) : (
          /* 桌面端：两栏布局 */
          <Row gutter={16}>
            <Col xs={24} md={7}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: "#202f47" }}>章节</div>
              <div style={{ maxHeight: "calc(100vh - 400px)", overflow: "auto", border: "1px solid #f0f0f0", borderRadius: 8, padding: "4px 0" }}>
                {flat.map(ch => (
                  <div key={ch.id} onClick={() => { setCid(ch.id); setVid(null); }}
                    style={{
                      padding: `8px 12px 8px ${12 + ch.level * 16}px`, cursor: "pointer", fontSize: 13,
                      marginBottom: 2, background: cid === ch.id ? "#eaf0ff" : "transparent",
                      color: cid === ch.id ? colors.primary : "#444",
                    }}>
                    {genNum(ch.path) ? `${genNum(ch.path)} ` : ""}{ch.title}
                  </div>
                ))}
              </div>
            </Col>
            <Col xs={24} md={17}>
              {!cid ? <Empty description="请从左侧选择章节" /> : (
                <div>
                  {vid && (
                    <div style={{ marginBottom: 16 }}>
                      <video controls style={{ width: "100%", maxHeight: 420, borderRadius: 10 }}
                        src={vid.playbackId || vid.assetId || undefined}
                        poster={vid.thumbnail || undefined}
                        onPlay={() => { if (user && course) logMmVideoView({ tenant, input: { userId: user.id, videoId: vid.id, microMajorCourseId: mmCourseId, microMajorCourseTitle: course.title, microMajorId: mmId, microMajorName: course.major || "" }, fields: ["id"], headers }).catch(() => {}); }}
                      />
                      <div style={{ marginTop: 8 }}><Text strong style={{ fontSize: 15 }}>{vid.title || "未命名视频"}</Text></div>
                    </div>
                  )}
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: "#202f47" }}>视频列表 ({vids.length})</div>
                  {vids.map(v => (
                    <div key={v.id} onClick={() => setVid(v)}
                      style={{
                        padding: "10px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
                        borderRadius: 8, marginBottom: 6,
                        background: vid?.id === v.id ? "#eaf0ff" : "#fafafa",
                        border: vid?.id === v.id ? `1px solid ${colors.primary}44` : "1px solid transparent",
                      }}>
                      {v.thumbnail ? <img src={v.thumbnail} alt="" style={{ width: 96, height: 54, borderRadius: 6, objectFit: "cover" }} /> : <VideoCameraOutlined style={{ fontSize: 28, color: colors.primary }} />}
                      <div style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14 }}>{v.title || "未命名视频"}</Text>
                        {v.duration && <div><Text type="secondary" style={{ fontSize: 12 }}>{Math.floor(v.duration / 60)}:{Math.floor(v.duration % 60).toString().padStart(2, "0")}</Text></div>}
                      </div>
                      <PlayCircleOutlined style={{ color: colors.primary, fontSize: 22 }} />
                    </div>
                  ))}
                </div>
              )}
            </Col>
          </Row>
        ))}

        {tab === "content" && (
          <div>
            {/* 资源统计 */}
            <div className="pu-grid pu-grid--three" style={{ marginBottom: mobile ? 14 : 20 }}>
              <div className="pu-stat">
                <span className="pu-stat__icon"><FileTextOutlined /></span>
                <div className="pu-stat__label">教学资源</div>
                <div className="pu-stat__num">{ress.length + exs.length}</div>
                <div className="pu-stat__desc">共 {ress.length} 文件 · {exs.length} 习题</div>
              </div>
              <div className="pu-stat">
                <span className="pu-stat__icon"><FileOutlined /></span>
                <div className="pu-stat__label">资源文件</div>
                <div className="pu-stat__num">{ress.length}</div>
                <div className="pu-stat__desc">可预览与下载</div>
              </div>
              <div className="pu-stat">
                <span className="pu-stat__icon"><FileTextOutlined /></span>
                <div className="pu-stat__label">课程习题</div>
                <div className="pu-stat__num">{exs.length}</div>
                <div className="pu-stat__desc">练习与巩固</div>
              </div>
            </div>

            {/* Sub tabs: 资源文件 / 习题 */}
            <div className="pu-tabs" style={{ marginBottom: mobile ? 12 : 16 }}>
              {[{ key: "files", label: `资源文件 (${ress.length})` }, { key: "exercises", label: `习题 (${exs.length})` }].map(st => (
                <button key={st.key} type="button" onClick={() => setSubTab(st.key)}
                  className={`pu-tabs__item${subTab === st.key ? " is-active" : ""}`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {/* Files table */}
            {subTab === "files" && (
              ress.length === 0 ? <Empty description="暂无资源文件" /> :
              <Collapse defaultActiveKey={flat.filter(ch => (resMap[ch.id]?.length || 0) > 0).map(ch => ch.id)}
                items={flat.filter(ch => (resMap[ch.id]?.length || 0) > 0).map(ch => ({
                  key: ch.id,
                  label: (<Space><FolderOutlined style={{ color: "var(--pu-blue)" }} /><Text strong>{genNum(ch.path) ? `${genNum(ch.path)} ` : ""}{ch.title}</Text><ProtoTag tone="blue">{resMap[ch.id]?.length || 0} 个</ProtoTag></Space>),
                  children: (
                    <div>
                      {resMap[ch.id]?.map((r: ResourceItem) => (
                        <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 4px", borderBottom: "1px solid var(--pu-line-soft)" }}>
                          <span style={{ width: 34, height: 34, borderRadius: 9, background: "var(--pu-blue-soft, #edf2ff)", color: "var(--pu-blue)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                            <FileOutlined />
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--pu-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.filename}</div>
                            <div style={{ fontSize: 12, color: "var(--pu-muted)", marginTop: 2 }}>{r.fileType?.toUpperCase()} · {fmtSz(r.size)}</div>
                          </div>
                          <Button size="small" icon={<EyeOutlined />} onClick={() => setPf({ url: r.path, name: r.filename, type: r.fileType })}>预览</Button>
                          <Button size="small" icon={<DownloadOutlined />} onClick={() => dl(r)}>下载</Button>
                        </div>
                      ))}
                    </div>
                  ),
                }))}
              />
            )}

            {/* Exercises table */}
            {subTab === "exercises" && (
              exs.length === 0 ? <Empty description="暂无习题" /> :
              <Collapse defaultActiveKey={flat.filter(ch => (exMap[ch.id]?.length || 0) > 0).map(ch => ch.id)}
                items={(() => {
                  const panels = flat.filter(ch => (exMap[ch.id]?.length || 0) > 0).map(ch => ({
                    key: ch.id,
                    label: (<Space><FolderOutlined style={{ color: "var(--pu-blue)" }} /><Text strong>{genNum(ch.path) ? `${genNum(ch.path)} ` : ""}{ch.title}</Text><ProtoTag tone="blue">{exMap[ch.id]?.length || 0} 题</ProtoTag></Space>),
                    children: <div>{exMap[ch.id]?.map(ex => renderEx(ex))}</div>,
                  }));
                  const uncategorized = exs.filter(e => !e.microMajorChapterId);
                  if (uncategorized.length > 0) {
                    panels.push({
                      key: "_uncategorized",
                      label: (<Space><FolderOutlined style={{ color: "#d97706" }} /><Text strong>未分类</Text><ProtoTag tone="amber">{uncategorized.length} 题</ProtoTag></Space>),
                      children: <div>{uncategorized.map(ex => renderEx(ex))}</div>,
                    });
                  }
                  return panels;
                })()}
              />
            )}
          </div> )}

        {tab === "homework" && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#202f47", marginBottom: 16 }}>课程作业</div>
            {homeworks.length === 0 ? (
              <Empty description="暂无作业" />
            ) : (
              <Collapse
                defaultActiveKey={[]}
                items={homeworks.map(hw => {
                  const sub = subMap[hw.id];
                  return {
                    key: hw.id,
                    label: (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", paddingRight: 16 }}>
                        <Space>
                          <FileTextOutlined style={{ color: colors.primary }} />
                          <Text strong>{hw.title}</Text>
                          <Tag color="green">{hw.score ? `${hw.score}分` : "未设置"}</Tag>
                          {sub && (
                            <Tag color={sub.status === "graded" ? "success" : "processing"}>
                              {sub.status === "graded" ? `已评分 ${sub.score || ""}分` : "已提交"}
                            </Tag>
                          )}
                        </Space>
                      </div>
                    ),
                    children: (
                      <div>
                        {hw.content && (
                          <div style={{ marginBottom: 16 }}>
                            <Text type="secondary" style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>作业内容</Text>
                            <div style={{ background: "#f9f9f9", borderRadius: 8, padding: 12, whiteSpace: "pre-wrap" }}>
                              {hw.content}
                            </div>
                          </div>
                        )}
                        {sub?.status === "graded" && (
                          <div style={{ marginBottom: 16, background: "#f6ffed", borderRadius: 8, padding: 12, border: "1px solid #b7eb8f" }}>
                            <Space><CheckCircleFilled style={{ color: "#52c41a" }} /><Text strong>评分结果</Text></Space>
                            <div style={{ marginTop: 8 }}><Text strong>得分：</Text><Text style={{ color: "#52c41a", fontSize: 18, fontWeight: 700 }}>{sub.score}</Text><Text type="secondary"> / {hw.score || "-"}</Text></div>
                            {sub.teacherComment && <div style={{ marginTop: 8 }}><Text strong>教师评语：</Text><Text>{sub.teacherComment}</Text></div>}
                          </div>
                        )}
                        {sub && sub.status === "submitted" && (
                          <div style={{ marginBottom: 16, background: "#fffbe6", borderRadius: 8, padding: 12, border: "1px solid #ffe58f" }}>
                            <Space><FileTextOutlined style={{ color: "#faad14" }} /><Text strong>已提交，等待评分</Text></Space>
                            <div style={{ marginTop: 8, background: "#fff", borderRadius: 6, padding: 10, whiteSpace: "pre-wrap" }}>
                              <Text type="secondary">你提交的内容：</Text>
                              <Paragraph style={{ marginTop: 4 }}>{sub.submissionContent}</Paragraph>
                            </div>
                          </div>
                        )}
                        {!sub && (
                          <div>
                            <TextArea
                              rows={4}
                              value={hwAns[hw.id] || ""}
                              onChange={e => setHwAns(p => ({ ...p, [hw.id]: e.target.value }))}
                              placeholder="在此输入作业内容..."
                              style={{ marginBottom: 12 }}
                            />
                            <Button
                              type="primary"
                              icon={<FileTextOutlined />}
                              loading={submittingHw[hw.id]}
                              onClick={() => handleSubmitHomework(hw)}
                              disabled={!hwAns[hw.id]?.trim()}
                            >
                              提交作业
                            </Button>
                          </div>
                        )}
                      </div>
                    ),
                  };
                })}
              />
            )}
          </div>
        )}

      </div>
      <FilePreview open={!!pf} onClose={() => setPf(null)} file={pf || { url: "", name: "", type: "" }} />
    </div>
  );
}

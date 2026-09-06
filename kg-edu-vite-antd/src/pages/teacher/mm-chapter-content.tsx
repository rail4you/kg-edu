import React, { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Checkbox,
  Empty,
  Grid,
  message,
  Modal,
  Space,
  Spin,
  Table,
  Tag,
  Tabs,
  Typography,
  Tooltip,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  FolderOutlined,
  LinkOutlined,
  DisconnectOutlined,
  VideoCameraOutlined,
  FileTextOutlined,
  EditOutlined,
  ArrowLeftOutlined
} from "@ant-design/icons";
import {
  getMmCourseFullHierarchy,
  listMmVideosByChapter,
  listMmExercisesByChapter,
  listMmHomeworksByChapter,
  listMmVideosByCourse,
  listMmExercisesByCourse,
  listMmHomeworksByCourse,
  updateMmVideo,
  updateMmExercise,
  updateMmHomework,
} from "@/lib/ash_rpc";
import { extractArrayData } from "@/utils/api-helpers";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";

interface MMChapterContentManagerProps {
  tenant: string;
  courseId: string;
  headers: Record<string, string>;
}

interface ChapterRow {
  id: string;
  title: string;
  description?: string | null;
  path?: string | null;
  sortOrder?: number | null;
  parentChapterId?: string | null;
  subchapters?: ChapterRow[];
}

interface VideoItem {
  id: string;
  title?: string | null;
  microMajorChapterId?: string | null;
  microMajorCourseId: string;
}

interface ExerciseItem {
  id: string;
  title: string;
  microMajorChapterId?: string | null;
  microMajorCourseId: string;
}

interface HomeworkItem {
  id: string;
  title: string;
  content?: string | null;
  score?: string | null;
  microMajorChapterId?: string | null;
  microMajorCourseId: string;
}

const { Text, Title } = Typography;

// ----- helpers -----

const generateChapterNumber = (path: string | null): string => {
  if (!path) return "";
  const numbers: string[] = [];
  for (let i = path.length; i >= 4; i -= 4) {
    const segment = path.slice(Math.max(0, i - 4), i);
    const num = path.length === 4 ? segment.charAt(2) : segment.slice(-1);
    if (num && num !== "0") numbers.unshift(num);
  }
  return numbers.join(".");
};

function flattenChapterTree(chapters: ChapterRow[], level = 0): (ChapterRow & { level: number })[] {
  const result: (ChapterRow & { level: number })[] = [];
  for (const ch of chapters) {
    result.push({ ...ch, level });
    if (ch.subchapters && ch.subchapters.length > 0) {
      result.push(...flattenChapterTree(ch.subchapters, level + 1));
    }
  }
  return result;
}

// ----- component -----

export default function MMChapterContentManager({ tenant, courseId, headers }: MMChapterContentManagerProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const bp = Grid.useBreakpoint();
  const isMobile = !bp.md;
  const { canEdit } = useEditPermission();
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);

  // Link/unlink modals
  const [linkVideoOpen, setLinkVideoOpen] = useState(false);
  const [linkExerciseOpen, setLinkExerciseOpen] = useState(false);
  const [linkHomeworkOpen, setLinkHomeworkOpen] = useState(false);
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<string[]>([]);
  const [selectedHomeworkIds, setSelectedHomeworkIds] = useState<string[]>([]);

  // Fetch chapter hierarchy
  const { data: chaptersData = [], isLoading: chaptersLoading } = useQuery({
    queryKey: ["mm-content-chapters", courseId],
    queryFn: async () => {
      const result = await getMmCourseFullHierarchy({
        tenant,
        input: { microMajorCourseId: courseId },
        fields: [
          "id", "title", "description", "sortOrder", "path", "parentChapterId",
          { subchapters: ["id", "title", "sortOrder", "path", "parentChapterId"] },
        ],
        headers,
      });
      if (result.success && result.data) {
        return extractArrayData(result) as ChapterRow[];
      }
      return [];
    },
    enabled: !!tenant && !!courseId,
  });

  const flatChapters = useMemo(() => flattenChapterTree(chaptersData), [chaptersData]);
  const selectedChapter = flatChapters.find((c) => c.id === selectedChapterId);

  // Fetch chapter's videos
  const { data: chapterVideos = [], isLoading: videosLoading } = useQuery({
    queryKey: ["mm-content-videos", courseId, selectedChapterId],
    queryFn: async () => {
      if (!selectedChapterId) return [];
      const result = await listMmVideosByChapter({
        tenant,
        input: { microMajorChapterId: selectedChapterId },
        fields: ["id", "title", "microMajorChapterId"],
        headers,
      });
      if (result.success && result.data) {
        return extractArrayData(result) as VideoItem[];
      }
      return [];
    },
    enabled: !!selectedChapterId,
  });

  // Fetch chapter's exercises
  const { data: chapterExercises = [], isLoading: exercisesLoading } = useQuery({
    queryKey: ["mm-content-exercises", courseId, selectedChapterId],
    queryFn: async () => {
      if (!selectedChapterId) return [];
      const result = await listMmExercisesByChapter({
        tenant,
        input: { microMajorChapterId: selectedChapterId },
        fields: ["id", "title", "microMajorChapterId"],
        headers,
      });
      if (result.success && result.data) {
        return extractArrayData(result) as ExerciseItem[];
      }
      return [];
    },
    enabled: !!selectedChapterId,
  });

  // Fetch chapter's homeworks
  const { data: chapterHomeworks = [], isLoading: homeworksLoading } = useQuery({
    queryKey: ["mm-content-homeworks", courseId, selectedChapterId],
    queryFn: async () => {
      if (!selectedChapterId) return [];
      const result = await listMmHomeworksByChapter({
        tenant,
        input: { microMajorChapterId: selectedChapterId },
        fields: ["id", "title", "content", "score", "microMajorChapterId"],
        headers,
      });
      if (result.success && result.data) {
        return extractArrayData(result) as HomeworkItem[];
      }
      return [];
    },
    enabled: !!selectedChapterId,
  });

  // Fetch all course videos (for linking)
  const { data: allVideos = [] } = useQuery({
    queryKey: ["mm-content-all-videos", courseId],
    queryFn: async () => {
      const result = await listMmVideosByCourse({
        tenant,
        input: { microMajorCourseId: courseId },
        fields: ["id", "title", "microMajorChapterId"],
        headers,
      });
      if (result.success && result.data) {
        return extractArrayData(result) as VideoItem[];
      }
      return [];
    },
    enabled: linkVideoOpen && !!courseId,
  });

  // Fetch all course exercises (for linking)
  const { data: allExercises = [] } = useQuery({
    queryKey: ["mm-content-all-exercises", courseId],
    queryFn: async () => {
      const result = await listMmExercisesByCourse({
        tenant,
        input: { microMajorCourseId: courseId },
        fields: ["id", "title", "microMajorChapterId"],
        headers,
      });
      if (result.success && result.data) {
        return extractArrayData(result) as ExerciseItem[];
      }
      return [];
    },
    enabled: linkExerciseOpen && !!courseId,
  });

  // Fetch all course homeworks (for linking)
  const { data: allHomeworks = [] } = useQuery({
    queryKey: ["mm-content-all-homeworks", courseId],
    queryFn: async () => {
      const result = await listMmHomeworksByCourse({
        tenant,
        input: { microMajorCourseId: courseId },
        fields: ["id", "title", "content", "score", "microMajorChapterId"],
        headers,
      });
      if (result.success && result.data) {
        return extractArrayData(result) as HomeworkItem[];
      }
      return [];
    },
    enabled: linkHomeworkOpen && !!courseId,
  });

  // Unlinked items (for linking modal)
  const unlinkedVideos = useMemo(
    () => allVideos.filter((v) => !v.microMajorChapterId || v.microMajorChapterId !== selectedChapterId),
    [allVideos, selectedChapterId]
  );
  const unlinkedExercises = useMemo(
    () => allExercises.filter((e) => !e.microMajorChapterId || e.microMajorChapterId !== selectedChapterId),
    [allExercises, selectedChapterId]
  );
  const unlinkedHomeworks = useMemo(
    () => allHomeworks.filter((h) => !h.microMajorChapterId || h.microMajorChapterId !== selectedChapterId),
    [allHomeworks, selectedChapterId]
  );

  // ---- Mutations ----

  const linkVideoMutation = useMutation({
    mutationFn: async (videoIds: string[]) => {
      for (const id of videoIds) {
        const result = await updateMmVideo({
          tenant,
          primaryKey: id,
          input: { microMajorChapterId: selectedChapterId },
          fields: ["id"],
          headers,
        });
        if (!result.success) throw new Error("关联视频失败");
      }
    },
    onSuccess: () => {
      message.success("视频关联成功");
      setLinkVideoOpen(false);
      setSelectedVideoIds([]);
      queryClient.invalidateQueries({ queryKey: ["mm-content-videos"] });
      queryClient.invalidateQueries({ queryKey: ["mm-content-all-videos"] });
    },
    onError: () => message.error("关联视频失败"),
  });

  const unlinkVideoMutation = useMutation({
    mutationFn: async (videoId: string) => {
      const result = await updateMmVideo({
        tenant,
        primaryKey: videoId,
        input: { microMajorChapterId: null },
        fields: ["id"],
        headers,
      });
      if (!result.success) throw new Error("移除视频失败");
    },
    onSuccess: () => {
      message.success("视频已移除");
      queryClient.invalidateQueries({ queryKey: ["mm-content-videos"] });
      queryClient.invalidateQueries({ queryKey: ["mm-content-all-videos"] });
    },
    onError: () => message.error("移除视频失败"),
  });

  const linkExerciseMutation = useMutation({
    mutationFn: async (exerciseIds: string[]) => {
      for (const id of exerciseIds) {
        const result = await updateMmExercise({
          tenant,
          primaryKey: id,
          input: { microMajorChapterId: selectedChapterId },
          fields: ["id"],
          headers,
        });
        if (!result.success) throw new Error("关联习题失败");
      }
    },
    onSuccess: () => {
      message.success("习题关联成功");
      setLinkExerciseOpen(false);
      setSelectedExerciseIds([]);
      queryClient.invalidateQueries({ queryKey: ["mm-content-exercises"] });
      queryClient.invalidateQueries({ queryKey: ["mm-content-all-exercises"] });
    },
    onError: () => message.error("关联习题失败"),
  });

  const unlinkExerciseMutation = useMutation({
    mutationFn: async (exerciseId: string) => {
      const result = await updateMmExercise({
        tenant,
        primaryKey: exerciseId,
        input: { microMajorChapterId: null },
        fields: ["id"],
        headers,
      });
      if (!result.success) throw new Error("移除习题失败");
    },
    onSuccess: () => {
      message.success("习题已移除");
      queryClient.invalidateQueries({ queryKey: ["mm-content-exercises"] });
      queryClient.invalidateQueries({ queryKey: ["mm-content-all-exercises"] });
    },
    onError: () => message.error("移除习题失败"),
  });

  // ---- Homework mutations ----

  const linkHomeworkMutation = useMutation({
    mutationFn: async (homeworkIds: string[]) => {
      for (const id of homeworkIds) {
        const result = await updateMmHomework({
          tenant,
          primaryKey: id,
          input: { microMajorChapterId: selectedChapterId },
          fields: ["id"],
          headers,
        });
        if (!result.success) throw new Error("关联作业失败");
      }
    },
    onSuccess: () => {
      message.success("作业关联成功");
      setLinkHomeworkOpen(false);
      setSelectedHomeworkIds([]);
      queryClient.invalidateQueries({ queryKey: ["mm-content-homeworks"] });
      queryClient.invalidateQueries({ queryKey: ["mm-content-all-homeworks"] });
    },
    onError: () => message.error("关联作业失败"),
  });

  const unlinkHomeworkMutation = useMutation({
    mutationFn: async (homeworkId: string) => {
      const result = await updateMmHomework({
        tenant,
        primaryKey: homeworkId,
        input: { microMajorChapterId: null },
        fields: ["id"],
        headers,
      });
      if (!result.success) throw new Error("移除作业失败");
    },
    onSuccess: () => {
      message.success("作业已移除");
      queryClient.invalidateQueries({ queryKey: ["mm-content-homeworks"] });
      queryClient.invalidateQueries({ queryKey: ["mm-content-all-homeworks"] });
    },
    onError: () => message.error("移除作业失败"),
  });

  // ---- Render ----

  const videoColumns: TableColumnsType<VideoItem> = [
    { title: "视频标题", dataIndex: "title", key: "title", render: (v: string) => <Tooltip title={v || "-"} mouseEnterDelay={0.3}><span style={{ fontSize: isMobile ? 13 : 14, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v || "-"}</span></Tooltip> },
    {
      title: "操作", key: "actions", width: isMobile ? 50 : 80,
      render: (_: any, record: VideoItem) => (
        <ReadonlyActionButton type="link" danger size="small" icon={<DisconnectOutlined />}
          onClick={() => unlinkVideoMutation.mutate(record.id)}>
          {isMobile ? "" : "移除"}
        </ReadonlyActionButton>
      ),
    },
  ];

  const exerciseColumns: TableColumnsType<ExerciseItem> = [
    { title: "习题标题", dataIndex: "title", key: "title", render: (v: string) => <Tooltip title={v || "-"} mouseEnterDelay={0.3}><span style={{ fontSize: isMobile ? 13 : 14, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v || "-"}</span></Tooltip> },
    {
      title: "操作", key: "actions", width: isMobile ? 50 : 80,
      render: (_: any, record: ExerciseItem) => (
        <ReadonlyActionButton type="link" danger size="small" icon={<DisconnectOutlined />}
          onClick={() => unlinkExerciseMutation.mutate(record.id)}>
          {isMobile ? "" : "移除"}
        </ReadonlyActionButton>
      ),
    },
  ];

  const homeworkColumns: TableColumnsType<HomeworkItem> = [
    { title: "作业标题", dataIndex: "title", key: "title", render: (v: string) => <Tooltip title={v || "-"} mouseEnterDelay={0.3}><span style={{ fontSize: isMobile ? 13 : 14, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v || "-"}</span></Tooltip> },
    {
      title: "分数", dataIndex: "score", key: "score", width: 60, responsive: ["md"],
      render: (v: string | null) => v ? `${v}分` : "-",
    },
    {
      title: "操作", key: "actions", width: isMobile ? 50 : 80,
      render: (_: any, record: HomeworkItem) => (
        <ReadonlyActionButton type="link" danger size="small" icon={<DisconnectOutlined />}
          onClick={() => unlinkHomeworkMutation.mutate(record.id)}>
          {isMobile ? "" : "移除"}
        </ReadonlyActionButton>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 12 : 16, marginTop: 16 }}>
      {/* Left panel: chapter tree */}
      <Card
        title="章节列表"
        size="small"
        style={{ width: isMobile ? "100%" : 300, flexShrink: 0, boxShadow: "0 1px 3px rgba(16,24,40,0.1)" }}
        bodyStyle={{ padding: 0, maxHeight: isMobile ? 200 : "calc(100vh - 280px)", overflow: "auto" }}
      >
        {chaptersLoading ? (
          <div style={{ textAlign: "center", padding: 24 }}><Spin /></div>
        ) : flatChapters.length === 0 ? (
          <Empty description="暂无章节" style={{ padding: 24 }} />
        ) : (
          flatChapters.map((ch) => (
            <div
              key={ch.id}
              onClick={() => setSelectedChapterId(ch.id)}
              style={{
                padding: "8px 12px 8px " + (16 + ch.level * 20) + "px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                backgroundColor: selectedChapterId === ch.id ? "#f0f0ff" : "transparent",
                borderLeft: selectedChapterId === ch.id ? "3px solid #722ed1" : "3px solid transparent",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => { if (selectedChapterId !== ch.id) e.currentTarget.style.backgroundColor = "#f9f9f9"; }}
              onMouseLeave={(e) => { if (selectedChapterId !== ch.id) e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              <FolderOutlined style={{ color: "#722ed1", fontSize: 14 }} />
              <Text style={{ fontSize: 13, flex: 1 }} ellipsis>
                {generateChapterNumber(ch.path) ? `${generateChapterNumber(ch.path)} ` : ""}{ch.title}
              </Text>
            </div>
          ))
        )}
      </Card>

      {/* Right panel: content */}
      <Card
        title={selectedChapter ? `章节内容: ${selectedChapter.title}` : "请选择一个章节"}
        size={isMobile ? "small" : "small"}
        style={{ flex: 1, boxShadow: "0 1px 3px rgba(16,24,40,0.1)" }}
        bodyStyle={{ padding: isMobile ? 8 : 12 }}
      >
        {!selectedChapterId ? (
          <Empty description="请从左侧选择一个章节" style={{ padding: 48 }} />
        ) : (
          <Tabs
            defaultActiveKey="videos"
            items={[
              {
                key: "videos",
                label: (
                  <span>
                    <VideoCameraOutlined style={{ marginRight: 4 }} />
                    视频 ({chapterVideos.length})
                  </span>
                ),
                children: (
                  <div>
                    <div style={{ marginBottom: 10, display: "flex", justifyContent: "flex-end" }}>
                      <Button size={isMobile ? "small" : "small"} type="primary" icon={<LinkOutlined />}
                        onClick={() => { setSelectedVideoIds([]); setLinkVideoOpen(true); }}
                        style={canEdit ? undefined : { display: "none" }}>
                        {isMobile ? "关联" : "关联视频"}
                      </Button>
                    </div>
                    <Table
                      columns={videoColumns}
                      dataSource={chapterVideos}
                      rowKey="id"
                      loading={videosLoading}
                      size="small"
                      pagination={false}
                      locale={{ emptyText: <Empty description="暂未关联视频" /> }}
                    />
                  </div>
                ),
              },
              {
                key: "exercises",
                label: (
                  <span>
                    <FileTextOutlined style={{ marginRight: 4 }} />
                    习题 ({chapterExercises.length})
                  </span>
                ),
                children: (
                  <div>
                    <div style={{ marginBottom: 10, display: "flex", justifyContent: "flex-end" }}>
                      <Button size={isMobile ? "small" : "small"} type="primary" icon={<LinkOutlined />}
                        onClick={() => { setSelectedExerciseIds([]); setLinkExerciseOpen(true); }}
                        style={canEdit ? undefined : { display: "none" }}>
                        {isMobile ? "关联" : "关联习题"}
                      </Button>
                    </div>
                    <Table
                      columns={exerciseColumns}
                      dataSource={chapterExercises}
                      rowKey="id"
                      loading={exercisesLoading}
                      size="small"
                      pagination={false}
                      locale={{ emptyText: <Empty description="暂未关联习题" /> }}
                    />
                  </div>
                ),
              },
              {
                key: "homeworks",
                label: (
                  <span>
                    <EditOutlined style={{ marginRight: 4 }} />
                    作业 ({chapterHomeworks.length})
                  </span>
                ),
                children: (
                  <div>
                    <div style={{ marginBottom: 10, display: "flex", justifyContent: "flex-end" }}>
                      <Button size={isMobile ? "small" : "small"} type="primary" icon={<LinkOutlined />}
                        onClick={() => { setSelectedHomeworkIds([]); setLinkHomeworkOpen(true); }}
                        style={canEdit ? undefined : { display: "none" }}>
                        {isMobile ? "关联" : "关联作业"}
                      </Button>
                    </div>
                    <Table
                      columns={homeworkColumns}
                      dataSource={chapterHomeworks}
                      rowKey="id"
                      loading={homeworksLoading}
                      size="small"
                      pagination={false}
                      locale={{ emptyText: <Empty description="暂未关联作业" /> }}
                    />
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>

      {/* Link Video Modal */}
      <Modal
        title="关联视频到章节"
        open={linkVideoOpen}
        onCancel={() => { setLinkVideoOpen(false); setSelectedVideoIds([]); }}
        onOk={() => {
          if (selectedVideoIds.length === 0) { message.warning("请选择视频"); return; }
          linkVideoMutation.mutate(selectedVideoIds);
        }}
        confirmLoading={linkVideoMutation.isPending}
        width={600}
      >
        {unlinkedVideos.length === 0 ? (
          <Empty description="所有视频已关联到章节" />
        ) : (
          <Table
            dataSource={unlinkedVideos}
            columns={[{ title: "视频标题", dataIndex: "title", key: "title", ellipsis: true, render: (v: string) => v || "-" }]}
            rowKey="id"
            size="small"
            pagination={false}
            rowSelection={{
              type: "checkbox",
              selectedRowKeys: selectedVideoIds,
              onChange: (keys) => setSelectedVideoIds(keys as string[]),
            }}
          />
        )}
      </Modal>

      {/* Link Exercise Modal */}
      <Modal
        title="关联习题到章节"
        open={linkExerciseOpen}
        onCancel={() => { setLinkExerciseOpen(false); setSelectedExerciseIds([]); }}
        onOk={() => {
          if (selectedExerciseIds.length === 0) { message.warning("请选择题"); return; }
          linkExerciseMutation.mutate(selectedExerciseIds);
        }}
        confirmLoading={linkExerciseMutation.isPending}
        width={600}
      >
        {unlinkedExercises.length === 0 ? (
          <Empty description="所有习题已关联到章节" />
        ) : (
          <Table
            dataSource={unlinkedExercises}
            columns={[{ title: "习题标题", dataIndex: "title", key: "title", ellipsis: true }]}
            rowKey="id"
            size="small"
            pagination={false}
            rowSelection={{
              type: "checkbox",
              selectedRowKeys: selectedExerciseIds,
              onChange: (keys) => setSelectedExerciseIds(keys as string[]),
            }}
          />
        )}
      </Modal>

      {/* Link Homework Modal */}
      <Modal
        title="关联作业到章节"
        open={linkHomeworkOpen}
        onCancel={() => { setLinkHomeworkOpen(false); setSelectedHomeworkIds([]); }}
        onOk={() => {
          if (selectedHomeworkIds.length === 0) { message.warning("请选择作业"); return; }
          linkHomeworkMutation.mutate(selectedHomeworkIds);
        }}
        confirmLoading={linkHomeworkMutation.isPending}
        width={600}
      >
        {unlinkedHomeworks.length === 0 ? (
          <Empty description="所有作业已关联到章节" />
        ) : (
          <Table
            dataSource={unlinkedHomeworks}
            columns={[
              { title: "作业标题", dataIndex: "title", key: "title", ellipsis: true },
              { title: "分数", dataIndex: "score", key: "score", width: 80, render: (v: string | null) => v ? `${v}分` : "-" },
            ]}
            rowKey="id"
            size="small"
            pagination={false}
            rowSelection={{
              type: "checkbox",
              selectedRowKeys: selectedHomeworkIds,
              onChange: (keys) => setSelectedHomeworkIds(keys as string[]),
            }}
          />
        )}
      </Modal>
    </div>
  );
}

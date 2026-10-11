import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Typography,
  Tabs,
  Select,
  Tag,
  Button,
  Modal,
  List,
  Checkbox,
  Alert,
  Spin,
  Space,
  Tree,
  Empty,
  message,
  Input,
  Badge,
  Tooltip,
  Statistic,
  Popover,
  Pagination,
  Table,
} from "antd";
import type { TreeDataNode } from "antd";
import {
  FileTextOutlined,
  FormOutlined,
  VideoCameraOutlined,
  FolderOutlined,
  LinkOutlined,
  DisconnectOutlined,
  SearchOutlined,
  AppstoreOutlined,
  BookOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  ArrowLeftOutlined,
  FileExcelOutlined,
  FileImageOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  PlusOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from "@ant-design/icons";
import {
  listFiles,
  listExercises,
  listVideos,
  listHomeworks,
  listChapters,
  listLinks,
  linkFileToKnowledge,
  linkExerciseToKnowledge,
  linkHomeworkToKnowledge,
  linkVideoToKnowledge,
  linkToKnowledge,
  unlinkFileFromKnowledge,
  unlinkExerciseFromKnowledge,
  unlinkHomeworkFromKnowledge,
  unlinkVideoFromKnowledge,
  unlinkFromKnowledge,
  reorderFiles,
  type ResourceResourceSchema,
} from "@/lib/ash_rpc";
import { useCourses } from "@/hooks/use-courses";

type CourseData = { id: string; title: string; description?: string | null };
type FileData = {
  id: string;
  filename: string;
  fileType: string;
  size: number;
  path?: string;
  purpose?: string;
  source?: string | null;
  sortOrder?: number | null;
};
type ExerciseData = {
  id: string;
  title: string;
  questionType: string;
  aiType?: string | null;
  questionContent?: string | null;
  answer?: string | null;
  options?: Record<string, any> | null;
  insertedAt?: string | null;
};
type VideoData = {
  id: string;
  title?: string | null;
  duration?: number | null;
  thumbnail?: string | null;
  chapterId?: string | null;
  aiType?: string | null;
};
type HomeworkData = { 
  id: string; 
  title: string; 
  score?: string | null; 
  content?: string | null; 
  answer?: string | null;
  aiType?: string | null;
};
type LinkData = {
  id: string;
  title: string;
  url: string;
  category?: string | null;
};

// 资源数据联合类型
type ResourceData = FileData | ExerciseData | HomeworkData | VideoData;
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import { getAuthHeaders } from "@/lib/auth";
import { AppPage } from "@/components/proto";
import { SwitchButton } from "@/components/teacher/switch-button";

const { Text } = Typography;

interface KnowledgeResource extends ResourceResourceSchema {
  children?: KnowledgeResource[];
}

interface KnowledgeTreeItem extends TreeDataNode {
  id: string;
  label: string;
  children?: KnowledgeTreeItem[];
  knowledgeData: KnowledgeResource;
}

// 获取文件类型图标
const getFileIcon = (fileType: string) => {
  const type = fileType.toLowerCase();
  if (type.includes("pdf") || type === "application/pdf") return <FilePdfOutlined style={{ color: "#e74c3c", fontSize: 20 }} />;
  if (type.includes("word") || type.includes("doc") || type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return <FileWordOutlined style={{ color: "#2b579a", fontSize: 20 }} />;
  if (type.includes("excel") || type.includes("sheet") || type.includes("xls") || type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return <FileExcelOutlined style={{ color: "#217346", fontSize: 20 }} />;
  if (type.includes("image") || type.includes("jpg") || type.includes("png") || type.includes("jpeg") || type.includes("gif"))
    return <FileImageOutlined style={{ color: "#9b59b6", fontSize: 20 }} />;
  if (type.includes("video") || type.startsWith("video/")) return <VideoCameraOutlined style={{ color: "#eb2f96", fontSize: 20 }} />;
  if (type.includes("powerpoint") || type.includes("ppt")) return <FileTextOutlined style={{ color: "#d24726", fontSize: 20 }} />;
  if (type.includes("zip") || type.includes("rar") || type.includes("tar") || type.includes("gz") || type.includes("compressed"))
    return <FolderOutlined style={{ color: "#f39c12", fontSize: 20 }} />;
  return <FileTextOutlined style={{ color: "#7f8c8d", fontSize: 20 }} />;
};

// 简化文件类型显示
// 文件名自然序排序（与资源页一致）：按数字自然序，忽略空格/分隔符差异
function naturalCompare(a?: string, b?: string): number {
  const sa = String(a || "");
  const sb = String(b || "");
  const r = sa.localeCompare(sb, "zh-Hans-CN", { numeric: true });
  if (r !== 0) return r;
  return sa.length - sb.length;
}

const simplifyFileType = (filename: string, fileType?: string): string => {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (ext === "pptx" || ext === "ppt") return "PPT";
  if (ext === "xlsx" || ext === "xls") return "Excel";
  if (ext === "docx" || ext === "doc") return "Word";
  if (ext === "pdf") return "PDF";
  if (ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "gif") return "图片";
  if (ext === "txt") return "文本";
  if (ext === "zip" || ext === "rar" || ext === "tar" || ext === "gz") return "压缩包";
  if (ext === "mp4" || ext === "avi" || ext === "mov" || ext === "wmv") return "视频";
  if (ext === "mp3" || ext === "wav" || ext === "ogg") return "音频";
  if (!fileType) return ext || "未知";
  const type = fileType.toLowerCase();
  if (type.includes("pdf") || type === "application/pdf") return "PDF";
  if (type.includes("word") || type.includes("doc") || type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "Word";
  if (type.includes("excel") || type.includes("sheet") || type.includes("xls") || type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return "Excel";
  if (type.includes("powerpoint") || type.includes("presentationml")) return "PPT";
  if (type.includes("image") || type.includes("jpg") || type.includes("png") || type.includes("jpeg") || type.includes("gif"))
    return "图片";
  if (type.includes("text") || type.includes("txt")) return "文本";
  if (type.includes("zip") || type.includes("rar") || type.includes("tar") || type.includes("gz") || type.includes("compressed"))
    return "压缩包";
  if (type.includes("video") || type.startsWith("video/")) return "视频";
  if (type.includes("audio") || type.startsWith("audio/")) return "音频";
  const parts = fileType.split("/");
  if (parts.length >= 2) {
    return parts[parts.length - 1].split(".")[0].toUpperCase();
  }
  return ext || fileType;
};

// 转换数字答案为字母答案
const convertNumberToLetter = (answer: string | null | undefined): string => {
  if (!answer) return "";
  const trimmed = answer.trim();
  // Already letter-based with separators (e.g. "A,C" or "A, B, D" or "A，B")
  if (/^[A-Da-d]/.test(trimmed)) {
    return trimmed
      .split(/[,，\s]+/)
      .map(s => s.replace(/\..*$/, '').trim().toUpperCase())
      .filter(s => /^[A-D]$/.test(s))
      .join(',');
  }
  // Numeric like "1,2" or "0,2"
  return trimmed
    .split(/[,，\s]+/)
    .map(s => {
      const num = parseInt(s, 10);
      if (num >= 1 && num <= 26) return String.fromCharCode(64 + num);
      if (num === 0) return 'A';
      return s;
    })
    .join(',');
};

// 清理选项文字，去除已有的序号格式
const cleanOptionText = (text: string | any): string => {
  if (typeof text !== 'string') return String(text);
  // 去除各种格式的序号: "A. ", "B. ", "A. ", ". 2", "2.", "2.", ". 文本" 等
  return text
    .replace(/^[A-Z]\.\s*/gi, '')      // 去除 "A. " 或 "a. " 格式
    .replace(/^\.\s+/, '')             // 去除 ". " 或 ".  " 格式（点号后跟空格）
    .replace(/^\d+\.\s*/, '')          // 去除 "2. " 格式
    .trim();
};

const QUESTION_TYPE_LABELS: Record<string, string> = {
  multiple_choice: "单选题",
  multiple_response: "多选题",
  true_false: "判断题",
  essay: "问答题",
  fill_in_blank: "填空题",
  fill_blank: "填空题",
  term_definition: "名词解释",
  case_study: "案例题",
};

function FilesTable({
  files,
  loading,
  onUnlink,
  searchText = "",
  onSearchChange,
  onMove,
  reordering = false,
}: {
  files?: FileData[];
  loading: boolean;
  onUnlink: (fileId: string, fileName: string) => void;
  searchText?: string;
  onSearchChange?: (text: string) => void;
  onMove?: (file: FileData, direction: "up" | "down") => void;
  reordering?: boolean;
}) {
  const [internalSearchText, setInternalSearchText] = useState("");
  const actualSearchText = searchText ?? internalSearchText;
  const handleSearchChange = onSearchChange ?? setInternalSearchText;

  const filteredFiles = useMemo(() => {
    if (!files) return [];
    let list = files;
    if (actualSearchText) {
      list = list.filter(f => f.filename?.toLowerCase().includes(actualSearchText.toLowerCase()));
    }
    return list;
  }, [files, actualSearchText]);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: 48,
        }}
      >
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!files || files.length === 0) {
    return (
      <div style={{ padding: 48 }}>
        <Empty
          description={
            <span style={{ color: "#8c8c8c" }}>
              暂无关联的文件
            </span>
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  return (
    <>
      <Table<FileData>
        rowKey="id"
        size="middle"
        loading={loading}
        pagination={false}
        dataSource={filteredFiles}
        columns={[
          {
            title: "文件名称",
            dataIndex: "filename",
            key: "filename",
            render: (_: string, file) => (
              <Space size={8}>
                <span style={{ display: "inline-flex", width: 22, justifyContent: "center" }}>
                  {getFileIcon(file.fileType)}
                </span>
                <Text strong ellipsis style={{ maxWidth: 320 }}>{file.filename}</Text>
                {file.source === "ai_generated" && (
                  <Tag color="green" style={{ fontSize: 11, padding: "0 6px", margin: 0 }}>AI生成文件</Tag>
                )}
              </Space>
            ),
          },
          {
            title: "类型",
            dataIndex: "fileType",
            key: "fileType",
            width: 90,
            render: (_: string, file) => (
              <Tag style={{ fontSize: 11, padding: "0 6px", margin: 0 }}>
                {simplifyFileType(file.filename || "", file.fileType)}
              </Tag>
            ),
          },
          {
            title: "大小",
            dataIndex: "size",
            key: "size",
            width: 110,
            render: (size: number) => (
              <Text type="secondary" style={{ fontSize: 13 }}>{(size / 1024).toFixed(1)} KB</Text>
            ),
          },
          {
            title: "操作",
            key: "action",
            width: onMove ? 160 : 110,
            render: (_: unknown, file) => (
              <Space size={4}>
                {onMove && (
                  <>
                    <Tooltip title="上移">
                      <Button size="small" type="text" icon={<ArrowUpOutlined />} disabled={reordering} onClick={() => onMove(file, "up")} />
                    </Tooltip>
                    <Tooltip title="下移">
                      <Button size="small" type="text" icon={<ArrowDownOutlined />} disabled={reordering} onClick={() => onMove(file, "down")} />
                    </Tooltip>
                  </>
                )}
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<DisconnectOutlined />}
                  onClick={() => onUnlink(file.id, file.filename)}
                >
                  取消关联
                </Button>
              </Space>
            ),
          },
        ]}
      />
      <div className="pu-table-footer"><span>共 {filteredFiles.length} 条</span></div>
    </>
  );
}

function ExercisesTable({
  exercises,
  loading,
  onUnlink,
  searchText = "",
  onSearchChange,
}: {
  exercises?: ExerciseData[];
  loading: boolean;
  onUnlink: (exerciseId: string, exerciseTitle: string) => void;
  searchText?: string;
  onSearchChange?: (text: string) => void;
}) {
  const [internalSearchText, setInternalSearchText] = useState("");
  const actualSearchText = searchText ?? internalSearchText;
  const handleSearchChange = onSearchChange ?? setInternalSearchText;

  const filteredExercises = useMemo(() => {
    if (!exercises) return [];
    if (!actualSearchText) return exercises;
    return exercises.filter(e => e.title?.toLowerCase().includes(actualSearchText.toLowerCase()));
  }, [exercises, actualSearchText]);

  const renderExercisePreview = (exercise: ExerciseData) => {
    const parseOptions = (): Record<string, any> | null => {
      const opt = exercise.options;
      if (!opt) return null;
      
      // 如果是对象格式，检查是否是 { choices: [...], correctAnswer: x } 格式
      if (typeof opt === 'object') {
        if (opt.choices && Array.isArray(opt.choices)) {
          const options: Record<string, string> = {};
          opt.choices.forEach((choice: string, idx: number) => {
            options[String(idx + 1)] = choice;
          });
          return options;
        }
        return opt;
      }
      
      const optStr = String(opt);
      if (typeof optStr === 'string') {
        // 尝试解析 JSON
        try {
          const parsed = JSON.parse(optStr);
          // 检查是否是 { choices: [...], correctAnswer: x } 格式
          if (parsed.choices && Array.isArray(parsed.choices)) {
            const options: Record<string, string> = {};
            parsed.choices.forEach((choice: string, idx: number) => {
              options[String(idx + 1)] = choice;
            });
            return options;
          }
          return parsed;
        } catch {
          // 如果不是 JSON，尝试解析换行分隔的格式
          // 格式: ". 选项1,选项2,选项3,选项4\n. 2" 或 ". 选项1\n. 选项2\n. 选项3\n. 选项4"
          const lines = optStr.split('\n').filter(line => line.trim());
          if (lines.length >= 1) {
            const options: Record<string, string> = {};
            
            // 过滤掉只包含答案的行（如 ". 2" 或 "2"）
            const optionLines = lines.filter(line => {
              const cleaned = line.replace(/^\.\s*/, '').trim();
              // 排除只包含数字的行（答案行）
              return !/^\d+$/.test(cleaned);
            });
            
            if (optionLines.length === 0) return null;
            
            // 如果选项在单行中用逗号分隔
            const firstLine = optionLines[0].replace(/^\.\s*/, '').trim();
            if (firstLine.includes(',')) {
              const optionList = firstLine.split(',').map((optItem) => {
                return optItem.replace(/^[A-Z]\.\s*/gi, '').trim();
              });
              optionList.forEach((optItem, idx) => {
                options[String(idx + 1)] = optItem;
              });
              return options;
            }

            // 如果选项在单行中用中文顿号分隔
            if (firstLine.includes('、')) {
              const optionList = firstLine.split('、').map((optItem) => {
                return optItem.replace(/^[A-Z]\.\s*/gi, '').trim();
              });
              optionList.forEach((optItem, idx) => {
                options[String(idx + 1)] = optItem;
              });
              return options;
            }
            
            // 如果每个选项单独一行
            optionLines.forEach((line, idx) => {
              const cleaned = line.replace(/^\.\s*/, '').replace(/^[A-Z]\.\s*/gi, '').trim();
              options[String(idx + 1)] = cleaned;
            });
            return options;
          }
          return null;
        }
      }
      return null;
    };

    // 显示所有选项列表
    const renderOptionsList = () => {
      const options = parseOptions();
      if (!options) return null;
      
      const optionKeys = Object.keys(options).sort();
      if (optionKeys.length === 0) return null;

      const isTrueFalse = exercise.questionType === 'true_false';

      return (
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>选项:</Text>
          <div style={{ marginTop: 4 }}>
            {optionKeys.map((key) => {
              const letter = String.fromCharCode(64 + parseInt(key, 10));
              const answerStr = exercise.answer || "";
              const answerLetters = convertNumberToLetter(answerStr).toUpperCase();
              const isCorrect = answerLetters.includes(letter);
              const optionText = cleanOptionText(options[key]);
              return (
                <div 
                  key={key} 
                  style={{ 
                    fontSize: 13, 
                    padding: '4px 8px',
                    marginBottom: 4,
                    backgroundColor: isCorrect ? '#f6ffed' : '#fafafa',
                    borderRadius: 4,
                    border: isCorrect ? '1px solid #b7eb8f' : '1px solid #d9d9d9',
                  }}
                >
                  {!isTrueFalse && <Text strong>{letter}. </Text>}
                  <Text style={isCorrect ? { color: '#52c41a' } : {}}>
                    {optionText}
                  </Text>
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    const renderAnswer = () => {
      if (!exercise.answer) return null;
      const answerLetters = convertNumberToLetter(exercise.answer);

      if (exercise.questionType === 'true_false') {
        const isCorrect = answerLetters.toUpperCase() === 'A';
        const answerText = isCorrect ? '正确' : '错误';
        return (
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>答案:</Text>
            <div style={{ marginTop: 4, fontSize: 13, color: "#52c41a", fontWeight: 'bold' }}>
              {answerText}
            </div>
          </div>
        );
      }

      const options = parseOptions();
      
      if (!options) {
        return (
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>答案:</Text>
            <div style={{ marginTop: 4, fontSize: 13, color: "#52c41a", fontWeight: 'bold' }}>
              {answerLetters}
            </div>
          </div>
        );
      }

      // 找到所有可能的 key 格式
      const findOptionValue = (letter: string): string | undefined => {
        const upperLetter = letter.toUpperCase();
        const numKey = String(upperLetter.charCodeAt(0) - 64); // A -> 1, B -> 2, C -> 3
        
        // 尝试多种 key 格式
        return options[numKey] || options[upperLetter] || options[letter] || options[numKey.toString()];
      };

      const answerContent = (() => {
        if (!options) return answerLetters;
        const letters = answerLetters.split(/[,，\s]+/).filter(Boolean);
        return letters.map(letter => {
          const upperLetter = letter.toUpperCase();
          const optionText = findOptionValue(letter);
          if (optionText) {
            const cleanedText = cleanOptionText(optionText);
            return `${upperLetter}. ${cleanedText}`;
          }
          return upperLetter;
        }).join('，');
      })();

      return (
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>答案:</Text>
          <div style={{ marginTop: 4, fontSize: 13, color: "#52c41a", fontWeight: 'bold' }}>
            {answerContent}
          </div>
        </div>
      );
    };

    return (
      <div style={{ maxWidth: 400, maxHeight: 400, overflow: "auto" }}>
        <div style={{ marginBottom: 12 }}>
          <Text strong style={{ fontSize: 14 }}>{exercise.title}</Text>
        </div>
        {exercise.questionContent && (
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>题目内容:</Text>
            <div style={{ marginTop: 4, fontSize: 13 }}>{exercise.questionContent}</div>
          </div>
        )}
        {renderOptionsList()}
        {renderAnswer()}
        {!exercise.questionContent && !exercise.answer && !exercise.options && (
          <Text type="secondary">暂无预览内容</Text>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: 48,
        }}
      >
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!exercises || exercises.length === 0) {
    return (
      <div style={{ padding: 48 }}>
        <Empty
          description={
            <span style={{ color: "#8c8c8c" }}>
              暂无关联的练习
            </span>
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  return (
    <>
      <Table<ExerciseData>
        rowKey="id"
        size="middle"
        loading={loading}
        pagination={false}
        dataSource={filteredExercises}
        columns={[
          {
            title: "题目",
            dataIndex: "title",
            key: "title",
            render: (title: string, exercise) => (
              <Popover
                content={renderExercisePreview(exercise)}
                trigger="hover"
                mouseEnterDelay={0.2}
                placement="right"
              >
                <Text strong ellipsis style={{ maxWidth: 360, cursor: "pointer" }}>{title}</Text>
              </Popover>
            ),
          },
          {
            title: "题型",
            dataIndex: "questionType",
            key: "questionType",
            width: 150,
            render: (qt: string, exercise) => (
              <Space size={4}>
                <Tag color="blue" style={{ fontSize: 11, padding: "0 6px", margin: 0 }}>
                  {QUESTION_TYPE_LABELS[qt] || qt}
                </Tag>
                {exercise.aiType === "ai_generated" && (
                  <Tag color="green" icon={<SyncOutlined spin />} style={{ fontSize: 11, padding: "0 6px", margin: 0 }}>AI生成</Tag>
                )}
              </Space>
            ),
          },
          {
            title: "操作",
            key: "action",
            width: 110,
            render: (_: unknown, exercise) => (
              <Button
                type="link"
                size="small"
                danger
                icon={<DisconnectOutlined />}
                onClick={() => onUnlink(exercise.id, exercise.title)}
              >
                取消关联
              </Button>
            ),
          },
        ]}
      />
      <div className="pu-table-footer"><span>共 {filteredExercises.length} 条</span></div>
    </>
  );
}

function HomeworksTable({
  homeworks,
  loading,
  onUnlink,
  searchText = "",
  onSearchChange,
}: {
  homeworks?: HomeworkData[];
  loading: boolean;
  onUnlink: (homeworkId: string, homeworkTitle: string) => void;
  searchText?: string;
  onSearchChange?: (text: string) => void;
}) {
  const [internalSearchText, setInternalSearchText] = useState("");
  const actualSearchText = searchText ?? internalSearchText;
  const handleSearchChange = onSearchChange ?? setInternalSearchText;

  const filteredHomeworks = useMemo(() => {
    if (!homeworks) return [];
    if (!actualSearchText) return homeworks;
    return homeworks.filter(h => h.title?.toLowerCase().includes(actualSearchText.toLowerCase()));
  }, [homeworks, actualSearchText]);

  const renderHomeworkPreview = (homework: HomeworkData) => {
    return (
      <div style={{ maxWidth: 400, maxHeight: 300, overflow: "auto" }}>
        <div style={{ marginBottom: 12 }}>
          <Text strong style={{ fontSize: 14 }}>{homework.title}</Text>
        </div>
        {homework.content && (
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>作业内容:</Text>
            <div style={{ marginTop: 4, fontSize: 13 }}>{homework.content}</div>
          </div>
        )}
        {homework.answer && (
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>答案:</Text>
            <div style={{ marginTop: 4, fontSize: 13, color: "#52c41a" }}>{homework.answer}</div>
          </div>
        )}
        {!homework.content && !homework.answer && (
          <Text type="secondary">暂无预览内容</Text>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: 48,
        }}
      >
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!homeworks || homeworks.length === 0) {
    return (
      <div style={{ padding: 48 }}>
        <Empty
          description={
            <span style={{ color: "#8c8c8c" }}>
              暂无关联的作业
            </span>
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  return (
    <>
      <Table<HomeworkData>
        rowKey="id"
        size="middle"
        loading={loading}
        pagination={false}
        dataSource={filteredHomeworks}
        columns={[
          {
            title: "作业标题",
            dataIndex: "title",
            key: "title",
            render: (title: string, homework) => (
              <Popover
                content={renderHomeworkPreview(homework)}
                trigger="hover"
                mouseEnterDelay={0.2}
                placement="right"
              >
                <Text strong ellipsis style={{ maxWidth: 360, cursor: "pointer" }}>{title}</Text>
              </Popover>
            ),
          },
          {
            title: "满分",
            dataIndex: "score",
            key: "score",
            width: 120,
            render: (score: string, homework) => (
              <Space size={4}>
                <Tag color="orange" icon={<ClockCircleOutlined />} style={{ fontSize: 11, padding: "0 6px", margin: 0 }}>
                  {score || "N/A"}
                </Tag>
                {homework.aiType === "ai_generated" && (
                  <Tag color="green" icon={<SyncOutlined spin />} style={{ fontSize: 11, padding: "0 6px", margin: 0 }}>AI生成</Tag>
                )}
              </Space>
            ),
          },
          {
            title: "操作",
            key: "action",
            width: 110,
            render: (_: unknown, homework) => (
              <Button
                type="link"
                size="small"
                danger
                icon={<DisconnectOutlined />}
                onClick={() => onUnlink(homework.id, homework.title)}
              >
                取消关联
              </Button>
            ),
          },
        ]}
      />
      <div className="pu-table-footer"><span>共 {filteredHomeworks.length} 条</span></div>
    </>
  );
}

function VideosTable({
  videos,
  loading,
  onUnlink,
  searchText = "",
  onSearchChange,
}: {
  videos?: VideoData[];
  loading: boolean;
  onUnlink: (videoId: string, videoTitle: string) => void;
  searchText?: string;
  onSearchChange?: (text: string) => void;
}) {
  const [internalSearchText, setInternalSearchText] = useState("");
  const actualSearchText = searchText ?? internalSearchText;
  const handleSearchChange = onSearchChange ?? setInternalSearchText;

  const filteredVideos = useMemo(() => {
    if (!videos) return [];
    if (!actualSearchText) return videos;
    return videos.filter(v => v.title?.toLowerCase().includes(actualSearchText.toLowerCase()));
  }, [videos, actualSearchText]);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: 48,
        }}
      >
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!videos || videos.length === 0) {
    return (
      <div style={{ padding: 48 }}>
        <Empty
          description={
            <span style={{ color: "#8c8c8c" }}>
              暂无关联的视频
            </span>
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return "N/A";
    const totalSecs = Math.floor(seconds);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <>
      <Table<VideoData>
        rowKey="id"
        size="middle"
        loading={loading}
        pagination={false}
        dataSource={filteredVideos}
        columns={[
          {
            title: "视频标题",
            dataIndex: "title",
            key: "title",
            render: (title: string) => (
              <Text strong ellipsis style={{ maxWidth: 360 }}>{title}</Text>
            ),
          },
          {
            title: "时长",
            dataIndex: "duration",
            key: "duration",
            width: 150,
            render: (duration: number | null | undefined, video) => (
              <Space size={4}>
                <Tag color="magenta" icon={<ClockCircleOutlined />} style={{ fontSize: 11, padding: "0 6px", margin: 0 }}>
                  {formatDuration(duration)}
                </Tag>
                {video.aiType === "ai_generated" && (
                  <Tag color="green" icon={<SyncOutlined spin />} style={{ fontSize: 11, padding: "0 6px", margin: 0 }}>AI生成</Tag>
                )}
              </Space>
            ),
          },
          {
            title: "操作",
            key: "action",
            width: 110,
            render: (_: unknown, video) => (
              <Button
                type="link"
                size="small"
                danger
                icon={<DisconnectOutlined />}
                onClick={() => onUnlink(video.id, video.title || "")}
              >
                取消关联
              </Button>
            ),
          },
        ]}
      />
      <div className="pu-table-footer"><span>共 {filteredVideos.length} 条</span></div>
    </>
  );
}

function LinksTable({
  links,
  loading,
  onUnlink,
  searchText = "",
  onSearchChange,
}: {
  links?: LinkData[];
  loading: boolean;
  onUnlink: (linkId: string, linkTitle: string) => void;
  searchText?: string;
  onSearchChange?: (text: string) => void;
}) {
  const [internalSearchText, setInternalSearchText] = useState("");
  const actualSearchText = searchText ?? internalSearchText;
  const handleSearchChange = onSearchChange ?? setInternalSearchText;

  const filteredLinks = useMemo(() => {
    if (!links) return [];
    if (!actualSearchText) return links;
    return links.filter(l => l.title?.toLowerCase().includes(actualSearchText.toLowerCase()));
  }, [links, actualSearchText]);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: 48,
        }}
      >
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!links || links.length === 0) {
    return (
      <div style={{ padding: 48 }}>
        <Empty
          description={
            <span style={{ color: "#8c8c8c" }}>
              暂无关联的链接
            </span>
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  const handleLinkClick = (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <Table<LinkData>
        rowKey="id"
        size="middle"
        loading={loading}
        pagination={false}
        dataSource={filteredLinks}
        columns={[
          {
            title: "标题",
            dataIndex: "title",
            key: "title",
            render: (title: string, link) => (
              <Space size={4}>
                <a onClick={(e) => handleLinkClick(link.url, e)} style={{ fontWeight: 600 }}>{title}</a>
                {link.category && (
                  <Tag color="blue" style={{ fontSize: 11, padding: "0 6px", margin: 0 }}>{link.category}</Tag>
                )}
              </Space>
            ),
          },
          {
            title: "链接",
            dataIndex: "url",
            key: "url",
            render: (url: string) => (
              <Tooltip title={url}>
                <a
                  onClick={(e) => handleLinkClick(url, e)}
                  style={{ fontFamily: "monospace", fontSize: 12, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 320 }}
                >
                  {url}
                </a>
              </Tooltip>
            ),
          },
          {
            title: "操作",
            key: "action",
            width: 110,
            render: (_: unknown, link) => (
              <Button
                type="link"
                size="small"
                danger
                icon={<DisconnectOutlined />}
                onClick={() => onUnlink(link.id, link.title)}
              >
                取消关联
              </Button>
            ),
          },
        ]}
      />
      <div className="pu-table-footer"><span>共 {filteredLinks.length} 条</span></div>
    </>
  );
}

interface KnowledgeTreeViewProps {
  items: KnowledgeTreeItem[];
  onNodeSelect: (resource: KnowledgeResource) => void;
  selectedItemId?: string;
}

// 获取所有需要展开的keys
const getAllKeys = (treeData: KnowledgeTreeItem[]): React.Key[] => {
  const keys: React.Key[] = [];
  treeData.forEach((item) => {
    keys.push(item.key);
    if (item.children && item.children.length > 0) {
      keys.push(...getAllKeys(item.children));
    }
  });
  return keys;
};

// 获取第一级节点的keys
const getFirstLevelKeys = (treeData: KnowledgeTreeItem[]): React.Key[] => {
  return treeData.map((item) => item.key);
};

// 过滤树节点
const filterTree = (
  treeData: KnowledgeTreeItem[],
  searchText: string,
): KnowledgeTreeItem[] => {
  if (!searchText) return treeData;

  return treeData
    .map((item) => {
      const label = item.label?.toLowerCase() || "";
      const matchesSearch = label.includes(searchText.toLowerCase());

      let filteredChildren: KnowledgeTreeItem[] | undefined;
      if (item.children && item.children.length > 0) {
        filteredChildren = filterTree(item.children, searchText);
      }

      if (matchesSearch || (filteredChildren && filteredChildren.length > 0)) {
        return {
          ...item,
          children: filteredChildren,
        };
      }
      return null;
    })
    .filter((item): item is KnowledgeTreeItem => item !== null);
};

function KnowledgeTreeView({
  items,
  onNodeSelect,
  selectedItemId,
}: KnowledgeTreeViewProps) {
  const [searchValue, setSearchValue] = useState("");
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // 初始化展开状态 - 默认展开全部知识层级
  useEffect(() => {
    if (!isInitialized && items.length > 0) {
      setExpandedKeys(getAllKeys(items));
      setIsInitialized(true);
    }
  }, [items, isInitialized]);

  // 搜索时自动展开匹配的节点
  const filteredItems = useMemo(() => filterTree(items, searchValue), [items, searchValue]);

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    if (value) {
      const matchingKeys = getAllKeys(filterTree(items, value));
      setExpandedKeys(matchingKeys);
    } else {
      setExpandedKeys(getAllKeys(items));
    }
  };

  const handleExpand = (keys: React.Key[]) => {
    setExpandedKeys(keys);
  };

  const handleSelect = (selectedKeys: React.Key[]) => {
    if (!selectedKeys.length) return;

    const itemId = selectedKeys[0] as string;

    const findItem = (
      treeData: KnowledgeTreeItem[],
      id: string,
    ): KnowledgeTreeItem | null => {
      for (const item of treeData) {
        if (item.id === id) return item;
        if (item.children) {
          const found = findItem(item.children, id);
          if (found) return found;
        }
      }
      return null;
    };

    // 先在原始items中查找
    const selectedItem = findItem(items, itemId);
    if (selectedItem) {
      onNodeSelect(selectedItem.knowledgeData);
    }
  };

  // 递归增强树数据 - 同时处理搜索高亮
  const enhanceTreeData = (
    treeData: KnowledgeTreeItem[],
    searchText: string,
  ): KnowledgeTreeItem[] => {
    return treeData.map((item) => {
      const label = item.label || item.title || "";
      // 高亮搜索词
      let titleNode: React.ReactNode = (
        <span style={{ fontSize: 15, lineHeight: 1.5 }}>{label}</span>
      );
      if (searchText) {
        const index = label.toLowerCase().indexOf(searchText.toLowerCase());
        if (index > -1) {
          const beforeStr = label.substring(0, index);
          const matchStr = label.substring(index, index + searchText.length);
          const afterStr = label.substring(index + searchText.length);
          titleNode = (
            <span style={{ fontSize: 15, lineHeight: 1.5 }}>
              {beforeStr}
              <span style={{ background: "#ffe58f", color: "#1F1F1F", padding: "0 2px", borderRadius: 2 }}>
                {matchStr}
              </span>
              {afterStr}
            </span>
          );
        }
      }

      return {
        ...item,
        title: titleNode,
        children: item.children ? enhanceTreeData(item.children, searchText) : undefined,
      };
    });
  };

  const treeDataWithTitle = useMemo(
    () => enhanceTreeData(filteredItems, searchValue),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredItems, searchValue],
  );

  // 计算当前显示的节点数量
  const displayCount = useMemo(() => {
    const countNodes = (nodes: KnowledgeTreeItem[]): number => {
      return nodes.reduce((acc, node) => {
        return acc + 1 + (node.children ? countNodes(node.children) : 0);
      }, 0);
    };
    return countNodes(filteredItems);
  }, [filteredItems]);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "12px 12px 8px", borderBottom: "1px solid var(--pu-line-soft, #edf0f5)" }}>
        <Input
          placeholder="搜索知识点..."
          prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
          value={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          allowClear
          style={{ borderRadius: 8, fontSize: 14 }}
        />
        {searchValue && (
          <div style={{ marginTop: 8, fontSize: 14, lineHeight: "22px", color: "#8c8c8c" }}>
            找到 {displayCount} 个相关知识点
          </div>
        )}
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "8px 12px 12px" }}>
        <Tree
          treeData={treeDataWithTitle}
          onSelect={handleSelect}
          selectedKeys={selectedItemId ? [selectedItemId] : []}
          expandedKeys={expandedKeys}
          onExpand={handleExpand}
          blockNode
          style={{
            background: "transparent",
          }}
          className="knowledge-tree"
        />
      </div>
    </div>
  );
}

interface LinkItemDialogProps {
  open: boolean;
  onClose: () => void;
  knowledgeResourceId: string;
  courseId: string;
  onLinkSuccess: () => void;
  initialTab: string;
}

function LinkItemDialog({
  open,
  onClose,
  knowledgeResourceId,
  courseId,
  onLinkSuccess,
  initialTab,
}: LinkItemDialogProps) {
  const { user } = useAuth();
  const currentTenant = getCurrentTenant();
  const [dialogTab, setDialogTab] = useState(initialTab);
  
  useEffect(() => {
    setDialogTab(initialTab);
  }, [initialTab, open]);

  const activeTab = open ? dialogTab : initialTab;
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [searchText, setSearchText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const [files, setFiles] = useState<FileData[]>([]);
  const [exercises, setExercises] = useState<ExerciseData[]>([]);
  const [homeworks, setHomeworks] = useState<HomeworkData[]>([]);
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [availableLinks, setAvailableLinks] = useState<LinkData[]>([]);

  const tabItems = [
    { key: "0", label: "文件" },
    { key: "1", label: "练习" },
    { key: "2", label: "作业" },
    { key: "3", label: "视频" },
    { key: "4", label: "链接" },
  ];

  const getDialogTitle = () => {
    const labels: Record<string, string> = {
      "0": "关联文件",
      "1": "关联练习",
      "2": "关联作业",
      "3": "关联视频",
      "4": "关联链接",
    };
    return labels[activeTab] || "关联资源";
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    const tenant = currentTenant?.schemaName || "";
    const headers = getAuthHeaders(user) as Record<string, string>;

    try {
      switch (activeTab) {
        case "0": {
          const filesResult = await listFiles({
            tenant,
            fields: ["id", "filename", "fileType", "size", "path", "source", "sortOrder"],
            filter: { courseId: { eq: courseId } },
            headers,
          });
          if (filesResult.success) {
            setFiles(filesResult.data || []);
          }
          break;
        }
        case "1": {
          const exercisesResult = await listExercises({
            tenant,
            fields: ["id", "title", "questionType", "aiType", "questionContent", "answer", "options", "insertedAt"],
            filter: { courseId: { eq: courseId } },
            headers,
          });
          if (exercisesResult.success) {
            const sorted = (exercisesResult.data || []).sort((a: ExerciseData, b: ExerciseData) =>
              (b.insertedAt || '').localeCompare(a.insertedAt || '')
            );
            setExercises(sorted);
          }
          break;
        }
        case "2": {
          const homeworksResult = await listHomeworks({
            tenant,
            fields: ["id", "title", "score", "content", "answer"],
            filter: { courseId: { eq: courseId } },
            headers,
          });
          if (homeworksResult.success) {
            setHomeworks(homeworksResult.data || []);
          }
          break;
        }
        case "3": {
          const chaptersResult = await listChapters({
            tenant,
            fields: ["id", "title", "courseId"],
            filter: { courseId: { eq: courseId } },
            headers,
          });

          if (chaptersResult.success && chaptersResult.data) {
            const courseChapterIds = chaptersResult.data.map(
              (chapter) => chapter.id,
            );

            const videosResult = await listVideos({
              tenant,
              fields: ["id", "title", "duration", "thumbnail", "chapterId"],
              headers,
            });

            if (videosResult.success) {
              const filteredVideos =
                courseChapterIds.length > 0
                  ? (videosResult.data || []).filter(
                      (video) =>
                        video.chapterId &&
                        courseChapterIds.includes(video.chapterId),
                    )
                  : [];

              setVideos(filteredVideos);
            }
          } else {
            setVideos([]);
          }
          break;
        }
        case "4": {
          const linksResult = await listLinks({
            tenant,
            fields: ["id", "title", "url", "category"],
            filter: { courseId: { eq: courseId } },
            headers,
          });
          if (linksResult.success) {
            setAvailableLinks(linksResult.data || []);
          }
          break;
        }
      }
    } catch (err) {
      setError("加载数据失败，请重试");
      console.error("Load data error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setCurrentPage(1);
      setSearchText("");
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeTab]);

  const handleToggleItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleLinkItems = async () => {
    setLinking(true);
    setError(null);
    const tenant = currentTenant?.schemaName || "";

    try {
      if (activeTab === "4") {
        if (selectedItems.size === 0) {
          setError("请选择要关联的链接");
          setLinking(false);
          return;
        }

        const linkPromises = Array.from(selectedItems).map((linkId) =>
          linkToKnowledge({
            tenant,
            primaryKey: linkId,
            input: { knowledgeResourceId },
            fields: ["id", "title"],
          }),
        );

        const results = await Promise.all(linkPromises);
        const failedLinks = results.filter((result) => !result.success);

        if (failedLinks.length === 0) {
          onLinkSuccess();
          handleClose();
        } else {
          setError(
            `部分链接关联失败 (${failedLinks.length}/${selectedItems.size})`,
          );
        }
      } else {
        if (selectedItems.size === 0) return;

        const linkPromises = Array.from(selectedItems).map((itemId) => {
      switch (activeTab) {
            case "0":
              return linkFileToKnowledge({
                tenant,
                primaryKey: itemId,
                input: { knowledgeResourceId },
                fields: ["id", "filename"],
              });
            case "1":
              return linkExerciseToKnowledge({
                tenant,
                primaryKey: itemId,
                input: { knowledgeResourceId },
                fields: ["id", "title"],
              });
            case "2":
              return linkHomeworkToKnowledge({
                tenant,
                primaryKey: itemId,
                input: { knowledgeResourceId },
                fields: ["id", "title"],
              });
            case "3":
              return linkVideoToKnowledge({
                tenant,
                primaryKey: itemId,
                input: { knowledgeResourceId },
                fields: ["id", "title"],
              });
            default:
              return Promise.resolve({ success: false });
          }
        });

        const results = await Promise.all(linkPromises);
        const failedLinks = results.filter((result) => !result.success);

        if (failedLinks.length === 0) {
          onLinkSuccess();
          handleClose();
        } else {
          setError(
            `部分项目链接失败 (${failedLinks.length}/${selectedItems.size})`,
          );
        }
      }
    } catch (err) {
      setError("链接失败，请重试");
      console.error("Link error:", err);
    } finally {
      setLinking(false);
    }
  };

  const handleClose = () => {
    setSelectedItems(new Set());
    setError(null);
    setCurrentPage(1);
    setSearchText("");
    onClose();
  };

  const renderTabContent = () => {
    if (loading) {
      return (
        <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
          <Spin />
        </div>
      );
    }

    if (error && !loading) {
      return <Alert type="error" message={error} style={{ margin: 16 }} />;
    }

    const dataMap: Record<string, { data: ResourceData[]; nameField: string }> = {
      "0": { data: files as ResourceData[], nameField: "filename" },
      "1": { data: exercises as ResourceData[], nameField: "title" },
      "2": { data: homeworks as ResourceData[], nameField: "title" },
      "3": { data: videos as ResourceData[], nameField: "title" },
    };

    const getFilteredData = (data: ResourceData[], nameField: string) => {
      if (!searchText) return data;
      return data.filter(item => {
        const name = item[nameField as keyof ResourceData];
        return name?.toString().toLowerCase().includes(searchText.toLowerCase());
      });
    };

    const getPaginatedData = (data: ResourceData[]) => {
      const start = (currentPage - 1) * pageSize;
      return data.slice(start, start + pageSize);
    };

    if (activeTab === "4") {
      const filteredLinks = getFilteredData(availableLinks as ResourceData[], "title");
      const paginatedLinks = getPaginatedData(filteredLinks);
      
      if (filteredLinks.length === 0) {
        return (
          <div>
            <div style={{ marginBottom: 12 }}>
              <Input.Search
                placeholder="搜索链接..."
                allowClear
                value={searchText}
                onChange={(e) => { setSearchText(e.target.value); setCurrentPage(1); }}
                style={{ width: 200 }}
              />
            </div>
            <Empty description={searchText ? "没有匹配的链接" : "本课程暂无可用链接"} style={{ padding: 32 }} />
          </div>
        );
      }

      return (
        <div>
          <div style={{ marginBottom: 12 }}>
            <Input.Search
              placeholder="搜索链接..."
              allowClear
              value={searchText}
              onChange={(e) => { setSearchText(e.target.value); setCurrentPage(1); }}
              style={{ width: 200 }}
            />
          </div>
        <List
          dataSource={paginatedLinks}
          renderItem={(link) => (
            <List.Item
              style={{ padding: "8px 0" }}
              onClick={() => handleToggleItem(link.id)}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  padding: 8,
                  border: `1px solid ${selectedItems.has(link.id) ? "#1890ff" : "#d9d9d9"}`,
                  borderRadius: 6,
                  backgroundColor: selectedItems.has(link.id)
                    ? "#e6f7ff"
                    : "transparent",
                  cursor: "pointer",
                }}
              >
                <Checkbox
                  checked={selectedItems.has(link.id)}
                  style={{ marginRight: 12 }}
                />
                <div style={{ flex: 1 }}>
                  <Text strong style={{ display: "block", marginBottom: 4 }}>
                    {link.title}
                  </Text>
                  <Text
                    type="secondary"
                    style={{ fontSize: 12, display: "block", marginBottom: 4 }}
                  >
                    {link.url}
                  </Text>
                  {link.category && <Tag>{link.category}</Tag>}
                </div>
              </div>
            </List.Item>
          )}
        />
        {filteredLinks.length > pageSize && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={filteredLinks.length}
              onChange={(page) => setCurrentPage(page)}
              showSizeChanger={false}
              simple
            />
          </div>
        )}
      </div>
      );
    }

    const currentData = dataMap[activeTab];
    const filteredData = getFilteredData(currentData.data, currentData.nameField);
    const paginatedData = getPaginatedData(filteredData);
    
    if (!currentData || filteredData.length === 0) {
      const emptyMessages: Record<string, string> = {
        "0": searchText ? "没有匹配的文件" : "没有可用的文件",
        "1": searchText ? "没有匹配的练习" : "没有可用的练习",
        "2": searchText ? "没有匹配的作业" : "没有可用的作业",
        "3": searchText ? "没有匹配的视频" : "没有可用的视频",
      };
      return (
        <div>
          <div style={{ marginBottom: 12 }}>
            <Input.Search
              placeholder={`搜索${tabItems.find(t => t.key === activeTab)?.label}...`}
              allowClear
              value={searchText}
              onChange={(e) => { setSearchText(e.target.value); setCurrentPage(1); }}
              style={{ width: 200 }}
            />
          </div>
          <Empty
            description={emptyMessages[activeTab] || "暂无数据"}
            style={{ padding: 32 }}
          />
        </div>
      );
    }

    return (
      <div>
        <div style={{ marginBottom: 12 }}>
          <Input.Search
            placeholder={`搜索${tabItems.find(t => t.key === activeTab)?.label}...`}
            allowClear
            value={searchText}
            onChange={(e) => { setSearchText(e.target.value); setCurrentPage(1); }}
            style={{ width: 200 }}
          />
        </div>
        <List
          dataSource={paginatedData}
        renderItem={(item: ResourceData) => {
          const exerciseItem = activeTab === "1" ? (item as ExerciseData) : null;
          const exercisePreview = exerciseItem ? (() => {
            const parseExerciseOptions = (): Record<string, any> | null => {
              const opt = exerciseItem.options;
              if (!opt) return null;
              
              // 如果是对象格式，检查是否是 { choices: [...], correctAnswer: x } 格式
              if (typeof opt === 'object') {
                if (opt.choices && Array.isArray(opt.choices)) {
                  const options: Record<string, string> = {};
                  opt.choices.forEach((choice: string, idx: number) => {
                    options[String(idx + 1)] = choice;
                  });
                  return options;
                }
                return opt;
              }
              
              const optStr = String(opt);
              if (typeof optStr === 'string') {
                try {
                  const parsed = JSON.parse(optStr);
                  // 检查是否是 { choices: [...], correctAnswer: x } 格式
                  if (parsed.choices && Array.isArray(parsed.choices)) {
                    const options: Record<string, string> = {};
                    parsed.choices.forEach((choice: string, idx: number) => {
                      options[String(idx + 1)] = choice;
                    });
                    return options;
                  }
                  return parsed;
                } catch {
                  // 尝试解析换行分隔的格式
                  const lines = optStr.split('\n').filter(line => line.trim());
                  if (lines.length >= 1) {
                    const options: Record<string, string> = {};
                    
                    // 过滤掉只包含答案的行（如 ". 2" 或 "2"）
                    const optionLines = lines.filter(line => {
                      const cleaned = line.replace(/^\.\s*/, '').trim();
                      // 排除只包含数字的行（答案行）
                      return !/^\d+$/.test(cleaned);
                    });
                    
                    if (optionLines.length === 0) return null;
                    
                    // 如果选项在单行中用逗号分隔
                    const firstLine = optionLines[0].replace(/^\.\s*/, '').trim();
                    if (firstLine.includes(',')) {
                      const optionList = firstLine.split(',').map((item) => {
                        return item.replace(/^[A-Z]\.\s*/gi, '').trim();
                      });
                      optionList.forEach((item, idx) => {
                        options[String(idx + 1)] = item;
                      });
                      return options;
                    }

                    // 如果选项在单行中用中文顿号分隔
                    if (firstLine.includes('、')) {
                      const optionList = firstLine.split('、').map((item) => {
                        return item.replace(/^[A-Z]\.\s*/gi, '').trim();
                      });
                      optionList.forEach((item, idx) => {
                        options[String(idx + 1)] = item;
                      });
                      return options;
                    }
                    
                    // 如果每个选项单独一行
                    optionLines.forEach((line, idx) => {
                      const cleaned = line.replace(/^\.\s*/, '').replace(/^[A-Z]\.\s*/gi, '').trim();
                      options[String(idx + 1)] = cleaned;
                    });
                    return options;
                  }
                  return null;
                }
              }
              return null;
            };

            const renderExerciseOptionsList = () => {
              const options = parseExerciseOptions();
              if (!options) return null;
              
              const optionKeys = Object.keys(options).sort();
              if (optionKeys.length === 0) return null;

              const isTrueFalse = exerciseItem.questionType === 'true_false';

              return (
                <div style={{ marginBottom: 12 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>选项:</Text>
                  <div style={{ marginTop: 4 }}>
                    {optionKeys.map((key) => {
                      const letter = String.fromCharCode(64 + parseInt(key, 10));
                      const answerStr = exerciseItem.answer || "";
                      const answerLetters = convertNumberToLetter(answerStr).toUpperCase();
                      const isCorrect = answerLetters.includes(letter);
                      const optionText = cleanOptionText(options[key]);
                      return (
                        <div 
                          key={key} 
                          style={{ 
                            fontSize: 13, 
                            padding: '4px 8px',
                            marginBottom: 4,
                            backgroundColor: isCorrect ? '#f6ffed' : '#fafafa',
                            borderRadius: 4,
                            border: isCorrect ? '1px solid #b7eb8f' : '1px solid #d9d9d9',
                          }}
                        >
                          {!isTrueFalse && <Text strong>{letter}. </Text>}
                          <Text style={isCorrect ? { color: '#52c41a' } : {}}>
                            {optionText}
                          </Text>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            };

            const renderExerciseAnswer = () => {
              if (!exerciseItem.answer) return null;
              const answerLetters = convertNumberToLetter(exerciseItem.answer);

              if (exerciseItem.questionType === 'true_false') {
                const isCorrect = answerLetters.toUpperCase() === 'A';
                const answerText = isCorrect ? '正确' : '错误';
                return (
                  <div style={{ marginBottom: 12 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>答案:</Text>
                    <div style={{ marginTop: 4, fontSize: 13, color: "#52c41a", fontWeight: 'bold' }}>
                      {answerText}
                    </div>
                  </div>
                );
              }

              const options = parseExerciseOptions();

              if (!options) {
                return (
                  <div style={{ marginBottom: 12 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>答案:</Text>
                    <div style={{ marginTop: 4, fontSize: 13, color: "#52c41a", fontWeight: 'bold' }}>
                      {answerLetters}
                    </div>
                  </div>
                );
              }

              const findOptionValue = (letter: string): string | undefined => {
                const upperLetter = letter.toUpperCase();
                const numKey = String(upperLetter.charCodeAt(0) - 64);
                return options[numKey] || options[upperLetter] || options[letter] || options[numKey.toString()];
              };

              const answerContent = answerLetters.split(/[,，\s]+/).filter(Boolean).map(letter => {
                const upperLetter = letter.toUpperCase();
                const optionText = findOptionValue(letter);
                if (optionText) {
                  const cleanedText = cleanOptionText(optionText);
                  return `${upperLetter}. ${cleanedText}`;
                }
                return upperLetter;
              }).join('，');

              return (
                <div style={{ marginBottom: 12 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>答案:</Text>
                  <div style={{ marginTop: 4, fontSize: 13, color: "#52c41a", fontWeight: 'bold' }}>
                    {answerContent}
                  </div>
                </div>
              );
            };

            return (
              <div style={{ maxWidth: 400, maxHeight: 400, overflow: "auto" }}>
                <div style={{ marginBottom: 12 }}>
                  <Text strong style={{ fontSize: 14 }}>{exerciseItem.title}</Text>
                </div>
                {exerciseItem.questionContent && (
                  <div style={{ marginBottom: 12 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>题目内容:</Text>
                    <div style={{ marginTop: 4, fontSize: 13 }}>{exerciseItem.questionContent}</div>
                  </div>
                )}
                {renderExerciseOptionsList()}
                {renderExerciseAnswer()}
                {!exerciseItem.questionContent && !exerciseItem.answer && !exerciseItem.options && (
                  <Text type="secondary">暂无预览内容</Text>
                )}
              </div>
            );
          })() : null;

          const homeworkItem = activeTab === "2" ? (item as HomeworkData) : null;
          const homeworkPreview = homeworkItem ? (
            <div style={{ maxWidth: 400, maxHeight: 300, overflow: "auto" }}>
              <div style={{ marginBottom: 12 }}>
                <Text strong style={{ fontSize: 14 }}>{homeworkItem.title}</Text>
              </div>
              {homeworkItem.content && (
                <div style={{ marginBottom: 12 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>作业内容:</Text>
                  <div style={{ marginTop: 4, fontSize: 13 }}>{homeworkItem.content}</div>
                </div>
              )}
              {homeworkItem.answer && (
                <div style={{ marginBottom: 12 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>答案:</Text>
                  <div style={{ marginTop: 4, fontSize: 13, color: "#52c41a" }}>{homeworkItem.answer}</div>
                </div>
              )}
              {!homeworkItem.content && !homeworkItem.answer && (
                <Text type="secondary">暂无预览内容</Text>
              )}
            </div>
          ) : null;

          const content = (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                width: "100%",
                padding: 8,
                border: `1px solid ${selectedItems.has(item.id) ? "#1890ff" : "#d9d9d9"}`,
                borderRadius: 6,
                backgroundColor: selectedItems.has(item.id)
                  ? "#e6f7ff"
                  : "transparent",
                cursor: "pointer",
              }}
            >
              <Checkbox
                checked={selectedItems.has(item.id)}
                style={{ marginRight: 12 }}
              />
              <div style={{ flex: 1 }}>
                <Text strong style={{ display: "block", marginBottom: 4 }}>
                  {activeTab === "0" ? (item as FileData).filename : (item as ExerciseData | HomeworkData | VideoData).title}
                </Text>
                <Space size={4}>
                  {activeTab === "0" && (
                    <>
                      <Tag>{simplifyFileType((item as FileData).filename || "", (item as FileData).fileType)}</Tag>
                      <Tag>{`${Math.round((item as FileData).size / 1024)}KB`}</Tag>
                      {(item as FileData).source === "ai_generated" && (
                        <Tag>AI生成文件</Tag>
                      )}
                    </>
                  )}
                  {activeTab === "1" && (
                    <>
                      <Tag>{QUESTION_TYPE_LABELS[(item as ExerciseData).questionType] || (item as ExerciseData).questionType}</Tag>
                      {(item as ExerciseData).aiType === "ai_generated" && (
                        <Tag color="blue">AI生成</Tag>
                      )}
                    </>
                  )}
                  {activeTab === "2" && (item as HomeworkData).score && (
                    <Tag>{`${(item as HomeworkData).score}分`}</Tag>
                  )}
                  {activeTab === "3" && (item as VideoData).duration && (
                    <Tag>{`${Math.round((item as VideoData).duration)}秒`}</Tag>
                  )}
                </Space>
              </div>
            </div>
          );

          return (
            <List.Item
              style={{ padding: "8px 0" }}
              onClick={() => handleToggleItem(item.id)}
            >
              {exercisePreview || homeworkPreview ? (
                <Popover
                  content={exercisePreview || homeworkPreview}
                  trigger="hover"
                  mouseEnterDelay={0.2}
                  placement="right"
                >
                  {content}
                </Popover>
              ) : (
                content
              )}
            </List.Item>
          );
        }}
      />
      {filteredData.length > pageSize && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          <Pagination
            current={currentPage}
            pageSize={pageSize}
            total={filteredData.length}
            onChange={(page) => setCurrentPage(page)}
            showSizeChanger={false}
            simple
          />
        </div>
      )}
      </div>
    );
  };

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      title={getDialogTitle()}
      width={720}
      footer={[
        <Button key="cancel" onClick={handleClose} disabled={linking}>
          取消
        </Button>,
        <Button
          key="link"
          type="primary"
          onClick={handleLinkItems}
          loading={linking}
          disabled={linking || selectedItems.size === 0}
          icon={<LinkOutlined />}
        >
          {linking ? "链接中..." : `关联 ${selectedItems.size} 个链接`}
        </Button>,
      ]}
    >
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setDialogTab(key)}
        items={[
          { key: "0", label: "文件" },
          { key: "1", label: "练习" },
          { key: "2", label: "作业" },
          { key: "3", label: "视频" },
          { key: "4", label: "链接" },
        ]}
      />
      <div style={{ minHeight: 400 }}>{renderTabContent()}</div>
      {selectedItems.size > 0 && (
        <div
          style={{
            padding: 12,
            backgroundColor: "#f5f5f5",
            borderRadius: 6,
            marginTop: 16,
          }}
        >
          <Text type="secondary">已选择 {selectedItems.size} 个</Text>
        </div>
      )}
    </Modal>
  );
}

export default function KnowledgeFilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentTenant = getCurrentTenant();
  const tenant = currentTenant?.schemaName || "";

  const { courses, loading: coursesLoading } = useCourses({
    fields: ["id", "title", "description"],
  });

  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [knowledgeTreeItems, setKnowledgeTreeItems] = useState<
    KnowledgeTreeItem[]
  >([]);
  const [selectedKnowledge, setSelectedKnowledge] =
    useState<KnowledgeResource | null>(null);
  const [tabValue, setTabValue] = useState("0");
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [tabSearchText, setTabSearchText] = useState<Record<string, string>>({});

  const [knowledgeTreeLoading, setKnowledgeTreeLoading] = useState(false);
  const [filesLoading, setFilesLoading] = useState(false);
  const [exercisesLoading, setExercisesLoading] = useState(false);
  const [homeworksLoading, setHomeworksLoading] = useState(false);
  const [videosLoading, setVideosLoading] = useState(false);
  const [linksLoading, setLinksLoading] = useState(false);

  const [files, setFiles] = useState<FileData[]>([]);
  const [exercises, setExercises] = useState<ExerciseData[]>([]);
  const [homeworks, setHomeworks] = useState<HomeworkData[]>([]);
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [links, setLinks] = useState<LinkData[]>([]);

  // 文件展示顺序：默认按文件名自然序；一旦手动调整过（存在有效 sortOrder），则保持手动顺序
  const displayFiles = useMemo(() => {
    if (!files || files.length === 0) return files;
    const hasManual = files.some(
      (f) => (f.sortOrder ?? 0) > 0 && (f.sortOrder ?? 0) < 2_000_000_000
    );
    if (hasManual) {
      return [...files].sort(
        (a, b) => (a.sortOrder ?? 2_000_000_000) - (b.sortOrder ?? 2_000_000_000)
      );
    }
    return [...files].sort((a, b) => naturalCompare(a.filename, b.filename));
  }, [files]);
  const [isReordering, setIsReordering] = useState(false);

  const moveFile = async (record: FileData, direction: "up" | "down") => {
    const idx = displayFiles.findIndex((f) => f.id === record.id);
    if (idx === -1) return;
    const target = direction === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= displayFiles.length) return;
    const next = [...displayFiles];
    [next[idx], next[target]] = [next[target], next[idx]];
    // 应用新顺序（写入 sortOrder，使展示进入手动模式并持久化到后端）
    setFiles(next.map((f, i) => ({ ...f, sortOrder: i + 1 })));
    setIsReordering(true);
    try {
      const result = await reorderFiles({
        tenant,
        input: { items: next.map((f, i) => ({ id: f.id, order: i + 1 })) },
        headers: getAuthHeaders(user) as Record<string, string>,
      });
      if (!result.success) message.error("排序保存失败，请重试");
    } catch (e: any) {
      message.error(e?.message || "排序保存失败，请重试");
    } finally {
      setIsReordering(false);
    }
  };

  const [error, setError] = useState<string | null>(null);

  // 当课程加载完成后，自动选择第一个课程
  useEffect(() => {
    if (courses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, selectedCourseId]);

  useEffect(() => {
    if (!selectedCourseId) return;

    const loadKnowledgeHierarchy = async () => {
      try {
        setKnowledgeTreeLoading(true);
        setError(null);

        // 使用与 knowledge-resource 相同的 API
        const response = await fetch(
          `/api/knowledge/hierarchy/nested?course_id=${selectedCourseId}&tenant=${tenant}`,
          { headers: { ...getAuthHeaders(user) as Record<string, string> } },
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch hierarchy: ${response.statusText}`);
        }

        const result = await response.json();
        const hierarchyData = (result && typeof result === "object" && Array.isArray(result.data))
          ? result.data
          : Array.isArray(result)
            ? result
            : [];

        // 先将层级数据扁平化，收集 sortPath 信息
        const flatRows: Array<{
          id: string;
          name: string;
          parentId: string | null;
          sortPath: string | null;
          path: string[];
          resource: Record<string, unknown>;
        }> = [];

        const seenIds = new Set<string>();

        const flattenHierarchy = (
          nodes: Record<string, unknown>[],
          parentPath: string[] = [],
          parentId: string | null = null,
        ): void => {
          nodes.forEach((node) => {
            if (seenIds.has(node.id as string)) return;
            seenIds.add(node.id as string);

            const currentPath = [...parentPath, node.name as string];
            flatRows.push({
              id: node.id as string,
              name: node.name as string,
              parentId,
              sortPath: (node.sortPath as string) || null,
              path: currentPath,
              resource: node,
            });

            const childArrays = [
              node.childUnits,
              node.directCells,
              node.subjectCells,
              node.childCells,
              node.nestedChildCells,
            ];
            childArrays.forEach((children) => {
              if (Array.isArray(children)) {
                flattenHierarchy(
                  children as Record<string, unknown>[],
                  currentPath,
                  node.id as string,
                );
              }
            });
          });
        };

        flattenHierarchy(hierarchyData);

        // 按层级和 sortPath 排序
        flatRows.sort((a, b) => {
          // 首先按照层级排序
          if (a.path.length !== b.path.length) return a.path.length - b.path.length;
          // 同层级情况下，按照 sortPath 排序
          const sortPathA = a.sortPath || "";
          const sortPathB = b.sortPath || "";
          return sortPathA.localeCompare(sortPathB, undefined, { numeric: true });
        });

        // 构建树结构
        const nodeMap = new Map<string, KnowledgeTreeItem>();
        const roots: KnowledgeTreeItem[] = [];

        flatRows.forEach((row) => {
          nodeMap.set(row.id, {
            id: row.id,
            key: row.id,
            title: row.name,
            label: row.name,
            knowledgeData: row.resource,
            children: [],
          });
        });

        flatRows.forEach((row) => {
          const node = nodeMap.get(row.id)!;
          if (row.parentId && nodeMap.has(row.parentId)) {
            const parent = nodeMap.get(row.parentId)!;
            if (!parent.children) parent.children = [];
            parent.children.push(node);
          } else {
            roots.push(node);
          }
        });

        // 清理空的 children 数组
        const cleanEmptyChildren = (nodes: KnowledgeTreeItem[]) => {
          nodes.forEach((node) => {
            if (node.children && node.children.length === 0) {
              delete node.children;
            } else if (node.children) {
              cleanEmptyChildren(node.children);
            }
          });
        };

        cleanEmptyChildren(roots);

        setKnowledgeTreeItems(roots);
      } catch (err) {
        setError("加载知识层级时出错");
        console.error("Error loading knowledge hierarchy:", err);
      } finally {
        setKnowledgeTreeLoading(false);
      }
    };

    loadKnowledgeHierarchy();
  }, [selectedCourseId, tenant, user]);

  const loadKnowledgeRelatedData = useCallback(
    async (knowledgeId: string) => {
      if (!knowledgeId) return;

      setFiles([]);
      setExercises([]);
      setHomeworks([]);
      setVideos([]);
      setLinks([]);

      setFilesLoading(true);
      try {
        const filesResult = await listFiles({
          tenant,
          fields: ["id", "filename", "fileType", "size", "purpose", "source", "sortOrder"],
          filter: { knowledgeResourceId: { eq: knowledgeId } },
        });
        if (filesResult.success) {
          setFiles(filesResult.data);
        }
      } catch (err) {
        console.error("Error loading files:", err);
      } finally {
        setFilesLoading(false);
      }

      setExercisesLoading(true);
      try {
        const exercisesResult = await listExercises({
          tenant,
          fields: ["id", "title", "questionType", "aiType", "questionContent", "answer", "options", "insertedAt"],
          filter: { knowledgeResourceId: { eq: knowledgeId } },
        });
        if (exercisesResult.success) {
          const sorted = (exercisesResult.data || []).sort((a: ExerciseData, b: ExerciseData) =>
            (b.insertedAt || '').localeCompare(a.insertedAt || '')
          );
          setExercises(sorted);
        }
      } catch (err) {
        console.error("Error loading exercises:", err);
      } finally {
        setExercisesLoading(false);
      }

      setHomeworksLoading(true);
      try {
        const homeworksResult = await listHomeworks({
          tenant,
          fields: ["id", "title", "score", "content", "answer"],
          filter: { knowledgeResourceId: { eq: knowledgeId } },
        });
        if (homeworksResult.success) {
          setHomeworks(homeworksResult.data);
        }
      } catch (err) {
        console.error("Error loading homeworks:", err);
      } finally {
        setHomeworksLoading(false);
      }

      setVideosLoading(true);
      try {
        const videosResult = await listVideos({
          tenant,
          fields: ["id", "title", "duration", "thumbnail"],
          filter: { knowledgeResourceId: { eq: knowledgeId } },
        });
        if (videosResult.success) {
          setVideos(videosResult.data);
        }
      } catch (err) {
        console.error("Error loading videos:", err);
      } finally {
        setVideosLoading(false);
      }

      setLinksLoading(true);
      try {
        const linksResult = await listLinks({
          tenant,
          fields: ["id", "title", "url", "category"],
          filter: { knowledgeResourceId: { eq: knowledgeId } },
        });
        if (linksResult.success) {
          setLinks(linksResult.data || []);
        }
      } catch (err) {
        console.error("Error loading links:", err);
      } finally {
        setLinksLoading(false);
      }
    },
    [tenant],
  );

  const handleKnowledgeSelect = useCallback(
    (resource: KnowledgeResource) => {
      setSelectedKnowledge(resource);
      setTabValue("0");
      loadKnowledgeRelatedData(resource.id);
    },
    [loadKnowledgeRelatedData],
  );

  const handleCourseChange = (value: string) => {
    setSelectedCourseId(value);
    setSelectedKnowledge(null);
    setKnowledgeTreeItems([]);
    setFiles([]);
    setExercises([]);
    setHomeworks([]);
    setVideos([]);
    setLinks([]);
  };

  const handleLinkSuccess = () => {
    if (selectedKnowledge) {
      loadKnowledgeRelatedData(selectedKnowledge.id);
    }
  };

  const handleUnlinkFile = async (fileId: string) => {
    if (!selectedKnowledge) return;

    try {
      const result = await unlinkFileFromKnowledge({
        tenant,
        primaryKey: fileId,
        fields: ["id"],
      });

      if (result.success) {
        message.success("取消链接成功");
        loadKnowledgeRelatedData(selectedKnowledge.id);
      } else {
        message.error("取消链接失败");
        console.error("Failed to unlink file:", result.errors);
      }
    } catch (err) {
      message.error("取消链接失败");
      console.error("Error unlinking file:", err);
    }
  };

  const handleUnlinkExercise = async (exerciseId: string) => {
    if (!selectedKnowledge) return;

    try {
      const result = await unlinkExerciseFromKnowledge({
        tenant,
        primaryKey: exerciseId,
        fields: ["id"],
      });

      if (result.success) {
        message.success("取消链接成功");
        loadKnowledgeRelatedData(selectedKnowledge.id);
      } else {
        message.error("取消链接失败");
        console.error("Failed to unlink exercise:", result.errors);
      }
    } catch (err) {
      message.error("取消链接失败");
      console.error("Error unlinking exercise:", err);
    }
  };

  const handleUnlinkHomework = async (homeworkId: string) => {
    if (!selectedKnowledge) return;

    try {
      const result = await unlinkHomeworkFromKnowledge({
        tenant,
        primaryKey: homeworkId,
        fields: ["id"],
      });

      if (result.success) {
        message.success("取消链接成功");
        loadKnowledgeRelatedData(selectedKnowledge.id);
      } else {
        message.error("取消链接失败");
        console.error("Failed to unlink homework:", result.errors);
      }
    } catch (err) {
      message.error("取消链接失败");
      console.error("Error unlinking homework:", err);
    }
  };

  const handleUnlinkVideo = async (videoId: string) => {
    if (!selectedKnowledge) return;

    try {
      const result = await unlinkVideoFromKnowledge({
        tenant,
        primaryKey: videoId,
        fields: ["id"],
      });

      if (result.success) {
        message.success("取消链接成功");
        loadKnowledgeRelatedData(selectedKnowledge.id);
      } else {
        message.error("取消链接失败");
        console.error("Failed to unlink video:", result.errors);
      }
    } catch (err) {
      message.error("取消链接失败");
      console.error("Error unlinking video:", err);
    }
  };

  const handleUnlinkLink = async (linkId: string) => {
    if (!selectedKnowledge) return;

    try {
      const result = await unlinkFromKnowledge({
        tenant,
        primaryKey: linkId,
        fields: ["id"],
      });

      if (result.success) {
        message.success("取消链接成功");
        loadKnowledgeRelatedData(selectedKnowledge.id);
      } else {
        message.error("取消链接失败");
        console.error("Failed to unlink link:", result.errors);
      }
    } catch (err) {
      message.error("取消链接失败");
      console.error("Error unlinking link:", err);
    }
  };

  // 计算资源统计
  const resourceStats = useMemo(() => {
    return {
      files: files.length,
      exercises: exercises.length,
      homeworks: homeworks.length,
      videos: videos.length,
      links: links.length,
      total: files.length + exercises.length + homeworks.length + videos.length + links.length,
    };
  }, [files, exercises, homeworks, videos, links]);

  const tabItems = [
    {
      key: "0",
      label: (
        <span>
          <FolderOutlined />
          <span style={{ marginLeft: 4 }}>文件</span>
        </span>
      ),
      children: (
        <>
          <div className="pu-filters" style={{ marginBottom: 12 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setTabValue("0"); setLinkDialogOpen(true); }}>
              关联文件
            </Button>
            <Input
              className="pu-search"
              placeholder="搜索文件..."
              prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
              allowClear
              value={tabSearchText["0"] || ""}
              onChange={(e) => setTabSearchText(prev => ({ ...prev, "0": e.target.value }))}
            />
          </div>
          <FilesTable
            files={displayFiles}
            loading={filesLoading}
            onUnlink={handleUnlinkFile}
            searchText={tabSearchText["0"]}
            onSearchChange={(text) => setTabSearchText(prev => ({ ...prev, "0": text }))}
            onMove={moveFile}
            reordering={isReordering}
          />
        </>
      ),
    },
    {
      key: "1",
      label: (
        <span>
          <FormOutlined />
          <span style={{ marginLeft: 4 }}>练习</span>
        </span>
      ),
      children: (
        <>
          <div className="pu-filters" style={{ marginBottom: 12 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setTabValue("1"); setLinkDialogOpen(true); }}>
              关联练习
            </Button>
            <Input
              className="pu-search"
              placeholder="搜索练习..."
              prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
              allowClear
              value={tabSearchText["1"] || ""}
              onChange={(e) => setTabSearchText(prev => ({ ...prev, "1": e.target.value }))}
            />
          </div>
          <ExercisesTable
            exercises={exercises}
            loading={exercisesLoading}
            onUnlink={handleUnlinkExercise}
            searchText={tabSearchText["1"]}
            onSearchChange={(text) => setTabSearchText(prev => ({ ...prev, "1": text }))}
          />
        </>
      ),
    },
    {
      key: "2",
      label: (
        <span>
          <FileTextOutlined />
          <span style={{ marginLeft: 4 }}>作业</span>
        </span>
      ),
      children: (
        <>
          <div className="pu-filters" style={{ marginBottom: 12 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setTabValue("2"); setLinkDialogOpen(true); }}>
              关联作业
            </Button>
            <Input
              className="pu-search"
              placeholder="搜索作业..."
              prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
              allowClear
              value={tabSearchText["2"] || ""}
              onChange={(e) => setTabSearchText(prev => ({ ...prev, "2": e.target.value }))}
            />
          </div>
          <HomeworksTable
            homeworks={homeworks}
            loading={homeworksLoading}
            onUnlink={handleUnlinkHomework}
            searchText={tabSearchText["2"]}
            onSearchChange={(text) => setTabSearchText(prev => ({ ...prev, "2": text }))}
          />
        </>
      ),
    },
    {
      key: "3",
      label: (
        <span>
          <VideoCameraOutlined />
          <span style={{ marginLeft: 4 }}>视频</span>
        </span>
      ),
      children: (
        <>
          <div className="pu-filters" style={{ marginBottom: 12 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setTabValue("3"); setLinkDialogOpen(true); }}>
              关联视频
            </Button>
            <Input
              className="pu-search"
              placeholder="搜索视频..."
              prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
              allowClear
              value={tabSearchText["3"] || ""}
              onChange={(e) => setTabSearchText(prev => ({ ...prev, "3": e.target.value }))}
            />
          </div>
          <VideosTable
            videos={videos}
            loading={videosLoading}
            onUnlink={handleUnlinkVideo}
            searchText={tabSearchText["3"]}
            onSearchChange={(text) => setTabSearchText(prev => ({ ...prev, "3": text }))}
          />
        </>
      ),
    },
    {
      key: "4",
      label: (
        <span>
          <LinkOutlined />
          <span style={{ marginLeft: 4 }}>链接</span>
        </span>
      ),
      children: (
        <>
          <div className="pu-filters" style={{ marginBottom: 12 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setTabValue("4"); setLinkDialogOpen(true); }}>
              关联链接
            </Button>
            <Input
              className="pu-search"
              placeholder="搜索链接..."
              prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
              allowClear
              value={tabSearchText["4"] || ""}
              onChange={(e) => setTabSearchText(prev => ({ ...prev, "4": e.target.value }))}
            />
          </div>
          <LinksTable
            links={links}
            loading={linksLoading}
            onUnlink={handleUnlinkLink}
            searchText={tabSearchText["4"]}
            onSearchChange={(text) => setTabSearchText(prev => ({ ...prev, "4": text }))}
          />
        </>
      ),
    },
  ];

  return (
    <AppPage
      fill
      className="knowledge-file-page"
      title="知识资源管理"
      description="为知识点关联文件、练习、作业、视频与链接"
      breadcrumb={<>智慧课程&nbsp;&nbsp;/&nbsp;&nbsp;知识点课程资源</>}
    >
      <style>{`
        .knowledge-file-page { height: calc(100vh - 60px); }
        .knowledge-tree .ant-tree-treenode {
          align-items: center;
          width: 100%;
          padding: 1px 0;
        }
        .knowledge-tree .ant-tree-switcher {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          align-self: center;
          line-height: 1;
        }
        .knowledge-tree .ant-tree-switcher .ant-tree-switcher-icon {
          font-size: 12px;
        }
        .knowledge-tree .ant-tree-node-content-wrapper {
          display: inline-flex;
          align-items: center;
          padding: 3px 6px;
          border-radius: 8px;
        }
        .knowledge-tree .ant-tree-title {
          display: inline-flex;
          align-items: center;
        }
        @media(max-width:768px){
          .knowledge-file-page { height: auto; }
          .kf-page-wrap{height:auto!important}
          .kf-page-wrap .kf-body{flex-direction:column!important;padding:0!important}
          .kf-page-wrap .kf-sidebar{width:100%!important;min-width:100%!important;height:auto!important;max-height:320px!important}
        }
      `}</style>
      <div className="kf-page-wrap" style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
      }}>
        <div className="pu-filters">
          <SwitchButton
            title="切换当前课程"
            buttonLabel="切换课程"
            options={courses.map((course) => ({ id: course.id, label: course.title }))}
            value={selectedCourseId}
            onChange={(id) => handleCourseChange(id)}
            loading={coursesLoading}
          />
        </div>

      <div className="kf-body" style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden", gap: 16 }}>
        {/* 左侧知识树 */}
        <div className="kf-sidebar"
          style={{
            width: 400,
            minWidth: 400,
            height: "100%",
            background: "#ffffff",
            borderRadius: 14,
            border: "1px solid var(--pu-line, #e3e9f1)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{
            padding: "10px 16px",
            borderBottom: "1px solid var(--pu-line, #e3e9f1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: 48,
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <BookOutlined style={{ color: "#0056D2", fontSize: 16 }} />
              <Text strong style={{ fontSize: 16, lineHeight: "24px", marginLeft: 8 }}>知识层级</Text>
            </div>
            {selectedCourseId && (
              <Tag color="#0056D2" style={{ borderRadius: 12, margin: 0, fontSize: 13, lineHeight: "20px", paddingInline: 8 }}>
                {courses.find((c) => c.id === selectedCourseId)?.title?.slice(0, 8) || "已选课程"}
              </Tag>
            )}
          </div>

          <div style={{ flex: 1, overflow: "hidden" }}>
            {coursesLoading ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  height: "100%",
                  gap: 16
                }}
              >
                <Spin size="large" />
                <Text type="secondary" style={{ fontSize: 15 }}>加载课程中...</Text>
              </div>
            ) : knowledgeTreeLoading ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  height: "100%",
                  gap: 12
                }}
              >
                <Spin size="small" />
                <Text type="secondary" style={{ fontSize: 15 }}>正在加载知识树...</Text>
              </div>
            ) : error ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  height: "100%",
                  padding: 24
                }}
              >
                <Alert type="error" message={error} showIcon />
              </div>
            ) : knowledgeTreeItems.length > 0 ? (
              <KnowledgeTreeView
                items={knowledgeTreeItems}
                onNodeSelect={handleKnowledgeSelect}
                selectedItemId={selectedKnowledge?.id}
              />
            ) : selectedCourseId ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  height: "100%",
                  padding: 24
                }}
              >
                <Empty
                  description="该课程暂无知识点数据"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  height: "100%",
                  padding: 24
                }}
              >
                <Empty
                  description="请先选择课程"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              </div>
            )}
          </div>
        </div>

        {/* 右侧详情区域 */}
        <div style={{ flex: 1, overflow: "hidden", height: "100%" }}>
          {selectedKnowledge ? (
            <div
              style={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                background: "#ffffff",
                borderRadius: 14,
                border: "1px solid var(--pu-line, #e3e9f1)",
                overflow: "hidden",
              }}
            >
              {/* 知识点头部信息 */}
              <div style={{
                padding: "10px 16px",
                borderBottom: "1px solid var(--pu-line, #e3e9f1)",
                minHeight: 48,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <Text strong style={{ fontSize: 16, lineHeight: "24px" }}>{selectedKnowledge.name}</Text>
              </div>

              {/* Tabs 内容区域 */}
              <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
                <Tabs
                  activeKey={tabValue}
                  onChange={setTabValue}
                  items={tabItems}
                  style={{ padding: "0 16px" }}
                />
              </div>
            </div>
          ) : (
            <div
              style={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                background: "#ffffff",
                borderRadius: 14,
                border: "1px solid var(--pu-line, #e3e9f1)",
                gap: 16
              }}
            >
              <div style={{
                width: 76,
                height: 76,
                borderRadius: "50%",
                background: "var(--pu-blue-soft, #edf2ff)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <BookOutlined style={{ fontSize: 34, color: "#93a7d6" }} />
              </div>
              <Text type="secondary" style={{ fontSize: 16, lineHeight: "26px" }}>
                {selectedCourseId
                  ? "请从左侧选择知识点查看关联资源"
                  : "请先选择课程"}
              </Text>
            </div>
          )}
        </div>
      </div>

      <LinkItemDialog
        open={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
        knowledgeResourceId={selectedKnowledge?.id || ""}
        courseId={selectedCourseId}
        onLinkSuccess={handleLinkSuccess}
        initialTab={tabValue}
      />
      </div>
    </AppPage>
  );
}

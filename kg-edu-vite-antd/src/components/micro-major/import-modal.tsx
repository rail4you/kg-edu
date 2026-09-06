import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Typography,
  message,
} from "antd";
import type { TableColumnsType } from "antd";
import { SearchOutlined, ImportOutlined } from "@ant-design/icons";

interface ImportModalProps {
  open: boolean;
  onCancel: () => void;
  onImport: (selectedIds: string[]) => Promise<any>;
  tenant: string;
  headers: Record<string, string>;
  title: string;
  /** Type of content to import: "videos" | "exercises" | "resources" */
  importType: "videos" | "exercises" | "resources";
  /** Target micro major course ID */
  targetCourseId: string;
}

interface SourceItem {
  id: string;
  title?: string;
  filename?: string;
  chapterTitle?: string;
  duration?: number;
  fileType?: string;
  size?: number;
  questionType?: string;
}

const IMPORT_CONFIG = {
  videos: {
    listAction: "get_videos_by_course_ids",
    labelField: "title",
    columns: [
      { title: "视频标题", dataIndex: "title", key: "title", ellipsis: true },
      {
        title: "时长",
        dataIndex: "duration",
        key: "duration",
        width: 80,
        render: (v: number) =>
          v ? `${Math.floor(v / 60)}:${Math.floor(v % 60).toString().padStart(2, "0")}` : "-",
      },
      { title: "所属章节", dataIndex: "chapterTitle", key: "chapterTitle" },
    ],
    fields: ["id", "title", "duration", "chapterId"],
  },
  exercises: {
    listAction: "list_exercises",
    labelField: "title",
    columns: [
      { title: "习题标题", dataIndex: "title", key: "title", ellipsis: true },
      {
        title: "题型",
        dataIndex: "questionType",
        key: "questionType",
        width: 100,
        render: (v: string) => {
          const labels: Record<string, string> = {
            multiple_choice: "单选题",
            multiple_response: "多选题",
            true_false: "判断题",
            fill_in_blank: "填空题",
            essay: "问答题",
            term_definition: "名词解释",
            case_study: "案例分析",
          };
          return labels[v] || v;
        },
      },
    ],
    fields: ["id", "title", "questionType"],
  },
  resources: {
    listAction: "list_files",
    labelField: "filename",
    columns: [
      { title: "文件名", dataIndex: "filename", key: "filename" },
      {
        title: "大小",
        dataIndex: "size",
        key: "size",
        width: 100,
        render: (v: number) => {
          if (!v) return "-";
          if (v < 1024) return `${v} B`;
          if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
          return `${(v / (1024 * 1024)).toFixed(1)} MB`;
        },
      },
    ],
    fields: ["id", "filename", "fileType", "size"],
  },
};

export default function ImportModal({
  open,
  onCancel,
  onImport,
  tenant,
  headers,
  title,
  importType,
  targetCourseId,
}: ImportModalProps) {
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [searchText, setSearchText] = useState("");
  const [importing, setImporting] = useState(false);

  const config = IMPORT_CONFIG[importType];

  // Fetch available smart courses
  const { data: coursesData } = useQuery({
    queryKey: ["import-courses", tenant],
    queryFn: async () => {
      const resp = await fetch(`/rpc/run?tenant=${tenant}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          action: "get_all_courses",
          fields: ["id", "title"],
        }),
      });
      const result = await resp.json();
      if (!result.success) return [];
      const data = result.data;
      if (Array.isArray(data)) return data;
      return data?.results || [];
    },
    enabled: !!tenant,
  });

  const courses: any[] = (coursesData as any[]) || [];

  // Fetch items from selected course
  const { data: itemsData, isLoading: itemsLoading } = useQuery({
    queryKey: ["import-items", importType, selectedCourseId],
    queryFn: async () => {
      const body: any = {
        action: config.listAction,
        fields: config.fields,
      };
      if (importType === "videos") {
        body.input = { courseIds: [selectedCourseId] };
      } else {
        // exercises and files use filter-based read actions
        body.filter = { courseId: { eq: selectedCourseId } };
      }
      const resp = await fetch(`/rpc/run?tenant=${tenant}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
      });
      const result = await resp.json();
      if (!result.success) return [];
      const data = result.data;
      if (Array.isArray(data)) return data;
      return data?.results || [];
    },
    enabled: !!selectedCourseId && !!tenant,
  });

  const items: SourceItem[] = ((itemsData as SourceItem[]) || []).filter((item) => {
    if (!searchText) return true;
    const text = searchText.toLowerCase();
    const label = (item.title || item.filename || "").toLowerCase();
    return label.includes(text);
  });

  const handleImport = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning("请至少选择一项");
      return;
    }
    setImporting(true);
    try {
      await onImport(selectedRowKeys);
      message.success(`成功导入 ${selectedRowKeys.length} 项`);
      setSelectedRowKeys([]);
      onCancel();
    } catch (e) {
      message.error("导入失败");
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setSelectedCourseId(null);
    setSelectedRowKeys([]);
    setSearchText("");
    onCancel();
  };

  const columns: TableColumnsType<SourceItem> = [
    ...config.columns,
  ];

  return (
    <Modal
      title={title}
      open={open}
      onCancel={handleClose}
      width={720}
      footer={[
        <Button key="cancel" onClick={handleClose}>
          取消
        </Button>,
        <Button
          key="import"
          type="primary"
          icon={<ImportOutlined />}
          loading={importing}
          disabled={selectedRowKeys.length === 0}
          onClick={handleImport}
        >
          确认导入 ({selectedRowKeys.length} 项)
        </Button>,
      ]}
    >
      <Space direction="vertical" style={{ width: "100%" }} size="middle">
        <div>
          <Typography.Text strong style={{ marginRight: 8 }}>
            选择智慧课程:
          </Typography.Text>
          <Select
            placeholder="请选择课程"
            style={{ width: "100%", maxWidth: 400 }}
            value={selectedCourseId}
            onChange={(v) => {
              setSelectedCourseId(v);
              setSelectedRowKeys([]);
            }}
            showSearch
            optionFilterProp="children"
          >
            {courses.map((c: any) => (
              <Select.Option key={c.id} value={c.id}>
                {c.title}
              </Select.Option>
            ))}
          </Select>
        </div>

        {selectedCourseId && (
          <>
            <Input
              prefix={<SearchOutlined />}
              placeholder="搜索..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
            <Table
              columns={columns}
              dataSource={items}
              rowKey="id"
              loading={itemsLoading}
              size="small"
              pagination={items.length > 20 ? { pageSize: 20 } : false}
              rowSelection={{
                type: "checkbox",
                selectedRowKeys,
                onChange: (keys) => setSelectedRowKeys(keys as string[]),
              }}
              scroll={{ y: 360 }}
            />
          </>
        )}
      </Space>
    </Modal>
  );
}

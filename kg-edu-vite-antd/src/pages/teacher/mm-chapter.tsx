import React, { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Empty,
  Form,
  Grid,
  Input,
  message,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  Alert,
  Upload,
  Select,
  InputNumber,
} from "antd";
import type { TableColumnsType, UploadProps } from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  FolderOutlined,
  DownloadOutlined,
  UploadOutlined,
  HolderOutlined,
  ArrowLeftOutlined
} from "@ant-design/icons";
import * as XLSX from "xlsx";

// Auto-generated RPC functions
import {
  createMmChapter,
  updateMmChapter,
  deleteMmChapter,
  listMmChaptersByCourse,
  getMmCourseFullHierarchy,
} from "@/lib/ash_rpc";
import { extractArrayData } from "@/utils/api-helpers";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";

interface MMChapterManagerProps {
  tenant: string;
  courseId: string;
  headers: Record<string, string>;
}

interface ChapterRow {
  id: string;
  microMajorCourseId: string;
  title: string;
  description?: string | null;
  parentChapterId?: string | null;
  path?: string | null;
  sortOrder?: number | null;
  subchapters?: ChapterRow[];
}

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// 根据 path 生成显示编号
const generateChapterNumber = (path: string | null): string => {
  if (!path) return "";
  const numbers: string[] = [];
  for (let i = path.length; i >= 4; i -= 4) {
    const segment = path.slice(Math.max(0, i - 4), i);
    let num: string;
    if (path.length === 4) {
      num = segment.charAt(2);
    } else {
      num = segment.slice(-1);
    }
    if (num && num !== "0") {
      numbers.unshift(num);
    }
  }
  return numbers.join(".");
};

// 扁平化章节树
function flattenChapters(
  chapters: ChapterRow[],
  level = 0
): (ChapterRow & { level: number })[] {
  const result: (ChapterRow & { level: number })[] = [];
  chapters.forEach((chapter) => {
    const children = chapter.subchapters || [];
    result.push({ ...chapter, level });
    if (children.length > 0) {
      result.push(...flattenChapters(children, level + 1));
    }
  });
  return result;
}

// 递归排序章节树
function sortChapterTree(chapters: ChapterRow[]): void {
  chapters.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  chapters.forEach((item) => {
    if (item.subchapters && item.subchapters.length > 0) {
      sortChapterTree(item.subchapters);
    }
  });
}

export default function MMChapterManager({ tenant, courseId, headers }: MMChapterManagerProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const bp = Grid.useBreakpoint();
  const isMobile = !bp.md;
  const { canEdit } = useEditPermission();

  // Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingChapter, setEditingChapter] = useState<ChapterRow | null>(null);
  const [parentChapterId, setParentChapterId] = useState<string | undefined>(undefined);
  const [form] = Form.useForm();

  // Import modal state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
    errors?: string[];
  } | null>(null);

  // Fetch chapters — use hierarchy for tree view
  const {
    data: chaptersData = [],
    isLoading,
    error: chaptersError,
  } = useQuery({
    queryKey: ["mm-chapters", courseId],
    queryFn: async () => {
      if (!courseId) return [];
      const result = await getMmCourseFullHierarchy({
        tenant,
        input: { microMajorCourseId: courseId },
        fields: [
          "id",
          "title",
          "description",
          "sortOrder",
          "path",
          "parentChapterId",
          "microMajorCourseId",
          {
            subchapters: [
              "id",
              "title",
              "description",
              "sortOrder",
              "path",
              "parentChapterId",
              "microMajorCourseId",
              {
                subchapters: [
                  "id",
                  "title",
                  "description",
                  "sortOrder",
                  "path",
                  "parentChapterId",
                  "microMajorCourseId",
                ],
              },
            ],
          },
        ],
        headers,
      });
      if (result.success && result.data) {
        // getMmCourseFullHierarchy already returns nested tree data
        const chapters = extractArrayData(result) as ChapterRow[];
        sortChapterTree(chapters);
        return chapters;
      }
      throw new Error("加载章节失败");
    },
    enabled: !!tenant && !!courseId,
  });

  // Flat chapters for parent selector
  const flatChapters = useMemo(() => flattenChapters(chaptersData), [chaptersData]);

  // Create chapter
  const createMutation = useMutation({
    mutationFn: async (values: {
      title: string;
      description?: string;
      parentChapterId?: string | null;
      sortOrder?: number;
    }) => {
      const result = await createMmChapter({
        tenant,
        input: {
          microMajorCourseId: courseId,
          title: values.title,
          description: values.description || null,
          parentChapterId: values.parentChapterId || null,
          sortOrder: values.sortOrder ?? 0,
        },
        fields: ["id", "title"],
        headers,
      });
      if (!result.success) throw new Error("创建章节失败");
      return result.data;
    },
    onSuccess: () => {
      message.success("章节创建成功");
      setCreateModalOpen(false);
      setParentChapterId(undefined);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ["mm-chapters"] });
    },
    onError: () => message.error("创建章节失败"),
  });

  // Update chapter
  const updateMutation = useMutation({
    mutationFn: async (values: { id: string; title: string; description?: string; sortOrder?: number }) => {
      const result = await updateMmChapter({
        tenant,
        primaryKey: values.id,
        input: {
          title: values.title,
          description: values.description || null,
          sortOrder: values.sortOrder ?? 0,
        },
        fields: ["id", "title"],
        headers,
      });
      if (!result.success) throw new Error("更新章节失败");
      return result.data;
    },
    onSuccess: () => {
      message.success("更新成功");
      setEditModalOpen(false);
      setEditingChapter(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ["mm-chapters"] });
    },
    onError: () => message.error("更新失败"),
  });

  // Delete chapter
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteMmChapter({
        tenant,
        primaryKey: id,
        headers,
      });
      if (!result.success) throw new Error("删除章节失败");
      return result.data;
    },
    onSuccess: () => {
      message.success("删除成功");
      queryClient.invalidateQueries({ queryKey: ["mm-chapters"] });
    },
    onError: () => message.error("删除失败"),
  });

  // ---- Handlers ----

  const handleAddClick = (parentChapter?: ChapterRow) => {
    setEditingChapter(null);
    setParentChapterId(parentChapter?.id);
    form.setFieldsValue({
      title: "",
      description: "",
      sortOrder: 0,
    });
    setCreateModalOpen(true);
  };

  const handleEditClick = (chapter: ChapterRow) => {
    setEditingChapter(chapter);
    form.setFieldsValue({
      title: chapter.title,
      description: chapter.description || "",
      sortOrder: chapter.sortOrder || 0,
    });
    setEditModalOpen(true);
  };

  const handleFormCreate = (values: any) => {
    createMutation.mutate({
      ...values,
      parentChapterId: parentChapterId || null,
    });
  };

  const handleFormEdit = (values: any) => {
    if (!editingChapter) return;
    updateMutation.mutate({ ...values, id: editingChapter.id });
  };

  // ---- Import chapter logic ----

  // Parse Excel file
  const parseChapterFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          const chapters: any[] = [];
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i] as string[];
            // 跳过全空行
            const hasAny = row.some((v: string) => v && v.trim());
            if (!hasAny) continue;
            chapters.push({
              level1: (row[0] || "").trim(),
              level2: (row[1] || "").trim(),
              level3: (row[2] || "").trim(),
              level4: (row[3] || "").trim(),
              level5: (row[4] || "").trim(),
              description: (row[5] || "").trim(),
            });
          }
          resolve(chapters);
        } catch (error) {
          reject(new Error("文件解析失败: " + (error instanceof Error ? error.message : "未知错误")));
        }
      };
      reader.onerror = () => reject(new Error("文件读取失败"));
      reader.readAsArrayBuffer(file);
    });
  };

  // Download template (generate XLSX client-side) — one chapter per row format
  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    // 每个章节/子章节只占用一行，层级由填充的列决定
    const wsData = [
      ["一级章节", "二级章节", "三级章节", "四级章节", "五级章节", "章节说明"],
      ["第一章 概述", null, "", "", "", "本章介绍课程目标和学习内容"],
      ["", "1.1 第一节", "", "", "", ""],
      ["", "1.2 第二节", "", "", "", ""],
      ["", "", "1.2.1 小节", "", "", ""],
      ["第二章 实战", null, "", "", "", "本章聚焦实战案例"],
      ["", "2.1 案例一", "", "", "", ""],
      ["", "2.2 案例二", "", "", "", ""],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = [{ wch: 24 }, { wch: 24 }, { wch: 24 }, { wch: 16 }, { wch: 16 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws, "章节模板");
    XLSX.writeFile(wb, "chapter_import_template.xlsx");
    message.success("模板已下载");
  };

  // Handle file selection
  const handleFileSelect: UploadProps["beforeUpload"] = async (file) => {
    setSelectedFile(file);
    setImportResult(null);
    try {
      const data = await parseChapterFile(file);
      setPreviewData(data);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "文件解析失败");
    }
    return false;
  };

  // Submit import — batch create chapters via API directly
  // 按 Excel 行顺序从上到下逐行导入，每个章节/子章节占一行
  const handleImport = async () => {
    if (!courseId) {
      message.error("请先选择课程");
      return;
    }
    if (previewData.length === 0) {
      message.error("没有可导入的章节数据");
      return;
    }

    setImporting(true);
    setImportResult(null);
    const errors: string[] = [];
    let imported = 0;

    try {
      // 章节栈：记录最近创建的各级父章节，用于确定当前行的父章节
      // 每当创建新章节时，弹出同层级或更深层的旧章节（因为新章节会成为新的同级节点）
      const chapterStack: { level: number; id: string }[] = [];
      // 递增的 sortOrder，保证导入的章节按 Excel 行顺序显示
      let nextSortOrder = 0;

      for (const row of previewData) {
        const levels = [
          { idx: 1, title: row.level1 },
          { idx: 2, title: row.level2 },
          { idx: 3, title: row.level3 },
          { idx: 4, title: row.level4 },
          { idx: 5, title: row.level5 },
        ];
        const desc = row.description || null;

        // 从一级到五级，找到当前行第一个非空标题
        for (const level of levels) {
          const t = level.title;
          if (!t) continue;

          // 弹出栈中层级 >= 当前层级的旧章节
          // （例如从二级回到一级时，清空二级及更深层的记录）
          while (chapterStack.length > 0 && chapterStack[chapterStack.length - 1].level >= level.idx) {
            chapterStack.pop();
          }

          // 栈顶就是当前章节的父章节
          const parentId = chapterStack.length > 0 ? chapterStack[chapterStack.length - 1].id : null;

          // 创建章节（含递增的 sortOrder 以保证显示顺序）
          const result = await createMmChapter({
            tenant,
            input: {
              microMajorCourseId: courseId,
              title: t,
              description: desc,
              parentChapterId: parentId,
              sortOrder: nextSortOrder++,
            },
            fields: ["id"],
            headers,
          });

          if (result.success && result.data) {
            const newId = ((result.data as any)?.id || "") as string;
            chapterStack.push({ level: level.idx, id: newId });
            imported++;
          } else {
            const errMsg = result.errors?.[0]?.message || "创建失败";
            errors.push(`"${t}": ${errMsg}`);
          }

          // 一行只有一个章节，找到后跳出内层循环
          break;
        }
      }

      if (errors.length === 0) {
        message.success(`导入成功，共导入 ${imported} 个章节`);
        queryClient.invalidateQueries({ queryKey: ["mm-chapters"] });
        handleCloseImportModal();
      } else {
        setImportResult({
          success: false,
          message: `导入完成，成功 ${imported} 个，失败 ${errors.length} 个`,
          errors,
        });
        message.warning(`导入完成，${imported} 成功，${errors.length} 失败`);
        if (imported > 0) {
          queryClient.invalidateQueries({ queryKey: ["mm-chapters"] });
        }
      }
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : "导入失败";
      if (imported > 0) {
        setImportResult({
          success: false,
          message: `部分导入成功（${imported} 个），但后续出错: ${errorMsg}`,
          errors,
        });
      } else {
        setImportResult({ success: false, message: "导入失败", errors: [errorMsg] });
      }
      message.error(errorMsg);
    } finally {
      setImporting(false);
    }
  };

  const handleCloseImportModal = () => {
    setImportModalOpen(false);
    setSelectedFile(null);
    setPreviewData([]);
    setImportResult(null);
  };

  // ---- Columns ----
  const columns: TableColumnsType<ChapterRow> = [
    {
      title: "章节标题",
      dataIndex: "title",
      key: "title",
      render: (text: string, record: ChapterRow) => {
        const children = record.subchapters || [];
        const hasChildren = children.length > 0;
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {(() => {
              const num = generateChapterNumber(record.path);
              return num ? <Tag color="blue" style={{ fontSize: isMobile ? 11 : 12, lineHeight: isMobile ? "18px" : undefined, padding: isMobile ? "0 5px" : undefined }}>{num}</Tag> : null;
            })()}
            <FolderOutlined style={{ color: "#722ed1", fontSize: isMobile ? 14 : 16, flexShrink: 0 }} />
            <Tooltip title={text} mouseEnterDelay={0.3}>
              <span style={{ fontSize: isMobile ? 13 : 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>{text}</span>
            </Tooltip>
            {hasChildren && (
              <Tag color="purple" style={{ fontSize: isMobile ? 10 : 12, lineHeight: isMobile ? "18px" : undefined, padding: isMobile ? "0 5px" : undefined }}>{children.length} 子章节</Tag>
            )}
          </div>
        );
      },
    },
    {
      title: "描述",
      dataIndex: "description",
      key: "description",
      responsive: ["md"],
      ellipsis: true,
      render: (text: string) => (
        <Text type="secondary" ellipsis style={{ maxWidth: 200 }}>
          {text || "暂无描述"}
        </Text>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: isMobile ? 100 : 300,
      render: (_: any, record: ChapterRow) => (
        <Space size={isMobile ? 2 : 4}>
          <ReadonlyActionButton type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditClick(record)}>
            {isMobile ? "" : "编辑"}
          </ReadonlyActionButton>
          <ReadonlyActionButton type="link" size="small" icon={<PlusOutlined />} onClick={() => handleAddClick(record)}>
            {isMobile ? "" : "添加子章节"}
          </ReadonlyActionButton>
          <Popconfirm
            title="确定删除此章节？"
            onConfirm={() => deleteMutation.mutate(record.id)}
          >
            <ReadonlyActionButton type="link" size="small" danger icon={<DeleteOutlined />}>
              {isMobile ? "" : "删除"}
            </ReadonlyActionButton>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        style={{ boxShadow: "0 1px 3px rgba(16, 24, 40, 0.1)" }}
      >
        {chaptersError && (
          <Alert
            type="error"
            message={(chaptersError as Error).message || "加载章节失败"}
            style={{ marginBottom: 16 }}
          />
        )}

        {(isLoading || createMutation.isPending || updateMutation.isPending) ? (
          <Table
            columns={columns}
            dataSource={chaptersData}
            rowKey="id"
            loading
            pagination={false}
            size="middle"
            showHeader={false}
            childrenColumnName="subchapters"
            defaultExpandAllRows
          />
        ) : chaptersData.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 24px" }}>
            <Empty description="暂无章节，请添加或导入章节" />
            <div style={{ marginTop: 24, display: "flex", justifyContent: "center", gap: 12 }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => handleAddClick()}
                style={canEdit ? undefined : { display: "none" }}
              >
                新建章节
              </Button>
              <Button
                icon={<UploadOutlined />}
                onClick={() => setImportModalOpen(true)}
                style={canEdit ? undefined : { display: "none" }}
              >
                导入章节
              </Button>
              <Button
                icon={<DownloadOutlined />}
                onClick={handleDownloadTemplate}
              >
                下载模板
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <Space size={isMobile ? 4 : 8} wrap>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  size={isMobile ? "small" : "middle"}
                  onClick={() => handleAddClick()}
                  style={canEdit ? undefined : { display: "none" }}
                >
                  {isMobile ? "新建" : "新建章节"}
                </Button>
                <Button
                  icon={<UploadOutlined />}
                  size={isMobile ? "small" : "middle"}
                  onClick={() => setImportModalOpen(true)}
                  style={canEdit ? undefined : { display: "none" }}
                >
                  {isMobile ? "导入" : "导入章节"}
                </Button>
                <Button
                  icon={<DownloadOutlined />}
                  size={isMobile ? "small" : "middle"}
                  onClick={handleDownloadTemplate}
                >
                  {isMobile ? "模板" : "下载模板"}
                </Button>
              </Space>
            </div>
            <Table
              columns={columns}
              dataSource={chaptersData}
              rowKey="id"
              loading={isLoading}
              pagination={false}
              size="middle"
              showHeader={true}
              indentSize={24}
              childrenColumnName="subchapters"
              defaultExpandAllRows
            />
          </>
        )}
      </Card>

      {/* Create Modal */}
      <Modal
        title={parentChapterId ? "添加子章节" : "新建章节"}
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          setParentChapterId(undefined);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleFormCreate}>
          {parentChapterId && (() => {
            const parent = flatChapters.find(c => c.id === parentChapterId);
            return parent ? (
              <Alert
                type="info"
                message={`父章节: ${generateChapterNumber(parent.path)} ${parent.title}`}
                style={{ marginBottom: 16 }}
                showIcon
              />
            ) : null;
          })()}
          <Form.Item
            name="title"
            label="章节标题"
            rules={[{ required: true, message: "请输入章节标题" }]}
          >
            <Input placeholder="请输入章节标题" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="可选" />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title="编辑章节"
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false);
          setEditingChapter(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        confirmLoading={updateMutation.isPending}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleFormEdit}>
          <Form.Item
            name="title"
            label="章节标题"
            rules={[{ required: true, message: "请输入章节标题" }]}
          >
            <Input placeholder="请输入章节标题" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="可选" />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Import Modal */}
      <Modal
        title="导入章节"
        open={importModalOpen}
        onCancel={handleCloseImportModal}
        width={800}
        footer={
          <Space>
            <Button onClick={handleCloseImportModal} disabled={importing}>
              关闭
            </Button>
            {selectedFile && !importResult && (
              <Button
                type="primary"
                onClick={handleImport}
                loading={importing}
                disabled={previewData.length === 0}
              >
                开始导入
              </Button>
            )}
          </Space>
        }
      >
        {!selectedFile ? (
          <div style={{ textAlign: "center", padding: 24 }}>
            <Paragraph>请选择章节导入 Excel 文件 (.xlsx 或 .xls)</Paragraph>

            <div style={{ textAlign: "left", marginBottom: 24 }}>
              <Title level={5}>Excel 文件格式要求：</Title>
              <Table
                size="small"
                pagination={false}
                dataSource={[
                  {
                    key: 1,
                    a: "第一章 概述",
                    b: "",
                    c: "",
                    d: "",
                    e: "",
                    f: "本章介绍课程目标和学习内容",
                  },
                  {
                    key: 2,
                    a: "",
                    b: "1.1 第一节",
                    c: "",
                    d: "",
                    e: "",
                    f: "",
                  },
                  {
                    key: 3,
                    a: "",
                    b: "1.2 第二节",
                    c: "",
                    d: "",
                    e: "",
                    f: "",
                  },
                  {
                    key: 4,
                    a: "",
                    b: "",
                    c: "1.2.1 小节",
                    d: "",
                    e: "",
                    f: "",
                  },
                  {
                    key: 5,
                    a: "第二章 实战",
                    b: "",
                    c: "",
                    d: "",
                    e: "",
                    f: "本章聚焦实战案例",
                  },
                ]}
                columns={[
                  { title: "一级章节", dataIndex: "a", width: 120 },
                  { title: "二级章节", dataIndex: "b", width: 120 },
                  { title: "三级章节", dataIndex: "c", width: 120 },
                  { title: "四级章节", dataIndex: "d", width: 120 },
                  { title: "五级章节", dataIndex: "e", width: 80 },
                  { title: "章节说明", dataIndex: "f", width: 150 },
                ]}
              />
              <Paragraph type="secondary" style={{ marginTop: 12, fontSize: 12 }}>
                说明：<br />
                1. 每个章节/子章节只占用一行<br />
                2. 层级由填充的列决定（填充一级列 = 一级章节，填充二级列 = 二级章节...）<br />
                3. 同一父章节下的相邻子章节按 Excel 行顺序从上到下排列<br />
                4. 章节说明对应该行的章节，为可选项
              </Paragraph>
            </div>

            <Upload
              accept=".xlsx,.xls"
              showUploadList={false}
              beforeUpload={handleFileSelect}
            >
              <Button icon={<UploadOutlined />} size="large">
                选择文件
              </Button>
            </Upload>

            <div style={{ marginTop: 16 }}>
              <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
                下载模板
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Paragraph>
              已选择文件: <Text strong>{selectedFile.name}</Text>
            </Paragraph>

            {previewData.length > 0 && (
              <>
                <Title level={5}>
                  预览导入数据 ({previewData.length} 个章节)
                </Title>
                <Table
                  size="small"
                  dataSource={previewData.map((c, i) => ({ ...c, key: i }))}
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: 600 }}
                  columns={[
                    { title: "一级章节", dataIndex: "level1", width: 120, render: (v: string) => v || "-" },
                    { title: "二级章节", dataIndex: "level2", width: 120, render: (v: string) => v || "-" },
                    { title: "三级章节", dataIndex: "level3", width: 120, render: (v: string) => v || "-" },
                    { title: "四级章节", dataIndex: "level4", width: 80, render: (v: string) => v || "-" },
                    { title: "五级章节", dataIndex: "level5", width: 80, render: (v: string) => v || "-" },
                    { title: "说明", dataIndex: "description", width: 150, ellipsis: true },
                  ]}
                />
              </>
            )}

            {importResult && (
              <Alert
                type={importResult.success ? "success" : "error"}
                message={importResult.message}
                showIcon
                style={{ marginTop: 16 }}
                description={
                  importResult.errors && importResult.errors.length > 0 && (
                    <div>
                      {importResult.errors.map((item, idx) => (
                        <div key={idx}>• {item}</div>
                      ))}
                    </div>
                  )
                }
              />
            )}

            {!importResult && (
              <Alert
                type="info"
                message="确认以上信息无误后，点击「开始导入」按钮"
                style={{ marginTop: 16 }}
              />
            )}

            <div style={{ marginTop: 16 }}>
              <Button onClick={() => setSelectedFile(null)}>重新选择文件</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Typography,
  Button,
  Table,
  Input,
  Modal,
  Alert,
  Space,
  Spin,
  message,
  Tooltip,
  Empty,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, FolderOutlined, ArrowLeftOutlined, EyeOutlined, ReadOutlined } from "@ant-design/icons";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  listSubjectCategories,
  createSubjectCategory,
  updateSubjectCategory,
  deleteSubjectCategory,
} from "@/lib/ash_rpc";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { extractArrayData } from "@/utils/api-helpers";
import type { ColumnsType } from "antd/es/table";
import { useTranslate } from "@/locales/use-locales";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";

const { Title, Text } = Typography;

interface Category {
  id: string;
  name: string;
  description: string | null;
  code: string | null;
  courses?: Array<{ id: string; title?: string }>;
}

interface CategoryFormData {
  name: string;
  description: string;
}

export default function CourseCategoryPage() {
  const navigate = useNavigate();
  const { t } = useTranslate("teacher");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>({
    name: "",
    description: "",
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewCategory, setViewCategory] = useState<Category | null>(null);

  const { user } = useAuth();
  const currentTenant = getCurrentTenant();
  const { canEdit } = useEditPermission();

  const {
    data: categoriesData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["subject-categories"],
    queryFn: () =>
      listSubjectCategories({
        tenant: currentTenant?.schemaName || "",
        fields: ["id", "name", "description", "code", { courses: ["id", "title"] }],
        sort: "+name",
        headers: getAuthHeaders(user) as Record<string, string>,
      }),
    enabled: !!currentTenant?.schemaName && !!user,
  });

  const categories: Category[] = extractArrayData(categoriesData);

  const getCourseCount = (category: Category) => {
    return category.courses?.length || 0;
  };

  const createMutation = useMutation({
    mutationFn: (data: CategoryFormData) =>
      createSubjectCategory({
        tenant: currentTenant?.schemaName || "",
        fields: ["id", "name", "description", "code"],
        input: {
          name: data.name,
          description: data.description || null,
        },
        headers: getAuthHeaders(user) as Record<string, string>,
      }),
    onSuccess: (response) => {
      if (response.success && response.data) {
        message.success(t("common.createSuccess"));
        handleCloseDialog();
        refetch();
      } else {
        message.error(t("common.createFailed"));
      }
    },
    onError: () => {
      message.error(t("common.createFailed"));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CategoryFormData }) =>
      updateSubjectCategory({
        tenant: currentTenant?.schemaName || "",
        primaryKey: id,
        fields: ["id", "name", "description", "code"],
        input: {
          name: data.name,
          description: data.description || null,
        },
        headers: getAuthHeaders(user) as Record<string, string>,
      }),
    onSuccess: (response) => {
      if (response.success) {
        message.success(t("common.updateSuccess"));
        handleCloseDialog();
        refetch();
      } else {
        message.error(t("common.updateFailed"));
      }
    },
    onError: () => {
      message.error(t("common.updateFailed"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      deleteSubjectCategory({
        tenant: currentTenant?.schemaName || "",
        primaryKey: id,
        headers: getAuthHeaders(user) as Record<string, string>,
      }),
    onSuccess: (response) => {
      if (response.success) {
        message.success(t("common.deleteSuccess"));
        handleCloseDeleteDialog();
        refetch();
      } else {
        message.error(t("common.deleteFailed"));
      }
    },
    onError: () => {
      message.error(t("common.deleteFailed"));
    },
  });

  const handleOpenDialog = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        description: category.description || "",
      });
    } else {
      setEditingCategory(null);
      setFormData({ name: "", description: "" });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingCategory(null);
    setFormData({ name: "", description: "" });
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      message.error("请输入学科分类名称");
      return;
    }

    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleOpenDeleteDialog = (category: Category) => {
    setCategoryToDelete(category);
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setCategoryToDelete(null);
  };

  const handleDelete = () => {
    if (categoryToDelete) {
      deleteMutation.mutate(categoryToDelete.id);
    }
  };

  const handleViewCourses = (category: Category) => {
    setViewCategory(category);
    setViewDialogOpen(true);
  };

  const handleCloseViewDialog = () => {
    setViewDialogOpen(false);
    setViewCategory(null);
  };

  const columns: ColumnsType<Category> = [
    {
      title: "学科分类",
      dataIndex: "name",
      key: "name",
      width: "28%",
      render: (name: string) => (
        <Tooltip title={name} mouseEnterDelay={0.3}>
          <Text strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</Text>
        </Tooltip>
      ),
    },
    {
      title: "描述",
      dataIndex: "description",
      key: "description",
      width: "34%",
      render: (description: string) => (
        <Tooltip title={description || "—"}>
          <Text
            type="secondary"
            ellipsis
            style={{ display: "block", maxWidth: 360 }}
          >
            {description || "—"}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: "关联课程",
      key: "courseCount",
      width: "16%",
      align: "center",
      render: (_: unknown, record: Category) => {
        const count = getCourseCount(record);
        return <Text>{count} 门课程</Text>;
      },
    },
    {
      title: "操作",
      key: "action",
      width: "22%",
      align: "center",
      render: (_: unknown, record: Category) => (
        <Space size={4}>
          <ReadonlyActionButton type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewCourses(record)}>
            <span className="cat-action-text">查看</span>
          </ReadonlyActionButton>
          <ReadonlyActionButton type="link" size="small" icon={<EditOutlined />} onClick={() => handleOpenDialog(record)}>
            <span className="cat-action-text">{t("common.edit")}</span>
          </ReadonlyActionButton>
          <ReadonlyActionButton type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleOpenDeleteDialog(record)}>
            <span className="cat-action-text">{t("common.delete")}</span>
          </ReadonlyActionButton>
        </Space>
      ),
    },
  ];

  return (
    <div className="cat-page-wrap" style={{ padding: 24 }}>
      <style>{`@media(max-width:768px){.cat-mobile-hide{display:none!important}.cat-action-text{display:none!important}.cat-page-wrap{padding:12px!important}.cat-page-wrap .ant-table-cell{padding:6px 4px!important}}`}</style>
      {/* 标题区域 */}
      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Button
              className="teacher-page-back-btn"
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate("/teacher/dashboard")}
              style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
            />
            <FolderOutlined style={{ fontSize: 24, color: "#1890ff" }} />
            <Title level={4} style={{ margin: 0 }}>学科分类管理</Title>
          </div>
          <Text type="secondary">管理课程学科分类，添加、编辑或删除分类信息</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenDialog()} style={canEdit ? undefined : { display: "none" }}>
          添加学科分类
        </Button>
      </div>

      {/* 表格 */}
      <Card style={{ borderRadius: 8 }}>
        {isLoading ? (
          <div style={{ textAlign: "center", padding: 64 }}><Spin /></div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: 64 }}>
            <Alert
              type="error"
              message="加载失败"
              action={<Button size="small" onClick={() => refetch()}>重试</Button>}
            />
          </div>
        ) : (
          <Table
            columns={columns}
            dataSource={categories}
            rowKey="id"
            size="small"
            pagination={{
              current: page,
              pageSize: pageSize,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
              onChange: (p, ps) => { setPage(p); setPageSize(ps); },
            }}
            locale={{
              emptyText: "暂无学科分类",
            }}
          />
        )}
      </Card>

      {/* 添加/编辑弹窗 */}
      <Modal
        title={editingCategory ? "编辑学科分类" : "添加学科分类"}
        open={openDialog}
        onCancel={handleCloseDialog}
        onOk={handleSubmit}
        okText={editingCategory ? "更新" : "创建"}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <div style={{ paddingTop: 16 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 8 }}>学科分类名称 <span style={{ color: "#ff4d4f" }}>*</span></label>
            <Input
              placeholder="请输入学科分类名称"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 8 }}>描述</label>
            <Input.TextArea
              placeholder="请输入学科分类描述（可选）"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>
        </div>
      </Modal>

      {/* 查看关联课程弹窗 */}
      <Modal
        title={
          <Space>
            <FolderOutlined style={{ color: "#1890ff" }} />
            <span>「{viewCategory?.name}」关联课程</span>
          </Space>
        }
        open={viewDialogOpen}
        onCancel={handleCloseViewDialog}
        footer={
          <Button onClick={handleCloseViewDialog}>关闭</Button>
        }
        width={560}
      >
        {viewCategory && (
          <div style={{ paddingTop: 8 }}>
            <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
              该学科分类下共 {getCourseCount(viewCategory)} 门课程，点击课程可跳转查看详情：
            </Text>
            {viewCategory.courses && viewCategory.courses.length > 0 ? (
              <div style={{ maxHeight: 420, overflow: "auto" }}>
                {viewCategory.courses.map((course) => (
                  <div
                    key={course.id}
                    onClick={() => navigate(`/teacher/dashboard/course/${course.id}`)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 14px",
                      marginBottom: 8,
                      border: "1px solid #E0E0E0",
                      borderRadius: 8,
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#1890ff";
                      e.currentTarget.style.boxShadow = "0 2px 8px rgba(24,144,255,0.15)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#E0E0E0";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: "#e6f4ff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <ReadOutlined style={{ color: "#1890ff", fontSize: 18 }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {course.title || "未命名课程"}
                      </Text>
                    </div>
                    <EyeOutlined style={{ color: "#8c8c8c" }} />
                  </div>
                ))}
              </div>
            ) : (
              <Empty description="该分类下暂无关联课程" />
            )}
          </div>
        )}
      </Modal>

      {/* 删除确认弹窗 */}
      <Modal
        title="确认删除"
        open={deleteDialogOpen}
        onCancel={handleCloseDeleteDialog}
        onOk={handleDelete}
        okText="删除"
        okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
      >
        <div>
          <Text>确定要删除学科分类 <strong>"{categoryToDelete?.name}"</strong> 吗？</Text>
        </div>
        {categoryToDelete && getCourseCount(categoryToDelete) > 0 && (
          <Alert type="warning" message={`该分类下还有 ${getCourseCount(categoryToDelete)} 门课程，删除后这些课程将失去分类关联。`} style={{ marginTop: 16 }} />
        )}
      </Modal>
    </div>
  );
}

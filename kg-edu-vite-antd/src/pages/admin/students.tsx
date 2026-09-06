import { useState, useMemo } from "react";
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Modal,
  Tooltip,
  Alert,
  Input,
  App,
  Popconfirm,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  DownloadOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/auth-context";
import { getUsersFromTenant, createUser, updateUser, deleteUser, listClasses } from "@/lib/ash_rpc";
import { getAuthHeaders } from "@/lib/auth";
import { hasTenant } from "@/lib/tenant";
import { downloadUserTemplate } from "@/lib/user-import-export";
import { StudentForm } from "@/components/admin/student-form";
import { ImportUserModal } from "@/components/admin/import-user-modal";
import { MobileTableCard } from "@/components/admin/mobile-table-card";
import { ReadonlyActionButton } from "@/components/readonly-action-button";
import { useTenantFilter, ALL_TENANTS } from "@/hooks/use-tenant-filter";
import { TenantLayout } from "@/components/admin/tenant-layout";
import { fetchAcrossTenants } from "@/lib/tenant-query";

import { useResponsive } from "@/hooks/use-responsive";

const { Text } = Typography;

interface StudentData {
  id: string;
  memberId: string;
  name: string;
  email?: string;
  phone?: string;
  colledge?: string;
  major?: string;
  classId?: string;
  _tenant?: string;
}

const transformAshStudent = (ashUser: any): StudentData => ({
  id: ashUser.id,
  memberId: ashUser.memberId || "",
  name: ashUser.name || "",
  email: ashUser.email,
  phone: ashUser.phone,
  colledge: ashUser.colledge,
  major: ashUser.major,
  classId: ashUser.classId,
  _tenant: ashUser._tenant,
});

export default function StudentManagement() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isMobile } = useResponsive();
  const {
    isSuperAdmin,
    tenantOptions,
    selectedTenantId,
    setSelectedTenantId,
    queryTenants,
    defaultTenant,
  } = useTenantFilter("student");
  const editTenant =
    isSuperAdmin && selectedTenantId === ALL_TENANTS ? null : queryTenants[0] || defaultTenant;
  const resolveTenant = (target?: { _tenant?: string }) =>
    target?._tenant || editTenant || defaultTenant;

  const [selectedStudent, setSelectedStudent] = useState<StudentData | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [searchText, setSearchText] = useState("");

  const { data: rawStudents, isLoading } = useQuery({
    queryKey: ["tenant-students", queryTenants],
    queryFn: () =>
      fetchAcrossTenants<StudentData>(queryTenants, (tenant) =>
        getUsersFromTenant({
          tenant,
          fields: ["id", "memberId", "name", "email", "phone", "colledge", "major", "classId"],
          filter: { role: { eq: "user" } },
          headers: getAuthHeaders(user),
        }),
      ),
    enabled: queryTenants.length > 0,
  });

  const { data: classesResponse } = useQuery({
    queryKey: ["classes-for-map", queryTenants],
    queryFn: () =>
      fetchAcrossTenants<{ id: string; name: string }>(queryTenants, (tenant) =>
        listClasses({
          tenant,
          fields: ["id", "name"],
          sort: "+name",
          page: { limit: 1000, offset: 0 },
          headers: getAuthHeaders(user),
        }),
      ),
    enabled: queryTenants.length > 0,
  });

  const classesMap = useMemo(() => {
    if (!classesResponse) return {};
    return classesResponse.reduce((acc: Record<string, string>, cls) => {
      acc[cls.id] = cls.name;
      return acc;
    }, {});
  }, [classesResponse]);

  const students = useMemo(() => {
    return (rawStudents || []).map(transformAshStudent);
  }, [rawStudents]);

  const filteredStudents = useMemo(() => {
    if (!searchText) return students;
    const lower = searchText.toLowerCase();
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(lower) ||
        s.memberId.toLowerCase().includes(lower) ||
        s.email?.toLowerCase().includes(lower) ||
        s.colledge?.toLowerCase().includes(lower) ||
        s.major?.toLowerCase().includes(lower)
    );
  }, [students, searchText]);

  const createStudentMutation = useMutation({
    mutationFn: (data: any) =>
      createUser({
        tenant: editTenant as string,
        input: {
          memberId: data.memberId,
          name: data.name,
          password: data.password,
          role: "user",
          ...(data.email && { email: data.email }),
          ...(data.phone && { phone: data.phone }),
          ...(data.colledge && { colledge: data.colledge }),
          ...(data.major && { major: data.major }),
          ...(data.classId && { classId: data.classId }),
        },
        fields: ["id", "memberId", "name", "email", "colledge", "major", "classId"],
        headers: getAuthHeaders(user),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-students", queryTenants] });
      setModalOpen(false);
      setSelectedStudent(null);
      message.success("学生创建成功");
    },
    onError: (error: any) => {
      message.error(error?.message || "创建学生失败");
    },
  });

  const updateStudentMutation = useMutation({
    mutationFn: ({ id, data, tenant }: { id: string; data: any; tenant: string }) =>
      updateUser({
        tenant,
        primaryKey: id,
        input: {
          name: data.name,
          ...(data.email && { email: data.email }),
          ...(data.phone && { phone: data.phone }),
          ...(data.colledge && { colledge: data.colledge }),
          ...(data.major && { major: data.major }),
          ...(data.classId && { classId: data.classId }),
          ...(data.password && { password: data.password }),
        },
        fields: ["id", "memberId", "name", "email", "colledge", "major", "classId"],
        headers: getAuthHeaders(user),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-students", queryTenants] });
      setModalOpen(false);
      setSelectedStudent(null);
      message.success("学生更新成功");
    },
    onError: (error: any) => {
      message.error(error?.message || "更新学生失败");
    },
  });

  const deleteStudentMutation = useMutation({
    mutationFn: ({ id, tenant }: { id: string; tenant: string }) =>
      deleteUser({
        tenant,
        primaryKey: id,
        headers: getAuthHeaders(user),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-students", queryTenants] });
      message.success("学生删除成功");
    },
    onError: (error: any) => {
      const errorMsg = error?.message || "";
      if (errorMsg.includes("course_enrollments_member_id_fkey") || errorMsg.includes("foreign_key_constraint")) {
        message.error("无法删除该学生：该学生存在课程关联记录，请先移除学生的课程关联后再删除");
      } else {
        message.error(errorMsg || "删除学生失败");
      }
    },
  });

  const handleCreate = () => {
    if (!editTenant) {
      message.warning("请先在左侧选择具体租户后再创建");
      return;
    }
    setSelectedStudent(null);
    setModalOpen(true);
  };

  const handleOpenImport = () => {
    if (!editTenant) {
      message.warning("请先在左侧选择具体租户后再导入");
      return;
    }
    setImportModalOpen(true);
  };

  const handleEdit = (record: StudentData) => {
    setSelectedStudent(record);
    setModalOpen(true);
  };

  const handleDelete = (record: StudentData) => {
    deleteStudentMutation.mutate({ id: record.id, tenant: resolveTenant(record) });
  };

  const handleSubmit = (data: any) => {
    if (selectedStudent) {
      updateStudentMutation.mutate({
        id: selectedStudent.id,
        data,
        tenant: resolveTenant(selectedStudent),
      });
    } else {
      createStudentMutation.mutate(data);
    }
  };

  const columns: ColumnsType<StudentData> = [
    {
      title: "学生ID",
      dataIndex: "memberId",
      key: "memberId",
      width: 120,
    },
    {
      title: "姓名",
      dataIndex: "name",
      key: "name",
      width: 120,
    },
    {
      title: "邮箱",
      dataIndex: "email",
      key: "email",
      width: 200,
      ellipsis: true,
      render: (text) => text || <Text type="secondary">未设置</Text>,
    },
    {
      title: "学院",
      dataIndex: "colledge",
      key: "colledge",
      width: 150,
      render: (text) => text || <Text type="secondary">未设置</Text>,
    },
    {
      title: "专业",
      dataIndex: "major",
      key: "major",
      width: 120,
      render: (text) => text || <Text type="secondary">未设置</Text>,
    },
    {
      title: "关联班级",
      dataIndex: "classId",
      key: "classId",
      width: 150,
      render: (classId) => {
        const className = classId ? classesMap[classId] : null;
        return className ? <Tag color="blue">{className}</Tag> : <Text type="secondary">未关联</Text>;
      },
    },
    {
      title: "操作",
      key: "action",
      width: 120,
      fixed: "right",
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="编辑">
            <ReadonlyActionButton type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Popconfirm
            title="确定要删除这个学生吗？"
            description="此操作不可撤销"
            onConfirm={() => handleDelete(record)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <ReadonlyActionButton type="text" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (!isSuperAdmin && !hasTenant()) {
    return (
      <Card>
        <Alert
          message="请先选择组织"
          description="学生管理需要在特定组织/租户下进行。请先选择一个组织。"
          type="warning"
          showIcon
        />
      </Card>
    );
  }

  return (
    <TenantLayout
      tenants={tenantOptions}
      selected={selectedTenantId}
      onSelect={setSelectedTenantId}
    >
    <div>
      <Card styles={{ body: { padding: isMobile ? 12 : 24 } }}>
        {/* 移动端工具栏 */}
        {isMobile && (
          <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <Tag color="blue" style={{ fontSize: 11, padding: "0 6px" }}>
                学生: {students.length}
              </Tag>
              <Space size={4} wrap>
                <Button
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={async () => {
                    try {
                      await downloadUserTemplate();
                      message.success("模板下载成功");
                    } catch (error) {
                      message.error(error instanceof Error ? error.message : "模板下载失败");
                    }
                  }}
                >
                  模板
                </Button>
                <ReadonlyActionButton
                  size="small"
                  icon={<UploadOutlined />}
                  onClick={handleOpenImport}
                >
                  导入
                </ReadonlyActionButton>
                <ReadonlyActionButton
                  type="primary"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={handleCreate}
                >
                  添加
                </ReadonlyActionButton>
              </Space>
            </div>
            <Input
              placeholder="搜索学生..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              size="small"
            />
          </div>
        )}

        {!isMobile && (
          <Table
            columns={columns}
            dataSource={filteredStudents}
            rowKey="id"
            loading={isLoading}
            scroll={{ x: 900 }}
            title={() => (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <Space wrap>
                  <Tag color="blue" style={{ fontSize: 13 }}>
                    学生: {students.length}
                  </Tag>
                  <Input
                    placeholder="搜索学生..."
                    prefix={<SearchOutlined />}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    style={{ width: 250 }}
                    allowClear
                  />
                </Space>
                <Space wrap>
                  <Button
                    icon={<DownloadOutlined />}
                    onClick={async () => {
                      try {
                        await downloadUserTemplate();
                        message.success("模板下载成功");
                      } catch (error) {
                        message.error(error instanceof Error ? error.message : "模板下载失败");
                      }
                    }}
                  >
                    下载模板
                  </Button>
                   <ReadonlyActionButton icon={<UploadOutlined />} onClick={handleOpenImport}>
                     导入学生
                   </ReadonlyActionButton>
                   <ReadonlyActionButton type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                     添加学生
                   </ReadonlyActionButton>
                </Space>
              </div>
            )}
            pagination={{
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条`,
              defaultPageSize: 10,
              size: "small",
            }}
          />
        )}

        {isMobile && (
          <MobileTableCard<StudentData>
            dataSource={filteredStudents}
            loading={isLoading}
            title={(r) => r.name}
            subtitle={(r) => r.memberId}
            extra={(r) => {
              const className = r.classId ? classesMap[r.classId] : null;
              return className ? <Tag color="blue">{className}</Tag> : null;
            }}
            fields={(r) => [
              { label: "邮箱", value: r.email },
              { label: "学院", value: r.colledge },
              { label: "专业", value: r.major },
            ]}
            actions={(r) => (
              <Space size={4}>
                <ReadonlyActionButton size="small" type="text" icon={<EditOutlined />} onClick={() => handleEdit(r)}>
                  编辑
                </ReadonlyActionButton>
                <Popconfirm
                  title="删除学生？"
                  onConfirm={() => handleDelete(r)}
                  okText="确定"
                  cancelText="取消"
                >
                  <ReadonlyActionButton size="small" type="text" danger icon={<DeleteOutlined />}>
                    删除
                  </ReadonlyActionButton>
                </Popconfirm>
              </Space>
            )}
          />
        )}

        {isMobile && (
          <div style={{ textAlign: "center", marginTop: 12, color: "#999", fontSize: 12 }}>
            共 {filteredStudents.length} 名学生
          </div>
        )}
      </Card>

      <Modal
        title={selectedStudent ? "编辑学生" : "创建新学生"}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setSelectedStudent(null);
        }}
        footer={null}
        width="95%"
        style={{ maxWidth: 600 }}
        destroyOnHidden
      >
        <StudentForm
          student={selectedStudent}
          onSubmit={handleSubmit}
          onCancel={() => {
            setModalOpen(false);
            setSelectedStudent(null);
          }}
          loading={createStudentMutation.isPending || updateStudentMutation.isPending}
          tenant={editTenant as string}
        />
      </Modal>

      <ImportUserModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["tenant-students", queryTenants] })}
        role="user"
        tenant={editTenant as string}
      />
    </div>
    </TenantLayout>
  );
}
import { useState, useMemo } from "react";
import {
  Card,
  Table,
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
  UserAddOutlined,
  UserDeleteOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/auth-context";
import { listClasses, createClass, updateClass, deleteClass, listUsers, updateUser } from "@/lib/ash_rpc";
import { getAuthHeaders } from "@/lib/auth";
import { hasTenant } from "@/lib/tenant";
import { ClassForm } from "@/components/admin/class-form";
import { MobileTableCard } from "@/components/admin/mobile-table-card";
import { useResponsive } from "@/hooks/use-responsive";
import { ReadonlyActionButton } from "@/components/readonly-action-button";
import { useTenantFilter, ALL_TENANTS } from "@/hooks/use-tenant-filter";
import { TenantLayout } from "@/components/admin/tenant-layout";
import { fetchAcrossTenants } from "@/lib/tenant-query";

const { Text } = Typography;

interface ClassData {
  id: string;
  name: string;
  college?: string;
  major?: string;
  studentCount?: number;
  _tenant?: string;
}

interface StudentData {
  id: string;
  name: string;
  memberId: string;
  email?: string;
  colledge?: string;
  major?: string;
  classId?: string;
}

export default function ClassManagement() {
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
  } = useTenantFilter("classes");
  const editTenant =
    isSuperAdmin && selectedTenantId === ALL_TENANTS ? null : queryTenants[0] || defaultTenant;
  const resolveTenant = (target?: { _tenant?: string }) =>
    target?._tenant || editTenant || defaultTenant;

  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [associateModalOpen, setAssociateModalOpen] = useState(false);
  const [dissociateModalOpen, setDissociateModalOpen] = useState(false);
  const [classForAssociate, setClassForAssociate] = useState<ClassData | null>(null);
  const [classForDissociate, setClassForDissociate] = useState<ClassData | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [searchText, setSearchText] = useState("");

  const { data: rawClasses, isLoading } = useQuery({
    queryKey: ["classes", queryTenants],
    queryFn: () =>
      fetchAcrossTenants<{ id: string; name: string; college: string | null; major: string | null }>(
        queryTenants,
        (tenant) =>
          listClasses({
            tenant,
            fields: ["id", "name", "college", "major"],
            sort: "+name",
            page: { limit: 100, offset: 0 },
            headers: getAuthHeaders(user),
          }),
      ),
    enabled: queryTenants.length > 0,
  });

  const { data: rawUsersForCount } = useQuery({
    queryKey: ["users-for-class-count", queryTenants],
    queryFn: () =>
      fetchAcrossTenants<{ id: string; classId: string | null }>(queryTenants, (tenant) =>
        listUsers({
          tenant,
          fields: ["id", "name", "classId", "role"],
          filter: { role: { eq: "user" } },
          headers: getAuthHeaders(user),
        }),
      ),
    enabled: queryTenants.length > 0,
  });

  const { data: allStudentsResponse } = useQuery({
    queryKey: ["all-students-for-associate", editTenant],
    queryFn: () =>
      listUsers({
        tenant: editTenant as string,
        fields: ["id", "name", "memberId", "email", "colledge", "major", "classId"],
        filter: { role: { eq: "user" } },
        headers: getAuthHeaders(user),
      }),
    enabled: associateModalOpen && !!editTenant,
  });

  const { data: classStudentsResponse, isLoading: classStudentsLoading } = useQuery({
    queryKey: ["class-students", classForDissociate?.id, editTenant],
    queryFn: () =>
      listUsers({
        tenant: editTenant as string,
        fields: ["id", "name", "memberId", "email", "colledge", "major", "classId"],
        filter: {
          and: [{ role: { eq: "user" } }, { classId: { eq: classForDissociate?.id } }],
        },
        headers: getAuthHeaders(user),
      }),
    enabled: dissociateModalOpen && !!classForDissociate?.id && !!editTenant,
  });

  const classes = useMemo<ClassData[]>(() => {
    const classData = (rawClasses || []) as any[];
    const studentData = (rawUsersForCount || []) as any[];
    return classData.map((cls: any) => ({
      id: cls.id,
      name: cls.name,
      college: cls.college,
      major: cls.major,
      studentCount: studentData.filter((s: any) => s.classId === cls.id).length,
    }));
  }, [rawClasses, rawUsersForCount]);

  const allStudents = useMemo(() => {
    if (!allStudentsResponse?.success) return [];
    const studentData = Array.isArray(allStudentsResponse.data)
      ? allStudentsResponse.data
      : (allStudentsResponse.data as any)?.results || [];
    return studentData.map((s: any) => ({
      id: s.id,
      name: s.name,
      memberId: s.memberId,
      email: s.email,
      colledge: s.colledge,
      major: s.major,
      classId: s.classId,
      currentClass: s.classId ? "已分配" : "未分配",
    }));
  }, [allStudentsResponse]);

  const classStudents = useMemo(() => {
    if (!classStudentsResponse?.success) return [];
    const studentData = Array.isArray(classStudentsResponse.data)
      ? classStudentsResponse.data
      : (classStudentsResponse.data as any)?.results || [];
    return studentData.map((s: any) => ({
      id: s.id,
      name: s.name,
      memberId: s.memberId,
      email: s.email,
      colledge: s.colledge,
      major: s.major,
    }));
  }, [classStudentsResponse]);

  const filteredClasses = useMemo(() => {
    if (!searchText) return classes;
    const lower = searchText.toLowerCase();
    return classes.filter(
      (c) =>
        c.name.toLowerCase().includes(lower) ||
        c.college?.toLowerCase().includes(lower) ||
        c.major?.toLowerCase().includes(lower)
    );
  }, [classes, searchText]);

  const filteredAllStudents = useMemo(() => {
    if (!searchText && associateModalOpen) return allStudents;
    const lower = searchText.toLowerCase();
    return allStudents.filter(
      (s) =>
        s.name.toLowerCase().includes(lower) ||
        s.memberId.toLowerCase().includes(lower) ||
        s.email?.toLowerCase().includes(lower)
    );
  }, [allStudents, searchText, associateModalOpen]);

  const createClassMutation = useMutation({
    mutationFn: (data: any) =>
      createClass({
        tenant: editTenant as string,
        input: data,
        fields: ["id", "name", "college", "major"],
        headers: getAuthHeaders(user),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes", queryTenants] });
      setModalOpen(false);
      setSelectedClass(null);
      message.success("班级创建成功");
    },
    onError: (error: any) => {
      message.error(error?.message || "创建班级失败");
    },
  });

  const updateClassMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      updateClass({
        tenant: editTenant as string,
        primaryKey: id,
        input: data,
        fields: ["id", "name", "college", "major"],
        headers: getAuthHeaders(user),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes", queryTenants] });
      setModalOpen(false);
      setSelectedClass(null);
      message.success("班级更新成功");
    },
    onError: (error: any) => {
      message.error(error?.message || "更新班级失败");
    },
  });

  const deleteClassMutation = useMutation({
    mutationFn: ({ id, tenant }: { id: string; tenant: string }) =>
      deleteClass({
        tenant,
        primaryKey: id,
        headers: getAuthHeaders(user),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes", queryTenants] });
      queryClient.invalidateQueries({ queryKey: ["users-for-class-count", queryTenants] });
      message.success("班级删除成功");
    },
    onError: (error: any) => {
      message.error(error?.message || "删除班级失败");
    },
  });

  const associateStudentsMutation = useMutation({
    mutationFn: async ({ studentIds, classId }: { studentIds: string[]; classId: string }) => {
      const promises = studentIds.map((studentId) =>
        updateUser({
          tenant: editTenant as string,
          primaryKey: studentId,
          input: { classId },
          fields: ["id", "name", "classId"],
          headers: getAuthHeaders(user),
        })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes", queryTenants] });
      queryClient.invalidateQueries({ queryKey: ["users-for-class-count", queryTenants] });
      setSelectedStudents([]);
      setAssociateModalOpen(false);
      setClassForAssociate(null);
      message.success("学生关联成功");
    },
    onError: (error: any) => {
      message.error(error?.message || "关联学生失败");
    },
  });

  const dissociateStudentsMutation = useMutation({
    mutationFn: async ({ studentIds }: { studentIds: string[] }) => {
      const promises = studentIds.map((studentId) =>
        updateUser({
          tenant: editTenant as string,
          primaryKey: studentId,
          input: { classId: null },
          fields: ["id", "name", "classId"],
          headers: getAuthHeaders(user),
        })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes", queryTenants] });
      queryClient.invalidateQueries({ queryKey: ["users-for-class-count", queryTenants] });
      setSelectedStudents([]);
      setDissociateModalOpen(false);
      setClassForDissociate(null);
      message.success("取消关联成功");
    },
    onError: (error: any) => {
      message.error(error?.message || "取消关联失败");
    },
  });

  const handleCreate = () => {
    if (!editTenant) {
      message.warning("请先在左侧选择具体租户后再创建");
      return;
    }
    setSelectedClass(null);
    setModalOpen(true);
  };

  const handleEdit = (record: ClassData) => {
    setSelectedClass(record);
    setModalOpen(true);
  };

  const handleDelete = (record: ClassData) => {
    deleteClassMutation.mutate({ id: record.id, tenant: resolveTenant(record) });
  };

  const handleAssociate = (record: ClassData) => {
    setClassForAssociate(record);
    setSelectedStudents([]);
    setAssociateModalOpen(true);
  };

  const handleDissociate = (record: ClassData) => {
    setClassForDissociate(record);
    setSelectedStudents([]);
    setDissociateModalOpen(true);
  };

  const handleSubmit = (data: any) => {
    if (selectedClass) {
      updateClassMutation.mutate({ id: selectedClass.id, data });
    } else {
      createClassMutation.mutate(data);
    }
  };

  const handleConfirmAssociate = () => {
    if (classForAssociate && selectedStudents.length > 0) {
      associateStudentsMutation.mutate({
        studentIds: selectedStudents,
        classId: classForAssociate.id,
      });
    }
  };

  const handleConfirmDissociate = () => {
    if (selectedStudents.length > 0) {
      dissociateStudentsMutation.mutate({ studentIds: selectedStudents });
    }
  };

  const columns: ColumnsType<ClassData> = [
    {
      title: "班级名称",
      dataIndex: "name",
      key: "name",
      width: 180,
      ellipsis: true,
    },
    {
      title: "专业",
      dataIndex: "major",
      key: "major",
      width: 150,
      render: (text) => text || <Text type="secondary">未设置</Text>,
    },
    {
      title: "学生人数",
      dataIndex: "studentCount",
      key: "studentCount",
      width: 100,
      render: (count) => (
        <Tag color={count > 0 ? "success" : "default"}>{count || 0}</Tag>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 200,
      fixed: "right",
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="编辑">
            <ReadonlyActionButton type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Tooltip title="关联学生">
            <ReadonlyActionButton type="text" size="small" icon={<UserAddOutlined />} onClick={() => handleAssociate(record)} />
          </Tooltip>
          <Tooltip title="取消关联">
            <ReadonlyActionButton
              type="text"
              size="small"
              icon={<UserDeleteOutlined />}
              onClick={() => handleDissociate(record)}
              disabled={(record.studentCount || 0) === 0}
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除这个班级吗？"
            description="只有没有关联学生的班级才能被删除"
            onConfirm={() => handleDelete(record)}
            okText="确定"
            cancelText="取消"
            disabled={(record.studentCount || 0) > 0}
          >
            <Tooltip title={(record.studentCount || 0) > 0 ? "请先取消所有学生关联" : "删除"}>
              <ReadonlyActionButton
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                disabled={(record.studentCount || 0) > 0}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const studentColumns: ColumnsType<StudentData> = [
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
      width: 180,
      render: (text) => text || <Text type="secondary">未设置</Text>,
    },
    {
      title: "学院",
      dataIndex: "colledge",
      key: "colledge",
      width: 120,
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
      title: "班级状态",
      dataIndex: "currentClass",
      key: "currentClass",
      width: 100,
      render: (text) => (
        <Tag color={text === "未分配" ? "default" : "blue"}>{text}</Tag>
      ),
    },
  ];

  if (!isSuperAdmin && !hasTenant()) {
    return (
      <Card>
        <Alert
          message="请先选择组织"
          description="班级管理需要在特定组织/租户下进行。请先选择一个组织。"
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
              <Space size={4} wrap>
                <Tag color="blue" style={{ fontSize: 11, padding: "0 6px" }}>
                  班级: {filteredClasses.length}
                </Tag>
                <Tag color="green" style={{ fontSize: 11, padding: "0 6px" }}>
                  学生: {classes.reduce((sum, c) => sum + (c.studentCount || 0), 0)}
                </Tag>
              </Space>
              <ReadonlyActionButton type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                添加班级
              </ReadonlyActionButton>
            </div>
            <Input
              placeholder="搜索班级..."
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
            dataSource={filteredClasses}
            rowKey="id"
            loading={isLoading}
            scroll={{ x: 800 }}
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
                <Space size={4} wrap>
                  <Tag color="blue" style={{ fontSize: 13 }}>
                    班级: {filteredClasses.length}
                  </Tag>
                  <Tag color="green" style={{ fontSize: 13 }}>
                    学生: {classes.reduce((sum, c) => sum + (c.studentCount || 0), 0)}
                  </Tag>
                  <Input
                    placeholder="搜索班级..."
                    prefix={<SearchOutlined />}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    style={{ width: 250 }}
                    allowClear
                  />
                </Space>
                <ReadonlyActionButton type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                  添加班级
                </ReadonlyActionButton>
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
          <MobileTableCard<ClassData>
            dataSource={filteredClasses}
            loading={isLoading}
            title={(r) => r.name}
            extra={(r) => (
              <Tag color={(r.studentCount || 0) > 0 ? "success" : "default"}>
                {r.studentCount || 0} 人
              </Tag>
            )}
            fields={(r) => [
              { label: "专业", value: r.major || <Text type="secondary">未设置</Text> },
            ]}
            actions={(r) => (
              <Space size={4} wrap>
                <ReadonlyActionButton size="small" type="text" icon={<EditOutlined />} onClick={() => handleEdit(r)}>
                  编辑
                </ReadonlyActionButton>
                <ReadonlyActionButton size="small" type="text" icon={<UserAddOutlined />} onClick={() => handleAssociate(r)}>
                  关联学生
                </ReadonlyActionButton>
                <ReadonlyActionButton
                  size="small"
                  type="text"
                  icon={<UserDeleteOutlined />}
                  onClick={() => handleDissociate(r)}
                  disabled={(r.studentCount || 0) === 0}
                >
                  取消关联
                </ReadonlyActionButton>
                <Popconfirm
                  title="删除班级？"
                  onConfirm={() => handleDelete(r)}
                  okText="确定"
                  cancelText="取消"
                  disabled={(r.studentCount || 0) > 0}
                >
                  <ReadonlyActionButton
                    size="small"
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    disabled={(r.studentCount || 0) > 0}
                  >
                    删除
                  </ReadonlyActionButton>
                </Popconfirm>
              </Space>
            )}
          />
        )}

        {!isMobile && (
          <Alert
            message="管理提示"
            description={
              <ul style={{ margin: "8px 0", paddingLeft: "20px" }}>
                <li>只有没有关联学生的班级才能被删除</li>
                <li>使用"关联学生"按钮将未分配的学生添加到班级</li>
                <li>使用"取消关联"按钮将学生从班级中移除</li>
              </ul>
            }
            type="info"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Card>

      <Modal
        title={selectedClass ? "编辑班级" : "创建新班级"}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setSelectedClass(null);
        }}
        footer={null}
        width="95%"
        style={{ maxWidth: 500 }}
        destroyOnHidden
      >
        <ClassForm
          classItem={selectedClass}
          onSubmit={handleSubmit}
          onCancel={() => {
            setModalOpen(false);
            setSelectedClass(null);
          }}
          loading={createClassMutation.isPending || updateClassMutation.isPending}
        />
      </Modal>

      <Modal
        title={`关联学生到班级: ${classForAssociate?.name}`}
        open={associateModalOpen}
        onCancel={() => {
          setAssociateModalOpen(false);
          setClassForAssociate(null);
          setSelectedStudents([]);
        }}
        onOk={handleConfirmAssociate}
        okText={`确认关联 (${selectedStudents.length})`}
        okButtonProps={{ disabled: selectedStudents.length === 0 }}
        width="95%"
        style={{ maxWidth: 900 }}
      >
        <div style={{ marginBottom: 16 }}>
          <Text>学生总数: {filteredAllStudents.length} 人</Text>
          {selectedStudents.length > 0 && (
            <Tag color="blue" style={{ marginLeft: 8 }}>
              已选择 {selectedStudents.length} 名
            </Tag>
          )}
        </div>
        <Table
          columns={studentColumns}
          dataSource={filteredAllStudents}
          rowKey="id"
          rowSelection={{
            selectedRowKeys: selectedStudents,
            onChange: (keys) => setSelectedStudents(keys as string[]),
          }}
          size="small"
          scroll={{ x: 800 }}
          pagination={{ pageSize: 10, simple: isMobile }}
        />
      </Modal>

      <Modal
        title={`取消关联学生: ${classForDissociate?.name}`}
        open={dissociateModalOpen}
        onCancel={() => {
          setDissociateModalOpen(false);
          setClassForDissociate(null);
          setSelectedStudents([]);
        }}
        onOk={handleConfirmDissociate}
        okText={`确认取消关联 (${selectedStudents.length})`}
        okButtonProps={{ disabled: selectedStudents.length === 0 }}
        width="95%"
        style={{ maxWidth: 800 }}
      >
        <div style={{ marginBottom: 16 }}>
          <Text>当前班级共有 {classStudents.length} 名学生</Text>
          {selectedStudents.length > 0 && (
            <Tag color="warning" style={{ marginLeft: 8 }}>
              已选择 {selectedStudents.length} 名进行取消关联
            </Tag>
          )}
        </div>
        <Table
          columns={studentColumns.slice(0, -1)}
          dataSource={classStudents}
          rowKey="id"
          rowSelection={{
            selectedRowKeys: selectedStudents,
            onChange: (keys) => setSelectedStudents(keys as string[]),
          }}
          size="small"
          scroll={{ x: 600 }}
          pagination={{ pageSize: 10, simple: isMobile }}
          loading={classStudentsLoading}
        />
      </Modal>
    </div>
    </TenantLayout>
  );
}
